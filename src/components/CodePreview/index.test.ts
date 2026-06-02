import { describe, expect, it } from 'vitest';

import { getCodePreviewType, isPreviewableCode, isPreviewableWebCode } from './index';

describe('CodePreview helpers', () => {
  it('detects HTML files and MIME types', () => {
    expect(getCodePreviewType({ fileName: 'index.html' })).toBe('html');
    expect(getCodePreviewType({ fileName: 'page.htm' })).toBe('html');
    expect(getCodePreviewType({ language: 'text/html' })).toBe('html');
  });

  it('detects React component files', () => {
    expect(getCodePreviewType({ fileName: 'App.jsx' })).toBe('react');
    expect(getCodePreviewType({ fileName: 'App.tsx' })).toBe('react');
    expect(getCodePreviewType({ fileName: 'demo.app.jsx' })).toBe('react');
    expect(getCodePreviewType({ fileName: 'demo.app.tsx' })).toBe('react');
    expect(getCodePreviewType({ language: 'application/lobe.artifacts.react' })).toBe('react');
  });

  it('detects Python files and MIME types', () => {
    expect(getCodePreviewType({ fileName: 'script.py' })).toBe('python');
    expect(getCodePreviewType({ language: 'python' })).toBe('python');
    expect(getCodePreviewType({ language: 'text/x-python' })).toBe('python');
  });

  it('keeps web preview detection separate from runnable code preview detection', () => {
    expect(isPreviewableWebCode({ fileName: 'script.py' })).toBe(false);
    expect(isPreviewableCode({ fileName: 'script.py' })).toBe(true);
  });
});
