import { PLATFORM_NAME } from "@shared/constants";

export default function CookiesPage() {
  return (
    <article className="prose prose-sm mx-auto max-w-2xl p-8 dark:prose-invert">
      <h1>Cookie siyosati</h1>
      <p>{PLATFORM_NAME} quyidagi cookie lardan foydalanadi:</p>
      <table>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Maqsad</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>gc_access_token</td>
            <td>HttpOnly autentifikatsiya (30 daqiqa)</td>
          </tr>
          <tr>
            <td>gc_refresh_token</td>
            <td>HttpOnly sessiya yangilash (7 kun)</td>
          </tr>
          <tr>
            <td>gc_session</td>
            <td>Marshrut himoyasi (sessiya mavjudligi)</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
