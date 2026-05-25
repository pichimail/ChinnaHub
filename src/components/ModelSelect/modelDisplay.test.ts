import { describe, expect, it } from 'vitest';

import {
  CHINNA_AUTO_MODEL_LABEL,
  getModelDisplayName,
  OPENROUTER_AUTO_MODEL_ID,
} from './modelDisplay';

describe('model display helpers', () => {
  it('aliases only OpenRouter auto to the Chinna AI label', () => {
    expect(getModelDisplayName(OPENROUTER_AUTO_MODEL_ID, 'Auto')).toBe(CHINNA_AUTO_MODEL_LABEL);
    expect(getModelDisplayName('deepseek-chat', 'DeepSeek Chat')).toBe('DeepSeek Chat');
    expect(getModelDisplayName('custom/model')).toBe('custom/model');
  });
});
