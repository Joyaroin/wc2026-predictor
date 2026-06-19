import { ChatPanel } from '../components/ChatPanel';

export function ChatPage() {
  return (
    <div className="chat-page">
      <h2>💬 Global chat</h2>
      <p className="muted fine">Say hi to everyone playing. Be nice — an admin can remove messages.</p>
      <ChatPanel scope="global" />
    </div>
  );
}
