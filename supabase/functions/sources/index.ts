import { corsHeaders, withJson } from "../_shared/cors.ts";
import { getAuthenticatedEmail } from "../_shared/auth.ts";
import { createUserClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAuthenticatedEmail(request);
    const userClient = createUserClient(request.headers.get("Authorization"));
    const url = new URL(request.url);
    const wantsSyncView = url.searchParams.get("view") === "sync";

    if (wantsSyncView) {
      const { data, error } = await userClient
        .from("source_sync_statuses")
        .select("source_key, workspace, source_app, status, discovered_units, uploaded_units, message")
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      return withJson(
        200,
        (data ?? []).map((item) => ({
          sourceKey: item.source_key,
          workspace: item.workspace,
          sourceApp: item.source_app,
          status: item.status,
          discoveredUnits: item.discovered_units,
          uploadedUnits: item.uploaded_units,
          message: item.message,
        })),
      );
    }

    const { data, error } = await userClient
      .from("source_catalog")
      .select("source_key, source_family, source_app, workspace, root_path, adapter_key, health, notes, last_discovered_at")
      .order("workspace", { ascending: true });

    if (error) {
      throw error;
    }

    return withJson(
      200,
      (data ?? []).map((item) => ({
        sourceKey: item.source_key,
        sourceFamily: item.source_family,
        sourceApp: item.source_app,
        workspace: item.workspace,
        rootPath: item.root_path,
        adapterKey: item.adapter_key,
        health: item.health,
        notes: item.notes,
        lastDiscoveredAt: item.last_discovered_at,
      })),
    );
  } catch (error) {
    return withJson(401, { error: error instanceof Error ? error.message : "Unauthorized" });
  }
});
