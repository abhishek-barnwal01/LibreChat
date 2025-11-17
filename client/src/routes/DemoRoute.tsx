import TopNavigation from '~/components/Nav/TopNavigation';
import LeftSidebar from '~/components/Nav/LeftSidebar';
import RightSidebar from '~/components/Nav/RightSidebar';
import EmptyChat from '~/components/Chat/EmptyChat';

// Mock conversation data for demo
const mockConversationData = {
  pages: [
    {
      conversations: [
        {
          conversationId: '1',
          title: 'what are the policy...',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 8,
        },
        {
          conversationId: '2',
          title: 'Show me market share trends',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          messageCount: 2,
        },
        {
          conversationId: '3',
          title: 'What are the market dynamics',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          updatedAt: new Date(Date.now() - 172800000).toISOString(),
          messageCount: 2,
        },
        {
          conversationId: '4',
          title: 'What are the key consumer trends',
          createdAt: new Date(Date.now() - 259200000).toISOString(),
          updatedAt: new Date(Date.now() - 259200000).toISOString(),
          messageCount: 2,
        },
        {
          conversationId: '5',
          title: 'What is Godrej market position',
          createdAt: new Date(Date.now() - 345600000).toISOString(),
          updatedAt: new Date(Date.now() - 345600000).toISOString(),
          messageCount: 2,
        },
        {
          conversationId: '6',
          title: 'What is the policy impact',
          createdAt: new Date(Date.now() - 432000000).toISOString(),
          updatedAt: new Date(Date.now() - 432000000).toISOString(),
          messageCount: 2,
        },
        {
          conversationId: '7',
          title: 'What is Godrej market share',
          createdAt: new Date(Date.now() - 518400000).toISOString(),
          updatedAt: new Date(Date.now() - 518400000).toISOString(),
          messageCount: 6,
        },
        {
          conversationId: '8',
          title: 'what is the policy recommendations',
          createdAt: new Date(Date.now() - 604800000).toISOString(),
          updatedAt: new Date(Date.now() - 604800000).toISOString(),
          messageCount: 2,
        },
        {
          conversationId: '9',
          title: 'What is the market outlook',
          createdAt: new Date(Date.now() - 691200000).toISOString(),
          updatedAt: new Date(Date.now() - 691200000).toISOString(),
          messageCount: 2,
        },
        {
          conversationId: '10',
          title: 'what is the LIC product analysis',
          createdAt: new Date(Date.now() - 777600000).toISOString(),
          updatedAt: new Date(Date.now() - 777600000).toISOString(),
          messageCount: 2,
        },
      ],
      pageNumber: 1,
      pageSize: 10,
    },
  ],
  pageParams: [undefined],
};

// Demo route to preview the new UI without backend
export default function DemoRoute() {
  const handleNewQuery = () => {
    console.log('New Query clicked');
  };

  const handlePromptClick = (prompt: string) => {
    console.log('Prompt clicked:', prompt);
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Top Navigation */}
      <TopNavigation onNewQuery={handleNewQuery} />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-gray-200">
          <LeftSidebar conversationData={mockConversationData} />
        </aside>

        {/* Center Chat Area */}
        <main className="relative flex h-full max-w-full flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center">
            <EmptyChat />
          </div>

          {/* Demo Input Area */}
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-center gap-3 rounded-full border border-gray-300 bg-white px-4 py-3 shadow-sm">
                <button className="text-gray-500 hover:text-gray-700">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <button className="text-gray-500 hover:text-gray-700">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
                <input
                  type="text"
                  placeholder="Ask about your CMI data..."
                  className="flex-1 border-none bg-transparent outline-none placeholder:text-gray-400"
                />
                <button className="rounded-full bg-gray-400 p-2 text-white transition-colors hover:bg-gray-500">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-64 flex-shrink-0">
          <RightSidebar onPromptClick={handlePromptClick} />
        </aside>
      </div>
    </div>
  );
}
