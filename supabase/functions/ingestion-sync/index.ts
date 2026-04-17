import { corsHeaders, withJson } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const syncSecret = Deno.env.get("TONGYUAN_SYNC_SECRET") ?? "";

const pick = (record: Record<string, unknown>, camelKey: string, snakeKey: string) =>
  record[camelKey] ?? record[snakeKey];

const describeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown sync failure";
  }
};

const mapKnowledgeUnit = (unit: Record<string, unknown>) => ({
  external_id: pick(unit, "externalId", "external_id"),
  bot: unit.bot,
  source_family: pick(unit, "sourceFamily", "source_family"),
  source_app: pick(unit, "sourceApp", "source_app"),
  workspace: unit.workspace,
  conversation_id: pick(unit, "conversationId", "conversation_id") ?? null,
  speaker: unit.speaker ?? null,
  title: unit.title,
  content_redacted: pick(unit, "contentRedacted", "content_redacted"),
  summary: unit.summary,
  tags: unit.tags ?? [],
  event_time: pick(unit, "eventTime", "event_time") ?? null,
  permissions: unit.permissions ?? [],
  allowed_emails: pick(unit, "allowedEmails", "allowed_emails") ?? [],
  attachment_refs: pick(unit, "attachmentRefs", "attachment_refs") ?? [],
  checksum: unit.checksum,
  source_uri: pick(unit, "sourceUri", "source_uri") ?? null,
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
  const requestedRunId = typeof payload.runId === "string" && payload.runId ? payload.runId : "";
  const finalize = Boolean(payload.finalize);

  let runId = requestedRunId;
  let existingSummary: Record<string, unknown> = {};

  if (runId) {
    const { data: existingRun, error: existingRunError } = await adminClient
      .from("ingestion_runs")
      .select("id, summary")
      .eq("id", runId)
      .single();

    if (existingRunError) {
      return withJson(500, { error: existingRunError.message });
    }

    existingSummary = (existingRun.summary as Record<string, unknown> | null) ?? {};
  } else {
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

    runId = runRow.id;
  }

  try {
    const sourceRows = (payload.sources ?? []).map((source: Record<string, unknown>) => ({
      source_key: pick(source, "sourceKey", "source_key"),
      source_family: pick(source, "sourceFamily", "source_family"),
      source_app: pick(source, "sourceApp", "source_app"),
      workspace: source.workspace,
      root_path: pick(source, "rootPath", "root_path"),
      adapter_key: pick(source, "adapterKey", "adapter_key"),
      health: source.health,
      notes: source.notes ?? "",
      last_discovered_at: pick(source, "lastDiscoveredAt", "last_discovered_at") ?? new Date().toISOString(),
    }));

    if (sourceRows.length > 0) {
      const { error: sourceError } = await adminClient
        .from("source_catalog")
        .upsert(sourceRows, { onConflict: "source_key" });
      if (sourceError) {
        throw sourceError;
      }
    }

    const syncRows = (payload.syncStatuses ?? []).map((status: Record<string, unknown>) => ({
      source_key: pick(status, "sourceKey", "source_key"),
      workspace: status.workspace,
      source_app: pick(status, "sourceApp", "source_app"),
      status: status.status,
      discovered_units: pick(status, "discoveredUnits", "discovered_units") ?? 0,
      uploaded_units: pick(status, "uploadedUnits", "uploaded_units") ?? 0,
      message: status.message ?? "",
      last_run_id: runId,
      updated_at: new Date().toISOString(),
    }));

    if (syncRows.length > 0) {
      const { error: syncError } = await adminClient
        .from("source_sync_statuses")
        .upsert(syncRows, { onConflict: "source_key" });
      if (syncError) {
        throw syncError;
      }
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

      const { error: deleteChunkError } = await adminClient
        .from("knowledge_chunks")
        .delete()
        .eq("knowledge_unit_id", stored.id);
      if (deleteChunkError) {
        throw deleteChunkError;
      }

      const chunkRows = ((unit.chunks ?? []) as Array<Record<string, unknown>>).map((chunk) => ({
        knowledge_unit_id: stored.id,
        chunk_index: pick(chunk, "chunkIndex", "chunk_index"),
        content_redacted: pick(chunk, "contentRedacted", "content_redacted"),
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

    const nextSummary = {
      ...existingSummary,
      ...(payload.runSummary ?? {}),
      insertedUnits: Number(existingSummary.insertedUnits ?? 0) + insertedUnits,
      insertedChunks: Number(existingSummary.insertedChunks ?? 0) + insertedChunks,
    };

    await adminClient
      .from("ingestion_runs")
      .update({
        status: finalize ? "succeeded" : "running",
        finished_at: finalize ? new Date().toISOString() : null,
        summary: nextSummary,
      })
      .eq("id", runId);

    return withJson(200, { runId, insertedUnits, insertedChunks });
  } catch (error) {
    const errorMessage = describeError(error);

    await adminClient
      .from("ingestion_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        summary: {
          ...existingSummary,
          ...(payload.runSummary ?? {}),
          error: errorMessage,
        },
      })
      .eq("id", runId);

    return withJson(500, { error: errorMessage });
  }
});
