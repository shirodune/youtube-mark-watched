# SPEC — YouTube Mark as Watched

> 唯一的规格文件。描述扩展**应该**做什么。改行为时先改这里，再改代码和测试。
> 验收条目带编号（如 `B3`），测试和提交信息里引用它们。

## 1. 目标

Chrome 扩展（MV3）。在 YouTube 缩略图上加一个"标记为已看"按钮，点击后把视频写进
**用户账号原生的观看记录**（服务端状态：跨设备同步、出现在 `/feed/history`、缩略图显示红色进度条）。
不是本地遮罩，不维护本地数据库。

## 2. 范围

| 生效 | 不生效 |
| --- | --- |
| 首页 `/` | 搜索 `/results` |
| 订阅 `/feed/subscriptions` | Shorts（`/shorts/` 链接） |
| 频道页 `/@…` `/channel/…` `/c/…` `/user/…` | 广告卡片 |
| 观看页侧栏 `/watch` | 其他所有路径 |
| 播放列表 `/playlist`（含稍后观看 `list=WL`） | |
| 观看记录 `/feed/history` | |
| 「你」页面 `/feed/you` | |

## 3. 行为（验收条目）

**按钮**
- **B1** 每个指向 `/watch?v=<id>` 且含缩略图图片的链接，注入一个按钮（放在 `<a>` 里面：只有它的盒子正好是缩略图）；
  同一链接只有一个按钮，YouTube 重新渲染丢掉按钮后，下次扫描补回。
- **B2** 按钮平时隐藏，悬停缩略图（或键盘聚焦到缩略图链接内）时显示；`aria-label="Mark as watched"`。
  位置：左上角，40px 圆形（与内联预览的原生按钮同尺寸）；缩略图宽度 ≤ 300px（如观看页侧栏）用 28px 小按钮。
  悬停后 YouTube 弹出的内联预览（`ytd-video-preview`）会盖住缩略图，预览上也要显示按钮。
- **B3** 无限滚动、SPA 跳转（`yt-navigate-finish`）后的新缩略图也会注入（MutationObserver；首个变更后 250ms 扫描一次，持续变更不会推迟扫描——观看记录页每 250ms 就有变更，防抖会被饿死）。
- **B4** 广告卡片（含 `ad-badge-view-model`）、非缩略图的标题链接不注入。

**点击**
- **C1** 未登录（顶栏有登录入口）→ 提示 "Sign in to mark videos as watched"，不发请求。
- **C2** 已登录 → 立即在缩略图底部显示红条、按钮变为已完成状态（乐观反馈），后台写入原生记录。
- **C3** 写入失败 → 移除红条、恢复按钮、提示 "Couldn’t mark as watched"。
- **C4** 同一视频请求进行中时重复点击被忽略。
- **C5** 红条只在本次页面浏览中存在；刷新后不重新应用，由 YouTube 自己的进度条接管。
- **C6** YouTube 会复用卡片和内联预览元素（换 `href` 不换节点）：点击时按链接**当前**的 `href` 取视频 ID；
  `href` 变化后红条和按钮状态跟着新视频同步（同一视频的所有缩略图状态一致）。

## 4. 写入机制（已由 2026-05-30 spike 在真实账号上验证）

YouTube 没有写观看记录的公开 API（Data API v3 自 2016 年起不支持 `HL` 列表）。
只能复刻播放器的上报。全部在 content script 里 `fetch(..., { credentials: 'include' })`
（`/watch` 同源；ping 发往 `s.youtube.com`，YouTube 的 CORS 允许 `www.youtube.com` 带 cookie 访问）：

1. `GET /watch?v=<id>`，从 HTML 中提取 `ytInitialPlayerResponse`，读取
   `playbackTracking.videostatsPlaybackUrl.baseUrl`、`videostatsWatchtimeUrl.baseUrl`、`videoDetails.lengthSeconds`。
2. 生成 16 位 `cpn`（字符集 `A-Za-z0-9-_`）。
3. playback ping：`playbackUrl + ver=2&cpn=<cpn>&cmt=0`。
4. 把 `0→时长` 切成约 4 段，逐段发 watchtime ping：`ver=2&cpn&cmt=<et>&st&et&state=playing`；
   **最后一段** `state=paused&final=1`（提交观看位置）。
5. 任一响应非 2xx → 失败。

已知事实：
- 只发一次瞬时 ping → 有历史记录但进度条只有 ~10%；分段 + `final=1` → 100%。
- 分段之间不需要真实等待，连续发送即可。
- 生效有延迟（几十秒），这是采用乐观反馈的原因。
- 首映 / 即将开播的视频没有 `playbackTracking`，会走 C3。

## 5. 非目标

设置页、批量标记、Shorts / 搜索页支持、本地持久化、跨浏览器构建、针对线上 YouTube 的自动化 E2E。

## 6. 约束与风险

- 依赖 YouTube 未公开的接口和 DOM（新旧组件 `ytd-*` / `yt-*-view-model` 并存），随时可能失效。
- 这种自动化违反 YouTube 服务条款；仅供个人使用，用户已知情接受。
- 最小权限：不申请任何 `permissions` / `host_permissions`，content script 只匹配 `https://www.youtube.com/*`
  （MV3 content script 的请求按页面身份走 CORS，不使用扩展的 host 权限，见 §4）。不收集、不外传任何数据。

## 7. 工程

- 技术栈：WXT（Vite）+ TypeScript + Vitest + Biome（lint/格式化），包管理用 Bun；GitHub Actions 跑 `check` 和 `build`。
- `src/entrypoints/content.ts` 入口；`src/page`（范围判断）、`src/dom`（查找/注入/样式）、
  `src/engine`（写入机制，对外只暴露 `markWatched(videoId): Promise<{ ok; error? }>`）、`src/ui`（toast）。
- 纯逻辑（`page`、`dom`、`engine`）必须有单元测试；`tests/` 镜像 `src/` 目录。

| 命令 | 作用 |
| --- | --- |
| `bun install` | 安装依赖（会自动 `wxt prepare`） |
| `bun run dev` | 开发构建到 `.output/chrome-mv3-dev`，改代码自动重载扩展 |
| `bun run build` | 生产构建到 `.output/chrome-mv3` |
| `bun run zip` | 打包上架用 zip |
| `bun run test` | 单元测试（注意不是 `bun test`） |
| `bun run format` | Biome 格式化并自动修复 |
| `bun run check` | lint + typecheck + 测试（CI 同款，提交前跑） |

## 8. 手动验收（在已登录的真实 Chrome 中，可由 Claude in Chrome 执行）

1. 首页、订阅、频道页、观看页侧栏、播放列表（含稍后观看）、观看记录、「你」页面：悬停出现按钮（B1、B2）；搜索页不出现。
2. 向下滚动后新卡片也有按钮（B3）。
3. 选一个没看过的短视频点击：立即出现红条（C2）；约 1 分钟后 `/feed/history` 里出现该视频。
4. 对一个首映视频点击：红条消失并出现失败提示（C3）。

> 第 3 步会写入真实观看记录，执行前需用户确认。
