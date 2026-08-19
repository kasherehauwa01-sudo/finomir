import { describe, expect, it } from 'vitest';
import { tagGroupQueryIds, toggleTagGroup } from './Dashboard';

const options=[{id:'one'},{id:'two'}];

describe('группы тегов дашборда',()=>{
  it('снимает все и выделяет все значения группы',()=>{
    expect(toggleTagGroup(['one','two'],options)).toEqual([]);
    expect(toggleTagGroup([],options)).toEqual(['one','two']);
  });

  it('передает заведомо отсутствующий UUID при снятии всех значений',()=>{
    expect(tagGroupQueryIds([],options)).toEqual(['00000000-0000-0000-0000-000000000000']);
    expect(tagGroupQueryIds(['one'],options)).toEqual(['one']);
  });
});
