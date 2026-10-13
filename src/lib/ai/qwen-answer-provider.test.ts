// unit test ของ QwenAnswerProvider: ใช้ fetch ปลอม (mock) จึงไม่เรียก Qwen จริงและไม่เสียเงิน
// รันด้วยคำสั่ง npm run test

// ดึงฟังก์ชันของ Vitest: describe จัดกลุ่ม, it คือ test หนึ่งข้อ, expect ใช้ตรวจผล, vi ใช้สร้าง mock
import { afterEach, describe, expect, it, vi } from "vitest";
// ดึงคลาสที่จะทดสอบ
import { QwenAnswerProvider } from "./qwen-answer-provider";

// ค่าตั้งค่าปลอมสำหรับ test (ไม่ใช่ key จริง)
const config = {
  // API key ปลอม
  apiKey: "qwen-key",
  // ชื่อโมเดล
  model: "qwen3.8-flash",
  // URL ที่จะตรวจว่าถูกเรียก
  baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  // เปิด web search
  webSearchEnabled: true,
};

// กลุ่ม test ของ QwenAnswerProvider
describe("QwenAnswerProvider", () => {
  // หลังจบแต่ละ test ให้คืน fetch ตัวจริง เพื่อไม่ให้ mock ค้างไปกระทบ test อื่น
  afterEach(() => vi.unstubAllGlobals());

  // test ข้อ 1: ส่งรูปและ tool ไปถูกต้อง และกรองลิงก์อันตรายออก
  it("sends image input and web tools, then returns safe source citations", async () => {
    // สร้าง fetch ปลอมที่คืนคำตอบตัวอย่างของ Qwen
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      // สถานะเสร็จสมบูรณ์
      status: "completed",
      // ผลลัพธ์ 1 ชิ้นที่เป็นข้อความของ assistant
      output: [{
        // ชนิดเป็นข้อความ
        type: "message",
        // ผู้พูดคือ assistant
        role: "assistant",
        // เนื้อหาของข้อความ
        content: [{
          // ชนิดเป็นข้อความตอบ
          type: "output_text",
          // ข้อความคำตอบ
          text: "นี่คือคำอธิบายรูปภาพค่ะ",
          // ลิงก์อ้างอิง 2 ตัว คือตัวปกติ และตัวอันตรายที่ต้องถูกกรองทิ้ง
          annotations: [
            // ลิงก์ https ปกติ ต้องได้กลับมา
            { type: "url_citation", title: "Official source", url: "https://example.com/source" },
            // ลิงก์ javascript: อันตราย ต้องถูกตัดทิ้ง
            { type: "url_citation", title: "Unsafe", url: "javascript:alert(1)" },
          ],
        }],
      }],
    }));
    // แทนที่ fetch ของระบบด้วยตัวปลอม
    vi.stubGlobal("fetch", fetchMock);

    // เรียก provider จริงพร้อมรูปภาพ
    const answer = await new QwenAnswerProvider(config).answer({
      // system prompt ตัวอย่าง
      systemPrompt: "Be polite",
      // ข้อความผู้ใช้
      userText: "อ่านข้อความในภาพ",
      // รูปขนาดเล็กแบบ base64 ("aGVsbG8=" คือคำว่า hello)
      imageDataUrl: "data:image/jpeg;base64,aGVsbG8=",
    });

    // ตรวจว่าได้คำตอบและมีเฉพาะลิงก์ที่ปลอดภัย
    expect(answer).toEqual({
      // ข้อความต้องตรงกัน
      text: "นี่คือคำอธิบายรูปภาพค่ะ",
      // เหลือแค่ลิงก์ https
      sources: [{ title: "Official source", url: "https://example.com/source" }],
    });
    // ตรวจว่าเรียก URL /responses ถูกต้อง (argument ตัวแรกของการเรียกครั้งแรก)
    expect(fetchMock.mock.calls[0][0]).toBe(`${config.baseUrl}/responses`);
    // แปลง body ที่ส่งไปกลับเป็น object เพื่อตรวจรายละเอียด
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    // ต้องแนบ tool ค้นเว็บทั้งสองตัว
    expect(request.tools).toEqual([{ type: "web_search" }, { type: "web_extractor" }]);
    // ต้องตั้ง reasoning เป็น low
    expect(request.reasoning).toEqual({ effort: "low" });
    // ต้องจำกัด token ไว้ที่ 1600
    expect(request.max_output_tokens).toBe(1600);
    // ข้อความของผู้ใช้ (input ตัวที่สอง) ต้องมีทั้งข้อความและรูป
    expect(request.input[1].content).toEqual([
      // ส่วนข้อความ
      { type: "input_text", text: "อ่านข้อความในภาพ" },
      // ส่วนรูปภาพ
      { type: "input_image", image_url: "data:image/jpeg;base64,aGVsbG8=" },
    ]);
  });

  // test ข้อ 2: ถ้าปิด web search ต้องไม่แนบ tool
  it("does not attach web tools when search is disabled", async () => {
    // fetch ปลอมที่คืนคำตอบแบบ output_text
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ output_text: "คำตอบค่ะ" }));
    // แทนที่ fetch
    vi.stubGlobal("fetch", fetchMock);

    // เรียก provider โดยปิด web search
    await new QwenAnswerProvider({ ...config, webSearchEnabled: false }).answer({ systemPrompt: "system", userText: "hello" });

    // อ่าน body ที่ส่งไป
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    // ต้องไม่มีฟิลด์ tools
    expect(request.tools).toBeUndefined();
  });

  // test ข้อ 3: ถ้า Qwen ตอบไม่ครบ (มีแต่ reasoning) ต้อง throw error ไม่ใช่ส่งคำตอบว่างกลับไป
  it("reports an incomplete Qwen response without pretending it has an answer", async () => {
    // fetch ปลอมที่คืนผลลัพธ์ไม่สมบูรณ์
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      // สถานะไม่สมบูรณ์
      status: "incomplete",
      // มีแต่ reasoning ไม่มีข้อความตอบ
      output: [{ type: "reasoning" }],
    }));
    // แทนที่ fetch
    vi.stubGlobal("fetch", fetchMock);

    // ต้อง reject พร้อมข้อความที่บอกสถานะและชนิด output
    await expect(new QwenAnswerProvider(config).answer({ systemPrompt: "system", userText: "hello" }))
      // ตรวจข้อความใน error
      .rejects.toThrow("status=incomplete, output=reasoning");
  });
});
