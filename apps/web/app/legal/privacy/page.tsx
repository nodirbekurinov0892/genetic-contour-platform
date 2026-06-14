import { PLATFORM_NAME } from "@shared/constants";

export default function PrivacyPage() {
  return (
    <article className="prose prose-sm mx-auto max-w-2xl p-8 dark:prose-invert">
      <h1>Maxfiylik siyosati</h1>
      <p>
        {PLATFORM_NAME} foydalanuvchi email, yuklangan rasmlar va tajriba natijalarini faqat
        xizmat ko&apos;rsatish uchun saqlaydi.
      </p>
      <h2>Ma&apos;lumotlar</h2>
      <ul>
        <li>Hisob: email, parol xeshi, ism</li>
        <li>Tadqiqot: rasmlar, GT maskalar, eksperiment metrikalari</li>
        <li>Texnik: IP (rate limit), Sentry xatoliklari (ixtiyoriy)</li>
      </ul>
      <h2>Saqlash</h2>
      <p>
        Ma&apos;lumotlar PostgreSQL va ob&apos;ekt storage (S3/R2) da saqlanadi. Foydalanuvchi
        rasm va GT ni o&apos;chirish huquqiga ega.
      </p>
    </article>
  );
}
