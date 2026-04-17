import { describe, expect, it } from "vitest";
import { mapLogicalPathToFunctionPath, queryTongyuan } from "./apiClient";

describe("queryTongyuan", () => {
  it("在演示模式下会按海南业务问题返回海南仓库引用", async () => {
    const response = await queryTongyuan({
      bot: "tongyuan",
      question: "海南这项功能现在主要服务哪一段业务流程？",
      topK: 5,
    });

    expect(response.citations[0]?.workspace).toBe("HAINAN.Server");
    expect(response.confidenceLabel).toBe("high");
  });
});

describe("mapLogicalPathToFunctionPath", () => {
  it("会把逻辑聊天路径映射到 Supabase 函数路径", () => {
    expect(mapLogicalPathToFunctionPath("/chat/query")).toBe("/chat-query");
    expect(mapLogicalPathToFunctionPath("/admin/invite")).toBe("/admin-invite");
    expect(mapLogicalPathToFunctionPath("/documents?id=abc")).toBe("/documents?id=abc");
  });
});
