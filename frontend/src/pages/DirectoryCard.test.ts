import { describe, expect, it } from 'vitest';
import { partnerUpdatePayload } from './DirectoryCard';

describe('карточка партнера', () => {
  it('сохраняет единственный выбранный тег', () => {
    expect(partnerUpdatePayload('Партнер', null, 'tag-1')).toEqual({
      name: 'Партнер',
      comment: null,
      tag_id: 'tag-1',
    });
  });

  it('позволяет удалить привязку к тегу', () => {
    expect(partnerUpdatePayload('Партнер', 'Комментарий', '').tag_id).toBeNull();
  });
});
