// สคริปต์แปลง PDF ในโฟลเดอร์ knowledge/ เป็นข้อความรวมไฟล์เดียว knowledge/knowledge.txt ให้บอทใช้ตอบคำถาม
// รันด้วยคำสั่ง npm run knowledge ทุกครั้งที่เพิ่ม ลบ หรือแก้ PDF
// แปลงล่วงหน้าแทนการอ่าน PDF ตอนบอททำงาน เพื่อให้เปิดไฟล์ .txt ตรวจ/แก้ข้อความได้ (PDF ภาษาไทยบางไฟล์สระหรือวรรณยุกต์เพี้ยน)

// ดึงฟังก์ชันอ่าน/เขียนไฟล์แบบ async
import { readdir, readFile, writeFile } from "node:fs/promises";
// ดึงฟังก์ชันต่อ path ให้ถูกทุกระบบปฏิบัติการ
import path from "node:path";
// ดึงฟังก์ชันเปิด PDF จาก unpdf (ใช้ pdf.js ของ Mozilla อยู่ข้างใน)
import { getDocumentProxy } from "unpdf";

// โฟลเดอร์ที่เก็บ PDF (อยู่ที่ root ของโปรเจค)
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
// ไฟล์ผลลัพธ์ที่บอทจะอ่าน
const OUTPUT_FILE = path.join(KNOWLEDGE_DIR, "knowledge.txt");
// ขนาดที่ควรเตือน (ตรงกับเพดานใน src/config/knowledge.ts) เพราะเอกสารทั้งก้อนถูกส่งไปกับทุกคำถาม ยิ่งยาวยิ่งแพงและช้า
const WARN_CHARS = 100_000;
// ตัวอักษรไทยทุกตัว (ช่วง Unicode U+0E00–U+0E7F)
const THAI_CHAR = /[฀-๿]/;
// ช่องว่างหน้าตัวที่ขึ้นต้นคำไม่ได้ (ะ ั า ำ สระบน/ล่าง วรรณยุกต์) เช่น "พนั กงาน" "ค่าจ้ าง"
const SPACE_BEFORE_NON_INITIAL = /[ \t]+(?=[ะ-ฺๅ็-๎])/g;
// ช่องว่างหลังตัวที่ลงท้ายคำไม่ได้ (ไม้หันอากาศ และสระหน้า เ แ โ ใ ไ) เช่น "วั นจั นทร์"
const SPACE_AFTER_NON_FINAL = /(?<=[ัเ-ไ])[ \t]+(?=[฀-๿])/g;

// ดึงข้อความของหน้าหนึ่ง โดยแก้ปัญหา pdf.js แทรกช่องว่างกลางคำภาษาไทย
async function extractPageText(pdf, pageNumber) {
  // ชิ้นข้อความทั้งหมดในหน้า แต่ละชิ้นมี str (ข้อความ) และ hasEOL (จบบรรทัดหรือไม่)
  const { items } = await (await pdf.getPage(pageNumber)).getTextContent();
  // ต่อชิ้นข้อความเข้าด้วยกัน
  return items
    .map((item, index) => {
      // ช่องว่างที่แยกเป็นชิ้นเดี่ยวระหว่างอักษรไทยสองตัว มักเป็นช่องว่างที่ pdf.js เติมเอง ให้ตัดทิ้ง
      const isInsertedThaiSpace = !item.str.trim() && item.str.length > 0
        && THAI_CHAR.test(items[index - 1]?.str.at(-1) ?? "") && THAI_CHAR.test(items[index + 1]?.str.at(0) ?? "");
      // คืนข้อความของชิ้นนี้ และขึ้นบรรทัดใหม่ถ้าเป็นท้ายบรรทัด
      return (isInsertedThaiSpace ? "" : item.str) + (item.hasEOL ? "\n" : "");
    })
    .join("")
    // ลบช่องว่างกลางคำที่ยังหลงเหลือ (ช่องว่างระหว่างวรรณยุกต์กับพยัญชนะ เช่น "แจ้ ง" ปล่อยไว้ เพราะอาจเป็นการเว้นวรรคจริง เช่น "ไม่ ได้")
    .replace(SPACE_BEFORE_NON_INITIAL, "")
    .replace(SPACE_AFTER_NON_FINAL, "")
    // ตัดช่องว่างหัวท้าย
    .trim();
}

