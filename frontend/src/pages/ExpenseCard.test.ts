import { describe, expect, it } from 'vitest';
import { selectSingleExpenseTag } from './ExpenseCard';

const first = { id: 'tag-1', name: 'Первый' };
const second = { id: 'tag-2', name: 'Второй' };

describe('редактирование тегов расхода', () => {
  it('заменяет ранее выбранный тег', () => {
    expect(selectSingleExpenseTag([first], second)).toEqual([second]);
  });

  it('позволяет снять единственный выбранный тег', () => {
    expect(selectSingleExpenseTag([first], first)).toEqual([]);
  });
});
