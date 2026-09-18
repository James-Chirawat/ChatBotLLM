import { afterEach, describe, expect, it, vi } from "vitest";
import { getLineImageContent, replyToLine, startLineLoadingIndicator } from "./client";

describe("replyToLine", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("issues a new stateless token from channel credentials before replying", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: "temporary-token", expires_in: 900 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await replyToLine({
      channelId: "123456",
      channelSecret: "channel-secret",
      replyToken: "reply-token",
      text: "สวัสดีค่ะ",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]).toEqual([
      "https://api.line.me/oauth2/v3/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials&client_id=123456&client_secret=channel-secret",
      }),
    ]);
    expect(fetchMock.mock.calls[1]).toEqual([
      "https://api.line.me/v2/bot/message/reply",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer temporary-token" }) }),
    ]);
  });

  it("starts LINE's native loading animation for a one-to-one chat", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: "temporary-token", expires_in: 900 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await startLineLoadingIndicator({
      channelId: "123456",
      channelSecret: "channel-secret",
      chatId: "U123",
      loadingSeconds: 60,
    });

    expect(fetchMock.mock.calls[1]).toEqual([
      "https://api.line.me/v2/bot/chat/loading/start",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer temporary-token" }),
        body: JSON.stringify({ chatId: "U123", loadingSeconds: 60 }),
      }),
    ]);
  });

  it("downloads a LINE image to an in-memory data URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: "temporary-token", expires_in: 900 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const image = await getLineImageContent({ channelId: "123456", channelSecret: "channel-secret", messageId: "image-id" });

    expect(image).toEqual({ dataUrl: "data:image/png;base64,AQID" });
    expect(fetchMock.mock.calls[1][0]).toBe("https://api-data.line.me/v2/bot/message/image-id/content");
  });
});
