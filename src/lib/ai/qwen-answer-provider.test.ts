import { afterEach, describe, expect, it, vi } from "vitest";
import { QwenAnswerProvider } from "./qwen-answer-provider";

const config = {
  apiKey: "qwen-key",
  model: "qwen3.8-flash",
  baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  webSearchEnabled: true,
};

describe("QwenAnswerProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends image input and web tools, then returns safe source citations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      status: "completed",
      output: [{
        type: "message",
        role: "assistant",
        content: [{
          type: "output_text",
          text: "นี่คือคำอธิบายรูปภาพค่ะ",
          annotations: [
            { type: "url_citation", title: "Official source", url: "https://example.com/source" },
            { type: "url_citation", title: "Unsafe", url: "javascript:alert(1)" },
          ],
        }],
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await new QwenAnswerProvider(config).answer({
      systemPrompt: "Be polite",
      userText: "อ่านข้อความในภาพ",
      imageDataUrl: "data:image/jpeg;base64,aGVsbG8=",
    });

    expect(answer).toEqual({
      text: "นี่คือคำอธิบายรูปภาพค่ะ",
      sources: [{ title: "Official source", url: "https://example.com/source" }],
    });
    expect(fetchMock.mock.calls[0][0]).toBe(`${config.baseUrl}/responses`);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.tools).toEqual([{ type: "web_search" }, { type: "web_extractor" }]);
    expect(request.reasoning).toEqual({ effort: "low" });
    expect(request.max_output_tokens).toBe(1600);
    expect(request.input[1].content).toEqual([
      { type: "input_text", text: "อ่านข้อความในภาพ" },
      { type: "input_image", image_url: "data:image/jpeg;base64,aGVsbG8=" },
    ]);
  });

  it("does not attach web tools when search is disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ output_text: "คำตอบค่ะ" }));
    vi.stubGlobal("fetch", fetchMock);

    await new QwenAnswerProvider({ ...config, webSearchEnabled: false }).answer({ systemPrompt: "system", userText: "hello" });

    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.tools).toBeUndefined();
  });

  it("reports an incomplete Qwen response without pretending it has an answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      status: "incomplete",
      output: [{ type: "reasoning" }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new QwenAnswerProvider(config).answer({ systemPrompt: "system", userText: "hello" }))
      .rejects.toThrow("status=incomplete, output=reasoning");
  });
});
