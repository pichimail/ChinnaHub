'use client';

import { Button, Flexbox, Icon } from '@lobehub/ui';
import { Mic2 } from 'lucide-react';
import { memo, useState } from 'react';

import LeanPromptInput from './Lean';
import VoicePersonaModal from '../VoicePersonaModal';

const VoiceLeanPromptInput = memo(() => {
  const [open, setOpen] = useState(false);

  return (
    <Flexbox gap={8} width="100%">
      <LeanPromptInput />
      <Flexbox horizontal justify="flex-end">
        <Button icon={<Icon icon={Mic2} />} size="small" type="text" onClick={() => setOpen(true)}>
          Voice
        </Button>
      </Flexbox>
      <VoicePersonaModal open={open} onClose={() => setOpen(false)} />
    </Flexbox>
  );
});

VoiceLeanPromptInput.displayName = 'VoiceLeanPromptInput';
export default VoiceLeanPromptInput;
