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
    return {
      answer: contexts.length
        ? `检索到了 ${contexts.length} 条引用。请根据右侧来源继续确认细节。`
        : "当前没有足够证据回答这个问题。",
      confidenceLabel: contexts.length >= 3 ? "medium" : "low",
      notes: ["当前使用了无模型回退答案。"],
    };
  }

  const response = await requestJson("/chat/completions", {
    model: chatModel,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are TongYuan, a grounded work knowledge assistant. Answer only from provided context. If evidence is weak, say so.",
      },
      {
        role: "user",
        content: `Question:\n${question}\n\nContext:\n${contexts.join("\n\n---\n\n")}`,
      },
    ],
  });

  const answer = response.choices?.[0]?.message?.content?.trim() ??
    "当前模型没有返回内容。";

  return {
    answer,
    confidenceLabel: contexts.length >= 3 ? "high" : contexts.length >= 1 ? "medium" : "insufficient",
    notes: ["答案仅基于脱敏后的检索片段生成。"],
  };
};
