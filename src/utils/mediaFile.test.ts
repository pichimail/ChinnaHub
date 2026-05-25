import { describe, expect, it } from 'vitest';

import { getMediaKind, isAudioFile, isVideoFile } from './mediaFile';

describe('media file detection', () => {
  it('detects common audio files by MIME type and extension', () => {
    expect(isAudioFile('audio/mpeg', 'track.bin')).toBe(true);
    expect(isAudioFile('application/octet-stream', 'track.mp3')).toBe(true);
    expect(isAudioFile('audio/wav', undefined)).toBe(true);
    expect(getMediaKind('application/octet-stream', 'voice.ogg')).toBe('audio');
  });

  it('detects common video files by MIME type and extension', () => {
    expect(isVideoFile('video/mp4', 'clip.bin')).toBe(true);
    expect(isVideoFile('application/octet-stream', 'clip.webm')).toBe(true);
    expect(isVideoFile('video/quicktime', undefined)).toBe(true);
    expect(getMediaKind('application/octet-stream', 'movie.mov')).toBe('video');
  });

  it('does not classify unrelated files as media', () => {
    expect(isAudioFile('application/pdf', 'file.pdf')).toBe(false);
    expect(isVideoFile('text/plain', 'notes.txt')).toBe(false);
    expect(getMediaKind('image/png', 'image.png')).toBeUndefined();
  });
});
