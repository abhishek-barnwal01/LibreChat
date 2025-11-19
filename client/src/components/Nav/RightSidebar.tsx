import { memo } from 'react';
import { useForm } from 'react-hook-form';
import { Sparkles } from 'lucide-react';
import type { ChatFormValues } from '~/common';
import { ChatFormProvider } from '~/Providers';
import GroupSidePanel from '~/components/Prompts/Groups/GroupSidePanel';
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
      <div className="flex h-full w-full flex-col overflow-y-auto border-l border-border-light bg-surface-primary">
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
    </ChatFormProvider>
  );
});

RightSidebar.displayName = 'RightSidebar';

export default RightSidebar;
