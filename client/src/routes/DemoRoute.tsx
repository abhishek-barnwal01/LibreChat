import { useState } from 'react';
import TopNavigation from '~/components/Nav/TopNavigation';
import LeftSidebar from '~/components/Nav/LeftSidebar';
import RightSidebar from '~/components/Nav/RightSidebar';
import EmptyChat from '~/components/Chat/EmptyChat';

// Demo route to preview the new UI without backend
export default function DemoRoute() {
  const [sidebarView, setSidebarView] = useState<'filters' | 'history'>('filters');

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
        <aside className="w-64 flex-shrink-0 border-r border-gray-200">
          <LeftSidebar
            view={sidebarView}
            onViewChange={setSidebarView}
            conversationData={undefined}
          />
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
        <aside className="w-80 flex-shrink-0">
          <RightSidebar onPromptClick={handlePromptClick} />
        </aside>
      </div>
    </div>
  );
}
