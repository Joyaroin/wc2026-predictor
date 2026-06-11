import { useEffect } from 'react';
import { UPDATES, markUpdatesSeen } from '../updates';

/** "What's new" — a graceful timeline of features shipped to production. */
export function UpdatesPage() {
  useEffect(() => {
    markUpdatesSeen();
  }, []);

  return (
    <div className="updates">
      <h2>✨ What's new</h2>
      <p className="muted fine">Features and improvements as they ship.</p>
      <div className="timeline">
        {UPDATES.map((u, i) => (
          <article className="timeline-entry" key={u.id} style={{ animationDelay: `${i * 110}ms` }}>
            <div className="timeline-marker">
              <span className="timeline-dot" />
              {i < UPDATES.length - 1 && <span className="timeline-line" />}
            </div>
            <div className="timeline-body">
              <div className="timeline-head">
                <span className="timeline-emoji" aria-hidden>{u.emoji}</span>
                <h3>{u.title}</h3>
                <span className="timeline-date muted fine">{u.date}</span>
              </div>
              <ul>
                {u.points.map((p, j) => (
                  <li key={j}>{p}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
