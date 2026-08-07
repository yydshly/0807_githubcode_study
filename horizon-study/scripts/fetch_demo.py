"""Run Horizon's real fetch and URL-dedup stages without requiring an AI key."""

from __future__ import annotations

import argparse
import asyncio
import html
import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path


STUDY_DIR = Path(__file__).resolve().parents[1]
UPSTREAM_DIR = STUDY_DIR / "upstream"
sys.path.insert(0, str(UPSTREAM_DIR))

from src.orchestrator import HorizonOrchestrator  # noqa: E402
from src.storage.manager import StorageManager  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch live items with Horizon and render a local inspection page."
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=STUDY_DIR / "data" / "config.json",
    )
    parser.add_argument("--hours", type=int, default=None)
    return parser.parse_args()


def render_markdown(items, outcomes, fetched_count: int, generated_at: datetime) -> str:
    counts = Counter(item.source_type.value for item in items)
    lines = [
        "# Horizon 原始采集演示",
        "",
        f"- 运行时间：{generated_at.astimezone().isoformat(timespec='seconds')}",
        f"- 抓取总数：{fetched_count}",
        f"- URL 去重后：{len(items)}",
        "- AI 状态：未调用（当前演示只验证真实来源采集、统一建模和 URL 去重）",
        "",
        "## 来源结果",
        "",
        "| 来源 | 状态 | 条目数 | 错误 |",
        "|---|---:|---:|---|",
    ]
    for outcome in outcomes:
        error = (outcome.error or "").replace("|", "\\|")
        lines.append(
            f"| {outcome.source_name} | {outcome.status} | {len(outcome.items)} | {error} |"
        )
    lines.extend(["", "## 去重后来源分布", ""])
    for source, count in sorted(counts.items()):
        lines.append(f"- {source}: {count}")
    lines.extend(
        [
            "",
            "## 条目预览",
            "",
            "| 时间（UTC） | 来源 | 标题 | Profile |",
            "|---|---|---|---|",
        ]
    )
    for item in sorted(items, key=lambda value: value.published_at, reverse=True):
        title = item.title.replace("|", "\\|").replace("\n", " ")
        url = str(item.url)
        profile = item.profile if isinstance(item.profile, str) else json.dumps(item.profile, ensure_ascii=False)
        lines.append(
            f"| {item.published_at.isoformat(timespec='minutes')} | {item.source_type.value} "
            f"| [{title}]({url}) | {profile or 'auto'} |"
        )
    return "\n".join(lines) + "\n"


