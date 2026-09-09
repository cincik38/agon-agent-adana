// Vercel Serverless Function — POST { text } -> Telegram'a gonderir.
// Token/chat-id sadece burada (sunucu tarafinda, env var) tutulur, frontend'e hic gitmez.
// Klasik Node.js (req, res) imzasi kullanilir — en uyumlu, en az hataya acik yontem.

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      res.status(200).json({ ok: false, error: 'telegram env eksik' });
      return;
    }
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    const text = String((body && body.text) || '').slice(0, 3500);
    if (!text) {
      res.status(400).json({ ok: false, error: 'text bos' });
      return;
    }
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await r.json().catch(() => ({}));
    res.status(200).json({ ok: r.ok, data });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e) });
  }
}
