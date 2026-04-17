import type {
  ChatQueryRequest,
  ChatQueryResponse,
  DocumentDetail,
  InviteRequest,
  InviteResponse,
  SourceCatalogEntry,
  SyncSourceStatus,
} from "@tongyuan/contracts";
import { buildDemoResponse, demoDocuments, demoSources, demoSyncStatuses } from "./sampleData";
import { supabaseClient } from "./supabaseClient";

const explicitApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const explicitFunctionsBaseUrl =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.replace(/\/$/, "") ?? "";
const derivedFunctionsBaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  ? `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1`
  : "";
const functionsBaseUrl = explicitFunctionsBaseUrl || derivedFunctionsBaseUrl;
const apiBaseUrl = explicitApiBaseUrl || functionsBaseUrl;
const usesSupabaseFunctionEndpoints = !explicitApiBaseUrl && functionsBaseUrl.length > 0;

export const mapLogicalPathToFunctionPath = (path: string): string => {
  if (path === "/chat/query") {
    return "/chat-query";
  }

  if (path === "/sources" || path === "/sources?view=sync") {
    return path;
  }

  if (path.startsWith("/documents")) {
    return path;
  }

  if (path === "/admin/invite") {
    return "/admin-invite";
  }

  return path;
};

export const resolveRemotePath = (path: string): string =>
  usesSupabaseFunctionEndpoints ? mapLogicalPathToFunctionPath(path) : path;

const fetchJson = async <T>(
  path: string,
  init?: RequestInit,
  accessToken?: string,
): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${resolveRemotePath(path)}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
};

export const supportsRemoteApi = (): boolean => apiBaseUrl.length > 0;

export const supportsMagicLink = (): boolean => Boolean(supabaseClient);

export const loginWithMagicLink = async (email: string): Promise<"demo" | "magic-link"> => {
  if (!supabaseClient) {
    return "demo";
  }

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href,
    },
  });

  if (error) {
    throw error;
  }

  return "magic-link";
};

export const getCurrentAccessToken = async (): Promise<string | undefined> => {
  if (!supabaseClient) {
    return undefined;
  }

  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token;
};

export const getCurrentSessionEmail = async (): Promise<string | null> => {
  if (!supabaseClient) {
    return null;
  }

  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    return null;
  }

  return data.user.email ?? null;
};

export const signOutSession = async (): Promise<void> => {
  if (!supabaseClient) {
    return;
  }

  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    throw error;
  }
};

export const listSources = async (): Promise<SourceCatalogEntry[]> => {
  if (!supportsRemoteApi()) {
    return demoSources;
  }

  const accessToken = await getCurrentAccessToken();
  return fetchJson<SourceCatalogEntry[]>("/sources", undefined, accessToken);
};

export const listSyncStatuses = async (): Promise<SyncSourceStatus[]> => {
  if (!supportsRemoteApi()) {
    return demoSyncStatuses;
  }

  const accessToken = await getCurrentAccessToken();
  return fetchJson<SyncSourceStatus[]>("/sources?view=sync", undefined, accessToken);
};

export const queryTongyuan = async (
  request: ChatQueryRequest,
): Promise<ChatQueryResponse> => {
  if (!supportsRemoteApi()) {
    return buildDemoResponse(request.question);
  }

  const accessToken = await getCurrentAccessToken();
  return fetchJson<ChatQueryResponse>(
    "/chat/query",
    {
      method: "POST",
      body: JSON.stringify(request),
    },
    accessToken,
  );
};

export const getDocumentDetail = async (
  documentId: string,
): Promise<DocumentDetail | null> => {
  if (!supportsRemoteApi()) {
    return demoDocuments[documentId] ?? null;
  }

  const accessToken = await getCurrentAccessToken();
  return fetchJson<DocumentDetail | null>(
    `/documents?id=${encodeURIComponent(documentId)}`,
    undefined,
    accessToken,
  );
};

export const sendInvite = async (
  request: InviteRequest,
): Promise<InviteResponse> => {
  if (!supportsRemoteApi()) {
    return {
      email: request.email,
      status: "sent",
      message: "当前是演示模式，我已经记下这条邀请请求。接通私有后端后才会真正发出邀请。",
    };
  }

  const accessToken = await getCurrentAccessToken();
  return fetchJson<InviteResponse>(
    "/admin/invite",
    {
      method: "POST",
      body: JSON.stringify(request),
    },
    accessToken,
  );
};
