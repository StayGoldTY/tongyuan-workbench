import { corsHeaders, withJson } from "../_shared/cors.ts";
import { createGroundedAnswer, createQueryEmbedding } from "../_shared/openai.ts";
import { getAuthenticatedEmail } from "../_shared/auth.ts";
import { createUserClient } from "../_shared/supabase.ts";

type SearchRecord = {
  external_id?: unknown;
  title?: unknown;
  source_app?: unknown;
  workspace?: unknown;
  excerpt?: unknown;
  summary?: unknown;
  source_uri?: unknown;
  event_time?: unknown;
  tags?: unknown;
  confidence?: unknown;
};

type RankedRecord = {
  id: string;
  title: string;
  sourceApp: string;
  workspace: string;
  excerpt: string;
  summary: string;
  sourceUri: string | null;
  eventTime: string | null;
  confidence: number;
  tags: string[];
  rerankScore: number;
};

const inferSourceLabel = (sourceApp: string) => {
  if (sourceApp === "git") {
    return "代码资料";
  }

  if (sourceApp === "wxwork") {
    return "企业微信";
  }

  if (sourceApp === "wechat") {
    return "微信";
  }

  if (sourceApp === "larkshell") {
    return "建研智通";
  }

  return sourceApp;
};

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const inferEvidenceType = (record: RankedRecord) => {
  if (record.tags.includes("delivery-playbook")) {
    return "发布与联调说明";
  }

  if (record.tags.includes("recent-business-impact")) {
    return "近期业务变化";
  }

  if (record.tags.includes("business-module-map")) {
    return "业务模块地图";
  }

  if (record.tags.includes("business-summary") || record.tags.includes("business-overview")) {
    return "业务概况";
  }

  if (record.sourceApp === "wxwork" || record.sourceApp === "wechat" || record.sourceApp === "larkshell") {
    return "聊天线索";
  }

  if (record.title.toLowerCase().endsWith(".md") || record.title.toLowerCase().endsWith(".docx")) {
    return "文档摘要";
  }

  return "代码线索";
};

const looksLikeRuntimeNoise = (record: RankedRecord) => {
  const combined = `${record.title} ${record.summary} ${record.excerpt}`.toLowerCase();

  if (record.sourceApp === "wxwork") {
    return [
      "mailinlinedcsr",
      "composeindex.html",
      "wemail_native_resource",
      "qqmailapijs://dispatch_message",
      "/doc/d0000000000000000",
      "bigfont init",
      "ratiogroup",
      "ssr snapshot styles",
    ].some((token) => combined.includes(token));
  }

  return false;
};

const includesAny = (question: string, keywords: string[]) =>
  keywords.some((keyword) => question.includes(keyword));

const computeRerankScore = (question: string, record: RankedRecord) => {
  let score = record.confidence;
  const loweredQuestion = question.toLowerCase();
  const evidenceType = inferEvidenceType(record);

  if (record.tags.includes("priority-context")) {
    score += 2;
  }

  if (record.tags.includes("business-summary")) {
    score += 1.6;
  }

  if (
    record.tags.includes("business-module-map") &&
    includesAny(loweredQuestion, ["页面", "模块", "功能", "入口", "给谁用", "做什么"])
  ) {
    score += 1.8;
  }

  if (
    record.tags.includes("recent-business-impact") &&
    includesAny(loweredQuestion, ["最近", "近期", "为什么", "变化", "改动", "这阵子"])
  ) {
    score += 1.9;
  }

  if (
    record.tags.includes("delivery-playbook") &&
    includesAny(loweredQuestion, ["发布", "上线", "部署", "联调", "同步", "对接"])
  ) {
    score += 2;
  }

  if (
    (record.sourceApp === "wxwork" || record.sourceApp === "wechat" || record.sourceApp === "larkshell") &&
    includesAny(loweredQuestion, ["聊天", "谁提过", "谁说过", "什么时候", "讨论", "群里", "消息"])
  ) {
    score += 1.4;
  }

  if (loweredQuestion.includes(record.workspace.toLowerCase())) {
    score += 0.7;
  }

  if (
    evidenceType === "代码线索" &&
    !includesAny(loweredQuestion, ["代码", "接口", "字段", "表", "sql", "类", "方法"])
  ) {
    score -= 0.15;
  }

  if (looksLikeRuntimeNoise(record)) {
    score -= 3;
  }

  if (record.title.toLowerCase().includes("log") && !includesAny(loweredQuestion, ["日志", "log", "报错"])) {
    score -= 1;
  }

  return score;
};

