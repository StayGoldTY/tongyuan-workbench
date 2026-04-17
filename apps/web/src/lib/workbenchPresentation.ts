import type { SourceCatalogEntry, SyncSourceStatus } from "@tongyuan/contracts";

export const examplePrompts = [
  "海南这一块现在主要服务哪个业务环节？",
  "湖南这个页面在业务上是给谁用的，主要解决什么问题？",
  "最近一次同步里，哪些变化需要提前和同事说明？",
  "这件需求之前在聊天里大概是怎么定下来的？",
];

const healthLabelMap: Record<SourceCatalogEntry["health"], string> = {
  ready: "可用",
  warning: "需关注",
  missing: "未发现",
  failed: "异常",
};

const syncStatusLabelMap: Record<SyncSourceStatus["status"], string> = {
  ready: "待处理",
  synced: "已同步",
  skipped: "已跳过",
  failed: "失败",
};

const confidenceLabelMap = {
  high: "把握较高",
  medium: "基本可靠",
  low: "仅供参考",
  insufficient: "证据不足",
} as const;

const sourceAppLabelMap: Record<string, string> = {
  git: "代码资料",
  wxwork: "企业微信",
  wechat: "微信",
  larkshell: "建研智通",
};

const sourceFamilyLabelMap: Record<string, string> = {
  code: "代码资料",
  chat: "聊天资料",
  document: "文档资料",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatHealthLabel = (health: SourceCatalogEntry["health"]): string =>
  healthLabelMap[health] ?? health;

export const formatSyncStatusLabel = (status: SyncSourceStatus["status"]): string =>
  syncStatusLabelMap[status] ?? status;

export const formatConfidenceLabel = (
  label: keyof typeof confidenceLabelMap,
): string => confidenceLabelMap[label];

export const formatSourceAppLabel = (sourceApp: string): string =>
  sourceAppLabelMap[sourceApp] ?? sourceApp;

export const formatSourceFamilyLabel = (sourceFamily: string): string =>
  sourceFamilyLabelMap[sourceFamily] ?? sourceFamily;

export const formatTimestamp = (value?: string | null): string => {
  if (!value) {
    return "时间未标注";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
};

export const countSyncedSources = (items: SyncSourceStatus[]): number =>
  items.filter((item) => item.status === "synced").length;

export const countFailedSources = (items: SyncSourceStatus[]): number =>
  items.filter((item) => item.status === "failed").length;

export const countSkippedSources = (items: SyncSourceStatus[]): number =>
  items.filter((item) => item.status === "skipped").length;
