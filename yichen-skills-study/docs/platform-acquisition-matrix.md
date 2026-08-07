# 平台搜索、读取与下载技术矩阵

> 本矩阵来自上游公开文档和脚本审计，没有在当前环境执行登录态或平台抓取。它用于路线选择，不代表接口长期稳定，也不代表平台全量覆盖。

## 总表

| 信息源 | 搜索/发现 | 登录要求 | 已知内容读取 | 媒体下载 | 关键技术与限制 |
|---|---|---|---|---|---|
| 公共网页/新闻 | AnySearch；普通、批量、垂直域和 `site:` | 通常匿名 | Jina Reader / Web Reader | 保存指定URL的Markdown、HTML、文本或原始响应 | 不扩展站点、sitemap、相关推荐；摘要不是正文证据 |
| GitHub | `gh search repos/code/issues/prs` | 公共数据匿名；额度不足再登录 | 网页读取或GitHub工具 | 上游没有专用仓库归档链 | 结构化搜索强；搜索阶段不clone、不修改 |
| 微信公众号 | `opencli weixin search`，公开搜狗微信路线 | 跨号关键词匿名 | 已知文章走公众号 exporter | Markdown/JSON/文本/HTML | 指定公众号历史需本地 exporter 与当轮授权；不控制微信 UI |
| 小红书 | `opencli xiaohongshu search` | 站内搜索需当轮 Chrome 授权 | 匿名请求页面，解析 `window.__INITIAL_STATE__`，失败回退 meta | 图片、视频、字幕；匿名失败后可授权 Cookie 重试 | 可取标题、作者、标签、互动量、媒体和章节；页面结构和风控敏感 |
| 抖音 | `opencli douyin search` | 站内搜索需当轮 Chrome 授权 | Playwright 打开已知视频页并监听网络响应 | 从 `aweme/detail` 取得播放地址后下载视频 | 低频串行；不在搜索阶段展开评论或下载 |
| 今日头条 | `opencli toutiao search` | 独立匿名 profile | 可按普通网页尝试 | 无专用下载器 | 只保留文章和非视频图文；单关键词、低频、不自动重试 |
| X/Twitter | Grok CLI原生XSearch；明确额度耗尽后才进入 FxTwitter → OpenCLI → xreach | Grok OAuth；匿名或登录回退分层 | 已知URL先匿名 FxTwitter，再按需 Jina | 通用归档器不下载媒体；X Slicer可处理自身需要的公开媒体 | 可还原Post、Quote、Article与同作者Thread；非官方路线可能变化 |
| B站 | `bili search` | 匿名优先 | `bili video <BV/URL> --json` | `yt-dlp`；可续传、防覆盖 | 高画质、会员、地区或年龄限制目标需单独Cookie授权 |
| YouTube | `yt-dlp --flat-playlist "ytsearchN:query"` | 匿名优先 | `yt-dlp --dump-json <URL>` | `yt-dlp`下载音视频/字幕 | 播放列表先平铺为固定清单；不从条目扩展推荐或频道 |
| 小宇宙 | AnySearch `site:xiaoyuzhoufm.com` | 全站发现匿名 | 解析已知episode页面 | 验证 `xyzcdn.net` 后下载音频 | 精确播客列表需要当轮令牌授权；付费ASR需另行确认 |
| 私人收藏/书签 | 不属于搜索 | 小红书/抖音复用授权Chrome；X依赖外部CLI | 只导出URL文件 | 不自动下载 | 授权按平台和当前任务限定；导出授权不能转移给归档 |

## 技术差异说明

### 小红书：页面状态解析

1. 只接受小红书 HTTPS URL。
2. 匿名请求页面并识别笔记 ID。
3. 从 `window.__INITIAL_STATE__` 的 `noteDetailMap` 提取结构化笔记。
4. 解析标题、作者、标签、互动指标、图片、视频流、字幕和章节。
5. 状态缺失时回退 OpenGraph/meta，只保留有限字段。
6. Cookie 只在匿名失败且用户当轮授权后注入。
7. 输出目录冲突时创建 `-run-N`。

### 抖音：浏览器网络拦截

1. 将短链或多种URL规范为视频详情页。
2. 启动独立 Playwright Chromium。
3. 监听页面产生的 `aweme/detail` 响应。
4. 从 `aweme_detail.video` 选择播放或下载地址。
5. 生成不包含临时媒体直链的元数据文件。
6. 使用流式HTTP下载已知视频，冲突时生成新文件名。

### X：搜索和已知对象解析分开

- 关键词发现：Grok原生XSearch优先；只有明确账号额度耗尽才使用匿名公共索引。
- 已知Status：FxTwitter读取正文、作者、指标、引用和内嵌Article。
- 已知Article ID：最多一次有限搜索，只接受 `article.id` 精确相等的父Status，再还原正文。
- 匿名结果不完整：先说明缺口，再针对当前链接请求登录态回退授权。
- X Slicer只为视觉切片下载允许域名上的公开图片/视频，不是通用X媒体归档器。

### 公众号：公共发现和账号历史分开

- 跨公众号关键词通过公开索引发现文章候选。
- 已知文章URL可下载成Markdown、JSON、文本或HTML。
- 指定公众号历史属于精确容器枚举，需要本地loopback exporter和当前任务授权。
- 登录失效时必须由用户本人扫码和手机确认，Agent不操作微信客户端。

### B站与YouTube：枚举和下载分开

搜索或播放列表首先使用flat模式生成固定URL清单，随后只处理清单内项目。下载阶段使用断点续传、防覆盖和下载档案，禁止从视频继续扩展相关推荐、频道或私人列表。

### 小宇宙：网页索引和音频主机白名单

全站关键词发现依赖公共网页索引；已知episode则解析页面音频URL，并只接受HTTPS的小宇宙episode域名和 `xyzcdn.net` 媒体主机。下载、转写和付费额度是三个独立动作。

## 建议的内部统一接口

未来若正式接入，应让所有平台适配器输出同一候选对象：

```json
{
  "platform": "xiaohongshu",
  "source_id": "stable-platform-id",
  "query": "原始查询",
  "canonical_url": "https://...",
  "title": "标题",
  "author": "作者",
  "published_at": null,
  "content_type": "video",
  "metrics": {},
  "access": {"visibility": "public", "login_state_used": false},
  "verification": {"status": "candidate", "opened_original": false},
  "provenance": {"backend": "adapter-name", "retrieved_at": "RFC3339"},
  "limitations": []
}
```

正式下载应另建任务对象，不能仅靠候选对象自动触发。
