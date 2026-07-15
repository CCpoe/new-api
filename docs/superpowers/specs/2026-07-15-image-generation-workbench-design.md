# 生成图片工作台设计

## 背景

KKCode 需要在控制台新增“生成图片”入口，功能和交互参考用户提供的页面。参考页面实际嵌入了开源项目 GPT Image Playground v0.7.0，而不是简单的生图表单。该项目支持画廊、参考图与遮罩编辑、Agent、多图生成、收藏及浏览器本地历史。

本设计采用固定版本集成：将 GPT Image Playground v0.7.0（提交 `31de6011888b7e5efc9ae94564e37b7e7be9378c`）纳入当前仓库构建，并通过 KKCode 的登录会话调用本站模型，不向浏览器暴露用户 API Key。

## 目标

- Classic 与 Default 两套前端都显示“生成图片”侧栏入口。
- 页面视觉和核心交互与参考站一致，包括画廊、Agent、参考图、遮罩、生成参数、收藏和本地历史。
- 图片生成、图片编辑和 Agent 请求使用当前登录用户的额度、分组和渠道路由。
- 页面不依赖参考站或其他外部运行时服务。
- 不在 URL、iframe、日志或浏览器持久化存储中写入真实用户 API Key。
- Docker、一键部署脚本和本地完整构建都能自动构建并嵌入工作台产物。

## 非目标

- 不把工作台历史同步到服务端数据库；继续使用其 IndexedDB 本地存储机制。
- 不修改现有 OpenAI 兼容 `/v1` API 的令牌鉴权行为。
- 不增加新的计费规则；请求沿用现有 Relay 计费、限额和日志链路。
- 不移除或改写上游项目的 MIT 许可与署名。

## 总体架构

### 独立前端工作区

在 `web/image/` 保存固定版本的 GPT Image Playground 源码和 MIT 许可证。它作为独立 React/Vite 工作区构建，避免与 Classic、Default 的 React 和样式依赖互相污染。

构建产物输出到 `web/image/dist/`，由 Go 使用 `embed.FS` 嵌入，并通过同源 `/image/` 路径提供。Vite 使用相对资源路径，因此部署在子路径时无需额外反向代理规则。

仅对上游代码增加一个边界清晰的 KKCode 集成层：

- 识别 `integration=kkcode` 和当前用户 ID。
- 在集成模式下隐藏 API Key 配置要求，使用会话请求头。
- 请求固定走同源 `/pg` 路由。
- 保留上游原有独立部署模式和功能，便于后续对照升级。

当前用户 ID 直接读取同源 `localStorage.user`。Classic 与 Default 已统一使用该存储键，因此 iframe URL 不需要携带用户 ID。

### 控制台承载页

Classic 与 Default 各自增加一个轻量承载页。承载页负责：

- 展示页面标题“生成图片”。
- 读取当前主题和语言。
- 生成同源 iframe URL，不包含 API Key。
- 提供“新窗口打开”操作。
- 让 iframe 占满可用内容区，并在窄屏下保持可操作。
- 登录失效时由现有鉴权路由统一跳转登录页。

Classic 使用 `/console/image-generation`；Default 使用 `/image-generation`。两套侧栏模块都使用稳定模块键 `image_generation`，并纳入管理员全局显示设置和用户个人显示设置。

### 会话 Relay 路由

扩展现有 `/pg` Playground 路由：

- `POST /pg/images/generations`
- `POST /pg/images/edits`
- `POST /pg/responses`

这些路由继续使用 `UserAuth`、`SystemPerformanceCheck` 和 `Distribute`，并创建只存在于请求上下文中的临时 Token。临时 Token 继承当前用户、当前分组和现有计费语义，不写入数据库。

`Path2RelayMode` 同时识别 `/pg` 对应路径。共享的规范化函数将 `/pg/...` 映射为 `/v1/...`，并同时供 Distributor 的渠道能力匹配与 RelayInfo 使用，使高级自定义渠道选择、上游 URL 和日志保持既有行为。

## 数据流

