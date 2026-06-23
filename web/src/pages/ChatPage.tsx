import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChatPanel } from '../components/ChatPanel';
import { api } from '../api/client';

/** One chat surface: a Global feed plus a tab per group the player belongs to. */
export function ChatPage() {
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.listGroups });
  const [active, setActive] = useState<string>('global'); // 'global' or a groupId
  const list = groups.data ?? [];

  return (
    <div className="chat-page">
      <h2>Chat</h2>
      <div className="chat-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={active === 'global'}
          className={active === 'global' ? 'on' : ''}
          onClick={() => setActive('global')}
          data-testid="chat-tab-global"
        >
          🌍 Global
        </button>
        {list.map((g) => (
          <button
            type="button"
            role="tab"
            key={g.id}
            aria-selected={active === g.id}
            className={active === g.id ? 'on' : ''}
            onClick={() => setActive(g.id)}
            data-testid={`chat-tab-${g.id}`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {active === 'global' ? (
        <ChatPanel key="global" scope="global" />
      ) : (
        <ChatPanel key={active} scope="group" groupId={active} />
      )}
    </div>
  );
}
