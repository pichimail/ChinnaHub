'use client';

import { Button, Flexbox, Icon, Text } from '@lobehub/ui';
import { App, Input, Modal, Select, Upload } from 'antd';
import { ArrowLeft, Mic, RefreshCw, UploadCloud } from 'lucide-react';
import { memo, useRef, useState } from 'react';

import { audioActionService } from '@/services/audioAction';

interface VoicePersonaModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'source' | 'record' | 'phrase' | 'verify' | 'create';

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const getUrl = (response: any) =>
  response?.data?.url || response?.data?.fileUrl || response?.data?.downloadUrl || response?.url || '';

const getTaskId = (response: any) => response?.data?.taskId || response?.taskId || response?.data?.id || '';

const VoicePersonaModal = memo<VoicePersonaModalProps>(({ onClose, open }) => {
  const { message } = App.useApp();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [step, setStep] = useState<Step>('source');
  const [sourceUrl, setSourceUrl] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [phraseTaskId, setPhraseTaskId] = useState('');
  const [voiceTaskId, setVoiceTaskId] = useState('');
  const [phrase, setPhrase] = useState('');
  const [voiceName, setVoiceName] = useState('My Voice');
  const [style, setStyle] = useState('Pop, Male Vocal');
  const [skill, setSkill] = useState('beginner');
  const [voiceId, setVoiceId] = useState('');
  const [loading, setLoading] = useState(false);

  const uploadAudio = async (file: File, target: 'source' | 'verify') => {
    setLoading(true);
    try {
      const base64 = await toBase64(file);
      const response = (await audioActionService.uploadFileFromBase64({ base64, fileName: file.name })) as any;
      const url = getUrl(response);
      if (!url) throw new Error('Upload response did not include a file URL');
      if (target === 'source') setSourceUrl(url);
      else setVerifyUrl(url);
      message.success('Audio ready');
      return url;
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Upload failed');
      return '';
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async (target: 'source' | 'verify') => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    recorderRef.current = new MediaRecorder(stream);
    recorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], `voice-${target}-${Date.now()}.webm`, { type: 'audio/webm' });
      await uploadAudio(file, target);
      stream.getTracks().forEach((track) => track.stop());
    };
    recorderRef.current.start();
  };

  const stopRecording = () => recorderRef.current?.stop();

  const fetchPhrase = async (regenerate = false) => {
    if (!sourceUrl && !regenerate) {
      message.warning('Add source audio first');
      return;
    }
    setLoading(true);
    try {
      const response = regenerate && phraseTaskId
        ? ((await audioActionService.regenerateVoiceVerificationPhrase({ taskId: phraseTaskId })) as any)
        : ((await audioActionService.voiceGenerateVerificationPhrase({
            language: 'English',
            voiceUrl: sourceUrl,
          })) as any);
      const taskId = getTaskId(response);
      if (!taskId) throw new Error('Verification task id missing');
      setPhraseTaskId(taskId);
      const details = (await audioActionService.getVoiceVerificationPhrase(taskId)) as any;
      const validateInfo = details?.data?.validateInfo || details?.data?.phrase || details?.data?.verificationPhrase || '';
      setPhrase(validateInfo || 'Phrase is still processing. Click refresh in a few seconds.');
      setStep('verify');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not fetch phrase');
    } finally {
      setLoading(false);
    }
  };

  const refreshPhrase = async () => {
    if (!phraseTaskId) return;
    setLoading(true);
    try {
      const details = (await audioActionService.getVoiceVerificationPhrase(phraseTaskId)) as any;
      const validateInfo = details?.data?.validateInfo || details?.data?.phrase || details?.data?.verificationPhrase || '';
      if (validateInfo) setPhrase(validateInfo);
      message.success(details?.data?.status || 'Updated');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Refresh failed');
    } finally {
      setLoading(false);
    }
  };

  const createVoice = async () => {
    if (!phraseTaskId || !verifyUrl) {
      message.warning('Verification phrase and audio are required');
      return;
    }
    setLoading(true);
    try {
      const response = (await audioActionService.createCustomVoice({
        description: 'Created from Accoustica voice flow',
        singerSkillLevel: skill,
        style,
        taskId: phraseTaskId,
        verifyUrl,
        voiceName: voiceName || 'My Voice',
      })) as any;
      const taskId = getTaskId(response);
      if (!taskId) throw new Error('Voice task id missing');
      setVoiceTaskId(taskId);
      setStep('create');
      message.success('Voice generation started');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Voice generation failed');
    } finally {
      setLoading(false);
    }
  };

  const refreshVoice = async () => {
    if (!voiceTaskId) return;
    setLoading(true);
    try {
      const record = (await audioActionService.getCustomVoiceRecords({ taskId: voiceTaskId })) as any;
      const nextVoiceId = record?.data?.voiceId || record?.voiceId || '';
      if (nextVoiceId) {
        setVoiceId(nextVoiceId);
        const availability = (await audioActionService.checkVoiceAvailability({ task_id: voiceTaskId })) as any;
        message.success(availability?.data?.isAvailable ? 'Voice ready' : 'Voice created, still activating');
      } else {
        message.info(record?.data?.status || 'Still processing');
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Voice refresh failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal centered footer={null} open={open} title="Voice" width={640} onCancel={onClose}>
      <Flexbox gap={16} padding={4}>
        {step !== 'source' && <Button icon={<Icon icon={ArrowLeft} />} size="small" type="text" onClick={() => setStep('source')} />}
        {step === 'source' && (
          <Flexbox gap={14}>
            <Text as="h3">Source audio</Text>
            <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
              <Button icon={<Icon icon={Mic} />} onClick={() => setStep('record')}>Record</Button>
              <Upload accept="audio/*" beforeUpload={(file) => { void uploadAudio(file, 'source').then((url) => url && setStep('phrase')); return false; }} showUploadList={false}>
                <Button icon={<Icon icon={UploadCloud} />} loading={loading}>Upload</Button>
              </Upload>
            </Flexbox>
            <Input readOnly placeholder="Source audio URL" value={sourceUrl} />
            <Button disabled={!sourceUrl} loading={loading} type="primary" onClick={() => fetchPhrase(false)}>Get phrase</Button>
          </Flexbox>
        )}
        {step === 'record' && (
          <Flexbox align="center" gap={14} paddingBlock={32}>
            <Text as="h3">Record source audio</Text>
            <Button icon={<Icon icon={Mic} />} type="primary" onMouseDown={() => startRecording('source')} onMouseUp={stopRecording}>Hold to record</Button>
          </Flexbox>
        )}
        {step === 'phrase' && <Button loading={loading} type="primary" onClick={() => fetchPhrase(false)}>Get phrase</Button>}
        {step === 'verify' && (
          <Flexbox gap={12}>
            <Text as="h3">Read phrase</Text>
            <Input.TextArea readOnly autoSize={{ minRows: 2, maxRows: 4 }} value={phrase} />
            <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
              <Button icon={<Icon icon={RefreshCw} />} loading={loading} onClick={refreshPhrase}>Refresh</Button>
              <Button loading={loading} onClick={() => fetchPhrase(true)}>Regenerate</Button>
              <Button icon={<Icon icon={Mic} />} onMouseDown={() => startRecording('verify')} onMouseUp={stopRecording}>Hold verification</Button>
              <Upload accept="audio/*" beforeUpload={(file) => { void uploadAudio(file, 'verify'); return false; }} showUploadList={false}>
                <Button icon={<Icon icon={UploadCloud} />} loading={loading}>Upload verification</Button>
              </Upload>
            </Flexbox>
            <Input readOnly placeholder="Verification audio URL" value={verifyUrl} />
            <Input placeholder="Voice name" value={voiceName} onChange={(e) => setVoiceName(e.target.value)} />
            <Input placeholder="Style" value={style} onChange={(e) => setStyle(e.target.value)} />
            <Select value={skill} options={[{ label: 'Beginner', value: 'beginner' }, { label: 'Intermediate', value: 'intermediate' }, { label: 'Expert', value: 'expert' }]} onChange={setSkill} />
            <Button disabled={!verifyUrl || !phraseTaskId} loading={loading} type="primary" onClick={createVoice}>Create voice</Button>
          </Flexbox>
        )}
        {step === 'create' && (
          <Flexbox gap={12}>
            <Text as="h3">Voice status</Text>
            <Input readOnly value={voiceTaskId} />
            {voiceId && <Input readOnly value={voiceId} />}
            <Flexbox horizontal gap={8}>
              <Button icon={<Icon icon={RefreshCw} />} loading={loading} onClick={refreshVoice}>Check</Button>
              <Button onClick={onClose}>Done</Button>
            </Flexbox>
          </Flexbox>
        )}
      </Flexbox>
    </Modal>
  );
});

VoicePersonaModal.displayName = 'VoicePersonaModal';
export default VoicePersonaModal;
