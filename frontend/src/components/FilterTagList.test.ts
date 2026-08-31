import { describe, expect, it } from 'vitest';
import { toggleFilterTag } from './FilterTagList';

describe('плашки фильтра', () => {
  it('добавляет и удаляет выбранное значение', () => {
    expect(toggleFilterTag(['one'], 'two')).toEqual(['one', 'two']);
    expect(toggleFilterTag(['one', 'two'], 'one')).toEqual(['two']);
  });
});
