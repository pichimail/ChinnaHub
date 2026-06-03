'use client';

import { Dices, Wand2 } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Action from '@/features/ChatInput/ActionBar/components/Action';
import { generatePromptWithAssistant, type PromptAssistantMode } from '@/services/promptAssistant';

interface GenerationPromptAssistantActionProps {
  imageUrls?: string[];
  mode: PromptAssistantMode;
  onPromptChange: (prompt: string) => void;
  prompt?: string | null;
}

const GenerationPromptAssistantAction = memo<GenerationPromptAssistantActionProps>(
  ({ mode, onPromptChange, prompt, imageUrls }) => {
    const { t } = useTranslation('common');
    const [isLoading, setIsLoading] = useState(false);
    const intent = useMemo(() => (prompt?.trim() ? 'enhance' : 'generate'), [prompt]);

    const handleClick = useCallback(async () => {
      if (isLoading) return;

      try {
        const nextPrompt = await generatePromptWithAssistant({
          imageUrls,
          intent,
          mode,
          onLoadingChange: setIsLoading,
          prompt,
        });

        onPromptChange(nextPrompt);
      } catch (error) {
        console.error('[GenerationPromptAssistantAction] Failed to prepare prompt:', error);
      }
    }, [imageUrls, intent, isLoading, mode, onPromptChange, prompt]);

    return (
      <Action
        icon={intent === 'enhance' ? Wand2 : Dices}
        loading={isLoading}
        title={t(
          isLoading
            ? intent === 'enhance'
              ? 'promptAssistant.status.enhancing'
              : 'promptAssistant.status.generating'
            : intent === 'enhance'
              ? 'promptAssistant.actions.enhance'
              : 'promptAssistant.actions.generate',
        )}
        onClick={handleClick}
      />
    );
  },
);

GenerationPromptAssistantAction.displayName = 'GenerationPromptAssistantAction';

export default GenerationPromptAssistantAction;
