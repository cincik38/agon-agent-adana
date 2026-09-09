import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, X, Send, Circle, Check, CheckCheck } from 'lucide-react';
import { useStore } from '../lib/store';
import {
  fetchRecentChatMessages,
  sendChatMessage,
  subscribeChatMessages,
  fetchChatReads,
  markChatRead,
  subscribeChatReads,
  type ChatMessage,
  type ChatRead,
} from '../lib/teamSync';
import { pageLabel } from '../lib/utils';

const LAST_READ_KEY = 'uyu-chat-last-read';
const POS_KEY = 'uyu-chat-btn-pos';
const BTN_SIZE = 56;
const MARGIN = 12;

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function loadPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { x: window.innerWidth - BTN_SIZE - MARGIN, y: window.innerHeight - BTN_SIZE - 96 };
}

function clampPos(x: number, y: number) {
  const maxX = window.innerWidth - BTN_SIZE - 4;
  const maxY = window.innerHeight - BTN_SIZE - 4;
  return { x: Math.min(Math.max(4, x), maxX), y: Math.min(Math.max(4, y), maxY) };
}

/** Resepsiyon zili gibi iki tonlu kisa bir "ding" sesi — dis dosya
 * gerektirmeden Web Audio API ile anlik uretilir. */
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.42);
    });
    setTimeout(() => ctx.close(), 900);
  } catch {
    /* ses cikarilamiyorsa sessizce gec */
  }
}

