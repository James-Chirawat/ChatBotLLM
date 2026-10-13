// unit test ของ AnswerService: ใช้ provider ปลอม จึงไม่เรียก AI จริง
// รันด้วยคำสั่ง npm run test

// ดึงฟังก์ชันของ Vitest
import { describe, expect, it, vi } from "vitest";
// ดึงคลาสที่จะทดสอบ
import { AnswerService } from "./answer.service";

// สร้าง provider ปลอมที่จำ input ไว้ให้ตรวจ และคืนคำตอบตายตัว
function createFakeProvider() {
  // คืน object ที่มีเมธอด answer เหมือน AnswerProvider
  return { answer: vi.fn().mockResolvedValue({ text: "ตอบแล้วค่ะ", sources: [] }) };
}

// กลุ่ม test ของ AnswerService
describe("AnswerService", () => {
  // test ข้อ 1: ใส่ข้อมูลองค์กรและเอกสารลงใน system prompt
  it("adds organization instructions and PDF knowledge to the system prompt", async () => {
    // provider ปลอม
    const provider = createFakeProvider();

    // ถามคำถามโดยมีทั้งข้อมูลองค์กรและเอกสาร
    await new AnswerService(provider, "เปิดทำการ 8:30-16:30", "=== ไฟล์: rules.pdf ===\nลาป่วยได้ 30 วัน").createAnswer({ userText: "  ลาป่วยได้กี่วัน  " });

    // ดึง input ที่ provider ได้รับ
    const input = provider.answer.mock.calls[0][0];
    // ข้อความผู้ใช้ต้องถูกตัดช่องว่างหัวท้าย
    expect(input.userText).toBe("ลาป่วยได้กี่วัน");
    // ต้องมีข้อมูลองค์กร
    expect(input.systemPrompt).toContain("ข้อมูลเพิ่มเติมขององค์กร:\nเปิดทำการ 8:30-16:30");
    // ต้องมีเอกสารอยู่ในแท็ก <documents>
    expect(input.systemPrompt).toContain("<documents>\n=== ไฟล์: rules.pdf ===\nลาป่วยได้ 30 วัน\n</documents>");
  });

  // test ข้อ 2: ไม่มีข้อมูลเพิ่ม ต้องได้ persona อย่างเดียว ไม่มีหัวข้อว่าง ๆ
  it("omits empty sections when there are no instructions or documents", async () => {
    // provider ปลอม
    const provider = createFakeProvider();

    // ถามโดยไม่มีข้อมูลองค์กรและเอกสาร
    await new AnswerService(provider, "").createAnswer({ userText: "สวัสดี" });

    // ดึง system prompt ที่ส่งไป
    const { systemPrompt } = provider.answer.mock.calls[0][0];
    // ต้องไม่มีหัวข้อข้อมูลองค์กร
    expect(systemPrompt).not.toContain("ข้อมูลเพิ่มเติมขององค์กร");
    // ต้องไม่มีแท็กเอกสาร
    expect(systemPrompt).not.toContain("<documents>");
  });
});
