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
    notes: "海南后端主仓库，主要承接审查流转、资料处理和系统规则能力。",
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
    notes: "海南前端主仓库，包含页面、表单、流程入口和部署相关脚本。",
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
    notes: "湖南后端主仓库，主要承接监管平台的流程、统计和规则处理。",
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
    notes: "湖南前端主仓库，主要覆盖监管页面、图表展示和业务录入入口。",
    lastDiscoveredAt: "2026-04-17T09:40:00Z",
  },
  {
    sourceKey: "wechat",
    sourceFamily: "chat",
    sourceApp: "wechat",
    workspace: "WeChat",
    rootPath: "D:/WeChat Files",
    adapterKey: "sqlite_chat_archive",
    health: "warning",
    notes: "已发现真实微信账号目录和消息库，但当前客户端库是加密格式，需要先走本地解密或导出流程后才能读取正文。",
    lastDiscoveredAt: "2026-04-17T09:40:00Z",
  },
  {
    sourceKey: "wxwork",
    sourceFamily: "chat",
    sourceApp: "wxwork",
    workspace: "WXWork",
    rootPath: "C:/Users/14042/AppData/Roaming/Tencent/WXWork",
    adapterKey: "sqlite_chat_archive",
    health: "ready",
    notes: "已发现企业微信日志与可读元数据，当前优先保留下发、文档、邮件等业务线索。",
    lastDiscoveredAt: "2026-04-17T09:40:00Z",
  },
  {
    sourceKey: "larkshell",
    sourceFamily: "chat",
    sourceApp: "larkshell",
    workspace: "建研智通",
    rootPath: "C:/Users/14042/AppData/Roaming/LarkShell-ka-dajzkx436",
    adapterKey: "sqlite_chat_archive",
    health: "ready",
    notes: "已发现建研智通工作台模板、下载通知和组织信息等结构化资料。",
    lastDiscoveredAt: "2026-04-17T09:40:00Z",
  },
];

export const demoDocuments: Record<string, DocumentDetail> = {
  "hainan-process-overview": {
    id: "hainan-process-overview",
    title: "海南业务流程概况",
    summary: "当前资料显示，海南相关能力主要围绕项目受理、资料审查、状态流转和结果反馈展开。",
    contentRedacted:
      "从仓库概况和最近的改动摘要来看，海南这一侧重点不是单一页面，而是围绕项目资料提交、规则校验、状态推进和结果回传这一整条业务链路在持续演进。对业务同事来说，可以把它理解成“前台收资料、后台控规则、流程管状态、结果再回传”的闭环。",
    sourceApp: "git",
    workspace: "HAINAN.Server",
    sourceFamily: "code",
    tags: ["hainan", "业务流程", "资料审查"],
    eventTime: "2026-04-17T09:40:00Z",
    sourceUri: "git://HAINAN.Server/overview",
  },
  "lekima-page-role": {
    id: "lekima-page-role",
    title: "湖南页面业务定位",
    summary: "湖南前端页面更偏向监管展示、数据录入和流程跟踪，后端负责规则处理和统计汇总。",
    contentRedacted:
      "从页面映射和接口摘要来看，湖南前端更像业务操作台：页面负责录入、查询和展示，后端负责规则判断、状态变更和汇总统计。所以同事如果问“这个页面是干什么的”，通常可以先从“给谁看、在哪个环节用、会影响哪个状态”来解释，而不是先说接口名。",
    sourceApp: "git",
    workspace: "Lekima-App",
    sourceFamily: "code",
    tags: ["hunan", "页面定位", "监管平台"],
    eventTime: "2026-04-17T09:40:00Z",
    sourceUri: "git://Lekima-App/page-role",
  },
  "wxwork-discussion-summary": {
    id: "wxwork-discussion-summary",
    title: "企业微信讨论摘要",
    summary: "当前脱敏记录里能看到文档、下载和邮件相关线索，适合用来辅助回忆需求结论和资料来源。",
    contentRedacted:
      "企业微信当前优先保留了文档页、下载链接和邮件动作等业务痕迹，不直接暴露原始聊天正文。对同事来说，它更适合回答“当时讨论大致围绕什么资料”“是否有相关文档或附件线索”，而不是逐字还原聊天原文。",
    sourceApp: "wxwork",
    workspace: "WXWork",
    sourceFamily: "chat",
    tags: ["聊天线索", "文档", "下载"],
    eventTime: "2026-04-15T10:20:00Z",
    sourceUri: "sqlite://wxwork/discussion-summary",
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
    message: "代码概况、文档摘要和最近改动已经完成脱敏整理。",
  },
  {
    sourceKey: "hunan-lekima",
    workspace: "Lekima-App",
    sourceApp: "git",
    status: "synced",
    discoveredUnits: 89,
    uploadedUnits: 89,
    message: "页面映射、业务说明和相关资料索引已经进入知识库。",
  },
  {
    sourceKey: "wechat",
    workspace: "WeChat",
    sourceApp: "wechat",
    status: "failed",
    discoveredUnits: 0,
    uploadedUnits: 0,
    message: "已识别真实微信消息库，但当前数据库仍是加密状态，需先完成本地解密后才能继续采集。",
  },
  {
    sourceKey: "wxwork",
    workspace: "WXWork",
    sourceApp: "wxwork",
    status: "synced",
    discoveredUnits: 42,
    uploadedUnits: 42,
    message: "企业微信已保留可读的下载、文档和邮件类业务线索。",
  },
];