// อ่านรายชื่อไฟล์ แล้วเก็บเฉพาะ .pdf เรียงตามชื่อเพื่อให้ผลลัพธ์เหมือนเดิมทุกครั้ง
const pdfFiles = (await readdir(KNOWLEDGE_DIR)).filter((name) => name.toLowerCase().endsWith(".pdf")).sort();
// ถ้าไม่มี PDF ให้แจ้งแล้วจบ
if (pdfFiles.length === 0) {
  // บอกผู้ใช้ว่าต้องวางไฟล์ไว้ที่ไหน
  console.error(`ไม่พบไฟล์ PDF ใน ${KNOWLEDGE_DIR}`);
  // จบโปรแกรมด้วยรหัสผิดพลาด
  process.exit(1);
}

// เก็บข้อความของแต่ละไฟล์
const sections = [];
// วนทีละไฟล์
for (const fileName of pdfFiles) {
  // อ่านไฟล์เป็น byte แล้วเปิดเป็นเอกสาร PDF
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(path.join(KNOWLEDGE_DIR, fileName))));
  // ดึงข้อความแยกทีละหน้า (pdf.js นับหน้าเริ่มที่ 1) เพื่อใส่เลขหน้าให้บอทอ้างอิงได้
  const pages = [];
  // วนทุกหน้า
  for (let page = 1; page <= pdf.numPages; page++) pages.push({ page, text: await extractPageText(pdf, page) });
  // นับหน้าที่ไม่มีข้อความ (มักเป็น PDF สแกนเป็นรูป ซึ่งต้องทำ OCR ก่อน)
  const emptyPages = pages.filter(({ text }) => !text).length;
  // แสดงสรุปของไฟล์นี้
  console.log(`${fileName}: ${pdf.numPages} หน้า${emptyPages ? ` (ไม่มีข้อความ ${emptyPages} หน้า อาจเป็นรูปสแกน)` : ""}`);
  // ต่อข้อความทุกหน้า โดยมีหัวบอกเลขหน้า และข้ามหน้าว่าง
  const body = pages
    .filter(({ text }) => text)
    .map(({ page, text }) => `--- หน้า ${page} ---\n${text}`)
    .join("\n\n");
  // เพิ่มหัวชื่อไฟล์ เพื่อให้บอทบอกได้ว่าข้อมูลมาจากเอกสารไหน
  sections.push(`=== ไฟล์: ${fileName} ===\n${body}`);
}

// รวมทุกไฟล์เป็นข้อความเดียว
const output = `${sections.join("\n\n")}\n`;
// เขียนลงไฟล์ผลลัพธ์
await writeFile(OUTPUT_FILE, output, "utf8");
// แจ้งตำแหน่งไฟล์และจำนวนตัวอักษร
console.log(`\nเขียน ${path.relative(process.cwd(), OUTPUT_FILE)} แล้ว (${output.length.toLocaleString()} ตัวอักษร)`);
// เตือนถ้ายาวเกินเพดาน ส่วนเกินจะถูกตัดทิ้งตอนบอททำงาน
if (output.length > WARN_CHARS) console.warn(`คำเตือน: เกิน ${WARN_CHARS.toLocaleString()} ตัวอักษร ส่วนเกินจะถูกตัดทิ้ง ควรตัดเนื้อหาที่ไม่จำเป็นออก`);
// เตือนให้ตรวจข้อความภาษาไทยด้วยตาก่อนใช้งาน
console.log("เปิดไฟล์ตรวจว่าภาษาไทยอ่านถูกต้อง แก้ไขในไฟล์ได้เลยถ้าสระหรือวรรณยุกต์เพี้ยน");
