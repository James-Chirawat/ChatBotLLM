// ไฟล์ตั้งค่าของ Vitest

// ดึงฟังก์ชันแปลง URL เป็น path ของไฟล์
import { fileURLToPath } from "node:url";
// ดึงฟังก์ชันสร้าง config ของ Vitest
import { defineConfig } from "vitest/config";

// ให้ test เข้าใจ "@/xxx" เป็น "./src/xxx" เหมือนที่ตั้งไว้ใน tsconfig.json
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
