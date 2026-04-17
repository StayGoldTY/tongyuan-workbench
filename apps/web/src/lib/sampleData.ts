import type {
  ChatQueryResponse,
  Citation,
  DocumentDetail,
  SourceCatalogEntry,
  SyncSourceStatus,
} from "@tongyuan/contracts";

export const demoSources: SourceCatalogEntry[] = [
  {
    sourceKey: "hainan-server",
    sourceFamily: "code",
    sourceApp: "git",
    workspace: "HAINAN.Server",
    rootPath: "D:/Code/WorkCode/HAINAN.Server",
    adapterKey: "code_repository",
    health: "ready",
    notes: "Legacy .NET backend with service, dto, repository, and mapping layers.",
    lastDiscoveredAt: "2026-04-17T09:40:00Z",
  },
  {
    sourceKey: "hainan-web",
    sourceFamily: "code",
    sourceApp: "git",
    workspace: "HAINAN.Web",
    rootPath: "D:/Code/WorkCode/HAINAN.Web",
    adapterKey: "code_repository",
    health: "ready",
    notes: "Vue-based frontend with modules, mock data, and deployment scripts.",
    lastDiscoveredAt: "2026-04-17T09:40:00Z",
  },
  {
    sourceKey: "hunan-kellyt",
    sourceFamily: "code",
    sourceApp: "git",
    workspace: "KellyT.Solutions.Prod",
    rootPath: "D:/Code/WorkCode/HUNAN-ALL/KellyT.Solutions.Prod",
    adapterKey: "code_repository",
    health: "ready",
    notes: "Surging-based backend for the Hunan regulation platform.",
    lastDiscoveredAt: "2026-04-17T09:40:00Z",
  },
  {
    sourceKey: "hunan-lekima",
    sourceFamily: "code",
    sourceApp: "git",
    workspace: "Lekima-App",
    rootPath: "D:/Code/WorkCode/HUNAN-ALL/Lekima-App",
    adapterKey: "code_repository",
    health: "ready",
    notes: "Vue 2 frontend with Element UI, ECharts, and mapping integrations.",
    lastDiscoveredAt: "2026-04-17T09:40:00Z",
  },
  {
    sourceKey: "wechat",
    sourceFamily: "chat",
    sourceApp: "wechat",
    workspace: "WeChat",
    rootPath: "C:/Users/14042/AppData/Roaming/Tencent/WeChat",
    adapterKey: "sqlite_chat_archive",
    health: "warning",
    notes: "Local stores found. Some databases may be encrypted or unreadable.",
    lastDiscoveredAt: "2026-04-17T09:40:00Z",
  },
  {
    sourceKey: "wxwork",
    sourceFamily: "chat",
    sourceApp: "wxwork",
    workspace: "WXWork",
    rootPath: "C:/Users/14042/AppData/Roaming/Tencent/WXWork",
    adapterKey: "sqlite_chat_archive",
    health: "warning",
    notes: "Logs and client stores found. Parsing falls back when tables are encrypted.",
    lastDiscoveredAt: "2026-04-17T09:40:00Z",
  },
];

