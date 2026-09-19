# Pun Kub Fang API

Backend สำหรับเว็บไซต์ปั่นกับฟ่าง ใช้ **Bun + Hono + PostgreSQL** ครอบคลุมสินค้า เนื้อหาเว็บไซต์ และออเดอร์

## เริ่มใช้งาน

1. คัดลอก `.env.example` เป็น `.env` แล้วใส่รหัสผ่าน PostgreSQL, รหัสผ่านแอดมิน และ JWT secret
2. ติดตั้งแพ็กเกจและเตรียมฐานข้อมูล

```bash
bun install
bun run db:setup
```

3. เปิด API

```bash
bun run dev
```

API จะทำงานที่ `http://localhost:3001` และมี health check ที่ `/health`

## คำสั่ง

- `bun run dev` เปิดเซิร์ฟเวอร์แบบ reload อัตโนมัติ
- `bun run start` เปิดเซิร์ฟเวอร์ production
- `bun run db:migrate` สร้าง/อัปเดตตาราง
- `bun run db:seed` นำเมนูและเนื้อหาเว็บไซต์เดิมเข้า PostgreSQL (รันซ้ำได้โดยไม่สร้างข้อมูลซ้ำ)
- `bun run db:setup` รัน migrate และ seed ต่อกันสำหรับการติดตั้งครั้งแรก
- `bun test` รัน unit tests

รูปที่อัปโหลดจะอยู่ในโฟลเดอร์ `uploads/` และถูกเสิร์ฟผ่าน `/uploads/...`

## หน้าจัดการ

- `/admin` จัดการสินค้าและรูปสินค้า
- `/admin/content` จัดการชุดข้อมูลของทุกหน้า เช่น โปรโมชัน สูตร DIY รีวิว ข้อมูลร้าน และข้อความต่าง ๆ
- `/admin/orders` ดูออเดอร์ เปลี่ยนสถานะ และลบออเดอร์

ข้อมูลเนื้อหาที่มีโครงสร้างซับซ้อนเก็บในตาราง `content_datasets` แบบ JSONB โดยแบ่งเป็นชุดข้อมูลตามชื่อเดิมใน `src/data/site.ts` ส่วนสินค้าและออเดอร์เก็บในตารางเชิงสัมพันธ์เพื่อให้ค้นหาและอัปเดตได้เหมาะสมกว่า

## API หลัก

- `GET /api/site` ข้อมูลทั้งหมดที่หน้าเว็บลูกค้าใช้
- `POST /api/orders` สร้างออเดอร์
- `POST /api/recommendations` วิเคราะห์ภาษาลูกค้าและเสนอสูตรมิกซ์ 3 แก้ว + เมนูสำเร็จ 3 แก้ว
- `GET|POST|PUT|DELETE /api/admin/products` จัดการสินค้า
- `GET /api/admin/content` และ `PUT /api/admin/content/:key` จัดการเนื้อหา
- `GET /api/admin/orders`, `PUT /api/admin/orders/:id/status` และ `DELETE /api/admin/orders/:id` จัดการออเดอร์

เส้นทาง `/api/admin/*` ต้องส่ง admin token ที่ได้จาก `/api/admin/login`

## AI แนะนำเครื่องดื่ม

กำหนด `AI_GATEWAY_URL` ให้ชี้ไปยัง AI Develyst gateway จาก Bruno collection ระบบจะแยกการประมวลผลเป็นหลาย call: DeepSeek วิเคราะห์ความต้องการ, xAI ออกแบบสูตรมิกซ์, OpenAI คัดเมนูสำเร็จ และ DeepSeek ตรวจทาน (fallback เป็น OpenAI เมื่อ DeepSeek ไม่คืน content) ก่อนตรวจ ID ราคา สถานะขาย และจำนวนผลลัพธ์กับข้อมูลจริงอีกครั้ง