export default function ChatWidget() {
  const { session, presence } = useStore();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'online'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reads, setReads] = useState<Record<string, ChatRead>>({});
  const [text, setText] = useState('');
  const [lastRead, setLastRead] = useState(() => localStorage.getItem(LAST_READ_KEY) || '');
  const [sending, setSending] = useState(false);
  const [pos, setPos] = useState(loadPos);
  const [dragging, setDragging] = useState(false);
  const [shake, setShake] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  // Realtime abonelik callback'leri kapanista "eski" state'i gormesin diye
  // (stale closure) guncel degerleri ref'te tutuyoruz.
  const openRef = useRef(open);
  const tabRef = useRef(tab);
  useEffect(() => {
    openRef.current = open;
    tabRef.current = tab;
  }, [open, tab]);

  useEffect(() => {
    let unsubMsg: (() => void) | null = null;
    let unsubReads: (() => void) | null = null;
    (async () => {
      const [recent, readRows] = await Promise.all([fetchRecentChatMessages(50), fetchChatReads()]);
      setMessages(recent);
      setReads(Object.fromEntries(readRows.map((r) => [r.staffId, r])));

      unsubMsg = subscribeChatMessages((msg) => {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        const mine = msg.senderId === session?.staffId;
        const panelOpenOnChat = openRef.current && tabRef.current === 'chat';
        if (!mine && !panelOpenOnChat) {
          playChime();
          setShake(true);
          setTimeout(() => setShake(false), 900);
        }
      });
      unsubReads = subscribeChatReads((r) => {
        setReads((prev) => ({ ...prev, [r.staffId]: r }));
      });
    })();
    return () => {
      unsubMsg?.();
      unsubReads?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Panel Sohbet sekmesinde acikken (ya da yeni mesaj gelince acik kalirsa)
  // "okundu" bilgisini bildir.
  useEffect(() => {
    if (open && tab === 'chat' && session) {
      const latest = messages[messages.length - 1]?.createdAt || new Date().toISOString();
      setLastRead(latest);
      localStorage.setItem(LAST_READ_KEY, latest);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      void markChatRead(session.staffId, session.name || 'Personel');
    }
  }, [open, tab, messages, session]);

  const unreadCount = useMemo(() => {
    if (!lastRead) return messages.length;
    return messages.filter((m) => m.createdAt > lastRead && m.senderId !== session?.staffId).length;
  }, [messages, lastRead, session]);

  const onlineStaff = useMemo(() => {
    const now = Date.now();
    const latestByStaff = new Map<string, { staffName: string; page: string; at: number }>();
    Object.entries(presence).forEach(([staffId, entries]) => {
      const newest = entries.reduce((a, b) => (b.at > a.at ? b : a));
      latestByStaff.set(staffId, newest);
    });
    return Array.from(latestByStaff.values())
      .filter((p) => now - p.at < 3 * 60 * 1000)
      .sort((a, b) => b.at - a.at);
  }, [presence]);

  // Bir mesaji, gonderen disinda kimlerin gordugunu hesaplar (kendi
  // "son okuma" zaman damgasi mesajdan sonra ise gormustur demektir).
  const seenBy = (msg: ChatMessage): string[] => {
    return Object.values(reads)
      .filter((r) => r.staffId !== msg.senderId && r.lastReadAt >= msg.createdAt)
      .map((r) => r.staffName);
  };

  const send = async () => {
    const msg = text.trim();
    if (!msg || !session || sending) return;
    setSending(true);
    setText('');
    const ok = await sendChatMessage(session.staffId, session.name || 'Personel', msg);
    if (!ok) setText(msg);
    setSending(false);
  };

  // --- Surukleme (mouse/dokunmatik ortak) ---
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragInfo.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragInfo.current) return;
    const dx = e.clientX - dragInfo.current.startX;
    const dy = e.clientY - dragInfo.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragInfo.current.moved = true;
    setPos(clampPos(dragInfo.current.origX + dx, dragInfo.current.origY + dy));
  };
  const onPointerUp = () => {
    setDragging(false);
    if (dragInfo.current) {
      const moved = dragInfo.current.moved;
      dragInfo.current = null;
      if (moved) {
        setPos((p) => {
          localStorage.setItem(POS_KEY, JSON.stringify(p));
          return p;
        });
      } else {
        setOpen((v) => !v);
      }
    }
  };

  if (!session) return null;

  const openLeft = pos.x > window.innerWidth / 2;
  const openUp = pos.y > window.innerHeight / 2;
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 90,
    ...(openLeft ? { right: window.innerWidth - pos.x - BTN_SIZE } : { left: pos.x }),
    ...(openUp ? { bottom: window.innerHeight - pos.y + 8 } : { top: pos.y + BTN_SIZE + 8 }),
  };

  return (
    <>
      <style>{`
        @keyframes uyu-chat-shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          15% { transform: translate(-3px, 0) rotate(-8deg); }
          30% { transform: translate(3px, 0) rotate(8deg); }
          45% { transform: translate(-3px, 0) rotate(-6deg); }
          60% { transform: translate(3px, 0) rotate(6deg); }
          75% { transform: translate(-2px, 0) rotate(-3deg); }
        }
      `}</style>
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          zIndex: 90,
          touchAction: 'none',
          animation: shake ? 'uyu-chat-shake 0.5s ease-in-out 2' : undefined,
        }}
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-white shadow-xl transition hover:bg-teal-800 ${dragging ? 'cursor-grabbing scale-105' : 'cursor-grab'}`}
        title="Personel Sohbeti — sürükleyerek taşıyabilirsin"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {onlineStaff.length > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
        )}
      </button>

      {open && (
        <div
          style={panelStyle}
          className="flex h-[min(70vh,520px)] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold text-slate-800">Personel</p>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                onClick={() => setTab('chat')}
                className={`rounded-md px-2.5 py-1 ${tab === 'chat' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'}`}
              >
                Sohbet
              </button>
              <button
                onClick={() => setTab('online')}
                className={`rounded-md px-2.5 py-1 ${tab === 'online' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'}`}
              >
                Online ({onlineStaff.length})
              </button>
            </div>
          </div>

          {tab === 'online' ? (
            <div className="flex-1 space-y-1 overflow-y-auto p-3">
              {onlineStaff.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">Şu an başka aktif personel yok</p>
              )}
              {onlineStaff.map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-slate-50">
                  <Circle size={9} className="fill-emerald-500 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.staffName}</p>
                    <p className="text-xs text-slate-400">{pageLabel(p.page)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto p-3">
                {messages.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">Henüz mesaj yok — ilk mesajı sen yaz</p>
                )}
                {messages.map((m, idx) => {
                  const mine = m.senderId === session.staffId;
                  const seen = mine ? seenBy(m) : [];
                  const isLastMine = mine && idx === messages.length - 1;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[80%]">
                        <div className={`rounded-2xl px-3 py-2 ${mine ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
                          {!mine && <p className="mb-0.5 text-[11px] font-bold text-teal-700">{m.senderName}</p>}
                          <p className="whitespace-pre-wrap break-words text-sm">{m.message}</p>
                          <p className={`mt-0.5 text-[10px] ${mine ? 'text-teal-100/70' : 'text-slate-400'}`}>
                            {timeLabel(m.createdAt)}
                          </p>
                        </div>
                        {mine && isLastMine && (
                          <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                            {seen.length > 0 ? (
                              <>
                                <CheckCheck size={12} className="text-teal-600" />
                                Görüldü: {seen.join(', ')}
                              </>
                            ) : (
                              <>
                                <Check size={12} /> İletildi
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 p-2.5">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Mesaj yaz..."
                  className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
                />
                <button
                  onClick={send}
                  disabled={!text.trim() || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white disabled:opacity-40"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
