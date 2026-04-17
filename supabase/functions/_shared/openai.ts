const openAiBaseUrl = Deno.env.get("OPENAI_BASE_URL") ?? "";
const openAiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
const chatModel = Deno.env.get("CHAT_MODEL") ?? "";
const embeddingModel = Deno.env.get("EMBEDDING_MODEL") ?? "";

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

const buildFallbackAnswer = (question: string, contextCount: number) => {
  if (contextCount === 0) {
    return {
      answer:
        "目前资料里还没有找到足够依据，暂时不能对这个问题下结论。你可以补充项目名、页面名、时间范围或聊天对象，我再继续帮你归纳。",
      confidenceLabel: "insufficient" as const,
      notes: ["当前没有检索到足够证据，所以系统没有给出结论性判断。"],
    };
  }

  return {
    answer:
      `我先根据已检索到的 ${contextCount} 条脱敏资料做一个初步业务判断：这件事已经能找到相关依据，但当前环境还没有启用在线大模型，所以系统暂时只能给你保守说明，不能自动整理成更完整的业务口径。你可以先查看引用依据，或者接通模型后获得更自然的中文总结。`,
    confidenceLabel: contextCount >= 3 ? ("medium" as const) : ("low" as const),
    notes: [`回退回答已根据问题“${question}”和当前检索结果生成。`],
  };
};

const buildSystemPrompt = () => `
你是“童园”，是用户本人给同事解释工作的分身。

默认受众：
- 中文业务同事、项目同事、管理同事。
- 他们通常不懂代码，也不关心技术实现细节。

你的回答原则：
1. 先讲明确结论，再讲业务含义、影响范围和建议动作。
2. 如果证据来自代码，也必须翻译成业务功能、页面用途、流程节点、资料流转、角色职责或统计口径。
3. 除非用户明确要求技术细节，否则不要堆类名、函数名、接口名、表名、字段名、SQL、文件路径。
4. 语气像微信里回复同事：自然、稳妥、直接、有协作感。
5. 只能依据给出的资料作答，不能编造。证据不足时要明确说“目前资料只能确认……，还不能完全下结论”。
6. 如果多条资料的结论不一致，要主动指出分歧，不要硬凑统一答案。

输出要求：
- 全程使用简体中文。
- 不要写英文标题，不要写“Context”“Summary”这类英文小节。
- 第一行先给结论。
- 后面用 2 到 4 句解释业务影响、适用对象、建议动作。
- 如果还需要补充信息，最后单独写一行：建议继续确认：……
`.trim();

export const createQueryEmbedding = async (question: string): Promise<number[] | null> => {
  if (!openAiBaseUrl || !openAiApiKey || !embeddingModel) {
    return null;
  }

  const response = await requestJson("/embeddings", {
    model: embeddingModel,
    input: question,
  });

  return response.data?.[0]?.embedding ?? null;
};

export const createGroundedAnswer = async (
  question: string,
  contexts: string[],
) => {
  if (!openAiBaseUrl || !openAiApiKey || !chatModel) {
    return buildFallbackAnswer(question, contexts.length);
  }

  const response = await requestJson("/chat/completions", {
    model: chatModel,
    temperature: 0.15,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      {
        role: "user",
        content: `用户问题：\n${question}\n\n资料依据：\n${contexts.join("\n\n---\n\n")}`,
      },
    ],
  });

  const answer = response.choices?.[0]?.message?.content?.trim() ??
    "目前模型没有返回可用内容，请稍后重试。";

  return {
    answer,
    confidenceLabel: contexts.length >= 4 ? "high" : contexts.length >= 2 ? "medium" : "low",
    notes: ["回答仅基于当前检索到的脱敏资料生成。"],
  };
};
