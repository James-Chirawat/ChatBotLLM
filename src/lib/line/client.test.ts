// unit test ของฟังก์ชันเรียก LINE API: ใช้ fetch ปลอม จึงไม่เรียก LINE จริง

// ดึงเครื่องมือของ Vitest
import { afterEach, describe, expect, it, vi } from "vitest";
// ดึงฟังก์ชันที่จะทดสอบ
import { getLineImageContent, replyToLine, startLineLoadingIndicator } from "./client";

// กลุ่ม test ของ LINE client
describe("replyToLine", () => {
  // คืน fetch ตัวจริงหลังจบแต่ละ test
  afterEach(() => vi.unstubAllGlobals());

  // test: ต้องขอ token ใหม่ก่อน แล้วค่อยตอบข้อความด้วย token นั้น
  it("issues a new stateless token from channel credentials before replying", async () => {
    // สร้าง fetch ปลอมที่ตอบตามลำดับการเรียก
    const fetchMock = vi
      // เริ่มสร้าง mock function
      .fn()
      // ครั้งที่ 1 (ขอ token) คืน token ปลอม
      .mockResolvedValueOnce(Response.json({ access_token: "temporary-token", expires_in: 900 }))
      // ครั้งที่ 2 (reply) คืน 200 OK
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    // แทนที่ fetch
    vi.stubGlobal("fetch", fetchMock);

    // เรียกฟังก์ชันตอบข้อความด้วยข้อมูลปลอม
    await replyToLine({
      // Channel ID ปลอม
      channelId: "123456",
      // secret ปลอม
      channelSecret: "channel-secret",
      // reply token ปลอม
      replyToken: "reply-token",
      // ข้อความที่จะตอบ
      text: "สวัสดีค่ะ",
    });

    // ต้องเรียก fetch 2 ครั้งพอดี
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // ครั้งแรกต้องเป็นการขอ token ด้วยข้อมูลที่ถูกต้อง
    expect(fetchMock.mock.calls[0]).toEqual([
      // URL ขอ token
      "https://api.line.me/oauth2/v3/token",
      // ตรวจเฉพาะฟิลด์ที่ระบุ ฟิลด์อื่นจะมีหรือไม่ก็ได้
      expect.objectContaining({
        // ต้องเป็น POST
        method: "POST",
        // ต้องส่งเป็น form
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        // body ต้องมี ID และ secret ถูกต้อง
        body: "grant_type=client_credentials&client_id=123456&client_secret=channel-secret",
      }),
    ]);
    // ครั้งที่สองต้องเป็นการ reply โดยใช้ token ที่เพิ่งได้มา
    expect(fetchMock.mock.calls[1]).toEqual([
      // URL reply
      "https://api.line.me/v2/bot/message/reply",
      // header ต้องมี Bearer token ที่ได้จากครั้งแรก
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer temporary-token" }) }),
    ]);
  });

  // test: เรียก loading animation ถูกต้อง
  it("starts LINE's native loading animation for a one-to-one chat", async () => {
    // fetch ปลอมแบบเรียงลำดับ
    const fetchMock = vi
      // เริ่มสร้าง mock
      .fn()
      // ครั้งที่ 1 คืน token
      .mockResolvedValueOnce(Response.json({ access_token: "temporary-token", expires_in: 900 }))
      // ครั้งที่ 2 คืน 202 Accepted (LINE ตอบรหัสนี้สำหรับ loading API)
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    // แทนที่ fetch
    vi.stubGlobal("fetch", fetchMock);

    // เรียกฟังก์ชันแสดง loading
    await startLineLoadingIndicator({
      // Channel ID ปลอม
      channelId: "123456",
      // secret ปลอม
      channelSecret: "channel-secret",
      // userId ปลอม
      chatId: "U123",
      // แสดง 60 วินาที
      loadingSeconds: 60,
    });

    // ตรวจการเรียกครั้งที่สอง
    expect(fetchMock.mock.calls[1]).toEqual([
      // URL ของ loading API
      "https://api.line.me/v2/bot/chat/loading/start",
      // ตรวจ header และ body
      expect.objectContaining({
        // ต้องมี Bearer token
        headers: expect.objectContaining({ Authorization: "Bearer temporary-token" }),
        // body ต้องมี chatId และจำนวนวินาทีถูกต้อง
        body: JSON.stringify({ chatId: "U123", loadingSeconds: 60 }),
      }),
    ]);
  });

  // test: ดาวน์โหลดรูปแล้วแปลงเป็น data URL
  it("downloads a LINE image to an in-memory data URL", async () => {
    // fetch ปลอมแบบเรียงลำดับ
    const fetchMock = vi
      // เริ่มสร้าง mock
      .fn()
      // ครั้งที่ 1 คืน token
      .mockResolvedValueOnce(Response.json({ access_token: "temporary-token", expires_in: 900 }))
      // ครั้งที่ 2 คืนข้อมูลรูป 3 ไบต์ [1, 2, 3]
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        // สำเร็จ
        status: 200,
        // ชนิดไฟล์เป็น PNG
        headers: { "content-type": "image/png" },
      }));
    // แทนที่ fetch
    vi.stubGlobal("fetch", fetchMock);

    // เรียกดาวน์โหลดรูป
    const image = await getLineImageContent({ channelId: "123456", channelSecret: "channel-secret", messageId: "image-id" });

    // byte [1,2,3] ในรูปแบบ base64 คือ "AQID"
    expect(image).toEqual({ dataUrl: "data:image/png;base64,AQID" });
    // ต้องดาวน์โหลดจากโดเมน api-data และใช้ messageId ที่ส่งไป
    expect(fetchMock.mock.calls[1][0]).toBe("https://api-data.line.me/v2/bot/message/image-id/content");
  });
});
