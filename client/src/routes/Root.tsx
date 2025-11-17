import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import type { ContextType } from '~/common';
import {
  useSearchEnabled,
  useAssistantsMap,
  useAuthContext,
  useAgentsMap,
  useFileMap,
} from '~/hooks';
import {
  PromptGroupsProvider,
  AssistantsMapContext,
  AgentsMapContext,
  SetConvoProvider,
  FileMapContext,
} from '~/Providers';
import { useUserTermsQuery, useGetStartupConfig, useConversationsInfiniteQuery } from '~/data-provider';
import { TermsAndConditionsModal } from '~/components/ui';
import TopNavigation from '~/components/Nav/TopNavigation';
import LeftSidebar from '~/components/Nav/LeftSidebar';
import RightSidebar from '~/components/Nav/RightSidebar';
import { useHealthCheck } from '~/data-provider';
import { Banner } from '~/components/Banners';
import store from '~/store';

export default function Root() {
  const [showTerms, setShowTerms] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);
  const [navVisible, setNavVisible] = useState(() => {
    const savedNavVisible = localStorage.getItem('navVisible');
    return savedNavVisible !== null ? JSON.parse(savedNavVisible) : true;
  });
  const [sidebarView, setSidebarView] = useState<'filters' | 'history'>('filters');

  const { isAuthenticated, logout } = useAuthContext();
  const navigate = useNavigate();
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

  // Global health check - runs once per authenticated session
  useHealthCheck(isAuthenticated);

  const assistantsMap = useAssistantsMap({ isAuthenticated });
  const agentsMap = useAgentsMap({ isAuthenticated });
  const fileMap = useFileMap({ isAuthenticated });

  const { data: config } = useGetStartupConfig();
  const { data: termsData } = useUserTermsQuery({
    enabled: isAuthenticated && config?.interface?.termsOfService?.modalAcceptance === true,
  });

  useSearchEnabled(isAuthenticated);

  useEffect(() => {
    if (termsData) {
      setShowTerms(!termsData.termsAccepted);
    }
  }, [termsData]);

  const handleAcceptTerms = () => {
    setShowTerms(false);
  };

  const handleDeclineTerms = () => {
    setShowTerms(false);
    logout('/login?redirect=false');
  };

  const handleNewQuery = useCallback(() => {
    navigate('/c/new');
  }, [navigate]);

  const handlePromptClick = useCallback((prompt: string) => {
    const textarea = document.querySelector('textarea[id="prompt-textarea"]') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = prompt;
      textarea.focus();
    }
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SetConvoProvider>
      <FileMapContext.Provider value={fileMap}>
        <AssistantsMapContext.Provider value={assistantsMap}>
          <AgentsMapContext.Provider value={agentsMap}>
            <PromptGroupsProvider>
              <Banner onHeightChange={setBannerHeight} />
              <div className="flex flex-col bg-white" style={{ height: `calc(100dvh - ${bannerHeight}px)` }}>
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
                  <main className="relative flex h-full max-w-full flex-1 flex-col overflow-hidden">
                    <Outlet context={{ navVisible, setNavVisible } satisfies ContextType} />
                  </main>

                  {/* Right Sidebar */}
                  <aside className="w-80 flex-shrink-0">
                    <RightSidebar onPromptClick={handlePromptClick} />
                  </aside>
                </div>
              </div>
            </PromptGroupsProvider>
          </AgentsMapContext.Provider>
          {config?.interface?.termsOfService?.modalAcceptance === true && (
            <TermsAndConditionsModal
              open={showTerms}
              onOpenChange={setShowTerms}
              onAccept={handleAcceptTerms}
              onDecline={handleDeclineTerms}
              title={config.interface.termsOfService.modalTitle}
              modalContent={config.interface.termsOfService.modalContent}
            />
          )}
        </AssistantsMapContext.Provider>
      </FileMapContext.Provider>
    </SetConvoProvider>
  );
}
