import { memo, useState } from 'react';
import { Bookmark, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '~/utils';

interface Prompt {
  id: string;
  text: string;
  category?: string;
}

interface RightSidebarProps {
  onPromptClick?: (prompt: string) => void;
}

const myPromptsData: Prompt[] = [
  { id: '1', text: 'Analyze quarterly sales trends' },
  { id: '2', text: 'Compare regional performance' },
];

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
  const [myPrompts, setMyPrompts] = useState<Prompt[]>(myPromptsData);

  const handleDeletePrompt = (id: string) => {
    setMyPrompts((prev) => prev.filter((p) => p.id !== id));
  };

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
    <div className="flex h-full flex-col overflow-y-auto border-l border-gray-200 bg-white">
      {/* My Prompts Section */}
      <div className="border-b border-gray-200 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Bookmark className="h-4 w-4" />
          <span>My Prompts</span>
        </div>

        <div className="space-y-2">
          {myPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="group flex items-start justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors hover:border-gray-300 hover:bg-gray-100"
            >
              <button
                type="button"
                onClick={() => onPromptClick?.(prompt.text)}
                className="flex-1 text-left text-sm text-gray-700"
              >
                {prompt.text}
              </button>
              <button
                type="button"
                onClick={() => handleDeletePrompt(prompt.id)}
                className="opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Prompts Section */}
      <div className="flex-1 p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Sparkles className="h-4 w-4" />
          <span>Suggested Prompts</span>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedSuggestedPrompts).map(([category, prompts]) => (
            <div key={category}>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                {category}
              </div>
              <div className="space-y-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    onClick={() => onPromptClick?.(prompt.text)}
                    className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left text-sm text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
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
  );
});

RightSidebar.displayName = 'RightSidebar';

export default RightSidebar;
