const AUDIO_EXTENSIONS = [
  '.aac',
  '.flac',
  '.m4a',
  '.mp3',
  '.oga',
  '.ogg',
  '.opus',
  '.wav',
  '.weba',
];
const VIDEO_EXTENSIONS = ['.avi', '.m4v', '.mkv', '.mov', '.mp4', '.mpeg', '.mpg', '.ogv', '.webm'];

const AUDIO_MIME_PREFIX = 'audio/';
const VIDEO_MIME_PREFIX = 'video/';

const normalize = (value?: string | null) => value?.toLowerCase() || '';

const matchesExtension = (fileName: string | undefined | null, extensions: string[]) => {
  const lowerFileName = normalize(fileName);
  return extensions.some((extension) => lowerFileName.endsWith(extension));
};

export const isAudioFile = (fileType?: string | null, fileName?: string | null) => {
  const lowerFileType = normalize(fileType);
  return (
    lowerFileType.startsWith(AUDIO_MIME_PREFIX) ||
    AUDIO_EXTENSIONS.some((extension) => lowerFileType.includes(extension.slice(1))) ||
    matchesExtension(fileName, AUDIO_EXTENSIONS)
  );
};

export const isVideoFile = (fileType?: string | null, fileName?: string | null) => {
  const lowerFileType = normalize(fileType);
  return (
    lowerFileType.startsWith(VIDEO_MIME_PREFIX) ||
    VIDEO_EXTENSIONS.some((extension) => lowerFileType.includes(extension.slice(1))) ||
    matchesExtension(fileName, VIDEO_EXTENSIONS)
  );
};

export const getMediaKind = (fileType?: string | null, fileName?: string | null) => {
  if (isAudioFile(fileType, fileName)) return 'audio';
  if (isVideoFile(fileType, fileName)) return 'video';
};
