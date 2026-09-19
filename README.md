# Pun Kub Fang API

Backend สำหรับเว็บไซต์ปั่นกับฟ่าง ใช้ **Bun + Hono + PostgreSQL**

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
- `bun run db:seed` นำเมนูเดิมเข้า PostgreSQL (รันซ้ำได้โดยไม่สร้างข้อมูลซ้ำ)
- `bun run db:setup` รัน migrate และ seed ต่อกันสำหรับการติดตั้งครั้งแรก
- `bun test` รัน unit tests

รูปที่อัปโหลดจะอยู่ในโฟลเดอร์ `uploads/` และถูกเสิร์ฟผ่าน `/uploads/...`
