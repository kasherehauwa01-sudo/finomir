import { useId, useMemo, useState } from 'react';

export type CheckboxFilterOption = { id: string; name: string; search?: string };

export function filterCheckboxOptions(options: CheckboxFilterOption[], search: string) {
  const term = search.trim().toLocaleLowerCase('ru');
  return options.filter((option) => !term || `${option.name} ${option.search ?? ''}`.toLocaleLowerCase('ru').includes(term));
}

export function SearchableCheckboxFilter({ label, options, values, onChange }: {
  label: string;
  options: CheckboxFilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const searchId = useId();
  const visibleOptions = useMemo(() => filterCheckboxOptions(options, search), [options, search]);

  function toggle(id: string) {
    onChange(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  }

  return <details className="checkbox-filter">
    <summary><span>{label}</span><small>{values.length ? `Выбрано: ${values.length}` : 'Все'}</small></summary>
    <div className="checkbox-filter__dropdown">
      <label className="checkbox-filter__search" htmlFor={searchId}>
        <span className="visually-hidden">Поиск: {label}</span>
        <input id={searchId} type="search" placeholder="Поиск…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className="checkbox-filter__options">
        {visibleOptions.map((option) => <label key={option.id}><input type="checkbox" checked={values.includes(option.id)} onChange={() => toggle(option.id)} /><span>{option.name}</span></label>)}
        {!visibleOptions.length && <small className="checkbox-filter__empty">Ничего не найдено</small>}
      </div>
      {values.length > 0 && <button type="button" className="link checkbox-filter__clear" onClick={() => onChange([])}>Очистить выбор</button>}
    </div>
  </details>;
}
