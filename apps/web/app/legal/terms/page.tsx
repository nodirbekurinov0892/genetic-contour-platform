import { PLATFORM_NAME } from "@shared/constants";

export default function TermsPage() {
  return (
    <article className="prose prose-sm mx-auto max-w-2xl p-8 dark:prose-invert">
      <h1>Foydalanish shartlari</h1>
      <p>
        {PLATFORM_NAME} platformasidan foydalanish orqali siz tadqiqot maqsadida yuklangan
        kontent uchun javobgar ekanligingizni tasdiqlaysiz.
      </p>
      <h2>Xizmat</h2>
      <p>
        Platforma kontur aniqlash algoritmlarini taqqoslash va ilmiy hisobot yaratish uchun
        taqdim etiladi. Natijalar tadqiqot maqsadida bo&apos;lib, tibbiy yoki sanoat qarorlari
        uchun to&apos;g&apos;ridan-to&apos;g&apos;ri tavsiya etilmaydi.
      </p>
      <h2>Hisob</h2>
      <p>Foydalanuvchi hisob ma&apos;lumotlarini maxfiy saqlash majburiyatini oladi.</p>
    </article>
  );
}