const toRankedRecord = (item: SearchRecord): RankedRecord => ({
  id: String(item.external_id ?? ""),
  title: String(item.title ?? ""),
  sourceApp: String(item.source_app ?? ""),
  workspace: String(item.workspace ?? ""),
  excerpt: normalizeText(String(item.excerpt ?? "")),
  summary: normalizeText(String(item.summary ?? "")),
  sourceUri: item.source_uri ? String(item.source_uri) : null,
  eventTime: item.event_time ? String(item.event_time) : null,
  confidence: Number(item.confidence ?? 0),
  tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
  rerankScore: 0,
});

const rerankRecords = (question: string, records: SearchRecord[], topK: number) => {
  const ranked = records.map(toRankedRecord).map((record) => ({
    ...record,
    rerankScore: computeRerankScore(question, record),
  }));

  const deduped: RankedRecord[] = [];
  const seen = new Set<string>();

  for (const record of ranked.sort((left, right) => {
    if (right.rerankScore !== left.rerankScore) {
      return right.rerankScore - left.rerankScore;
    }

    if ((right.eventTime ?? "") !== (left.eventTime ?? "")) {
      return (right.eventTime ?? "").localeCompare(left.eventTime ?? "");
    }

    return right.confidence - left.confidence;
  })) {
    const dedupeKey = `${record.title}|${record.sourceUri ?? ""}|${record.excerpt}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    deduped.push(record);

    if (deduped.length >= topK) {
      break;
    }
  }

  return deduped;
};

const buildContexts = (records: RankedRecord[]) =>
  records.map((record, index) =>
    [
      `证据 ${index + 1}`,
      `标题：${record.title}`,
      `项目：${record.workspace}`,
      `来源：${inferSourceLabel(record.sourceApp)}`,
      `资料类型：${inferEvidenceType(record)}`,
      `时间：${record.eventTime ?? "未标注"}`,
      `标签：${record.tags.length > 0 ? record.tags.join("、") : "无"}`,
      `摘要：${record.summary || "未提供摘要"}`,
      `片段：${record.excerpt || "未提供片段"}`,
      `来源标识：${record.sourceUri ?? "未标注"}`,
    ].join("\n")
  );

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAuthenticatedEmail(request);
    const payload = await request.json();
    const question = String(payload.question ?? "").trim();
    const topK = Math.min(Math.max(Number(payload.topK ?? 6), 1), 8);

    if (!question) {
      return withJson(400, { error: "问题不能为空。" });
    }

    const embedding = await createQueryEmbedding(question);
    const userClient = createUserClient(request.headers.get("Authorization"));
    const fetchCount = Math.min(Math.max(topK * 3, 12), 24);
    const { data, error } = await userClient.rpc("match_knowledge_chunks", {
      search_query: question,
      query_embedding: embedding,
      match_count: fetchCount,
    });

    if (error) {
      throw error;
    }

    const rankedRecords = rerankRecords(question, (data ?? []) as SearchRecord[], topK);
    const citations = rankedRecords.map((record) => ({
      id: record.id,
      title: record.title,
      sourceApp: record.sourceApp,
      sourceType: inferEvidenceType(record),
      workspace: record.workspace,
      excerpt: record.excerpt || record.summary,
      sourceUri: record.sourceUri,
      eventTime: record.eventTime,
      confidence: Number(record.rerankScore.toFixed(4)),
      tags: record.tags,
    }));

    const contexts = buildContexts(rankedRecords);
    const answer = await createGroundedAnswer(question, contexts);

    return withJson(200, {
      answer: answer.answer,
      confidenceLabel: citations.length === 0 ? "insufficient" : answer.confidenceLabel,
      citations,
      notes:
        citations.length === 0
          ? ["目前没有检索到足够的脱敏资料，建议补充项目名、页面名、时间范围或讨论对象后再问一次。"]
          : answer.notes,
    });
  } catch (error) {
    return withJson(401, {
      error: error instanceof Error ? error.message : "查询失败。",
    });
  }
});
