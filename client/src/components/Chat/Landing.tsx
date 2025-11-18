import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { EModelEndpoint } from 'librechat-data-provider';
import { useChatContext, useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import { useGetEndpointsQuery } from '~/data-provider';
import { getIconEndpoint, getEntity } from '~/utils';

export default function Landing({ centerFormOnLanding }: { centerFormOnLanding: boolean }) {
  const { conversation } = useChatContext();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();

  const endpointType = useMemo(() => {
    let ep = conversation?.endpoint ?? '';
    if (
      [
        EModelEndpoint.chatGPTBrowser,
        EModelEndpoint.azureOpenAI,
        EModelEndpoint.gptPlugins,
      ].includes(ep as EModelEndpoint)
    ) {
      ep = EModelEndpoint.openAI;
    }
    return getIconEndpoint({
      endpointsConfig,
      iconURL: conversation?.iconURL,
      endpoint: ep,
    });
  }, [conversation?.endpoint, conversation?.iconURL, endpointsConfig]);

  const { entity } = getEntity({
    endpoint: endpointType,
    agentsMap,
    assistantMap,
    agent_id: conversation?.agent_id,
    assistant_id: conversation?.assistant_id,
  });

  const description = (entity?.description || conversation?.greeting) ?? '';

  return (
    <div
      className={`flex h-full transform-gpu flex-col items-center justify-center pb-16 transition-all duration-200 ${centerFormOnLanding ? 'max-h-full sm:max-h-0' : 'max-h-full'}`}
    >
      <div className="flex flex-col items-center px-4">
        <div className="mb-4 rounded-full bg-gray-100 p-4">
          <Sparkles className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold text-gray-900">Start a conversation</h2>
        <p className="max-w-md text-center text-sm text-gray-500">
          {description || 'Ask questions about your CMI data, upload files for analysis, or explore insights.'}
        </p>
      </div>
    </div>
  );
}
