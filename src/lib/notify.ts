/**
 * Telegram bildirimleri — token sunucu tarafinda (Vercel env var) tutulur,
 * frontend sadece kendi /api/notify uc noktamiza istek atar.
 */
export function sendTelegramNotify(text: string) {
  try {
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => {
      /* sessizce yut — bildirim basarisiz olsa da uygulama akisi bozulmasin */
    });
  } catch {
    /* ignore */
  }
}
