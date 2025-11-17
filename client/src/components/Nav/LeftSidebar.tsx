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
    const [selectedDataset, setSelectedDataset] = useState('household');
    const [selectedGeography, setSelectedGeography] = useState('india');

    return (
      <div className="flex h-full flex-col bg-gray-50">
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900">CMI Data Assistant</h2>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Documents Section */}
          <div className="border-b border-gray-200 py-3">
            <div className="space-y-2 px-3">
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
          </div>

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
