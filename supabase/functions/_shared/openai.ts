type ConfidenceLabel = "high" | "medium" | "low" | "insufficient";

type GroundedAnswer = {
  answer: string;
  confidenceLabel: ConfidenceLabel;
  notes: string[];
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

const readEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = Deno.env.get(key)?.trim();
    if (value) {
      return value;
    }
  }

  return "";
};

const openAiBaseUrl = readEnv("OPENAI_BASE_URL", "TONGYUAN_OPENAI_BASE_URL");
const openAiApiKey = readEnv("OPENAI_API_KEY", "TONGYUAN_OPENAI_API_KEY");
const chatModel = readEnv(
  "CHAT_MODEL",
  "OPENAI_CHAT_MODEL",
  "OPENAI_MODEL",
  "TONGYUAN_CHAT_MODEL",
);
const embeddingModel = readEnv(
  "EMBEDDING_MODEL",
  "OPENAI_EMBEDDING_MODEL",
  "TONGYUAN_EMBEDDING_MODEL",
);
const wireApi = readEnv("OPENAI_WIRE_API", "TONGYUAN_OPENAI_WIRE_API");

const requestJson = async (path: string, payload: unknown) => {
  const response = await fetch(`${openAiBaseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
};

const buildFallbackAnswer = (question: string, contextCount: number): GroundedAnswer => {
  if (contextCount === 0) {
    return {
      answer:
        "目前资料里还没有找到足够依据，这个问题我先不硬下结论。你可以补充项目名、页面名、时间范围，或者说明是微信、企业微信还是建研智通里的讨论，我再继续帮你收窄。",
      confidenceLabel: "insufficient",
      notes: ["当前没有检索到足够的脱敏资料，所以系统不会编造答案。"],
    };
  }

  return {
    answer:
      `先给你一个保守判断：这次已经找到了 ${contextCount} 条相关依据，但当前模型链路还没有返回可直接使用的自然语言结果。你可以先查看右侧引用片段确认方向；如果需要，我会继续基于这些依据把结论整理成更口语化的业务说明。`,
    confidenceLabel: contextCount >= 4 ? "medium" : "low",
    notes: [`本次回退回答仍然基于问题“${question}”和当前检索到的脱敏资料生成。`],
  };
};

const buildSystemPrompt = () =>
  [
    "你是“童园”，是用户本人给中文同事解释工作的分身。",
    "默认受众是不懂代码的业务同事、项目同事和管理同事。",
    "你的回答目标不是解释技术实现，而是把资料翻译成业务语言。",
    "回答规则：",
    "1. 第一行先给明确结论。",
    "2. 后面用 2 到 4 句讲清楚业务含义、影响对象、风险或建议动作。",
    "3. 能不提代码就不提代码，不主动说类名、方法名、接口名、表名、字段名、SQL、文件路径。",
    "4. 如果证据来自代码，也要翻译成页面用途、流程节点、角色职责、资料流转、统计口径或对外协同含义。",
    "5. 语气像微信里直接回同事，自然、直接、稳妥，不要像客服，不要像技术文档。",
    "6. 只能根据提供的资料作答，证据不够就明确说“目前只能确认到这里，还不能完全下结论”。",
    "7. 如果多条证据互相矛盾，要主动指出分歧来自哪里。",
    "8. 不要写英文标题，不要写“根据资料显示”“综合分析如下”这种生硬开场。",
    "输出要求：",
    "- 全程简体中文。",
    "- 不要列表，不要分点编号，直接写成自然段。",
    "- 尽量用“这块”“这件事”“现在主要是”“如果你要继续推进”这类自然表达。",
  ].join("\n");

const buildUserPrompt = (question: string, contexts: string[]) =>
  [
    `用户问题：${question}`,
    "",
    "下面是可引用的脱敏资料，请只基于这些资料作答：",
    contexts.join("\n\n---\n\n"),
    "",
    "请直接给出业务化中文回答，不要复述这些资料结构。",
  ].join("\n");

const extractResponseText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidate = payload as Record<string, unknown>;

  if (typeof candidate.output_text === "string") {
    return candidate.output_text.trim();
  }

  const choices = Array.isArray(candidate.choices) ? candidate.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  if (typeof message?.content === "string") {
    return message.content.trim();
  }

  const output = Array.isArray(candidate.output) ? candidate.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as Array<Record<string, unknown>>)
      : [];
    for (const part of content) {
      if (typeof part.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  return "";
};

const requestModelAnswer = async (messages: ChatMessage[]) => {
  const preferResponsesApi = wireApi.toLowerCase() === "responses";

  if (preferResponsesApi) {
    try {
      const response = await requestJson("/responses", {
        model: chatModel,
        temperature: 0.2,
        input: messages.map((message) => ({
          role: message.role,
          content: [{ type: "input_text", text: message.content }],
        })),
      });
      const text = extractResponseText(response);
      if (text) {
        return text;
      }
    } catch {
      // fall through to chat completions
    }
  }

  const response = await requestJson("/chat/completions", {
    model: chatModel,
    temperature: 0.2,
    messages,
  });

  return extractResponseText(response);
};

export const createQueryEmbedding = async (question: string): Promise<number[] | null> => {
  if (!openAiBaseUrl || !openAiApiKey || !embeddingModel) {
    return null;
  }

  let response: unknown;
  try {
    response = await requestJson("/embeddings", {
      model: embeddingModel,
      input: question,
    });
  } catch {
    return null;
  }

  const data = (response as Record<string, unknown>).data;
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== "object") {
    return null;
  }

  const embedding = (data[0] as Record<string, unknown>).embedding;
  return Array.isArray(embedding) ? embedding as number[] : null;
};

export const createGroundedAnswer = async (
  question: string,
  contexts: string[],
): Promise<GroundedAnswer> => {
  if (contexts.length === 0) {
    return buildFallbackAnswer(question, 0);
  }

  if (!openAiBaseUrl || !openAiApiKey || !chatModel) {
    return buildFallbackAnswer(question, contexts.length);
  }

  const answer = await requestModelAnswer([
    {
      role: "system",
      content: buildSystemPrompt(),
    },
    {
      role: "user",
      content: buildUserPrompt(question, contexts),
    },
  ]);

  if (!answer) {
    return buildFallbackAnswer(question, contexts.length);
  }

  return {
    answer,
    confidenceLabel:
      contexts.length >= 5 ? "high" : contexts.length >= 3 ? "medium" : "low",
    notes: ["本次回答仅基于当前检索到的脱敏资料生成，未使用原始敏感内容。"],
  };
};
