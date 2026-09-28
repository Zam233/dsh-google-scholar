// dsh-google-scholar — SerpAPI Google Scholar 三个工具：
// google_scholar_search / google_scholar_cited_by / google_scholar_all_versions。
// 协议对齐原 Scholar_View google_scholar 插件：纯 GET https://serpapi.com/search.json，
// 错误一律返回可读中文文本（不抛异常）。
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";

const name = "dsh-google-scholar";
const inject = ["tools", "systemPrompt"];

const SERPAPI_SEARCH_URL = "https://serpapi.com/search.json";
const ENGINE_GOOGLE_SCHOLAR = "google_scholar";
const TIMEOUT_MS = 30_000;
const NUM_MIN = 1;
const NUM_MAX = 20;

const Config = z.object({
  serpapi_key: z.string().default(""),
  max_results: z.number().default(10)
});

// ---- 工具描述与参数 schema ----

function searchDescription() {
  return [
    "中文：通过 SerpAPI 检索 Google Scholar 学术论文，检索词支持 author:/source: 修饰符",
    "（如 'author:李四 大语言模型' 或 'source:Nature'）。",
    "/ English: Search academic papers on Google Scholar via SerpAPI; the query supports author:/source: modifiers.",
    "/ 限制：本插件三个工具共享 SerpAPI 月配额（250 次/月），优先加大 num（每页结果数）而非多次翻页以节省配额；",
    "hl 为界面语言（如 en/zh-CN），lr 为语言限制（如 lang_zh-CN），as_ylo/as_yhi 限定起始/截止年份，",
    "scisbd 控制排序（0=相关度 1=新摘要 2=新全部）。"
  ].join(" ");
}

function citedByDescription() {
  return [
    "中文：查询引用某文献的论文（施引文献检索，SerpAPI）。",
    "/ English: Find papers that cite a given paper via Google Scholar (SerpAPI).",
    "/ 限制：cites_id 必须取自上一步 google_scholar_search 结果中的 cites_id 字段；",
    "q 可在施引文献内二次检索，as_ylo/as_yhi 限定年份；与其余 google_scholar 工具共享 SerpAPI 月配额（250 次/月）；",
    "仅当用户明确要求查看某文献的被引用情况/施引文献时调用。"
  ].join(" ");
}

function allVersionsDescription() {
  return [
    "中文：查询某论文的全部版本（SerpAPI）。",
    "/ English: List all versions of a paper via Google Scholar (SerpAPI).",
    "/ 限制：cluster_id 必须取自上一步 google_scholar_search 结果中的版本 cluster_id 字段；",
    "与其余 google_scholar 工具共享 SerpAPI 月配额（250 次/月）；仅当用户明确要求查看某论文的全部版本/其他版本时调用。"
  ].join(" ");
}

// ---- 公共请求层 ----

function makeSignal(exec) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  if (exec?.signal) return AbortSignal.any([exec.signal, timeout]);
  return timeout;
}

async function serpapiFetch(apiKey, extraParams, signal) {
  if (!apiKey) {
    throw new Error(
      "未配置 SerpAPI Key：请在 dsh-google-scholar 插件「配置」中填写 serpapi_key（SerpAPI 控制台获取）。"
    );
  }
  const params = new URLSearchParams({ engine: ENGINE_GOOGLE_SCHOLAR, api_key: apiKey });
  for (const [key, value] of Object.entries(extraParams)) {
    if (value != null && value !== "") params.set(key, String(value));
  }
  let res;
  try {
    res = await fetch(`${SERPAPI_SEARCH_URL}?${params.toString()}`, { method: "GET", signal });
  } catch (err) {
    if (err?.name === "AbortError") throw new Error(`SerpAPI 请求超时（${TIMEOUT_MS / 1000}s）或已取消`);
    throw new Error(`SerpAPI 网络请求失败：${err?.message ?? String(err)}`);
  }
  if (res.status === 429) {
    let detail = "";
    try {
      const body = await res.json();
      if (body && typeof body === "object" && body.error) detail = `：${body.error}`;
    } catch {
      // ignore body parse failure
    }
    throw new Error(
      `SerpAPI 配额已用尽或请求过于频繁（HTTP 429）${detail}。三个 google_scholar 工具共享 SerpAPI 月配额（250 次/月），请稍后再试，或在插件配置中更换 Key。`
    );
  }
  if (res.status !== 200) {
    let detail = "";
    try {
      const body = await res.json();
      if (body && typeof body === "object" && body.error) detail = `：${body.error}`;
    } catch {
      // ignore body parse failure
    }
    throw new Error(`SerpAPI 请求失败：HTTP ${res.status}${detail}`);
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("SerpAPI 返回内容无法解析（非 JSON）。");
  }
  if (!data || typeof data !== "object") throw new Error("SerpAPI 返回内容格式异常（非对象）。");
  if (data.error) throw new Error(`SerpAPI 返回错误：${data.error}`);
  return data;
}

