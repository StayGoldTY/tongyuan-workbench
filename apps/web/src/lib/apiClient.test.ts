import { describe, expect, it } from "vitest";
import { mapLogicalPathToFunctionPath, queryTongyuan } from "./apiClient";

describe("queryTongyuan", () => {
  it("returns the Hainan demo citation for Hainan-focused questions", async () => {
    const response = await queryTongyuan({
      bot: "tongyuan",
      question: "海南后端模块怎么分层？",
      topK: 5,
    });

    expect(response.citations[0]?.workspace).toBe("HAINAN.Server");
    expect(response.confidenceLabel).toBe("high");
  });
});

describe("mapLogicalPathToFunctionPath", () => {
  it("maps the logical chat path to the Supabase function path", () => {
    expect(mapLogicalPathToFunctionPath("/chat/query")).toBe("/chat-query");
    expect(mapLogicalPathToFunctionPath("/admin/invite")).toBe("/admin-invite");
    expect(mapLogicalPathToFunctionPath("/documents?id=abc")).toBe("/documents?id=abc");
  });
});
