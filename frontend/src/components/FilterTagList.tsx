import { toggleSelectedId } from '../utils/filterSelection';

type FilterTag = { id: string; name: string };

type Props = {
  items: FilterTag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyText: string;
};

export function toggleFilterTag(selectedIds: string[], id: string) {
  return toggleSelectedId(selectedIds, id);
}

/** Отображает значения фильтра компактными плашками с множественным выбором. */
export function FilterTagList({ items, selectedIds, onChange, emptyText }: Props) {
  if (!items.length) return <small className="filter-tag-empty">{emptyText}</small>;

  return <div className="filter-tag-list">
    {items.map((item) => {
      const selected = selectedIds.includes(item.id);
      return <button
        type="button"
        key={item.id}
        aria-pressed={selected}
        className={`filter-tag ${selected ? 'selected' : ''}`}
        onClick={() => onChange(toggleFilterTag(selectedIds, item.id))}
      >
        {selected && <span aria-hidden="true">✓</span>}{item.name}
      </button>;
    })}
  </div>;
}
