import { memo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { Sparkles, Blocks, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@librechat/client';
import { Permissions, EModelEndpoint, PermissionTypes } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import { ChatFormProvider, ChatContext } from '~/Providers';
import GroupSidePanel from '~/components/Prompts/Groups/GroupSidePanel';
import AgentPanelSwitch from '~/components/SidePanel/Agents/AgentPanelSwitch';
import { useGetEndpointsQuery } from '~/data-provider';
import { useHasAccess } from '~/hooks';
import useChatHelpers from '~/hooks/Chat/useChatHelpers';
import { cn } from '~/utils';

interface Prompt {
  id: string;
  text: string;
  category?: string;
}

interface RightSidebarProps {
  onPromptClick?: (prompt: string) => void;
}

const suggestedPromptsData: Prompt[] = [
  { id: '3', text: 'What are the top 3 growing product categories in India?', category: 'MARKET TRENDS' },
  { id: '4', text: 'Show me market share trends for the last 2 years', category: 'MARKET TRENDS' },
  { id: '5', text: 'Compare our performance vs competitors in Indonesia', category: 'MARKET TRENDS' },
  { id: '6', text: 'What are the main consumer pain points?', category: 'CONSUMER INSIGHTS' },
  { id: '7', text: 'Analyze demographic shifts in our customer base', category: 'CONSUMER INSIGHTS' },
  { id: '8', text: 'Show sentiment analysis from social listening data', category: 'CONSUMER INSIGHTS' },
  { id: '9', text: 'Which regions show declining sales?', category: 'SALES ANALYTICS' },
  { id: '10', text: 'Forecast next quarter revenue', category: 'SALES ANALYTICS' },
  { id: '11', text: 'Analyze seasonal patterns in sales', category: 'SALES ANALYTICS' },
];

const RightSidebar = memo(({ onPromptClick }: RightSidebarProps) => {
  const methods = useForm<ChatFormValues>({
    defaultValues: { text: '' },
  });

  const [isAgentBuilderExpanded, setIsAgentBuilderExpanded] = useState(false);

  // Get conversation ID from route if available
  const { conversationId } = useParams();

  const { data: endpointsConfig = {} } = useGetEndpointsQuery();

  const hasAccessToAgents = useHasAccess({
    permissionType: PermissionTypes.AGENTS,
    permission: Permissions.USE,
  });

  const hasAccessToCreateAgents = useHasAccess({
    permissionType: PermissionTypes.AGENTS,
    permission: Permissions.CREATE,
  });

  const showAgentBuilder =
    endpointsConfig?.[EModelEndpoint.agents] &&
    hasAccessToAgents &&
    hasAccessToCreateAgents &&
    endpointsConfig[EModelEndpoint.agents].disableBuilder !== true;

  // Use real conversation ID if available, otherwise use 'new'
  // This provides proper context for agent operations
  const chatHelpers = useChatHelpers(0, 'new');

  const groupedSuggestedPrompts = suggestedPromptsData.reduce(
    (acc, prompt) => {
      const category = prompt.category || 'OTHER';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(prompt);
      return acc;
    },
    {} as Record<string, Prompt[]>,
  );

  return (
    <ChatFormProvider {...methods}>
      <div className="flex h-full w-full flex-col border-l border-border-light bg-surface-primary">
        {/* Scrollable content area - single scroll for everything */}
        <div className="flex-1 overflow-y-auto">
          {/* Agent Builder Section */}
          {showAgentBuilder && (
            <div className="w-full border-b border-border-light px-4 pt-4">
              <div className="flex flex-col">
                <Button
                  variant="outline"
                  className="w-full bg-transparent justify-between mb-2"
                  onClick={() => setIsAgentBuilderExpanded(!isAgentBuilderExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <Blocks className="h-4 w-4" />
                    <span>Agent Builder</span>
                  </div>
                  {isAgentBuilderExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                {isAgentBuilderExpanded && (
                  <div className="mt-4 pb-4 relative isolate">
                    <div className="w-full overflow-hidden">
                      <ChatContext.Provider value={chatHelpers}>
                        <AgentPanelSwitch />
                      </ChatContext.Provider>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompts Section - Uses actual user prompts from database */}
          <div className="w-full border-b border-border-light">
            <GroupSidePanel
              isDetailView={false}
              className="!w-full border-b-0 md:!min-w-0 lg:!w-full xl:!w-full"
              onPromptClick={onPromptClick}
            />
          </div>

          {/* Suggested Prompts Section - Hardcoded system-wide suggestions */}
          <div className="p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Sparkles className="h-4 w-4" />
              <span>Suggested Prompts</span>
            </div>

            <div className="space-y-6">
              {Object.entries(groupedSuggestedPrompts).map(([category, prompts]) => (
                <div key={category}>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                    {category}
                  </div>
                  <div className="space-y-2">
                    {prompts.map((prompt) => (
                      <button
                        key={prompt.id}
                        type="button"
                        onClick={() => onPromptClick?.(prompt.text)}
                        className="w-full rounded-lg border border-border-medium bg-surface-primary p-3 text-left text-sm text-text-primary transition-all duration-300 hover:border-[#54b948] hover:shadow-lg"
                        style={{
                          transition: 'all 0.3s ease-in-out',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(90deg, #54b9481a, #00aeef1a, #ec008c1a)';
                          e.currentTarget.style.transform = 'translateX(2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '';
                          e.currentTarget.style.transform = '';
                        }}
                      >
                        {prompt.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ChatFormProvider>
  );
});

RightSidebar.displayName = 'RightSidebar';

export default RightSidebar;
