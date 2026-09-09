// Vercel Cron ile her gun 08:00 (TR) tetiklenir — son 24 saatin gelir/gider
// ozetini Telegram'a gonderir. Supabase'e sadece okuma (select) yapar.
// Klasik Node.js (req, res) imzasi kullanilir — en uyumlu, en az hataya acik yontem.

const SUPABASE_URL = 'https://yhlfesjjzwmydulixckf.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlobGZlc2pqendteWR1bGl4Y2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDk0ODcsImV4cCI6MjEwMTQyNTQ4N30.jvHSq5S99y7U5U6L4bWM7q-VaYxATmHKmgBjlJTUsTs';
const HOTEL_ID = 'uyu-room-main';

interface LedgerEntryLite {
  type: 'income' | 'expense';
  amount: number;
  category?: string;
  createdAt?: string;
  deletedAt?: string;
}

function fmtTRY(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

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

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      res.status(200).json({ ok: false, error: 'telegram env eksik' });
      return;
    }

    const sbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/uyu_hotel_live?id=eq.${HOTEL_ID}&select=payload`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
    );
    const rows = (await sbRes.json()) as Array<{ payload?: { ledger?: LedgerEntryLite[] } }>;
    const payload = rows?.[0]?.payload;
    const ledger: LedgerEntryLite[] = payload?.ledger || [];

    const since = Date.now() - 24 * 3600 * 1000;
    const recent = ledger.filter((e) => !e.deletedAt && e.createdAt && new Date(e.createdAt).getTime() >= since);
    const income = recent.filter((e) => e.type === 'income').reduce((a, e) => a + (e.amount || 0), 0);
    const expense = recent.filter((e) => e.type === 'expense').reduce((a, e) => a + (e.amount || 0), 0);

    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });

    const text =
      `📊 <b>UYU ROOM — Günlük Özet</b> (${dateStr})\n\n` +
      `Son 24 saat:\n` +
      `🟢 Gelir: <b>${fmtTRY(income)}</b>\n` +
      `🔴 Gider: <b>${fmtTRY(expense)}</b>\n` +
      `⚪️ Net: <b>${fmtTRY(income - expense)}</b>\n` +
      `İşlem sayısı: ${recent.length}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await tgRes.json().catch(() => ({}));
    res.status(200).json({ ok: tgRes.ok, income, expense, data });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e) });
  }
}
