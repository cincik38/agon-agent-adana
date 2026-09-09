// Vercel Cron ile her gun tetiklenir — canli veriyi (uyu_hotel_live) ayri bir
// yedek tabloya (uyu_hotel_backups) YYYY-MM-DD id'siyle kopyalar. 60 gunden
// eski yedekler otomatik silinir. Klasik Node.js (req, res) imzasi kullanilir.

const SUPABASE_URL = 'https://yhlfesjjzwmydulixckf.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlobGZlc2pqendteWR1bGl4Y2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDk0ODcsImV4cCI6MjEwMTQyNTQ4N30.jvHSq5S99y7U5U6L4bWM7q-VaYxATmHKmgBjlJTUsTs';
const HOTEL_ID = 'uyu-room-main';
const RETENTION_DAYS = 60;

export default async function handler(req: any, res: any) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers?.authorization;
      if (auth !== `Bearer ${secret}`) {
        res.status(401).send('unauthorized');
        return;
      }
    }

    // 1) Canli veriyi oku
    const liveRes = await fetch(
      `${SUPABASE_URL}/rest/v1/uyu_hotel_live?id=eq.${HOTEL_ID}&select=payload`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
    );
    const rows = (await liveRes.json()) as Array<{ payload?: unknown }>;
    const payload = rows?.[0]?.payload;
    if (!payload) {
      res.status(200).json({ ok: false, error: 'canli veri bulunamadi' });
      return;
    }

    // 2) Bugunun tarihini (TR saati) id olarak kullanarak yedek tabloya yaz (upsert)
    const todayId = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }); // YYYY-MM-DD

    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/uyu_hotel_backups?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ id: todayId, payload, created_at: new Date().toISOString() }),
    });
    const upsertOk = upsertRes.ok;
    const upsertErrText = upsertOk ? undefined : await upsertRes.text().catch(() => 'bilinmeyen hata');

    // 3) RETENTION_DAYS gunden eski yedekleri sil
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000)
      .toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
    await fetch(`${SUPABASE_URL}/rest/v1/uyu_hotel_backups?id=lt.${cutoff}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    }).catch(() => {});

    res.status(200).json({ ok: upsertOk, backedUpAs: todayId, error: upsertErrText });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e) });
  }
}