function resolveNum(args, cfg) {
  let raw = args.num;
  if (raw == null || raw === "") raw = cfg.max_results;
  let value = Number(raw);
  if (!Number.isFinite(value)) value = 10;
  return Math.max(NUM_MIN, Math.min(NUM_MAX, Math.trunc(value)));
}

function optStr(args, ...names) {
  const out = {};
  for (const name of names) {
    if (args[name] != null && args[name] !== "") out[name] = String(args[name]);
  }
  return out;
}

function optInt(args, name) {
  const value = args[name];
  if (value == null || value === "") return {};
  const num = Number(value);
  return Number.isFinite(num) ? { [name]: Math.trunc(num) } : {};
}

// ---- 结果格式化（统一 Markdown 分节） ----

function formatPaper(index, paper, { snippetLimit = 300, pdfMode = "all" } = {}) {
  const title = paper?.title || "（无标题）";
  const pub = paper?.publication_info || {};
  const authors = (pub.authors || [])
    .map((a) => (a && typeof a === "object" ? a.name : ""))
    .filter(Boolean);
  const summary = pub.summary || "";
  const snippet = String(paper?.snippet ?? "").trim();
  const link = paper?.link || "";
  const inline = paper?.inline_links || {};
  const cited = inline.cited_by || {};
  const citedTotal = cited.total;
  const citesId = String(cited.cites_id ?? "").trim();
  const pdfLinks = (paper?.resources || [])
    .filter((r) => r && typeof r === "object" && String(r.file_format ?? "").toUpperCase() === "PDF" && r.link)
    .map((r) => r.link);

  const lines = [`### ${index}. ${title}`];
  if (authors.length) lines.push(`- 作者：${authors.join("、")}`);
  if (summary) lines.push(`- 来源：${summary}`);
  if (snippet) lines.push(`- 摘要：${snippet.slice(0, snippetLimit)}`);
  if (link) lines.push(`- 主页：${link}`);
  if (citedTotal != null || citesId) {
    if (citedTotal != null) {
      let line = `- 被引：${citedTotal}`;
      if (citesId) line += `（cites_id：${citesId}）`;
      lines.push(line);
    } else {
      lines.push(`- cites_id：${citesId}`);
    }
  }
  if ((pdfMode === "all" || pdfMode === "first") && pdfLinks.length) {
    const urls = pdfMode === "all" ? pdfLinks : pdfLinks.slice(0, 1);
    for (const url of urls) lines.push(`- PDF：${url}`);
  }
  return lines.join("\n");
}

function paginationHint(data) {
  const pag = data?.serpapi_pagination || data?.pagination || {};
  if (pag && typeof pag === "object" && pag.next) {
    return "\n\n> 提示：存在更多结果，可用 start 参数继续翻页。";
  }
  return "";
}

function formatSearch(data) {
  const lines = ["# Google Scholar 检索结果"];
  const info = data?.search_information || {};
  const parts = [];
  const displayed = info.query_displayed;
  if (displayed) parts.push(`检索词：${displayed}`);
  const total = info.total_results;
  if (total != null) parts.push(`共 ${total} 条结果`);
  if (parts.length) lines.push(parts.join("；"));

  const results = data?.organic_results || [];
  if (!Array.isArray(results) || results.length === 0) {
    lines.push("未检索到结果。");
    return lines.join("\n\n");
  }
  for (const [index, paper] of results.entries()) {
    lines.push(formatPaper(index + 1, paper, { snippetLimit: 300, pdfMode: "all" }));
  }
  return lines.join("\n\n") + paginationHint(data);
}

function formatCitedBy(data) {
  const lines = ["# 引用该文献的论文"];
  const results = data?.organic_results || [];
  if (!Array.isArray(results) || results.length === 0) {
    lines.push("未检索到施引文献。");
  } else {
    for (const [index, paper] of results.entries()) {
      lines.push(formatPaper(index + 1, paper, { snippetLimit: 250, pdfMode: "none" }));
    }
  }

  const trend = data?.citations_per_year || [];
  const years = (Array.isArray(trend) ? trend : [])
    .filter((c) => c && typeof c === "object" && c.year != null)
    .sort((a, b) => Number(a.year) - Number(b.year))
    .slice(-5);
  if (years.length) {
    lines.push("");
    lines.push("## 引用趋势（最近 5 年）");
    for (const item of years) {
      const count = item.citations != null ? item.citations : 0;
      lines.push(`- ${item.year}: ${count}篇`);
    }
  }
  return lines.join("\n\n") + paginationHint(data);
}

