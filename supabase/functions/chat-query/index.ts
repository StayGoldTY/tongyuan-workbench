import { corsHeaders, withJson } from "../_shared/cors.ts";
import { createGroundedAnswer, createQueryEmbedding } from "../_shared/openai.ts";
import { getAuthenticatedEmail } from "../_shared/auth.ts";
import { createUserClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAuthenticatedEmail(request);
    const payload = await request.json();
    const question = String(payload.question ?? "").trim();
    const topK = Number(payload.topK ?? 6);

    if (!question) {
      return withJson(400, { error: "Question is required" });
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

    const citations = (data ?? []).map((item: Record<string, unknown>) => ({
      id: item.external_id,
      title: item.title,
      sourceApp: item.source_app,
      workspace: item.workspace,
      excerpt: item.excerpt,
      sourceUri: item.source_uri,
      eventTime: item.event_time,
      confidence: item.confidence,
      tags: item.tags ?? [],
    }));

    const contexts = citations.map(
      (citation) =>
        `Title: ${citation.title}\nWorkspace: ${citation.workspace}\nSource: ${citation.sourceApp}\nExcerpt: ${citation.excerpt}`,
    );
    const answer = await createGroundedAnswer(question, contexts);

    return withJson(200, {
      answer: answer.answer,
      confidenceLabel: citations.length === 0 ? "insufficient" : answer.confidenceLabel,
      citations,
      notes:
        citations.length === 0
          ? ["没有检索到足够的脱敏证据。"]
          : answer.notes,
    });
  } catch (error) {
    return withJson(401, { error: error instanceof Error ? error.message : "Query failed" });
  }
});
