import { memo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  FolderOpen,
  Upload,
  Link as LinkIcon,
  MessageSquare,
} from 'lucide-react';
import { cn } from '~/utils';
import { Conversations } from '~/components/Conversations';
import type { ConversationListResponse } from 'librechat-data-provider';

interface LeftSidebarProps {
  // Props for conversation list
  conversationData?: any;
  moveToTop?: () => void;
  toggleNavVisible?: () => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  scrollableRef?: React.RefObject<any>;
  refetch?: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  rightAction?: React.ReactNode;
}

const CollapsibleSection = memo(
  ({ title, children, defaultOpen = true, rightAction }: CollapsibleSectionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
      <div className="border-b border-gray-200 py-3">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between px-3 text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span>{title}</span>
          </div>
          {rightAction}
        </button>
        {isOpen && <div className="mt-3 space-y-1 px-3">{children}</div>}
      </div>
    );
  },
);

CollapsibleSection.displayName = 'CollapsibleSection';

interface PillButtonProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}

const PillButton = memo(({ children, selected = false, onClick }: PillButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-full border px-4 py-1.5 text-sm transition-colors',
      selected
        ? 'border-black bg-black text-white'
        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
    )}
  >
    {children}
  </button>
));

PillButton.displayName = 'PillButton';

const LeftSidebar = memo(
  ({
    conversationData,
    moveToTop,
    toggleNavVisible,
    containerRef,
    scrollableRef,
    refetch,
  }: LeftSidebarProps) => {
    return (
      <div className="flex h-full flex-col bg-gray-50">
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900">CMI Data Assistant</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          <CollapsibleSection title="Chat History" defaultOpen={true}>
            {conversationData && (
              <Conversations
                conversations={conversationData}
                moveToTop={moveToTop}
                toggleNavVisible={toggleNavVisible}
              />
            )}
          </CollapsibleSection>
        </div>
      </div>
    );
  },
);

LeftSidebar.displayName = 'LeftSidebar';

export default LeftSidebar;