function formatAllVersions(data) {
  const lines = ["# 该论文的全部版本"];
  const results = data?.organic_results || [];
  if (!Array.isArray(results) || results.length === 0) {
    lines.push("未检索到其他版本。");
  } else {
    for (const [index, paper] of results.entries()) {
      lines.push(formatPaper(index + 1, paper, { snippetLimit: 250, pdfMode: "first" }));
    }
  }
  return lines.join("\n\n") + paginationHint(data);
}

// ---- 工具定义 ----

function defineScholarTool(ctx, cfg, spec) {
  const { toolName, description, parameters, buildParams, format } = spec;
  ctx.systemPrompt.section({
    name: `tool:${toolName}`,
    order: 113,
    text: `Use the ${toolName} tool for Google Scholar lookups via SerpAPI (${description.split("/ English:")[1]?.split("/")[0]?.trim() ?? "see tool description"}).`
  });
  ctx.tools.register(defineTool({
    name: toolName,
    description,
    parameters,
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", required: true }
        }
      },
      render: (_args, value) => [{ type: "text", text: value.text }]
    },
    timeoutMs: TIMEOUT_MS,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      try {
        const data = await serpapiFetch(cfg.serpapi_key, buildParams(args, cfg), makeSignal(exec));
        return { text: format(data) };
      } catch (err) {
        return { text: err?.message ?? String(err) };
      }
    }
  }));
}

function apply(ctx, config) {
  const resolved = Config(config ?? {});

  defineScholarTool(ctx, resolved, {
    toolName: "google_scholar_search",
    description: searchDescription(),
    parameters: {
      q: { type: "string", required: true, description: "检索词，支持 author:/source: 修饰符" },
      hl: { type: "string", description: "界面语言，默认 en" },
      lr: { type: "string", description: "语言限制，如 lang_zh-CN" },
      as_ylo: { type: "string", description: "起始年份" },
      as_yhi: { type: "string", description: "截止年份" },
      num: { type: "integer", description: "返回结果数（1-20），默认 10" },
      start: { type: "integer", description: "分页偏移" },
      scisbd: { type: "integer", enum: [0, 1, 2], description: "排序：0=相关度，1=新摘要，2=新全部" }
    },
    buildParams(args, cfg) {
      const q = String(args.q ?? "").trim();
      if (!q) throw new Error("检索词 q 不能为空。");
      const params = { q };
      Object.assign(params, optStr(args, "hl", "lr", "as_ylo", "as_yhi"));
      params.num = resolveNum(args, cfg);
      Object.assign(params, optInt(args, "start"), optInt(args, "scisbd"));
      return params;
    },
    format: formatSearch
  });

  defineScholarTool(ctx, resolved, {
    toolName: "google_scholar_cited_by",
    description: citedByDescription(),
    parameters: {
      cites_id: { type: "string", required: true, description: "上一次搜索结果 inline_links.cited_by.cites_id" },
      q: { type: "string", description: "在施引文献内的二次检索词（可选）" },
      hl: { type: "string", description: "界面语言，默认 en" },
      as_ylo: { type: "string", description: "起始年份" },
      as_yhi: { type: "string", description: "截止年份" },
      num: { type: "integer", description: "返回结果数（1-20），默认 10" },
      start: { type: "integer", description: "分页偏移" }
    },
    buildParams(args, cfg) {
      const citesId = String(args.cites_id ?? "").trim();
      if (!citesId) throw new Error("cites_id 不能为空（取自上一步搜索结果中的 cites_id）。");
      const params = { cites: citesId };
      Object.assign(params, optStr(args, "q", "hl", "as_ylo", "as_yhi"));
      params.num = resolveNum(args, cfg);
      Object.assign(params, optInt(args, "start"));
      return params;
    },
    format: formatCitedBy
  });

  defineScholarTool(ctx, resolved, {
    toolName: "google_scholar_all_versions",
    description: allVersionsDescription(),
    parameters: {
      cluster_id: { type: "string", required: true, description: "上一次搜索结果 inline_links.versions.cluster_id" },
      hl: { type: "string", description: "界面语言，默认 en" },
      num: { type: "integer", description: "返回结果数（1-20），默认 10" },
      start: { type: "integer", description: "分页偏移" }
    },
    buildParams(args, cfg) {
      const clusterId = String(args.cluster_id ?? "").trim();
      if (!clusterId) throw new Error("cluster_id 不能为空（取自上一步搜索结果中的版本 cluster_id）。");
      const params = { cluster: clusterId };
      Object.assign(params, optStr(args, "hl"));
      params.num = resolveNum(args, cfg);
      Object.assign(params, optInt(args, "start"));
      return params;
    },
    format: formatAllVersions
  });
}

export { Config, apply, inject, name };
