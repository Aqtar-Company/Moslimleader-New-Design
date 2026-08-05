export const dynamic = 'force-dynamic';
import TareeqConversationClient from './TareeqConversationClient';

export default function ConversationPage({ params }: { params: { conversationId: string } }) {
  return <TareeqConversationClient conversationId={params.conversationId} />;
}
