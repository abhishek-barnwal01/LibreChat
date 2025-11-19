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
        <h2 className="text-lg font-semibold text-text-primary">CMI Data Assistant</h2>
      </div>

      {/* Single scrollable content area for entire sidebar */}
      <div className="flex-1 overflow-y-auto">
        {/* Projects Section */}
        <CollapsibleSection
          title="Projects"
          defaultOpen={true}
          rightAction={
            <button
              type="button"
              className="rounded p-0.5 hover:bg-surface-hover"
              onClick={(e) => {
                e.stopPropagation();
                // Handle add project
              }}
            >
              <Plus className="h-3 w-3" />
            </button>
          }
        >
          <button
            type="button"
            onClick={() => setSelectedProject('default')}
            className={cn(
              'w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all',
              selectedProject === 'default'
                ? 'bg-gradient-to-r from-green-500 to-purple-500 text-white shadow-md'
                : 'bg-surface-primary text-text-primary hover:bg-surface-hover',
            )}
          >
            Default Project
          </button>
        </CollapsibleSection>

        {/* Documents Section */}
        <CollapsibleSection title="Documents" defaultOpen={true}>
          <div className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-hover"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Knowledge Base</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-hover"
            >
              <Upload className="h-4 w-4" />
              <span>Uploaded Files</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-hover"
            >
              <LinkIcon className="h-4 w-4" />
              <span>Link SharePoint</span>
            </button>
          </div>
        </CollapsibleSection>

        {/* Filters Section */}
        <CollapsibleSection
          title="Filters"
          defaultOpen={true}
          rightAction={
            <button
              type="button"
              className="text-xs font-normal text-blue-500 hover:underline dark:text-blue-400"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDataset('household');
                setSelectedGeography('india');
              }}
            >
              Reset
            </button>
          }
        >
          <div className="space-y-4">
            {/* Datasets */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                Datasets
              </div>
              <div className="flex flex-wrap gap-2">
                <PillButton
                  selected={selectedDataset === 'household'}
                  onClick={() => setSelectedDataset('household')}
                >
                  Household Panel
                </PillButton>
                <PillButton
                  selected={selectedDataset === 'retail'}
                  onClick={() => setSelectedDataset('retail')}
                >
                  Retail Audit
                </PillButton>
                <PillButton
                  selected={selectedDataset === 'social'}
                  onClick={() => setSelectedDataset('social')}
                >
                  Social Listening
                </PillButton>
              </div>
            </div>

            {/* Geography */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                Geography
              </div>
              <div className="flex flex-wrap gap-2">
                <PillButton
                  selected={selectedGeography === 'india'}
                  onClick={() => setSelectedGeography('india')}
                >
                  India
                </PillButton>
                <PillButton
                  selected={selectedGeography === 'indonesia'}
                  onClick={() => setSelectedGeography('indonesia')}
                >
                  Indonesia
                </PillButton>
                <PillButton
                  selected={selectedGeography === 'africa'}
                  onClick={() => setSelectedGeography('africa')}
                >
                  Africa
                </PillButton>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Chat History Section */}
        <CollapsibleSection title="Chat History" defaultOpen={true}>
          <div style={{ height: '800px' }}>
            <Conversations
              conversations={conversations}
              moveToTop={moveToTop}
              toggleNav={handleToggleNav}
              containerRef={listRef}
              loadMoreConversations={loadMoreConversations}
              isLoading={isFetchingNextPage || showLoading || isLoading}
              isSearchLoading={!!search.query && (search.isTyping || isLoading || isFetching)}
              compact={true}
            />
          </div>
        </CollapsibleSection>
      </div>

      {/* Account Settings at bottom */}
      <div className="flex-shrink-0 border-t border-border-light p-2">
        <Suspense fallback={null}>
          <AccountSettings />
        </Suspense>
      </div>
    </div>
  );
});

LeftSidebar.displayName = 'LeftSidebar';

export default LeftSidebar;
