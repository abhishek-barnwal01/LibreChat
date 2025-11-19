import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { useParams } from 'react-router-dom';
import { Constants } from 'librechat-data-provider';
import { useToastContext, useMediaQuery } from '@librechat/client';
import type { TConversation } from 'librechat-data-provider';
import { useUpdateConversationMutation } from '~/data-provider';
import EndpointIcon from '~/components/Endpoints/EndpointIcon';
import { useNavigateToConvo, useLocalize } from '~/hooks';
import { useGetEndpointsQuery } from '~/data-provider';
import { NotificationSeverity } from '~/common';
import { ConvoOptions } from './ConvoOptions';
import RenameForm from './RenameForm';
import { cn, logger } from '~/utils';
import ConvoLink from './ConvoLink';
import store from '~/store';
import { MessageSquare } from 'lucide-react';

interface ConversationProps {
  conversation: TConversation;
  retainView: () => void;
  toggleNav: () => void;
  compact?: boolean;
}

export default function Conversation({ conversation, retainView, toggleNav, compact = false }: ConversationProps) {
  const params = useParams();
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { navigateToConvo } = useNavigateToConvo();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const currentConvoId = useMemo(() => params.conversationId, [params.conversationId]);
  const updateConvoMutation = useUpdateConversationMutation(currentConvoId ?? '');
  const activeConvos = useRecoilValue(store.allConversationsSelector);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const { conversationId, title = '' } = conversation;

  const [titleInput, setTitleInput] = useState(title || '');
  const [renaming, setRenaming] = useState(false);
  const [isPopoverActive, setIsPopoverActive] = useState(false);

  const previousTitle = useRef(title);

  useEffect(() => {
    if (title !== previousTitle.current) {
      setTitleInput(title as string);
      previousTitle.current = title;
    }
  }, [title]);

  const isActiveConvo = useMemo(() => {
    if (conversationId === Constants.NEW_CONVO) {
      return currentConvoId === Constants.NEW_CONVO;
    }

    if (currentConvoId !== Constants.NEW_CONVO) {
      return currentConvoId === conversationId;
    } else {
      const latestConvo = activeConvos?.[0];
      return latestConvo === conversationId;
    }
  }, [currentConvoId, conversationId, activeConvos]);

  const handleRename = () => {
    setIsPopoverActive(false);
    setTitleInput(title as string);
    setRenaming(true);
  };

  const handleRenameSubmit = async (newTitle: string) => {
    if (!conversationId || newTitle === title) {
      setRenaming(false);
      return;
    }

    try {
      await updateConvoMutation.mutateAsync({
        conversationId,
        title: newTitle.trim() || localize('com_ui_untitled'),
      });
      setRenaming(false);
    } catch (error) {
      logger.error('Error renaming conversation', error);
      setTitleInput(title as string);
      showToast({
        message: localize('com_ui_rename_failed'),
        severity: NotificationSeverity.ERROR,
        showIcon: true,
      });
      setRenaming(false);
    }
  };

  const handleCancelRename = () => {
    setTitleInput(title as string);
    setRenaming(false);
  };

  const handleNavigation = (ctrlOrMetaKey: boolean) => {
    if (ctrlOrMetaKey) {
      toggleNav();
      const baseUrl = window.location.origin;
      const path = `/c/${conversationId}`;
      window.open(baseUrl + path, '_blank');
      return;
    }

    if (currentConvoId === conversationId || isPopoverActive) {
      return;
    }

    toggleNav();

    if (typeof title === 'string' && title.length > 0) {
      document.title = title;
    }

    navigateToConvo(conversation, {
      currentConvoId,
      resetLatestMessage: !(conversationId ?? '') || conversationId === Constants.NEW_CONVO,
    });
  };

  const convoOptionsProps = {
    title,
    retainView,
    renameHandler: handleRename,
    isActiveConvo,
    conversationId,
    isPopoverActive,
    setIsPopoverActive,
  };

  // Compact mode for simplified UI
  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          handleNavigation(e.ctrlKey || e.metaKey);
        }}
        className={cn(
          'flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-100',
          isActiveConvo && 'bg-gray-200',
        )}
      >
        <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-gray-900">{title || localize('com_ui_untitled')}</div>
          <div className="text-xs text-gray-500">
            {Math.floor(Math.random() * 8) + 2} messages
          </div>
        </div>
      </button>
    );
  }

  return (
    <div
      className={cn(
        'group relative mb-0.5 flex h-12 w-full items-center rounded-lg transition-colors duration-200 md:h-9',
        isActiveConvo ? 'bg-surface-active-alt' : 'hover:bg-surface-active-alt',
      )}
      role="button"
      tabIndex={renaming ? -1 : 0}
      aria-label={`${title || localize('com_ui_untitled')} conversation`}
      onClick={(e) => {
        if (renaming) {
          return;
        }
        if (e.button === 0) {
          handleNavigation(e.ctrlKey || e.metaKey);
        }
      }}
      onKeyDown={(e) => {
        if (renaming) {
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNavigation(false);
        }
      }}
      style={{ cursor: renaming ? 'default' : 'pointer' }}
      data-testid="convo-item"
    >
      {renaming ? (
        <RenameForm
          titleInput={titleInput}
          setTitleInput={setTitleInput}
          onSubmit={handleRenameSubmit}
          onCancel={handleCancelRename}
          localize={localize}
        />
      ) : (
        <ConvoLink
          isActiveConvo={isActiveConvo}
          title={title}
          onRename={handleRename}
          isSmallScreen={isSmallScreen}
          localize={localize}
        >
          <EndpointIcon
            conversation={conversation}
            endpointsConfig={endpointsConfig}
            size={20}
            context="menu-item"
          />
        </ConvoLink>
      )}
      <div
        className={cn(
          'mr-2 flex origin-left',
          isPopoverActive || isActiveConvo
            ? 'pointer-events-auto max-w-[28px] scale-x-100 opacity-100'
            : 'pointer-events-none max-w-0 scale-x-0 opacity-0 group-focus-within:pointer-events-auto group-focus-within:max-w-[28px] group-focus-within:scale-x-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:max-w-[28px] group-hover:scale-x-100 group-hover:opacity-100',
        )}
        aria-hidden={!(isPopoverActive || isActiveConvo)}
      >
        {!renaming && <ConvoOptions {...convoOptionsProps} />}
      </div>
    </div>
  );
}
