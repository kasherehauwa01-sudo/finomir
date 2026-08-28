import { describe, expect, it } from 'vitest';
import { APP_PATHS, NAVIGATION_ITEMS } from './navigation';

describe('навигация без удаленного функционала ИИ', () => {
  it('не содержит API ИИ и журнал распознавания', () => {
    const serialized = JSON.stringify({ APP_PATHS, NAVIGATION_ITEMS }).toLowerCase();
    expect(serialized).not.toContain('recognition-journal');
    expect(serialized).not.toContain('журнал распознавания');
    expect(serialized).not.toContain('api ии');
  });
});