const buildCitation = (id: string, confidence: number): Citation => {
  const document = demoDocuments[id];

  return {
    id: document.id,
    title: document.title,
    sourceApp: document.sourceApp,
    workspace: document.workspace,
    excerpt: document.summary,
    sourceUri: document.sourceUri,
    eventTime: document.eventTime,
    confidence,
    tags: document.tags,
  };
};

export const buildDemoResponse = (question: string): ChatQueryResponse => {
  const normalizedQuestion = question.toLowerCase();

  if (normalizedQuestion.includes("海南")) {
    return {
      answer:
        "先这样理解，海南这块现在重点不是某一个页面怎么写，而是整条业务流怎么稳住。从资料进入系统，到规则校验、状态流转、结果反馈，这几步是连在一起的。你如果要和同事沟通，建议先讲它影响的是哪个业务环节、谁会用到、状态会怎么变化；如果你再补一个具体功能名，我可以继续帮你收窄到更细。",
      confidenceLabel: "high",
      citations: [buildCitation("hainan-process-overview", 0.9)],
      notes: ["当前是演示数据，接通真实知识库后会替换成实时检索结果。"],
    };
  }

  if (normalizedQuestion.includes("湖南") || normalizedQuestion.includes("页面")) {
    return {
      answer:
        "湖南这边的页面更像业务操作台，不建议直接按代码结构去解释。更适合跟同事说的是：这个页面给谁用、处在什么业务环节、录入后会推动什么状态、后台会做哪些判断。简单讲，页面负责呈现和操作，后台负责规则和统计，前后是配套关系。",
      confidenceLabel: "medium",
      citations: [buildCitation("lekima-page-role", 0.82)],
      notes: ["如果继续补充页面名、菜单名或报表名，童园可以把范围再缩小。"],
    };
  }

  if (normalizedQuestion.includes("聊天") || normalizedQuestion.includes("讨论") || normalizedQuestion.includes("结论")) {
    return {
      answer:
        "当前演示里的聊天知识更偏向“辅助回忆结论和资料线索”，不是逐字还原原始对话。也就是说，童园会更适合告诉同事：当时讨论大致围绕什么、有没有相关文档或附件、结论大概落在哪个方向。如果要继续追某条结论，可以再补项目名、时间段或参与方。",
      confidenceLabel: "medium",
      citations: [buildCitation("wxwork-discussion-summary", 0.76)],
      notes: ["真实环境里，系统会优先从脱敏后的聊天片段和元数据里找依据。"],
    };
  }

  return {
    answer:
      "现在童园已经接入了工作代码、企业微信和建研智通等脱敏资料。你可以直接用业务语言来问，比如“这个功能是做什么的”“这项需求之前怎么定的”“最近同步里有什么重点”，系统会优先给业务结论，再附上来源依据。",
    confidenceLabel: "low",
    citations: [buildCitation("hainan-process-overview", 0.61)],
    notes: ["如果问题里带上项目名、页面名、时间范围或讨论对象，回答会更贴近实际。"],
  };
};
