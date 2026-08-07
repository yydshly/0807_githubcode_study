# Skill 能力地图与处理链路

## 能力分层

| 层级 | 代表 Skill | 主要职责 | 技术实质 | 本项目判断 |
|---|---|---|---|---|
| 研究路由 | `yichen-web-research` | 搜索、归档、收藏、ASR之间分流 | SOP与权限边界 | 值得参考架构 |
| 搜索发现 | `yichen-unified-search`、`yichen-grok-consult` | 多平台搜索和候选标准化 | 外部搜索后端 + 路由规则 | 平台差异最有价值 |
| 已知内容 | `yichen-content-archive` | 读取、下载、归档已知URL/容器 | 平台脚本、CLI、manifest | 值得参考接口与恢复设计 |
| 私人集合 | `yichen-bookmarks-export` | 导出收藏/书签URL | 浏览器滚动或外部CLI | 高敏感，按需专项研究 |
| 转写 | `yichen-asr`、`yichen-volc-asr` | 全文、时间戳、SRT、粗剪 | Step/豆包ASR + ffmpeg | 通用能力，当前不深入 |
| 内容分析 | `yichen-video-content` | 对标视频十三模块拆解 | 大模型提示框架 | 可参考，不是独有算法 |
| 视觉再包装 | `yichen-x-slicer` | X帖子转图片和固定视频 | Node/Playwright/ffmpeg | 特定场景完整，通用性有限 |
| 草稿与操作 | X Article、企微、剪映 Skills | 草稿上传和应用交接 | 浏览器或官方CLI | 依赖具体工作流，低优先级 |
| 知识沉淀 | `yichen-summary`、`yichen-agent-memory` | Obsidian笔记和长期记忆 | Markdown + SQLite FTS + 可选向量 | 通用基础设施，按需借鉴 |
| 本地私有数据 | 微信/企微Local Vault | 读取本人本地数据库 | 密钥提取、SQLCipher解密 | macOS限定且高敏感，不接入 |

## 处理链路

```text
用户研究目标
  ↓
平台路由与只读体检
  ↓
搜索候选（不下载）
  ↓
URL/稳定ID去重、来源与限制记录
  ↓
用户确认候选或提供已知链接
  ↓
正文/元数据读取 与 媒体下载分开执行
  ↓
archive-manifest + run-summary + failures
  ↓
按需ASR、内容分析、视觉切片或草稿上传
  ↓
Markdown/Obsidian/Agent Memory沉淀
```

## 抓取后的产物

```text
archive-root/
├── archive-manifest.jsonl
├── run-summary.json
├── failures.json
└── platform/content-id/
    ├── metadata.json
    ├── content.md
    ├── source.html
    ├── images/
    ├── video.mp4
    ├── audio.mp3
    ├── subtitles.srt
    └── transcript.txt
```

这套结构的价值在于让Web页面、搜索索引、AI分析、人工审核和发布工具消费同一种产物，而不是让每个平台的脚本直接耦合下游。

## 内容再创作的真实范围

核心仍是文案和结构处理：转写口播、识别标题公式、前五秒钩子、爆点、逐句作用、结构、表达效率、素材和可模仿模板，再由大模型结合新主题生成新文案。

最终视频能力只在两个有限方向存在：

- 豆包ASR时间戳 + ffmpeg生成口播粗剪，最终仍交给剪映精修。
- X Slicer把X帖子生成固定3:4模板图片和视频，不是通用视频生产引擎。

因此不应把该仓库描述为完整AI视频创作系统。

## 对未来Web工作台的启发

```text
平台适配器
→ 统一候选数据库
→ 原文核验与选择
→ 下载队列和归档
→ 媒体预览与字幕联动
→ AI分析与跨来源聚类
→ 人工编辑审核
→ 平台草稿与知识库
```

上游主要解决了前半段的规则和部分执行脚本；统一Web管理后台、跨平台实体关联、事实图谱、多来源原创写作和多渠道发布仍需自行建设。
