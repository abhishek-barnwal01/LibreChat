import { memo, useState, useCallback, useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import TopNavigation from '~/components/Nav/TopNavigation';
import LeftSidebar from '~/components/Nav/LeftSidebar';
import RightSidebar from '~/components/Nav/RightSidebar';
import EmptyChat from './EmptyChat';
import { MessagesView } from './Messages';
import ChatForm from './Input/ChatForm';
import { useChatContext } from '~/Providers';
import { useConversationsInfiniteQuery } from '~/data-provider';
import { useAuthContext } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

const NewChatLayout = memo(() => {
  const [sidebarView, setSidebarView] = useState<'filters' | 'history'>('filters');
  const { isAuthenticated } = useAuthContext();
  const { conversation } = useChatContext();
  const search = useRecoilValue(store.search);

  const { data: conversationData } = useConversationsInfiniteQuery(
    {
      search: search.debouncedQuery || undefined,
    },
    {
      enabled: isAuthenticated,
      staleTime: 30000,
      cacheTime: 300000,
    },
  );

  const handleNewQuery = useCallback(() => {
    // Handle new conversation
    window.location.href = '/c/new';
  }, []);

  const handlePromptClick = useCallback((prompt: string) => {
    // Handle prompt selection - this would typically set the input value
    const textarea = document.querySelector('textarea[id="prompt-textarea"]') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = prompt;
      textarea.focus();
    }
  }, []);

  const hasMessages = useMemo(
    () => Array.isArray(conversation?.messages) && conversation.messages.length > 0,
    [conversation?.messages],
  );

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Top Navigation */}
      <TopNavigation onNewQuery={handleNewQuery} />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-gray-200">
          <LeftSidebar
            view={sidebarView}
            onViewChange={setSidebarView}
            conversationData={conversationData}
          />
        </aside>

        {/* Center Chat Area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto">
            {hasMessages ? (
              <MessagesView />
            ) : (
              <EmptyChat />
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="mx-auto max-w-4xl">
              <ChatForm />
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-80 flex-shrink-0">
          <RightSidebar onPromptClick={handlePromptClick} />
        </aside>
      </div>
    </div>
  );
});

NewChatLayout.displayName = 'NewChatLayout';

export default NewChatLayout;
