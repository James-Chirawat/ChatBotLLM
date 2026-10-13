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
const THAI_CHAR = /[\u0E00-\u0E7F]/;
// ช่องว่าง (หรือขึ้นบรรทัด) หน้าตัวที่ขึ้นต้นคำไม่ได้ (ะ ั า ำ สระบน/ล่าง วรรณยุกต์) เช่น "พนั กงาน" "ค่าจ้ าง"
const SPACE_BEFORE_NON_INITIAL = /\s+(?=[ะ-ฺๅ็-๎])/g;
// ช่องว่าง (หรือขึ้นบรรทัด) หลังตัวที่ลงท้ายคำไม่ได้ (ไม้หันอากาศ และสระหน้า เ แ โ ใ ไ) เช่น "วั นจั นทร์" "ยั\nง"
const SPACE_AFTER_NON_FINAL = /(?<=[ัเ-ไ])\s+(?=[฀-๿])/g;

// ดึงข้อความของหน้าหนึ่ง โดยแก้ปัญหาที่ pdf.js เจอกับ PDF ภาษาไทย
async function extractPageText(pdf, pageNumber) {
  // ชิ้นข้อความทั้งหมดในหน้า แต่ละชิ้นมี str (ข้อความ) และ transform (ตำแหน่ง: [4] คือแกน x, [5] คือแกน y)
  const { items } = await (await pdf.getPage(pageNumber)).getTextContent();
  // จัดกลุ่มชิ้นข้อความเป็นบรรทัดตามตำแหน่ง y แทนการเชื่อ hasEOL เพราะ PDF ภาษาไทยบางไฟล์เรียงชิ้นสลับและตัดบรรทัดกลางคำ เช่น "ข้\nอ"
  const lines = [];
  // วนทีละชิ้น ข้ามชิ้นว่าง
  for (const item of items.filter((item) => item.str)) {
    // หาบรรทัดที่ y ห่างกันไม่เกิน 2 หน่วย (สระบน/ล่างอาจเยื้องขึ้นลงเล็กน้อย)
    const line = lines.find((line) => Math.abs(line.y - item.transform[5]) <= 2);
    // ถ้ามีบรรทัดแล้วให้เพิ่มเข้าไป ถ้ายังไม่มีให้สร้างบรรทัดใหม่
    if (line) line.items.push(item);
    else lines.push({ y: item.transform[5], items: [item] });
  }
  // เรียงบรรทัดจากบนลงล่าง (ใน PDF ค่า y มากคืออยู่ด้านบน)
  return lines
    .sort((a, b) => b.y - a.y)
    // ในแต่ละบรรทัด เรียงชิ้นจากซ้ายไปขวา แล้วต่อเป็นข้อความ
    .map((line) => line.items
      .sort((a, b) => a.transform[4] - b.transform[4])
      // ชิ้นช่องว่างล้วนที่คั่นอักษรไทยสองตัว ส่วนใหญ่เป็นช่องว่างที่ pdf.js เติมเองกลางคำ เช่น "ระเบี ยบ" ให้ตัดทิ้ง
      // แลกกับการเสียวรรคจริงระหว่างคำไทยบางจุด ซึ่งไม่ทำให้ AI อ่านผิด ส่วนวรรคข้างตัวเลขหรือภาษาอังกฤษยังอยู่ครบ
      .filter((item, index, sorted) => item.str.trim()
        || !THAI_CHAR.test(sorted[index - 1]?.str.at(-1) ?? "") || !THAI_CHAR.test(sorted[index + 1]?.str.at(0) ?? ""))
      .map((item) => item.str)
      .join("")
      .trim())
    .join("\n")
    // ฟอนต์หลายตัวเก็บสระอำเป็นนิคหิต + สระอา (ํา) ให้รวมกลับเป็นสระอำ (ำ) เพื่อให้ค้นคำว่า "ทำการ" เจอ
    .replace(/\u0E4D\u0E32/g, "\u0E33")
    // ลบช่องว่างกลางคำ (ช่องว่างระหว่างวรรณยุกต์กับพยัญชนะ เช่น "แจ้ ง" ปล่อยไว้ เพราะอาจเป็นการเว้นวรรคจริง เช่น "ไม่ ได้")
    .replace(SPACE_BEFORE_NON_INITIAL, "")
    .replace(SPACE_AFTER_NON_FINAL, "")
    // ยุบช่องว่างที่ติดกันหลายตัวให้เหลือตัวเดียว
    .replace(/[ \t]{2,}/g, " ")
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
