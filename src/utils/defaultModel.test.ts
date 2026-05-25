import {
  DEFAULT_MODEL,
  DEFAULT_ONBOARDING_MODEL,
  DEFAULT_ONBOARDING_PROVIDER,
  DEFAULT_PROVIDER,
} from '@lobechat/business-const';
import { describe, expect, it } from 'vitest';

describe('default language model config', () => {
  it('uses OpenRouter auto as the default runtime model', () => {
    expect(DEFAULT_PROVIDER).toBe('openrouter');
    expect(DEFAULT_MODEL).toBe('openrouter/auto');
  });

  it('uses OpenRouter auto as the onboarding default model', () => {
    expect(DEFAULT_ONBOARDING_PROVIDER).toBe('openrouter');
    expect(DEFAULT_ONBOARDING_MODEL).toBe('openrouter/auto');
  });
});
