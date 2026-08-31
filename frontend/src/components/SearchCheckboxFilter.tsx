import { useState } from 'react';
import { toggleSelectedId } from '../utils/filterSelection';

export type SearchCheckboxOption = { id: string; name: string; search?: string };

export function filterCheckboxOptions(options: SearchCheckboxOption[], search: string) {
  const term = search.trim().toLowerCase();
  return options.filter((option) => !term || (option.search ?? option.name).toLowerCase().includes(term));
}

type Props = {
  label: string;
  options: SearchCheckboxOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  searchPlaceholder: string;
  emptyText: string;
};

/** Раскрывающийся множественный фильтр с поиском и чекбоксами. */
export function SearchCheckboxFilter({ label, options, selectedIds, onChange, searchPlaceholder, emptyText }: Props) {
  const [search, setSearch] = useState('');
  const visibleOptions = filterCheckboxOptions(options, search);

  return <div className="relation-field checkbox-dropdown-field">
    <b>{label}</b>
    <details className="checkbox-dropdown" onToggle={(event) => { if (!event.currentTarget.open) setSearch(''); }}>
      <summary>{selectedIds.length ? `Выбрано: ${selectedIds.length}` : 'Все'}</summary>
      <div className="checkbox-dropdown-panel">
        <input type="search" aria-label={`Поиск: ${label.toLowerCase()}`} placeholder={searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="checkbox-dropdown-options">
          {visibleOptions.map((option) => <label key={option.id}>
            <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => onChange(toggleSelectedId(selectedIds, option.id))} />
            <span>{option.name}</span>
          </label>)}
          {!visibleOptions.length && <small>{options.length ? 'Ничего не найдено.' : emptyText}</small>}
        </div>
      </div>
    </details>
  </div>;
}
