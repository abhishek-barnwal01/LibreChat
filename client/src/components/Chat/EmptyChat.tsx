import { memo } from 'react';
import { Sparkles } from 'lucide-react';

const EmptyChat = memo(() => {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
        <Sparkles className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Start a conversation</h2>
      <p className="max-w-md text-center text-sm text-gray-500 dark:text-gray-400">
        Ask questions about your CMI data, upload files for analysis, or explore insights.
      </p>
    </div>
  );
});

EmptyChat.displayName = 'EmptyChat';

export default EmptyChat;
