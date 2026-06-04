'use client';

import { Button, Flexbox, Icon, Text } from '@lobehub/ui';
import { App, Input, Modal, Select, Upload } from 'antd';
import { ArrowLeft, Mic, UploadCloud } from 'lucide-react';
import { memo, useRef, useState } from 'react';

import { audioActionService } from '@/services/audioAction';

interface VoicePersonaModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'source' | 'record' | 'phrase' | 'create';

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const VoicePersonaModal = memo<VoicePersonaModalProps>(({ onClose, open }) => {
  const { message } = App.useApp();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [step, setStep] = useState<Step>('source');
  const [sourceUrl, setSourceUrl] = useState('');
  const [validationUrl, setValidationUrl] = useState('');
  const [phraseTaskId, setPhraseTaskId] = useState('');
  const [phrase, setPhrase] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [style, setStyle] = useState('Pop, Male Vocal');
  const [skill, setSkill] = useState('Beginner');
  const [loading, setLoading] = useState(false);

  const uploadAudio = async (file: File) => {
    setLoading(true);
    try {
      const base64 = await toBase64(file);
      const response = (await audioActionService.uploadFileFromBase64({
        base64,
        fileName: file.name,
      })) as any;
      const url = response?.data?.url || response?.url || response?.data?.fileUrl || '';
      if (!url) throw new Error('Upload response did not include a file URL');
      setSourceUrl(url);
      setStep('phrase');
      message.success('Audio ready');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    recorderRef.current = new MediaRecorder(stream);
    recorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      await uploadAudio(file);
      stream.getTracks().forEach((track) => track.stop());
    };
    recorderRef.current.start();
  };

  const stopRecording = () => recorderRef.current?.stop();

  const fetchPhrase = async () => {
    setLoading(true);
    try {
      const response = (await audioActionService.voiceGenerateVerificationPhrase({
        language: 'English',
      })) as any;
      const taskId = response?.data?.taskId || response?.taskId || response?.data?.id || '';
      setPhraseTaskId(taskId);
      if (taskId) {
        const details = (await audioActionService.getVoiceVerificationPhrase(taskId)) as any;
        setPhrase(
          details?.data?.phrase ||
            details?.data?.verificationPhrase ||
            details?.phrase ||
            'Read the verification phrase shown by the provider',
        );
      }
      setStep('phrase');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not fetch phrase');
    } finally {
      setLoading(false);
    }
  };

  const createVoice = async () => {
    setLoading(true);
    try {
      const response = (await audioActionService.createCustomVoice({
        description: 'created from Accoustica voice flow',
        sourceAudioUrl: sourceUrl,
        style,
        singerSkillLevel: skill,
        validationAudioUrl: validationUrl || sourceUrl,
        validationTaskId: phraseTaskId,
        voiceName: voiceName || 'My Voice',
      })) as any;
      const voiceId = response?.data?.voiceId || response?.voiceId || response?.data?.id;
      message.success(voiceId ? 'Voice created' : 'Voice generation started');
      setStep('create');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Voice generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal centered footer={null} open={open} title={null} width={860} onCancel={onClose}>
      <Flexbox gap={20} padding={10}>
        {step !== 'source' && (
          <Button icon={<Icon icon={ArrowLeft} />} size="small" onClick={() => setStep('source')} />
        )}
        {step === 'source' && (
          <Flexbox align="center" gap={22} paddingBlock={56}>
            <Text as="h2">Choose Audio Source</Text>
            <Flexbox horizontal gap={12} style={{ flexWrap: 'wrap' }}>
              <Button icon={<Icon icon={Mic} />} onClick={() => setStep('record')}>
                Record
              </Button>
              <Upload beforeUpload={(file) => { void uploadAudio(file); return false; }} showUploadList={false} accept="audio/*">
                <Button icon={<Icon icon={UploadCloud} />} loading={loading}>Upload Audio</Button>
              </Upload>
            </Flexbox>
          </Flexbox>
        )}
        {step === 'record' && (
          <Flexbox align="center" gap={18} paddingBlock={42}>
            <Text as="h2">Record Audio</Text>
            <Button icon={<Icon icon={Mic} />} type="primary" onMouseDown={startRecording} onMouseUp={stopRecording}>
              Hold to record
            </Button>
          </Flexbox>
        )}
        {step === 'phrase' && (
          <Flexbox gap={16}>
            <Text as="h2">Read This Phrase</Text>
            <Input readOnly value={phrase || 'Fetch a phrase before recording validation audio'} />
            <Flexbox horizontal gap={10}>
              <Button loading={loading} onClick={fetchPhrase}>Fetch phrase</Button>
              <Upload beforeUpload={(file) => { void uploadAudio(file).then(() => setValidationUrl(sourceUrl)); return false; }} showUploadList={false} accept="audio/*">
                <Button>Upload validation audio</Button>
              </Upload>
            </Flexbox>
            <Input placeholder="Voice name" value={voiceName} onChange={(e) => setVoiceName(e.target.value)} />
            <Input placeholder="Style" value={style} onChange={(e) => setStyle(e.target.value)} />
            <Select value={skill} options={['Beginner', 'Intermediate', 'Expert'].map((value) => ({ label: value, value }))} onChange={setSkill} />
            <Button disabled={!sourceUrl} loading={loading} type="primary" onClick={createVoice}>Generate Voice</Button>
          </Flexbox>
        )}
        {step === 'create' && (
          <Flexbox align="center" gap={12} paddingBlock={54}>
            <Text as="h2">Voice generation started</Text>
            <Button onClick={onClose}>Done</Button>
          </Flexbox>
        )}
      </Flexbox>
    </Modal>
  );
});

VoicePersonaModal.displayName = 'VoicePersonaModal';
export default VoicePersonaModal;
