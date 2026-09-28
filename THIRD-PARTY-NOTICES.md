# 第三方组件与出处说明 / Third-Party Notices

本项目的**源代码**（`lib/`、`README.md`、`package.json` 等）以
**GNU GPL-3.0-or-later** 发布（见 `LICENSE`）。

---

## 1. 代码出处：自有项目移植

本插件是本仓库作者自有项目 **Scholar_View**
（本地项目 `K:\Scholar_View`，同样以 **GNU GPL v3.0** 发布）
中 `plugins/google_scholar`（Python 实现）的 DSH 移植版。

- 原实现由作者本人编写，**不含任何第三方源码**，其中的工具逻辑、参数语义
  （`search` / `cited_by` / `all_versions`）、以及 SerpAPI 调用方式均为作者自有；
- 迁移到 DSH 时以 JavaScript 重写为 `lib/index.js`，功能对齐、代码重写；
- 原项目与其移植版同为 GPL-3.0，**许可一致，无冲突**。

> 注：`K:\Scholar_View` 自身引用的前端/后端第三方依赖（Vue、Vite、PyMuPDF、Qt 等）
> 与**本插件无关**——本插件不依赖、不捆绑这些组件。相关清单见 Scholar_View 仓库的
> `THIRD_PARTY_NOTICES.md`。

---

## 2. 运行时依赖（未捆绑，仅声明 peerDependencies）

本插件通过 `peerDependencies` 使用 DSH 自身的包，**不复制、不打包**其代码；
它们由 DSH 安装提供，各自遵循其原始许可：

| 包 | 许可 | 版权 |
| --- | --- | --- |
| `@deepseek-ai/dsh-tools` | MIT | Copyright (c) 2026 DeepSeek |
| `@deepseek-ai/schemastery` | MIT | Copyright (c) 2021-present Shigma |
| `@deepseek-ai/dsh`（宿主） | MIT | Copyright (c) 2026 DeepSeek |

MIT 与 GPL-3.0 兼容：MIT 许可的库可被 GPL 程序使用，不改变本项目的 GPL 授权。

---

## 3. 服务与商标（不属于代码许可范围）

- **SerpAPI 是第三方商业服务**，不是本项目的组成部分。本插件只是它的 HTTP 客户端
  （`GET https://serpapi.com/search.json`）。使用它须自行注册账号并遵守
  [SerpAPI 服务条款](https://serpapi.com/legal)，费用与配额由 SerpAPI 决定。
  **本项目的 GPL 授权不包含任何 SerpAPI 使用授权**。本仓库不附带任何 API Key。
- **Google Scholar / Google** 是 Google LLC 的商标/服务。
  本插件不直接抓取 Google Scholar，而是经由 SerpAPI 的官方接口获取数据；
  数据的使用需遵守 Google 与 SerpAPI 各自的条款。
- GPL 只覆盖本项目代码，不授予 SerpAPI、Google 等任何商标或服务的使用权。
