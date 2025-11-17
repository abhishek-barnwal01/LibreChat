import { memo, useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '~/utils';
import type { TConversation } from 'librechat-data-provider';

interface SimpleConversationListProps {
  conversations: TConversation[];
}

interface ConversationGroup {
  groupName: string;
  conversations: TConversation[];
}

const groupConversationsByDate = (conversations: TConversation[]): ConversationGroup[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const last7Days = new Date(today);
  last7Days.setDate(last7Days.getDate() - 7);

  const groups: ConversationGroup[] = [
    { groupName: 'Today', conversations: [] },
    { groupName: 'Yesterday', conversations: [] },
    { groupName: 'Last 7 Days', conversations: [] },
    { groupName: 'Older', conversations: [] },
  ];

  conversations.forEach((conv) => {
    const updatedAt = new Date(conv.updatedAt || conv.createdAt || '');
    if (updatedAt >= today) {
      groups[0].conversations.push(conv);
    } else if (updatedAt >= yesterday) {
      groups[1].conversations.push(conv);
    } else if (updatedAt >= last7Days) {
      groups[2].conversations.push(conv);
    } else {
      groups[3].conversations.push(conv);
    }
  });

  return groups.filter((group) => group.conversations.length > 0);
};

const SimpleConversationList = memo(({ conversations }: SimpleConversationListProps) => {
  const groupedConversations = useMemo(
    () => groupConversationsByDate(conversations),
    [conversations],
  );

  return (
    <div className="space-y-4">
      {groupedConversations.map((group) => (
        <div key={group.groupName}>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            {group.groupName}
          </div>
          <div className="space-y-1">
            {group.conversations.map((conversation) => (
              <button
                key={conversation.conversationId}
                type="button"
                className={cn(
                  'flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-100',
                )}
              >
                <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-gray-900">{conversation.title}</div>
                  <div className="text-xs text-gray-500">
                    {Math.floor(Math.random() * 8) + 2} messages
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

SimpleConversationList.displayName = 'SimpleConversationList';

export default SimpleConversationList;
