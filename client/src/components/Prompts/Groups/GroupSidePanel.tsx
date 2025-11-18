import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '@librechat/client';
import ManagePrompts from '~/components/Prompts/ManagePrompts';
import { usePromptGroupsContext } from '~/Providers';
import List from '~/components/Prompts/Groups/List';
import PanelNavigation from './PanelNavigation';
import { cn } from '~/utils';

export default function GroupSidePanel({
  children,
  isDetailView,
  className = '',
  onPromptClick,
}: {
  children?: React.ReactNode;
  isDetailView?: boolean;
  className?: string;
  onPromptClick?: (prompt: string) => void;
}) {
  const location = useLocation();
  const isSmallerScreen = useMediaQuery('(max-width: 1024px)');
  const isChatRoute = useMemo(() => location.pathname?.startsWith('/c/'), [location.pathname]);

  const { promptGroups, groupsQuery, nextPage, prevPage, hasNextPage, hasPreviousPage } =
    usePromptGroupsContext();

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col md:mr-2 md:w-auto md:min-w-72 lg:w-1/4 xl:w-1/4',
        isChatRoute ? '' : 'gap-2',
        isDetailView === true && isSmallerScreen ? 'hidden' : '',
        className,
      )}
    >
      {children}
      <div className={cn('flex-grow', isChatRoute ? '' : 'overflow-y-auto px-2 md:px-0')}>
        <List
          groups={promptGroups}
          isChatRoute={isChatRoute}
          isLoading={!!groupsQuery.isLoading}
          onPromptClick={onPromptClick}
        />
      </div>
      <div className={cn(isChatRoute ? '' : 'px-2 pb-3 pt-2 md:px-0')}>
        <PanelNavigation
          onPrevious={prevPage}
          onNext={nextPage}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          isLoading={groupsQuery.isFetching}
          isChatRoute={isChatRoute}
        >
          {isChatRoute && <ManagePrompts className="select-none" />}
        </PanelNavigation>
      </div>
    </div>
  );
}
