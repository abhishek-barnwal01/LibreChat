import { memo, useState, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  FolderOpen,
  Upload,
  Link as LinkIcon,
} from 'lucide-react';
import { Sidebar, Button } from '@librechat/client';
import { useRecoilValue } from 'recoil';
import { cn } from '~/utils';
import { Conversations } from '~/components/Conversations';
import { useConversationsInfiniteQuery } from '~/data-provider';
import { useNavScrolling } from '~/hooks';
import store from '~/store';

const AccountSettings = lazy(() => import('./AccountSettings'));
const KnowledgeBase = lazy(() => import('./KnowledgeBase'));

interface LeftSidebarProps {
  toggleNav?: () => void;
  onCollapse?: () => void;
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
      <div className="border-b border-border-light py-3">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between px-3 text-xs font-medium uppercase tracking-wide text-text-secondary"
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
        ? 'border-text-primary bg-text-primary text-white dark:border-white dark:bg-white dark:text-black'
        : 'border-border-medium bg-surface-primary text-text-primary hover:bg-surface-hover',
    )}
  >
    {children}
  </button>
));

PillButton.displayName = 'PillButton';

const LeftSidebar = memo(({ toggleNav, onCollapse }: LeftSidebarProps) => {
  const [selectedProject, setSelectedProject] = useState('default');
  const [selectedDataset, setSelectedDataset] = useState('household');
  const [selectedGeography, setSelectedGeography] = useState('india');
  const [tags, setTags] = useState<string[]>([]);
  const [showLoading, setShowLoading] = useState(false);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [chatHistoryOpen, setChatHistoryOpen] = useState(true);
  const listRef = useRef<any>(null);

  const search = useRecoilValue(store.search);

  // Fetch conversations with infinite query
  const { data, fetchNextPage, isFetchingNextPage, isLoading, isFetching } =
    useConversationsInfiniteQuery(
      {
        tags: tags.length === 0 ? undefined : tags,
        search: search.debouncedQuery || undefined,
      },
      {
        enabled: true,
        staleTime: 30000,
        cacheTime: 300000,
      },
    );

  const computedHasNextPage = useMemo(() => {
    if (data?.pages && data.pages.length > 0) {
      const lastPage = data.pages[data.pages.length - 1];
      return lastPage.nextCursor !== null;
    }
    return false;
  }, [data?.pages]);

  const { moveToTop } = useNavScrolling({
    setShowLoading,
    fetchNextPage: async (options?) => {
      if (computedHasNextPage) {
        return fetchNextPage(options);
      }
      return Promise.resolve({} as any);
    },
    isFetchingNext: isFetchingNextPage,
  });

  // Flatten conversations from pages structure
  const conversations = useMemo(() => {
    return data ? data.pages.flatMap((page) => page.conversations) : [];
  }, [data]);

  const loadMoreConversations = useCallback(() => {
    if (isFetchingNextPage || !computedHasNextPage) {
      return;
    }
    fetchNextPage();
  }, [isFetchingNextPage, computedHasNextPage, fetchNextPage]);

  const handleToggleNav = useCallback(() => {
    if (toggleNav) {
      toggleNav();
    }
  }, [toggleNav]);

  return (
    <div className="flex h-full flex-col bg-surface-primary">
      <div className="flex-shrink-0 border-b border-border-light p-4">
        <h2 className="text-lg font-semibold text-text-primary">CMI MarketLens</h2>
      </div>

      {/* Flex content area — Documents fixed, Chat History fills remaining space */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Documents Section */}
        <div className="flex-shrink-0">
          <CollapsibleSection title="Documents" defaultOpen={true}>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowKnowledgeBase(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-hover"
              >
                <FolderOpen className="h-4 w-4" />
                <span>Knowledge Base</span>
              </button>
            </div>
          </CollapsibleSection>
        </div>

        {/* Chat History Section — grows to fill remaining space, single scroll via List */}
        <div className="flex-1 min-h-0 flex flex-col border-b border-border-light">
          <button
            type="button"
            onClick={() => setChatHistoryOpen((p) => !p)}
            className="flex flex-shrink-0 w-full items-center justify-between px-3 py-3 text-xs font-medium uppercase tracking-wide text-text-secondary"
          >
            <div className="flex items-center gap-2">
              {chatHistoryOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>Chat History</span>
            </div>
          </button>
          {chatHistoryOpen && (
            <div className="flex-1 min-h-0 px-1">
              <Conversations
                conversations={conversations}
                moveToTop={moveToTop}
                toggleNav={handleToggleNav}
                containerRef={listRef}
                loadMoreConversations={loadMoreConversations}
                isLoading={isFetchingNextPage || showLoading || isLoading}
                isSearchLoading={!!search.query && (search.isTyping || isLoading || isFetching)}
                compact={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Account Settings at bottom */}
      <div className="px-3 pb-2">
        <Suspense fallback={null}>
          <AccountSettings />
        </Suspense>
      </div>

      {/* Knowledge Base Modal */}
      {showKnowledgeBase && (
        <Suspense fallback={null}>
          <KnowledgeBase onClose={() => setShowKnowledgeBase(false)} />
        </Suspense>
      )}
    </div>
  );
});

LeftSidebar.displayName = 'LeftSidebar';

export default LeftSidebar;
