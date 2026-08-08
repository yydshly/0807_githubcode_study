import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cliPath = path.resolve("scripts/comicctl.mjs");

async function runCli(args, env = {}) {
  return execFileAsync(process.execPath, [cliPath, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
  });
}

async function withMockServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("help is available without configuration", async () => {
  const { stdout } = await runCli(["--help"]);
  assert.match(stdout, /local Codex control surface/);
  assert.match(stdout, /default is dry-run/);
});

test("secret-looking command-line flags are rejected", async () => {
  await assert.rejects(
    runCli(["project", "list", "--api-key", "do-not-store"]),
    (error) => {
      assert.match(error.stderr, /Secrets are not accepted/);
      return true;
    },
  );
});

test("project list sends the local user ID and prints JSON", async () => {
  await withMockServer((request, response) => {
    assert.equal(request.url, "/api/projects");
    assert.equal(request.headers["x-user-id"], "test-user");
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify([{ id: "project-1", title: "Pilot" }]));
  }, async (baseUrl) => {
    const { stdout } = await runCli(["project", "list"], {
      COMICCTL_BASE_URL: baseUrl,
      COMICCTL_USER_ID: "test-user",
    });
    assert.deepEqual(JSON.parse(stdout), [{ id: "project-1", title: "Pilot" }]);
  });
});

test("run plan is dry-run and approval-gated by default", async () => {
  await withMockServer((request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/orchestrator/runs");
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body);
      assert.equal(parsed.projectId, "project-1");
      assert.equal(parsed.action, "script_outline");
      assert.equal(parsed.providerProfileId, "default");
      assert.equal(parsed.dryRun, true);
      assert.equal(parsed.requiresApproval, true);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: "run-1", status: "awaiting_approval" }));
    });
  }, async (baseUrl) => {
    const { stdout } = await runCli(
      ["run", "plan", "--project", "project-1", "--action", "script_outline"],
      {
        COMICCTL_BASE_URL: baseUrl,
        COMICCTL_USER_ID: "test-user",
        COMICCTL_PROVIDER_PROFILE: "default",
      },
    );
    assert.equal(JSON.parse(stdout).id, "run-1");
  });
});

test("loads non-secret CLI settings from an env file", async () => {
  await withMockServer((request, response) => {
    assert.equal(request.url, "/api/projects");
    assert.equal(request.headers["x-user-id"], "env-file-user");
    response.setHeader("content-type", "application/json");
    response.end("[]");
  }, async (baseUrl) => {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "comicctl-env-"));
    const envFile = path.join(tempDirectory, ".env.local");
    try {
      await fs.writeFile(
        envFile,
        `COMICCTL_BASE_URL=${baseUrl}\nCOMICCTL_USER_ID=env-file-user\n`,
        "utf8",
      );
      const { stdout } = await runCli(["project", "list"], {
        COMICCTL_ENV_FILE: envFile,
        COMICCTL_BASE_URL: "",
        COMICCTL_USER_ID: "",
      });
      assert.deepEqual(JSON.parse(stdout), []);
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
