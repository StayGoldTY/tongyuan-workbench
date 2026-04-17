import { corsHeaders, withJson } from "../_shared/cors.ts";
import { createGroundedAnswer, createQueryEmbedding } from "../_shared/openai.ts";
import { getAuthenticatedEmail } from "../_shared/auth.ts";
import { createUserClient } from "../_shared/supabase.ts";

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
    const { data, error } = await userClient.rpc("match_knowledge_chunks", {
      search_query: question,
      query_embedding: embedding,
      match_count: topK,
    });

    if (error) {
      throw error;
    }

    const records = (data ?? []) as Array<Record<string, unknown>>;
    const citations = records.map((item) => ({
      id: String(item.external_id ?? ""),
      title: String(item.title ?? ""),
      sourceApp: String(item.source_app ?? ""),
      workspace: String(item.workspace ?? ""),
      excerpt: String(item.excerpt ?? ""),
      sourceUri: item.source_uri ? String(item.source_uri) : null,
      eventTime: item.event_time ? String(item.event_time) : null,
      confidence: Number(item.confidence ?? 0),
      tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
    }));

    const contexts = records.map((item, index) =>
      [
        `证据 ${index + 1}`,
        `标题：${String(item.title ?? "")}`,
        `项目：${String(item.workspace ?? "")}`,
        `来源：${inferSourceLabel(String(item.source_app ?? ""))}`,
        `时间：${item.event_time ? String(item.event_time) : "未标注"}`,
        `标签：${
          Array.isArray(item.tags) && item.tags.length > 0
            ? item.tags.map((tag) => String(tag)).join("、")
            : "无"
        }`,
        `系统摘要：${String(item.summary ?? "未提供摘要")}`,
        `资料片段：${String(item.excerpt ?? "")}`,
        `来源标识：${item.source_uri ? String(item.source_uri) : "未标注"}`,
      ].join("\n")
    );

    const answer = await createGroundedAnswer(question, contexts);

    return withJson(200, {
      answer: answer.answer,
      confidenceLabel: citations.length === 0 ? "insufficient" : answer.confidenceLabel,
      citations,
      notes:
        citations.length === 0
          ? ["目前没有检索到足够的脱敏资料，建议补充项目名、页面名或时间范围后再问一次。"]
          : answer.notes,
    });
  } catch (error) {
    return withJson(401, { error: error instanceof Error ? error.message : "查询失败。" });
  }
});
