import { memo, useState, useMemo, useRef, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  FolderOpen,
  Upload,
  Link as LinkIcon,
} from 'lucide-react';
import { useRecoilValue } from 'recoil';
import { cn } from '~/utils';
import { Conversations } from '~/components/Conversations';
import { useConversationsInfiniteQuery } from '~/data-provider';
import { useNavScrolling } from '~/hooks';
import store from '~/store';

interface LeftSidebarProps {
  toggleNav?: () => void;
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

const LeftSidebar = memo(({ toggleNav }: LeftSidebarProps) => {
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
    <div className="flex h-full flex-col bg-white">
      <div className="flex-shrink-0 border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">CMI Data Assistant</h2>
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
                className="rounded p-0.5 hover:bg-gray-200"
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
                : 'bg-white text-gray-700 hover:bg-gray-100',
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
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Knowledge Base</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              <Upload className="h-4 w-4" />
              <span>Uploaded Files</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
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
              className="text-xs font-normal text-blue-600 hover:underline"
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
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
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
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
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
          <div className="min-h-[600px]">
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
    </div>
  );
});

LeftSidebar.displayName = 'LeftSidebar';

export default LeftSidebar;
