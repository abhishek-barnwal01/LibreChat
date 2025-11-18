import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import type { ContextType } from '~/common';
import {
  useSearchEnabled,
  useAssistantsMap,
  useAuthContext,
  useAgentsMap,
  useFileMap,
  useNewConvo,
} from '~/hooks';
import {
  PromptGroupsProvider,
  AssistantsMapContext,
  AgentsMapContext,
  SetConvoProvider,
  FileMapContext,
} from '~/Providers';
import { useUserTermsQuery, useGetStartupConfig } from '~/data-provider';
import { TermsAndConditionsModal } from '~/components/ui';
import TopNavigation from '~/components/Nav/TopNavigation';
import LeftSidebar from '~/components/Nav/LeftSidebar';
import RightSidebar from '~/components/Nav/RightSidebar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHealthCheck } from '~/data-provider';
import { Banner } from '~/components/Banners';
import { clearMessagesCache } from '~/utils';
import store from '~/store';

export default function Root() {
  const [showTerms, setShowTerms] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);
  const [navVisible, setNavVisible] = useState(() => {
    const savedNavVisible = localStorage.getItem('navVisible');
    return savedNavVisible !== null ? JSON.parse(savedNavVisible) : true;
  });
  const [rightSidebarVisible, setRightSidebarVisible] = useState(() => {
    const savedRightSidebarVisible = localStorage.getItem('rightSidebarVisible');
    return savedRightSidebarVisible !== null ? JSON.parse(savedRightSidebarVisible) : true;
  });

  const { isAuthenticated, logout } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const index = 0;
  const { conversation } = store.useCreateConversationAtom(index);
  const { newConversation } = useNewConvo(index);


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
    // Clear messages cache and invalidate queries
    clearMessagesCache(queryClient, conversation?.conversationId);
    queryClient.invalidateQueries([QueryKeys.messages]);

    // Create new conversation in state
    newConversation();

    // Navigate to new chat
    navigate('/c/new', { state: { focusChat: true } });
  }, [queryClient, conversation, newConversation, navigate]);

  const handlePromptClick = useCallback((prompt: string) => {
    const textarea = document.querySelector('textarea[id="prompt-textarea"]') as HTMLTextAreaElement;
    if (textarea) {
      // Get the native setter to bypass React's value tracking
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;

      if (nativeInputValueSetter) {
        // Set value using native setter
        nativeInputValueSetter.call(textarea, prompt);
      } else {
        // Fallback
        textarea.value = prompt;
      }

      // Dispatch both input and change events for React
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      const changeEvent = new Event('change', { bubbles: true });
      textarea.dispatchEvent(changeEvent);

      // Focus the textarea
      textarea.focus();
    }
  }, []);

  const toggleLeftSidebar = useCallback(() => {
    setNavVisible((prev) => {
      localStorage.setItem('navVisible', JSON.stringify(!prev));
      return !prev;
    });
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setRightSidebarVisible((prev) => {
      localStorage.setItem('rightSidebarVisible', JSON.stringify(!prev));
      return !prev;
    });
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
                  <aside
                    className="flex-shrink-0 border-r border-gray-200 transition-all duration-200 ease-in-out"
                    style={{
                      width: navVisible ? '208px' : '0px',
                      opacity: navVisible ? 1 : 0,
                    }}
                  >
                    <LeftSidebar onCollapse={toggleLeftSidebar} />
                  </aside>

                  {/* Left Sidebar Toggle - Only show when collapsed */}
                  {!navVisible && (
                    <button
                      onClick={toggleLeftSidebar}
                      className="fixed z-50 flex h-12 w-8 items-center justify-center rounded-r-lg border border-l-0 border-gray-300 bg-white shadow-md transition-all duration-200 ease-in-out hover:bg-gray-100"
                      style={{
                        top: `calc(50% + ${bannerHeight / 2}px)`,
                        left: '0px',
                      }}
                      aria-label="Open left sidebar"
                    >
                      <ChevronRight className="h-5 w-5 text-gray-700" />
                    </button>
                  )}

                  {/* Center Chat Area */}
                  <main className="relative flex h-full max-w-full flex-1 flex-col overflow-hidden">
                    <Outlet context={{ navVisible, setNavVisible } satisfies ContextType} />
                  </main>

                  {/* Right Sidebar Toggle */}
                  <button
                    onClick={toggleRightSidebar}
                    className="fixed z-50 flex h-12 w-8 items-center justify-center rounded-l-lg border border-r-0 border-gray-300 bg-white shadow-md transition-all duration-200 ease-in-out hover:bg-gray-100"
                    style={{
                      top: `calc(50% + ${bannerHeight / 2}px)`,
                      right: rightSidebarVisible ? '256px' : '0px',
                    }}
                    aria-label={rightSidebarVisible ? 'Close right sidebar' : 'Open right sidebar'}
                  >
                    {rightSidebarVisible ? (
                      <ChevronRight className="h-5 w-5 text-gray-700" />
                    ) : (
                      <ChevronLeft className="h-5 w-5 text-gray-700" />
                    )}
                  </button>

                  {/* Right Sidebar */}
                  <aside
                    className="flex-shrink-0 transition-all duration-200 ease-in-out"
                    style={{
                      width: rightSidebarVisible ? '256px' : '0px',
                      opacity: rightSidebarVisible ? 1 : 0,
                    }}
                  >
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
