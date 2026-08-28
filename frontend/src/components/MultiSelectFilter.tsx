import { useState } from 'react';

export type MultiSelectOption = { id: string; label: string; search?: string };
export const filterMultiSelectOptions = (options: MultiSelectOption[], search: string) => { const term=search.trim().toLowerCase(); return options.filter((item)=>!term||`${item.label} ${item.search??''}`.toLowerCase().includes(term)); };

export function MultiSelectFilter({ label, options, selected, onChange, placeholder = 'Все' }: { label: string; options: MultiSelectOption[]; selected: string[]; onChange: (ids: string[]) => void; placeholder?: string }) {
  const [search,setSearch]=useState('');
  const visible=filterMultiSelectOptions(options,search);
  const summary=selected.length===0?placeholder:selected.length===1?options.find((item)=>item.id===selected[0])?.label??'Выбрано: 1':`Выбрано: ${selected.length}`;
  return <label className="multi-filter"><span>{label}</span><details onToggle={(event)=>{if(!event.currentTarget.open)setSearch('')}}><summary>{summary}</summary><div className="multi-filter-dropdown"><input type="search" value={search} placeholder={`Поиск: ${label.toLowerCase()}`} onChange={(event)=>setSearch(event.target.value)}/><div className="multi-filter-options">{visible.map((item)=><label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={()=>onChange(selected.includes(item.id)?selected.filter((id)=>id!==item.id):[...selected,item.id])}/><span>{item.label}</span></label>)}{!visible.length&&<small>Ничего не найдено</small>}</div>{selected.length>0&&<button type="button" onClick={()=>onChange([])}>Очистить выбор</button>}</div></details></label>;
}
