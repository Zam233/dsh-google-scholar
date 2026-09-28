# dsh-google-scholar

DeepSeek Harness 插件：通过 [SerpAPI](https://serpapi.com) 检索 **Google Scholar**，
注册三个 LLM 工具（共享 SerpAPI 月配额）。

由作者自有项目 Scholar_View 的 `plugins/google_scholar` 移植（原实现为 Python，本插件以 JavaScript 重写）。

## 提供的工具

| 工具 | 说明 |
| --- | --- |
| `google_scholar_search` | 检索 Google Scholar 学术论文（支持 `author:` / `source:` 修饰符） |
| `google_scholar_cited_by` | 查询引用某文献的论文（参数 `cites_id` 取自上一步结果的 `cites_id` 字段） |
| `google_scholar_all_versions` | 查询某论文的全部版本（参数 `cluster_id` 取自上一步结果的版本 `cluster_id` 字段） |

## 快速开始 / Quickstart

### 第 0 步：注册 SerpAPI 并拿到 API Key（必做）

本插件**不自带** API Key，需要你自己的 SerpAPI 账号：

1. 打开 <https://serpapi.com/users/sign_up> 注册（支持邮箱注册，新账号有免费额度）。
2. 登录后进入控制台 <https://serpapi.com/manage-api-key>。
3. 复制 **Your Private API Key**（形如 `a1b2c3...`，64 位十六进制字符串）。
4. 在控制台 **Your Plan** 查看免费额度与计费方式——额度耗尽需自行升级。

> 💡 免费额度有限，三个工具**共用**同一个账号额度。翻页会额外消耗：
> 优先加大 `num`（每页结果数）而不是反复翻页。

### 第 1 步：写入配置

把 Key 写进**你的 profile 层**（该文件不在仓库内，不会被提交）：

```yaml
# $DSH_HOME/profiles/<profile>/cordis.patch.yml
- id: dsh-google-scholar
  config:
    serpapi_key: <你的 SerpAPI Key>
    max_results: 10        # 每次调用默认返回条数 1-20，默认 10
```

插件自带的 `cordis.patch.yml` 只含**空占位值**，不要改那个文件——
bundle patch 负责「挂载」，profile 层负责「配置」，同 id 覆盖由 DSH loader 保证。

### 第 2 步：加载

重启 `dsh web`（宿主插件在启动时加载，改动不会热更新）。

### 第 3 步：验证

```bash
dsh --profile web --dump-config        # 只打印组合配置，不启动服务；确认 serpapi_key 已生效
```

随后让 Agent 调用一次 `google_scholar_search`（参数 `q`，例如 `transformer architecture`）即可看到结果。

### 🤖 交给 Agent 一键配置

把下面这段发给你的 Agent：

````text
请帮我配置 dsh-google-scholar 插件（插件已装好，只需填配置）：

1. 我已经注册好 SerpAPI，你把我的 API Key 写进
   $DSH_HOME/profiles/<当前 profile>/cordis.patch.yml：

     - id: dsh-google-scholar
       config:
         serpapi_key: <我会给你的 Key>
         max_results: 10

   注意：插件自带的 cordis.patch.yml 里是空占位值，不要改那个文件；
   真实 Key 只写在 profile 层（不在仓库内，不会被提交）。

2. 运行 `dsh --profile <当前 profile> --dump-config` 确认配置已生效
   （该命令只打印配置，不会启动服务）。

3. 提醒我重启 `dsh web`，然后用 `google_scholar_search` 发一次
   q=transformer architecture 的测试调用，确认能返回结果。
````

## 配置字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `serpapi_key` | ✅ | SerpAPI Private API Key（<https://serpapi.com/manage-api-key>） |
| `max_results` | — | 每次调用默认返回的最大结果数（1-20），默认 10 |

未配置 Key 时工具会返回「未配置 SerpAPI Key」提示，不会抛异常。

## 安装

```bash
dsh plugin --profile web add link:C:/Users/<you>/.dsh/plugins/dsh-google-scholar
```

或从 Git 安装：

```bash
dsh plugin --profile web add git+https://github.com/Zam233/dsh-google-scholar.git
```

## 使用要点

- **三个工具共享 SerpAPI 月配额**（本插件三个工具都走同一个账号额度）
- 优先加大 `num` 而非多次翻页，以节省配额
- `hl` 为界面语言（如 `en` / `zh-CN`），`lr` 为语言限制（如 `lang_zh-CN`），`as_ylo` / `as_yhi` 限定起止年份
- `scisbd` 控制排序：`0`=相关度，`1`=新摘要，`2`=新全部

## 许可证与出处

本项目代码以 **GNU GPL-3.0-or-later** 发布，见 [`LICENSE`](./LICENSE)。

- **SerpAPI 是第三方商业服务**，本项目的 GPL 授权**不包含**其使用授权，请遵守
  [SerpAPI 服务条款](https://serpapi.com/legal)；
- 详见 [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md)。
