import { corsHeaders, withJson } from "../_shared/cors.ts";
import { getAuthenticatedEmail } from "../_shared/auth.ts";
import { createUserClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAuthenticatedEmail(request);
    const documentId = new URL(request.url).searchParams.get("id");
    if (!documentId) {
      return withJson(400, { error: "缺少文档标识。" });
    }

    const userClient = createUserClient(request.headers.get("Authorization"));
    const { data, error } = await userClient
      .from("knowledge_units")
      .select("external_id, title, summary, content_redacted, source_app, workspace, source_family, tags, event_time, source_uri")
      .eq("external_id", documentId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      return withJson(404, { error: "没有找到这条来源详情。" });
    }

    return withJson(200, {
      id: data.external_id,
      title: data.title,
      summary: data.summary,
      contentRedacted: data.content_redacted,
      sourceApp: data.source_app,
      workspace: data.workspace,
      sourceFamily: data.source_family,
      tags: data.tags,
      eventTime: data.event_time,
      sourceUri: data.source_uri,
    });
  } catch (error) {
    return withJson(401, { error: error instanceof Error ? error.message : "读取来源详情失败。" });
  }
});
