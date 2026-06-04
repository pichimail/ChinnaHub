'use client';

import { Button, Flexbox, Text } from '@lobehub/ui';
import { Input, Modal, Segmented, Select, Slider, Switch } from 'antd';
import { memo, useState } from 'react';

import { brandedGrokModels, grokImagineService } from '@/services/grokImagine';

interface GrokImagineSettingsModalProps {
  mode: 'image' | 'video';
  open: boolean;
  onClose: () => void;
}

const imageModes = [
  { label: brandedGrokModels.chinnaImage, value: 'text-to-image' },
  { label: 'Image to image', value: 'image-to-image' },
  { label: 'Upscale', value: 'upscale' },
  { label: brandedGrokModels.chinnaAutoImage, value: 'auto-image' },
];

const videoModes = [
  { label: brandedGrokModels.chinnaVideo, value: 'text-to-video' },
  { label: 'Image to video', value: 'image-to-video' },
  { label: 'Extend', value: 'extend' },
  { label: brandedGrokModels.chinnaVideoPreview, value: 'preview' },
  { label: brandedGrokModels.chinnaAutoVideo, value: 'auto-video' },
];

const GrokImagineSettingsModal = memo<GrokImagineSettingsModalProps>(({ mode, onClose, open }) => {
  const [providerMode, setProviderMode] = useState(mode === 'image' ? 'text-to-image' : 'text-to-video');
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [quality, setQuality] = useState('high');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState(6);
  const [enhance, setEnhance] = useState(true);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const payload = { aspectRatio, duration, enhancePrompt: enhance, imageUrl, prompt, quality };
      if (providerMode === 'auto-image') await grokImagineService.runChinnaAutoImage(payload);
      else if (providerMode === 'auto-video') await grokImagineService.runChinnaAutoVideo(payload);
      else if (mode === 'image') await grokImagineService.runChinnaImage(providerMode as any, payload);
      else await grokImagineService.runChinnaVideo(providerMode as any, payload);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal centered footer={null} open={open} title={mode === 'image' ? 'Image model' : 'Video model'} width={560} onCancel={onClose}>
      <Flexbox gap={14}>
        <Segmented block value={providerMode} options={mode === 'image' ? imageModes : videoModes} onChange={(value) => setProviderMode(String(value))} />
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} placeholder="Prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <Input placeholder="Reference image URL" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
        <Flexbox horizontal gap={8}>
          <Select style={{ flex: 1 }} value={quality} options={[{ label: 'Standard', value: 'standard' }, { label: 'High', value: 'high' }, { label: 'Ultra', value: 'ultra' }]} onChange={setQuality} />
          <Select style={{ flex: 1 }} value={aspectRatio} options={['1:1', '4:5', '9:16', '16:9', '21:9'].map((value) => ({ label: value, value }))} onChange={setAspectRatio} />
        </Flexbox>
        {mode === 'video' && <Flexbox gap={6}><Text fontSize={12}>Duration: {duration}s</Text><Slider min={4} max={12} value={duration} onChange={setDuration} /></Flexbox>}
        <Flexbox horizontal align="center" justify="space-between"><Text>Enhance prompt</Text><Switch checked={enhance} onChange={setEnhance} /></Flexbox>
        <Button block loading={loading} type="primary" onClick={run}>Generate</Button>
      </Flexbox>
    </Modal>
  );
});

GrokImagineSettingsModal.displayName = 'GrokImagineSettingsModal';
export default GrokImagineSettingsModal;
