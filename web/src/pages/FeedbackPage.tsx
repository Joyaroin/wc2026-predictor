import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function FeedbackPage() {
  const [message, setMessage] = useState('');
  const [page, setPage] = useState('');
  const [sent, setSent] = useState(false);

  const submit = useMutation({
    mutationFn: () => api.submitFeedback(message.trim(), page.trim() || undefined),
    onSuccess: () => {
      setSent(true);
      setMessage('');
      setPage('');
    },
  });

  // The inbox is only fetched (and shown) when you're the owner account.
  const adminMe = useQuery({ queryKey: ['feedback-admin-me'], queryFn: api.feedbackAdminMe });
  const inbox = useQuery({
    queryKey: ['feedback-admin'],
    queryFn: api.feedbackAdmin,
    enabled: adminMe.data?.isAdmin === true,
  });

  return (
    <div className="feedback">
      <h2>Feedback</h2>
      <p className="muted fine">Found a bug or have an idea? Tell me and I'll fix it.</p>

      <div className="card">
        {sent ? (
          <div className="feedback-thanks">
            <p>✅ Thanks — got it!</p>
            <button onClick={() => setSent(false)} data-testid="feedback-another">Send another</button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (message.trim()) submit.mutate();
            }}
          >
            <label className="fb-field">
              What happened?
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Describe the bug or your suggestion…"
                data-testid="feedback-message"
              />
            </label>
            <label className="fb-field">
              Where? <span className="muted fine">(optional)</span>
              <input
                type="text"
                value={page}
                onChange={(e) => setPage(e.target.value)}
                maxLength={120}
                placeholder="e.g. Fixtures, Awards, a specific match…"
                data-testid="feedback-where"
              />
            </label>
            <button type="submit" disabled={!message.trim() || submit.isPending} data-testid="feedback-submit">
              {submit.isPending ? 'Sending…' : 'Send'}
            </button>
            {submit.isError && <p className="error">Could not send — please try again.</p>}
          </form>
        )}
      </div>

      {adminMe.data?.isAdmin && (
        <div className="card">
          <h3>Inbox {inbox.data ? `(${inbox.data.length})` : ''}</h3>
          {inbox.isLoading && <p className="muted">Loading…</p>}
          {inbox.data && inbox.data.length === 0 && <p className="muted">No feedback yet.</p>}
          <ul className="feedback-list">
            {(inbox.data ?? []).map((f) => (
              <li key={f.id} data-testid="feedback-item">
                <div className="fb-meta">
                  <strong>{f.playerName}</strong>
                  {f.page && <span className="muted"> · {f.page}</span>}
                  <span className="muted fine"> · {new Date(f.createdAt).toLocaleString()}</span>
                </div>
                <div className="fb-msg">{f.message}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
