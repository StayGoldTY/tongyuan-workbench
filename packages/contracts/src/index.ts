export type BotIdentifier = "tongyuan" | "ty";

export type SourceFamily = "code" | "chat" | "document";

export type PermissionScope = "owner_only" | "team" | "redacted";

export interface AttachmentReference {
  label: string;
  uri?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface KnowledgeChunk {
  chunkIndex: number;
  contentRedacted: string;
  summary: string;
  metadata?: Record<string, unknown>;
  embedding?: number[] | null;
}

export interface KnowledgeUnit {
  externalId: string;
  bot: BotIdentifier;
  sourceFamily: SourceFamily;
  sourceApp: string;
  workspace: string;
  conversationId?: string | null;
  speaker?: string | null;
  title: string;
  contentRedacted: string;
  summary: string;
  tags: string[];
  eventTime?: string | null;
  permissions: PermissionScope[];
  allowedEmails: string[];
  attachmentRefs: AttachmentReference[];
  checksum: string;
  sourceUri?: string | null;
  embedding?: number[] | null;
  chunks: KnowledgeChunk[];
}

export interface Citation {
  id: string;
  title: string;
  sourceApp: string;
  workspace: string;
  excerpt: string;
  sourceUri?: string | null;
  eventTime?: string | null;
  confidence: number;
  tags: string[];
}

export interface ChatQueryRequest {
  bot: BotIdentifier;
  question: string;
  topK?: number;
  timeRange?: {
    start?: string;
    end?: string;
  };
}

export interface ChatQueryResponse {
  answer: string;
  confidenceLabel: "high" | "medium" | "low" | "insufficient";
  citations: Citation[];
  notes: string[];
}

export interface SourceCatalogEntry {
  sourceKey: string;
  sourceFamily: SourceFamily;
  sourceApp: string;
  workspace: string;
  rootPath: string;
  adapterKey: string;
  health: "ready" | "missing" | "warning" | "failed";
  notes?: string;
  lastDiscoveredAt?: string;
}

export interface SyncSourceStatus {
  sourceKey: string;
  workspace: string;
  sourceApp: string;
  status: "ready" | "synced" | "skipped" | "failed";
  discoveredUnits: number;
  uploadedUnits: number;
  message: string;
}

export interface DocumentDetail {
  id: string;
  title: string;
  summary: string;
  contentRedacted: string;
  sourceApp: string;
  workspace: string;
  sourceFamily: SourceFamily;
  tags: string[];
  eventTime?: string | null;
  sourceUri?: string | null;
}

export interface IngestionBatchRequest {
  bot: BotIdentifier;
  runSummary: Record<string, unknown>;
  sources: SourceCatalogEntry[];
  syncStatuses: SyncSourceStatus[];
  knowledgeUnits: KnowledgeUnit[];
}

export interface IngestionBatchResponse {
  runId: string;
  insertedUnits: number;
  insertedChunks: number;
}

export interface InviteRequest {
  email: string;
  reason?: string;
}

export interface InviteResponse {
  email: string;
  status: "sent" | "skipped";
  message: string;
}
