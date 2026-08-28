import { describe, expect, it } from 'vitest';
import type { StorePreset } from '../types';

describe('пресет магазинов', () => {
  it('хранит набор идентификаторов магазинов', () => {
    const preset: StorePreset = { id: 'preset', name: 'Центр', store_ids: ['one', 'two'], stores: ['Первый', 'Второй'] };
    expect(preset.store_ids).toEqual(['one', 'two']);
  });
});