export const demoDocuments: Record<string, DocumentDetail> = {
  "hainan-server-modules": {
    id: "hainan-server-modules",
    title: "海南后端模块地图",
    summary: "HAINAN.Server follows a layered structure with DTO, repository, service, and mapping projects.",
    contentRedacted:
      "关键目录包括 Bussiness、DataMapper、Dto、Services、Repository 和 Modules。问答时优先通过目录名和提交摘要定位业务边界，再引用具体源码文件。",
    sourceApp: "git",
    workspace: "HAINAN.Server",
    sourceFamily: "code",
    tags: ["hainan", "backend", "modules"],
    eventTime: "2026-04-17T09:40:00Z",
    sourceUri: "git://HAINAN.Server/module-map",
  },
  "lekima-page-interface": {
    id: "lekima-page-interface",
    title: "湖南前端页面与接口映射",
    summary: "Lekima-App keeps Vue 2 pages in src and uses axios-based calls for backend integration.",
    contentRedacted:
      "Element UI 和 ECharts 是主要依赖。页面问答优先从 src 下的视图组件、路由和接口调用中抽取证据，再把回答关联到具体页面。",
    sourceApp: "git",
    workspace: "Lekima-App",
    sourceFamily: "code",
    tags: ["hunan", "frontend", "vue2"],
    eventTime: "2026-04-17T09:40:00Z",
    sourceUri: "git://Lekima-App/page-interface-map",
  },
  "kellyt-workflow-chat": {
    id: "kellyt-workflow-chat",
    title: "湖南后端工作流讨论摘要",
    summary: "A sanitized chat-derived note about workflow routing and service ownership.",
    contentRedacted:
      "同步后的聊天知识单元只保留脱敏文本、时间、发送者和附件元数据。涉及账号、手机号、密钥和连接串的内容都已被替换。",
    sourceApp: "wxwork",
    workspace: "KellyT.Solutions.Prod",
    sourceFamily: "chat",
    tags: ["hunan", "chat", "workflow"],
    eventTime: "2026-04-15T10:20:00Z",
    sourceUri: "sqlite://wxwork/workflow-discussion",
  },
};

export const demoSyncStatuses: SyncSourceStatus[] = [
  {
    sourceKey: "hainan-server",
    workspace: "HAINAN.Server",
    sourceApp: "git",
    status: "synced",
    discoveredUnits: 124,
    uploadedUnits: 124,
    message: "Code files, docs, and recent commit digest were sanitized and queued.",
  },
  {
    sourceKey: "hunan-lekima",
    workspace: "Lekima-App",
    sourceApp: "git",
    status: "synced",
    discoveredUnits: 89,
    uploadedUnits: 89,
    message: "Vue pages and markdown docs were indexed for retrieval.",
  },
  {
    sourceKey: "wxwork-local",
    workspace: "WXWork",
    sourceApp: "wxwork",
    status: "skipped",
    discoveredUnits: 0,
    uploadedUnits: 0,
    message: "Encrypted tables were detected, so the adapter fell back to readable metadata only.",
  },
];

const highConfidenceCitation = (id: string): Citation => {
  const document = demoDocuments[id];

  return {
    id: document.id,
    title: document.title,
    sourceApp: document.sourceApp,
    workspace: document.workspace,
    excerpt: document.summary,
    sourceUri: document.sourceUri,
    eventTime: document.eventTime,
    confidence: 0.87,
    tags: document.tags,
  };
};

export const buildDemoResponse = (question: string): ChatQueryResponse => {
  const normalizedQuestion = question.toLowerCase();

  if (normalizedQuestion.includes("海南")) {
    return {
      answer:
        "海南相关问题优先从 HAINAN.Server 和 HAINAN.Web 两套仓库检索。当前知识库里最稳的入口是模块地图、README 和最近提交摘要。",
      confidenceLabel: "high",
      citations: [highConfidenceCitation("hainan-server-modules")],
      notes: ["当前答案来自演示数据。接上真实后端后会返回实时引用。"],
    };
  }

  if (normalizedQuestion.includes("页面") || normalizedQuestion.includes("湖南")) {
    return {
      answer:
        "湖南前端页面问题通常会先落到 Lekima-App 的 Vue 页面与接口调用映射。需要再细分时，可以继续按页面名或菜单名追问。",
      confidenceLabel: "medium",
      citations: [
        highConfidenceCitation("lekima-page-interface"),
        highConfidenceCitation("kellyt-workflow-chat"),
      ],
      notes: ["演示模式下会尽量给出最接近的来源，而不是完整实时检索结果。"],
    };
  }

  return {
    answer:
      "当前演示模式已经把工作代码仓库、聊天客户端目录和同步状态接到统一界面里。接入真实 Supabase 函数后，这里会返回带权限校验的检索问答。",
    confidenceLabel: "low",
    citations: [highConfidenceCitation("hainan-server-modules")],
    notes: [
      "没有找到强匹配关键词。",
      "可以试试：海南模块、湖南页面接口、最近同步状态。",
    ],
  };
};
