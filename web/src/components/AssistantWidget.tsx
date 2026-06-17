import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, type AssistantTurn } from '../api/client';

const AVATAR = '/rabbi-tarek.jpg';
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
  const [avatarOk, setAvatarOk] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread, open, sending]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!status.data?.enabled) return null;

  const Avatar = ({ size }: { size: number }) =>
    avatarOk ? (
      <img src={AVATAR} alt="Rabbi Tarek" className="asst-avatar" style={{ width: size, height: size }} onError={() => setAvatarOk(false)} />
    ) : (
      <span className="asst-avatar fallback" style={{ width: size, height: size, fontSize: size * 0.5 }}>⚽</span>
    );

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    const history = thread.slice(-10);
    setThread([...thread, { role: 'user', content: text }]);
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
        <button className="asst-fab" onClick={() => setOpen(true)} aria-label="Chat with Rabbi Tarek" data-testid="assistant-fab">
          <Avatar size={56} />
          <span className="asst-fab-ring" aria-hidden="true" />
        </button>
      )}
      {open && (
        <div className="asst-panel" data-testid="assistant-panel">
          <div className="asst-head">
            <Avatar size={32} />
            <span className="asst-title">Rabbi Tarek</span>
            <span className="asst-status">online</span>
            <button className="asst-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <div className="asst-body" ref={scrollRef}>
            <BotRow avatar={<Avatar size={26} />}>{GREETING}</BotRow>
            {thread.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="asst-msg me">{m.content}</div>
              ) : (
                <BotRow key={i} avatar={<Avatar size={26} />}>{m.content}</BotRow>
              ),
            )}
            {sending && (
              <BotRow avatar={<Avatar size={26} />}>
                <span className="asst-dots" aria-label="typing"><i /><i /><i /></span>
              </BotRow>
            )}
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
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Rabbi Tarek…"
              maxLength={1000}
              disabled={sending}
              aria-label="Message"
            />
            <button type="submit" className="asst-send" disabled={sending || !input.trim()} aria-label="Send">➤</button>
          </form>
        </div>
      )}
    </>
  );
}

function BotRow({ avatar, children }: { avatar: ReactNode; children: ReactNode }) {
  return (
    <div className="asst-row">
      <span className="asst-row-av">{avatar}</span>
      <div className="asst-msg bot">{children}</div>
    </div>
  );
}
