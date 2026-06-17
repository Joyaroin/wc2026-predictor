import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, type AssistantTurn } from '../api/client';

const GREETING =
  "Hey, I'm Rabbi Tarek ⚽ Ask me about the rules, how your points were scored, who's leading, or who to pick for an upcoming game.";

/** Floating chat assistant — bottom-left bubble that opens a grounded Q&A panel. Hidden when disabled. */
export function AssistantWidget() {
  const status = useQuery({ queryKey: ['assistant-status'], queryFn: () => api.assistantStatus(), staleTime: 10 * 60_000 });
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread, open, sending]);

  if (!status.data?.enabled) return null;

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    const history = thread.slice(-10);
    const next: AssistantTurn[] = [...thread, { role: 'user', content: text }];
    setThread(next);
    setInput('');
    setSending(true);
    try {
      const { reply } = await api.assistant(text, history);
      setThread((t) => [...t, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong — try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {!open && (
        <button className="asst-fab" onClick={() => setOpen(true)} aria-label="Open assistant" data-testid="assistant-fab">
          💬
        </button>
      )}
      {open && (
        <div className="asst-panel" data-testid="assistant-panel">
          <div className="asst-head">
            <span className="asst-title">⚽ Rabbi Tarek</span>
            <button className="asst-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <div className="asst-body" ref={scrollRef}>
            <div className="asst-msg bot">{GREETING}</div>
            {thread.map((m, i) => (
              <div key={i} className={`asst-msg ${m.role === 'user' ? 'me' : 'bot'}`}>{m.content}</div>
            ))}
            {sending && <div className="asst-msg bot asst-typing">…</div>}
            {error && <div className="asst-msg err">{error}</div>}
          </div>
          <form
            className="asst-input"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about rules, points, picks…"
              maxLength={1000}
              disabled={sending}
              aria-label="Message"
            />
            <button type="submit" disabled={sending || !input.trim()}>Send</button>
          </form>
        </div>
      )}
    </>
  );
}
