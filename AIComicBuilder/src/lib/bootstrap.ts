import { runMigrations } from "@/lib/db";
import { initializeProviders } from "@/lib/ai/setup";
import { registerPipelineHandlers } from "@/lib/pipeline";
import { startWorker } from "@/lib/task-queue";
import { recoverInterruptedRuns } from "@/lib/orchestrator/service";

let bootstrapped = false;

export async function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;

  console.log("[Bootstrap] Running database migrations...");
  runMigrations();

  const recoveredRuns = await recoverInterruptedRuns();
  if (recoveredRuns > 0) {
    console.log(`[Bootstrap] Recovered ${recoveredRuns} interrupted orchestrator run(s).`);
  }

  console.log("[Bootstrap] Initializing AI providers...");
  initializeProviders();

  console.log("[Bootstrap] Registering pipeline handlers...");
  registerPipelineHandlers();

  console.log("[Bootstrap] Starting task worker...");
  startWorker();

  console.log("[Bootstrap] Ready.");
}
