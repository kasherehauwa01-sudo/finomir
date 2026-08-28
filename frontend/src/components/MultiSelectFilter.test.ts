import { describe, expect, it } from 'vitest';
import { filterMultiSelectOptions } from './MultiSelectFilter';

describe('поиск в множественном фильтре',()=>{
  const options=[{id:'one',label:'ООО Альфа',search:'123'},{id:'two',label:'ООО Бета',search:'456'}];
  it('ищет по названию и дополнительным реквизитам',()=>{
    expect(filterMultiSelectOptions(options,'бета').map((item)=>item.id)).toEqual(['two']);
    expect(filterMultiSelectOptions(options,'123').map((item)=>item.id)).toEqual(['one']);
  });
});