1. 用户点击侧栏“生成图片”。
2. 控制台承载页加载 `/image/?integration=kkcode&model=gpt-image-2`。
3. 工作台从同源 `localStorage.user` 读取当前用户 ID；持久化配置不保存真实凭证。
4. 画廊模式向 `/pg/images/generations` 或 `/pg/images/edits` 发送请求；Agent 模式向 `/pg/responses` 发送请求。
5. 请求携带同源 Cookie 和 `New-Api-User`。服务端验证 Header 用户 ID 与 Session 用户 ID 一致。
6. `Distribute` 按当前用户分组、模型和渠道配置选择上游，Relay 完成请求、计费和日志记录。
7. 工作台解析 URL、Base64 或 SSE 图片响应，并继续使用 IndexedDB 保存本地历史。

## 鉴权与安全

- 不生成、不查询、也不传递用户已有 API Token。
- KKCode 集成模式不发送 `Authorization: Bearer <placeholder>`，避免误走 TokenAuth。
- 每个请求显式发送 `New-Api-User`，服务端现有 `UserAuth` 校验其与 Session 一致，篡改用户 ID 会返回 401。
- iframe 与 API 都是同源资源，不放宽 CORS，也不把凭证发送到参考站或 GitHub Pages。
- iframe URL 只包含非敏感的集成模式、主题、语言和默认模型参数。
- 上游 MIT 许可证保留在 `web/image/LICENSE`，并在第三方许可证清单中登记。

## 错误处理

- 未登录或 Session 失效：承载页由现有私有路由拦截；接口返回统一鉴权错误。
- 用户 ID 缺失或不匹配：工作台显示接口返回的明确错误，不重试生成请求。
- 模型或渠道不可用：沿用 Distributor 的模型不可用提示。
- 额度不足、上游 4xx/5xx、流式错误：沿用 Relay OpenAI 错误结构，由工作台展示任务失败原因。
- iframe 静态资源加载失败：承载页显示可重试错误状态，不保持永久加载动画。
- 浏览器不支持 IndexedDB：工作台仍允许当前会话生成，但明确提示历史无法持久化。

## 构建与部署

- `web/package.json` 增加 `image` 工作区。
- 根 `web/bun.lock` 记录固定依赖，统一使用 Bun 安装。
- Dockerfile 增加工作台构建阶段，并在 Go 构建前复制 `web/image/dist`。
- Makefile 的完整前端构建包含工作台；现有 Default/Classic 单独开发命令保持不变，并增加工作台开发命令。
- `main.go` 嵌入工作台产物，`router/web-router.go` 在主题静态中间件之前挂载 `/image/`。
- 服务器现有 `docker compose up -d --build` 一键部署流程无需新增人工步骤或数据库迁移。

## 兼容与迁移

- 不新增数据库表或字段。
- 旧用户的侧栏 JSON 可能没有 `image_generation`。前后端默认配置合并时将缺失键补为启用，避免只有新用户能看到入口。
- 管理员关闭模块后，用户无法通过侧栏看到入口；直接访问页面仍需登录，但不额外引入功能权限语义。
- Distributor 与 RelayInfo 都使用规范化后的 `/v1/images/...` 或 `/v1/responses` 路径，保证 Advanced Custom 渠道匹配一致。

## 测试与验收

### 后端

- 路径解析测试覆盖三个新增 `/pg` 路径及现有 `/v1` 路径不回归。
- Playground Relay 测试验证临时 Token 使用当前用户和分组，并拒绝 access token 模式。
- 路由集成测试验证用户 ID 缺失、错误和正确三种鉴权结果。

### 前端与工作台

- 上游工作台现有测试继续通过。
- 集成层测试验证 KKCode 模式不发送 Authorization、会发送 `New-Api-User` 和同源凭证。
- Classic 与 Default 的类型检查、lint 和生产构建通过。
- 浏览器验收覆盖桌面与移动视口：侧栏入口、iframe 尺寸、画廊/Agent 切换、设置、参考图上传和错误状态无重叠。
- 使用测试账号发起一次最小图片生成请求，确认图片返回、额度扣减和使用日志一致；若测试环境没有可用生图渠道，则以受控的接口响应替代真实付费请求，并明确记录未执行真实生成。

## 完成标准

- 两套主题均可从侧栏进入“生成图片”。
- 工作台无需用户配置 API Key 即可使用当前登录账户发起请求。
- 画廊、Agent、参考图与遮罩编辑入口可正常操作。
- 构建产物随 Go 二进制发布，Docker 一键部署后 `/image/` 可访问。
- 鉴权、额度、分组、渠道、计费和日志均复用现有服务端链路。
- 不向第三方或浏览器持久化数据泄露真实 API 凭证。
