import { SendHorizontal, Paperclip, Mic } from 'lucide-react';
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
        },
        {
          conversationId: '2',
          title: 'Show me market share trends',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          conversationId: '3',
          title: 'What are the market dynamics',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          updatedAt: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          conversationId: '4',
          title: 'What are the key consumer trends',
          createdAt: new Date(Date.now() - 259200000).toISOString(),
          updatedAt: new Date(Date.now() - 259200000).toISOString(),
        },
        {
          conversationId: '5',
          title: 'What is Godrej market position',
          createdAt: new Date(Date.now() - 345600000).toISOString(),
          updatedAt: new Date(Date.now() - 345600000).toISOString(),
        },
        {
          conversationId: '6',
          title: 'What is the policy impact',
          createdAt: new Date(Date.now() - 432000000).toISOString(),
          updatedAt: new Date(Date.now() - 432000000).toISOString(),
        },
        {
          conversationId: '7',
          title: 'What is Godrej market share',
          createdAt: new Date(Date.now() - 518400000).toISOString(),
          updatedAt: new Date(Date.now() - 518400000).toISOString(),
        },
        {
          conversationId: '8',
          title: 'what is the policy recommendations',
          createdAt: new Date(Date.now() - 604800000).toISOString(),
          updatedAt: new Date(Date.now() - 604800000).toISOString(),
        },
        {
          conversationId: '9',
          title: 'What is the market outlook',
          createdAt: new Date(Date.now() - 691200000).toISOString(),
          updatedAt: new Date(Date.now() - 691200000).toISOString(),
        },
        {
          conversationId: '10',
          title: 'what is the LIC product analysis',
          createdAt: new Date(Date.now() - 777600000).toISOString(),
          updatedAt: new Date(Date.now() - 777600000).toISOString(),
        },
        {
          conversationId: '11',
          title: 'Show regional sales data',
          createdAt: new Date(Date.now() - 864000000).toISOString(),
          updatedAt: new Date(Date.now() - 864000000).toISOString(),
        },
        {
          conversationId: '12',
          title: 'Analyze customer retention',
          createdAt: new Date(Date.now() - 950400000).toISOString(),
          updatedAt: new Date(Date.now() - 950400000).toISOString(),
        },
        {
          conversationId: '13',
          title: 'Product category performance',
          createdAt: new Date(Date.now() - 1036800000).toISOString(),
          updatedAt: new Date(Date.now() - 1036800000).toISOString(),
        },
        {
          conversationId: '14',
          title: 'Market expansion opportunities',
          createdAt: new Date(Date.now() - 1123200000).toISOString(),
          updatedAt: new Date(Date.now() - 1123200000).toISOString(),
        },
        {
          conversationId: '15',
          title: 'Consumer behavior insights',
          createdAt: new Date(Date.now() - 1209600000).toISOString(),
          updatedAt: new Date(Date.now() - 1209600000).toISOString(),
        },
      ],
      pageNumber: 1,
      pageSize: 15,
      nextCursor: null, // No more pages
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
                  <Paperclip className="h-5 w-5" />
                </button>
                <button className="text-gray-500 hover:text-gray-700">
                  <Mic className="h-5 w-5" />
                </button>
                <input
                  type="text"
                  placeholder="Ask about your CMI data..."
                  className="flex-1 border-none bg-transparent outline-none placeholder:text-gray-400"
                />
                <button className="rounded-full bg-gray-400 p-2.5 text-white transition-colors hover:bg-gray-500">
                  <SendHorizontal className="h-5 w-5" />
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
