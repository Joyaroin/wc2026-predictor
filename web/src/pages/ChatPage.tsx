import { ChatPanel } from '../components/ChatPanel';

export function ChatPage() {
  return (
    <div className="chat-page">
      <h2>💬 Global chat</h2>
      <ChatPanel scope="global" />
    </div>
  );
}
