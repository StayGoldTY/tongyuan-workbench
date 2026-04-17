import { corsHeaders, withJson } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const syncSecret = Deno.env.get("TONGYUAN_SYNC_SECRET") ?? "";

const mapKnowledgeUnit = (unit: Record<string, unknown>) => ({
  external_id: unit.externalId,
  bot: unit.bot,
  source_family: unit.sourceFamily,
  source_app: unit.sourceApp,
  workspace: unit.workspace,
  conversation_id: unit.conversationId ?? null,
  speaker: unit.speaker ?? null,
  title: unit.title,
  content_redacted: unit.contentRedacted,
  summary: unit.summary,
  tags: unit.tags ?? [],
  event_time: unit.eventTime ?? null,
  permissions: unit.permissions ?? [],
  allowed_emails: unit.allowedEmails ?? [],
  attachment_refs: unit.attachmentRefs ?? [],
  checksum: unit.checksum,
  source_uri: unit.sourceUri ?? null,
  updated_at: new Date().toISOString(),
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.headers.get("x-tongyuan-sync-key") !== syncSecret) {
    return withJson(401, { error: "Invalid sync key" });
  }

  const adminClient = createAdminClient();
  const payload = await request.json();
  const { data: runRow, error: runError } = await adminClient
    .from("ingestion_runs")
    .insert({
      trigger_source: "collector",
      status: "running",
      summary: payload.runSummary ?? {},
    })
    .select("id")
    .single();

  if (runError) {
    return withJson(500, { error: runError.message });
  }

  const runId = runRow.id;

  try {
    const sourceRows = (payload.sources ?? []).map((source: Record<string, unknown>) => ({
      source_key: source.sourceKey,
      source_family: source.sourceFamily,
      source_app: source.sourceApp,
      workspace: source.workspace,
      root_path: source.rootPath,
      adapter_key: source.adapterKey,
      health: source.health,
      notes: source.notes ?? "",
      last_discovered_at: source.lastDiscoveredAt ?? new Date().toISOString(),
    }));

    if (sourceRows.length > 0) {
      await adminClient.from("source_catalog").upsert(sourceRows, { onConflict: "source_key" });
    }

    const syncRows = (payload.syncStatuses ?? []).map((status: Record<string, unknown>) => ({
      source_key: status.sourceKey,
      workspace: status.workspace,
      source_app: status.sourceApp,
      status: status.status,
      discovered_units: status.discoveredUnits ?? 0,
      uploaded_units: status.uploadedUnits ?? 0,
      message: status.message ?? "",
      last_run_id: runId,
      updated_at: new Date().toISOString(),
    }));

    if (syncRows.length > 0) {
      await adminClient.from("source_sync_statuses").upsert(syncRows, { onConflict: "source_key" });
    }

    let insertedUnits = 0;
    let insertedChunks = 0;

    for (const unit of payload.knowledgeUnits ?? []) {
      const unitRow = mapKnowledgeUnit(unit);
      const { data: stored, error: unitError } = await adminClient
        .from("knowledge_units")
        .upsert(unitRow, { onConflict: "external_id" })
        .select("id")
        .single();

      if (unitError) {
        throw unitError;
      }

      await adminClient.from("knowledge_chunks").delete().eq("knowledge_unit_id", stored.id);
      const chunkRows = ((unit.chunks ?? []) as Array<Record<string, unknown>>).map((chunk) => ({
        knowledge_unit_id: stored.id,
        chunk_index: chunk.chunkIndex,
        content_redacted: chunk.contentRedacted,
        summary: chunk.summary,
        metadata: chunk.metadata ?? {},
        embedding: chunk.embedding ?? null,
      }));

      if (chunkRows.length > 0) {
        const { error: chunkError } = await adminClient.from("knowledge_chunks").insert(chunkRows);
        if (chunkError) {
          throw chunkError;
        }
      }

      insertedUnits += 1;
      insertedChunks += chunkRows.length;
    }

    await adminClient
      .from("ingestion_runs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        summary: {
          ...(payload.runSummary ?? {}),
          insertedUnits,
          insertedChunks,
        },
      })
      .eq("id", runId);

    return withJson(200, { runId, insertedUnits, insertedChunks });
  } catch (error) {
    await adminClient
      .from("ingestion_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        summary: {
          ...(payload.runSummary ?? {}),
          error: error instanceof Error ? error.message : "Unknown sync failure",
        },
      })
      .eq("id", runId);

    return withJson(500, { error: error instanceof Error ? error.message : "Sync failed" });
  }
});