def render_html(items, outcomes, fetched_count: int, generated_at: datetime) -> str:
    counts = Counter(item.source_type.value for item in items)
    source_cards = "".join(
        f"<article><strong>{html.escape(outcome.source_name)}</strong>"
        f"<span class='{html.escape(outcome.status)}'>{html.escape(outcome.status)}</span>"
        f"<b>{len(outcome.items)}</b>"
        f"<small>{html.escape(outcome.error or ('未返回条目；需结合日志判断' if outcome.status == 'empty' else '正常完成'))}</small></article>"
        for outcome in outcomes
    )
    item_cards = "".join(
        "<article class='item'>"
        f"<div><span>{html.escape(item.source_type.value)}</span>"
        f"<time>{html.escape(item.published_at.isoformat(timespec='minutes'))}</time></div>"
        f"<h2><a href='{html.escape(str(item.url), quote=True)}' target='_blank' rel='noreferrer'>"
        f"{html.escape(item.title)}</a></h2>"
        f"<p>{html.escape((item.content or '无正文摘要')[:360])}</p>"
        f"<footer>profile: {html.escape(str(item.profile or 'auto'))}</footer>"
        "</article>"
        for item in sorted(items, key=lambda value: value.published_at, reverse=True)
    )
    distribution = " · ".join(
        f"{html.escape(source)} {count}" for source, count in sorted(counts.items())
    )
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Horizon 原始采集演示</title>
<style>
:root{{--paper:#f7f3ea;--ink:#172026;--muted:#657078;--line:#d8d1c4;--accent:#e05d32}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 system-ui,sans-serif}}
main{{max-width:1120px;margin:auto;padding:48px 24px 80px}}h1{{font:700 clamp(2rem,6vw,4.5rem)/1.02 Georgia,serif;margin:.15em 0}}
.eyebrow{{color:var(--accent);font-weight:700;letter-spacing:.1em}}.note{{max-width:760px;color:var(--muted)}}
.metrics{{display:flex;gap:24px;margin:30px 0;border-block:1px solid var(--line);padding:18px 0}}.metrics b{{font-size:1.8rem;display:block}}
.sources{{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:22px 0 44px}}.sources article,.item{{border:1px solid var(--line);background:#fffdf8;padding:16px}}
.sources article{{display:grid;grid-template-columns:1fr auto;gap:2px 8px}}.sources span{{border-radius:999px;padding:0 8px;font-size:.75rem;background:#e6ece9}}.sources span.failure{{background:#f9d8d1}}.sources b{{font-size:1.5rem}}.sources small{{grid-column:1/-1;color:var(--muted);overflow-wrap:anywhere}}
.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}.item{{min-width:0;overflow-wrap:anywhere}}.item div,.item footer{{display:flex;justify-content:space-between;color:var(--muted);font-size:.8rem}}.item div span{{color:var(--accent);font-weight:700;text-transform:uppercase}}
.item h2{{font:700 1.2rem/1.3 Georgia,serif}}a{{color:inherit}}.item p{{color:#3b464c;white-space:pre-line}}.item footer{{border-top:1px solid var(--line);padding-top:10px}}
@media(max-width:700px){{.grid{{grid-template-columns:1fr}}.metrics{{flex-wrap:wrap}}}}
</style></head><body><main>
<div class="eyebrow">LIVE FETCH · NO AI</div><h1>Horizon 原始采集演示</h1>
<p class="note">这是真实来源采集、统一 ContentItem 建模和保守 URL 去重的结果。当前机器没有模型 API Key，因此没有冒充完成 AI 评分、语义去重或内容增强。</p>
<section class="metrics"><div><b>{fetched_count}</b>抓取条目</div><div><b>{len(items)}</b>URL 去重后</div><div><b>{len(counts)}</b>有效来源类型</div></section>
<p>{html.escape(distribution)}</p><p class="note">生成时间：{html.escape(generated_at.astimezone().isoformat(timespec='seconds'))}</p>
<h2>来源执行结果</h2><section class="sources">{source_cards}</section>
<h2>实际抓取内容</h2><section class="grid">{item_cards}</section>
</main></body></html>"""


async def run() -> None:
    args = parse_args()
    if not args.config.exists():
        raise SystemExit(
            f"配置不存在：{args.config}\n请先复制 data/config.example.json 为 data/config.json。"
        )
    storage = StorageManager(
        data_dir=str(STUDY_DIR / "data"),
        config_path=str(args.config),
    )
    config = storage.load_config()
    orchestrator = HorizonOrchestrator(config, storage)
    hours = args.hours or config.collection.time_window_hours
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    fetched = await orchestrator.fetch_all_sources(since)
    merged = orchestrator.merge_cross_source_duplicates(fetched)
    generated_at = datetime.now(timezone.utc)

    output_dir = STUDY_DIR / "demo-output"
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "raw-items.json").write_text(
        json.dumps([item.model_dump(mode="json") for item in fetched], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    outcomes = orchestrator.last_fetch_report.outcomes if orchestrator.last_fetch_report else []
    (output_dir / "fetch-report.md").write_text(
        render_markdown(merged, outcomes, len(fetched), generated_at), encoding="utf-8"
    )
    (output_dir / "index.html").write_text(
        render_html(merged, outcomes, len(fetched), generated_at), encoding="utf-8"
    )
    print(f"Fetched {len(fetched)} items; {len(merged)} after URL deduplication.")
    print(f"Report: {output_dir / 'fetch-report.md'}")
    print(f"Preview: {output_dir / 'index.html'}")


if __name__ == "__main__":
    asyncio.run(run())
