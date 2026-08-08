# AIComicBuilder + Codex 样例生产指南

本文记录本次实测采用的安全生产方式。它既适用于内置视频 Provider，也适用于只有第三方网页账户、没有视频 API 的情况。

## 1. 安装与启动

Windows 需要：

- Node.js 18+
- pnpm
- FFmpeg（需要在 PATH 中）

```powershell
pnpm install
pnpm drizzle-kit push
pnpm dev:subproject
```

默认子项目地址：<http://127.0.0.1:3100>。

## 2. 配置 MiniMax

把 `.env.example` 中需要的变量复制到 `.env.local`，不要提交 `.env.local`。

国际站示例：

```dotenv
COMIC_PROVIDER_PROFILE_ID=default
MINIMAX_API_KEY=replace-with-your-key
MINIMAX_BASE_URL=https://api.minimax.io/v1
MINIMAX_TEXT_MODEL=MiniMax-M3
MINIMAX_IMAGE_MODEL=image-01
```

中国大陆账户使用：

```dotenv
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
```

MiniMax M3 用于文本、图片理解和视频理解；它本身不生成视频。`image-01`、语音、音乐和视频分别属于独立模型。

## 3. 配置 Codex 控制入口

在本地浏览器控制台读取当前用户 ID：

```js
localStorage.getItem("ai_comic_uid")
```

写入 `.env.local`：

```dotenv
COMICCTL_BASE_URL=http://127.0.0.1:3100
COMICCTL_USER_ID=replace-with-local-user-id
COMICCTL_PROVIDER_PROFILE=default
```

检查连接：

```powershell
pnpm comicctl -- profiles
pnpm comicctl -- project list
```

API Key 不允许作为 CLI 参数，也不应出现在聊天、提示词、日志或 Git 提交中。

## 4. Codex 标准驱动流程

### 4.1 建立项目与分集

```powershell
pnpm comicctl -- project create --title "样例名称"
pnpm comicctl -- episode create --project PROJECT_ID --title "第1集"
pnpm comicctl -- status --project PROJECT_ID
```

### 4.2 只计划，不调用模型

把动作参数保存在临时 JSON 文件中：

```json
{
  "idea": "一个30秒、9:16、恰好6镜头的短故事",
  "shotCount": 6,
  "targetDuration": 30
}
```

```powershell
pnpm comicctl -- run plan --project PROJECT_ID --episode EPISODE_ID --action script_outline --payload-file .tmp/outline.json
```

默认返回 dry-run，不产生模型费用。

### 4.3 审批和执行

```powershell
pnpm comicctl -- run plan --project PROJECT_ID --episode EPISODE_ID --action script_outline --payload-file .tmp/outline.json --live
pnpm comicctl -- run approve RUN_ID
pnpm comicctl -- run execute RUN_ID
pnpm comicctl -- run get RUN_ID
```

执行完成后重新读取项目/分集状态，不依据上一条聊天消息假设数据库已更新。

### 4.4 推荐阶段顺序

1. `script_outline`
2. 审批故事结构
3. `script_generate`
4. `character_extract`
5. 审批角色身份和服装
6. `shot_split`
7. 审批镜头数、总时长和对白
8. `generate_keyframe_prompts`
9. `single_frame_generate`
10. 审批一个镜头的首尾帧
11. `single_video_prompt`
12. 单个视频生成或外部网页接力
13. 抽帧审查并导入
14. 其余镜头小批量生产
15. 确认 N/N 后 `video_assemble`

## 5. 外部网页视频接力

适用于已经登录 ChatArt Pro 等网页、但没有可配置视频 API 的情况。

在镜头卡片或抽屉中：

1. 复制视频提示词；
2. 下载首帧和尾帧；
3. 打开外部网页；
4. 选择正确画幅和时长；
5. 上传参考图片；
6. 生成并下载本地视频；
7. 回到 AIComicBuilder；
8. 上传 MP4/WebM/MOV；
9. 等待镜头资产刷新；
10. 预览并检查历史版本。

首选 MP4、H.264 视频和 AAC 音频。导入接口默认限制 250MB，可用 `MAX_IMPORTED_VIDEO_BYTES` 调整。

## 6. 两个实测样例

### 样例一：库内流水线

![样例一封面](samples/sample-01-poster.jpg)

- [播放/下载 MP4](samples/sample-01-aicomicbuilder-pipeline.mp4)
- 31.05秒，6镜，9:16
- 动画人物、雨夜室内、画纸上的发光星星
- 主要验证：现有项目流程、逐镜外接视频、导入、声音和拼接

### 样例二：ChatGPT 主创

![样例二封面](samples/sample-02-poster.jpg)

- [播放/下载 MP4](samples/sample-02-chatgpt-directed.mp4)
- 20.77秒，4镜，9:16
- 铜质幼苗机器人、雨夜温室、空盆发芽
- 主要验证：ChatGPT 负责故事/导演/美术，项目负责资产和执行，外部模型负责运动

## 7. 提示词原则

每个 5 秒镜头建议：

- 一个连续机位；
- 最多一个主要运镜；
- 1–2 个动作节拍；
- 不增加画外人物、道具、天气或地点；
- 列出必须保持不变的身份特征；
- 明确禁止动作，不用抽象形容词代替行为。

示例结构：

```text
5秒固定中近景。
主体从A状态执行一个动作，到B状态结束。
保持人物身份、服装、场景和道具不变。
环境音……；无对白。
禁止新增主体、换脸、镜头跳动和额外动作。
```

## 8. 首尾帧与单图模式

### 首尾帧适用

- 物体位置确实需要从 A 到 B；
- 两帧构图、人物身份和光线高度一致；
- 动作可以被连续插值；
- 人脸不是主要变化区域。

### 单图模式更适用

- 真人近景；
- 只需要呼吸、眨眼、头发或雨水等微动；
- 想最大化身份稳定；
- 首尾图来自两次独立生成，脸部存在细微差异。

不要用两张独立生成的人脸去插值眼神和微表情。眼神变化优先通过切镜表达。

## 9. 审片清单

### 图片

- 脸、年龄、发型、痣、眼镜；
- 服装颜色、袖口、鞋、包带和饰品；
- 场景结构、门窗、柜台和固定道具；
- 人数、手指、文字和道具数量；
- 首尾帧是否真的是同一个连续机位。

### 视频

- 0秒、25%、50%、75%和结束帧；
- 人脸是否渐变、闪烁或突然变形；
- 手、眼球、口型和遮挡；
- 是否出现新人物、新花朵或新道具；
- 声音是否存在、是否爆音、对白是否正确；
- 实际时长、画幅、帧率和编码。

### 合成前

- 完成视频数必须等于镜头总数；
- 所有镜头属于同一分集和分镜版本；
- 视频编码、分辨率和帧率一致；
- 需要保留原声时，第一版全部使用硬切；
- 已接受镜头不能被“重新生成所有”意外覆盖。

## 10. 失败处理

优先级从高到低：

1. 判断是否是导演方案不适合模型；
2. 减少动作和角色；
3. 改为单图模式或切镜；
4. 更换参考图；
5. 更换 Provider；
6. 最后才是增加提示词长度。

同一镜头连续失败两次后停止付费重试，先报告失败类型和新的导演方案。

## 11. 完成报告格式

每次 Codex 执行后应报告：

```text
当前阶段：
完成/总数：
成功资产：
失败与重试：
质量问题：
费用相关调用：
下一步审批：
```

完整控制和扩展说明见 [`CAPABILITY_CONTROL_ARCHITECTURE.md`](CAPABILITY_CONTROL_ARCHITECTURE.md)。
