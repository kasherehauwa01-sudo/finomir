import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ExpenseModal } from '../components/ExpenseModal';
import { type ExpenseFilters, useExpenses } from '../hooks/useExpenses';
import type { Counterparty, Partner, Store, Tag } from '../types';
import { money } from '../utils/format';

const columns = [
  ['period', 'Период'], ['partner', 'Партнер'], ['counterparty', 'Контрагент'],
  ['stores', 'Магазины'], ['tags', 'Тег'], ['service_name', 'Услуга'], ['invoice_total', 'Сумма счетов'],
  ['paid_total', 'Оплачено'], ['remaining_total', 'Остаток'], ['has_invoice_document', 'Счет'], ['has_closing_document', 'Акт'],
] as const;
type Column = typeof columns[number][0];
type TagAction = 'add' | 'remove' | 'replace';

const emptyFilters: ExpenseFilters = {
  search: '', period: '', payment_status: 'all', partner_ids: [], counterparty_ids: [], store_ids: [], tag_ids: [],
  amount_from: '', amount_to: '', invoice_document: 'all', closing_document: 'all',
};
const actionLabels: Record<TagAction, string> = { add: 'Добавить теги', remove: 'Удалить теги', replace: 'Заменить теги' };

function CheckboxFilter({ label, values, options, onChange }: { label: string; values: string[]; options: { id: string; name: string }[]; onChange: (values: string[]) => void }) {
  return <details className="checkbox-filter"><summary>{label}{values.length ? `: ${values.length}` : ': Все'}</summary><div>{options.map((option) => <label key={option.id}><input type="checkbox" checked={values.includes(option.id)} onChange={() => onChange(values.includes(option.id) ? values.filter((id) => id !== option.id) : [...values, option.id])} />{option.name}</label>)}{!options.length && <small>Нет значений</small>}</div></details>;
}

export function Expenses() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ExpenseFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visible, setVisible] = useState<Column[]>(columns.map(([key]) => key));
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [tagModal, setTagModal] = useState(false);
  const [tagAction, setTagAction] = useState<TagAction>('add');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [applyingTags, setApplyingTags] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const { data, error, loading } = useExpenses(filters, page, revision);
  const items = useMemo(() => data?.items ?? [], [data]);
  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const selectedVisible = visibleIds.filter((id) => selected.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible === visibleIds.length;
  const availableCounterparties = filters.partner_ids.length ? counterparties.filter((item) => item.partner_id && filters.partner_ids.includes(item.partner_id)) : counterparties;

  useEffect(() => {
    Promise.all([api<Partner[]>('/partners'), api<Counterparty[]>('/counterparties'), api<Store[]>('/stores'), api<Tag[]>('/tags')])
      .then(([partnerItems, counterpartyItems, storeItems, tagItems]) => {
        setPartners(partnerItems ?? []); setCounterparties(counterpartyItems ?? []); setStores(storeItems ?? []); setTags(tagItems ?? []);
      }).catch((reason: Error) => setActionError(`Не удалось загрузить справочники. ${reason.message}`));
  }, []);
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = selectedVisible > 0 && !allVisibleSelected; }, [selectedVisible, allVisibleSelected]);
  useEffect(() => { const available = new Set(visibleIds); setSelected((current) => new Set([...current].filter((id) => available.has(id)))); }, [visibleIds]);

  function updateFilter<K extends keyof ExpenseFilters>(key: K, value: ExpenseFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1); setNotice('');
  }
  function updatePartners(partnerIds: string[]) {
    setFilters((current) => ({ ...current, partner_ids: partnerIds, counterparty_ids: current.counterparty_ids.filter((id) => counterparties.some((item) => item.id === id && (!partnerIds.length || Boolean(item.partner_id && partnerIds.includes(item.partner_id))))) }));
    setPage(1); setNotice('');
  }
  function resetFilters() { setFilters(emptyFilters); setPage(1); }
  function toggleAll() {
    setSelected((current) => { const next = new Set(current); visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id)); return next; });
  }
  async function deleteSelected() {
    const ids = [...selected];
    if (!ids.length || !window.confirm(`Удалить выбранные расходы (${ids.length})? Это действие нельзя отменить.`)) return;
    setDeleting(true); setActionError('');
    try {
      await api('/expenses/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
      setSelected(new Set()); setNotice(`Удалено расходов: ${ids.length}`);
      if (items.length === ids.length && page > 1) setPage((value) => value - 1); else setRevision((value) => value + 1);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Не удалось удалить расходы'); }
    finally { setDeleting(false); }
  }
  async function applyTags() {
    if (!selectedTags.size) return;
    setApplyingTags(true); setActionError('');
    try {
      await api('/expenses/bulk-tags', { method: 'POST', body: JSON.stringify({ expense_ids: [...selected], tag_ids: [...selectedTags], action: tagAction }) });
      const count = selected.size; setTagModal(false); setSelected(new Set()); setSelectedTags(new Set()); setRevision((value) => value + 1);
      setNotice(`Теги успешно изменены у расходов: ${count}`);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Не удалось изменить теги'); }
    finally { setApplyingTags(false); }
  }
  function renderCell(item: NonNullable<typeof data>['items'][number], column: Column) {
    const value = item[column];
    if (column === 'stores') return <div className="store-list">{(item.stores ?? []).map((store) => <span key={store.name}>{store.name} — {money(store.amount)}</span>)}</div>;
    if (column === 'tags') return <div className="store-list">{(item.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}</div>;
    if (column === 'has_invoice_document' || column === 'has_closing_document') return <span className={value ? 'document-ok' : 'document-missing'}>{value ? '✓' : '×'}</span>;
    return ['invoice_total', 'paid_total', 'remaining_total'].includes(column) ? money(value as string) : typeof value === 'string' ? value : '';
  }

  return <>
    <div className="page-head"><div><h1>Расходы</h1><p>Единый реестр расходов отдела</p></div><button className="primary" onClick={() => setModal(true)}>+ Добавить расход</button></div>
    <div className="toolbar">
      <input type="search" placeholder="Поиск по партнеру, ИНН, счету…" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} />
      <button className={filtersOpen ? 'active-button' : ''} onClick={() => { setFiltersOpen((value) => !value); setColumnsOpen(false); }}>Фильтры</button>
      <button className={columnsOpen ? 'active-button' : ''} onClick={() => { setColumnsOpen((value) => !value); setFiltersOpen(false); }}>Настроить колонки</button>
    </div>
    {filtersOpen && <section className="toolbar-panel expense-filters">
      <label>Период<input type="text" inputMode="numeric" placeholder="ММ.ГГГГ" value={filters.period} onChange={(event) => updateFilter('period', event.target.value)} /></label>
      <label>Статус оплаты<select value={filters.payment_status} onChange={(event) => updateFilter('payment_status', event.target.value)}><option value="all">Все</option><option value="paid">Оплачено</option><option value="unpaid">Есть остаток</option></select></label>
      <CheckboxFilter label="Партнер" values={filters.partner_ids} options={partners} onChange={updatePartners} />
      <CheckboxFilter label="Контрагент" values={filters.counterparty_ids} options={availableCounterparties.map((item) => ({ id: item.id, name: item.full_name }))} onChange={(values) => updateFilter('counterparty_ids', values)} />
      <CheckboxFilter label="Магазин" values={filters.store_ids} options={stores} onChange={(values) => updateFilter('store_ids', values)} />
      <CheckboxFilter label="Тег" values={filters.tag_ids} options={tags} onChange={(values) => updateFilter('tag_ids', values)} />
      <label>Сумма счетов от<input type="number" min="0" step="0.01" value={filters.amount_from} onChange={(event) => updateFilter('amount_from', event.target.value)} /></label>
      <label>Сумма счетов до<input type="number" min="0" step="0.01" value={filters.amount_to} onChange={(event) => updateFilter('amount_to', event.target.value)} /></label>
      <label>Счет<select value={filters.invoice_document} onChange={(event) => updateFilter('invoice_document', event.target.value)}><option value="all">Все</option><option value="yes">Есть</option><option value="no">Нет</option></select></label>
      <label>Акт<select value={filters.closing_document} onChange={(event) => updateFilter('closing_document', event.target.value)}><option value="all">Все</option><option value="yes">Есть</option><option value="no">Нет</option></select></label>
      <button type="button" className="link reset-filters" onClick={resetFilters}>Сбросить фильтры</button>
    </section>}
    {columnsOpen && <section className="toolbar-panel columns-panel">{columns.map(([key, label]) => <label key={key}><input type="checkbox" checked={visible.includes(key)} disabled={visible.length === 1 && visible.includes(key)} onChange={() => setVisible((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />{label}</label>)}</section>}
    {actionError && <p className="selection-error error" role="alert">{actionError}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    {selected.size > 0 && <div className="selection-bar"><span>Выбрано: {selected.size}</span><button type="button" onClick={() => setTagModal(true)}>Изменить теги</button><button type="button" className="danger" disabled={deleting} onClick={() => void deleteSelected()}>{deleting ? 'Удаление…' : 'Удалить выбранные'}</button></div>}
    {loading ? <div className="state">Загружаем расходы…</div> : error ? <div className="state error">Не удалось загрузить расходы. {error}</div> : !items.length ? <section className="empty"><h2>Ничего не найдено</h2><p>Измените запрос или сбросьте фильтры.</p></section> : <div className="table-wrap"><table><thead><tr><th className="selection-cell"><input ref={selectAllRef} type="checkbox" aria-label="Выбрать все расходы на странице" checked={allVisibleSelected} onChange={toggleAll} /></th>{columns.filter(([key]) => visible.includes(key)).map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr className={`clickable-row${selected.has(item.id) ? ' selected-row' : ''}`} tabIndex={0} key={item.id} onClick={() => navigate(`/expenses/${item.id}`)} onKeyDown={(event) => event.key === 'Enter' && navigate(`/expenses/${item.id}`)}><td className="selection-cell" data-label="Выбрать" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Выбрать расход: ${item.service_name}`} checked={selected.has(item.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })} /></td>{columns.filter(([key]) => visible.includes(key)).map(([key, label]) => <td key={key} data-label={label}>{renderCell(item, key)}</td>)}</tr>)}</tbody></table></div>}
    {data && data.total > data.page_size && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Назад</button><span>Страница {page} из {Math.ceil(data.total / data.page_size)}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage((value) => value + 1)}>Далее</button></div>}
    {modal && <ExpenseModal close={() => setModal(false)} onSaved={() => setRevision((value) => value + 1)} />}
    {tagModal && <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="bulk-tags-title"><section className="modal bulk-tags-modal"><button className="close" type="button" onClick={() => setTagModal(false)} aria-label="Закрыть">×</button><h2 id="bulk-tags-title">Изменить теги</h2><p>Выбрано расходов: <b>{selected.size}</b></p><div className="bulk-tag-actions">{(Object.keys(actionLabels) as TagAction[]).map((action) => <button type="button" className={tagAction === action ? 'active-button' : ''} key={action} onClick={() => setTagAction(action)}>{actionLabels[action]}</button>)}</div><fieldset><legend>Теги</legend><div className="tag-selector">{tags.map((tag) => <label key={tag.id}><input type="checkbox" checked={selectedTags.has(tag.id)} onChange={() => setSelectedTags((current) => { const next = new Set(current); next.has(tag.id) ? next.delete(tag.id) : next.add(tag.id); return next; })} />{tag.name}</label>)}</div>{!tags.length && <p>В справочнике нет тегов.</p>}</fieldset><div className="bulk-tags-summary"><span>Операция: <b>{actionLabels[tagAction]}</b></span><span>Выбранные теги: <b>{tags.filter((tag) => selectedTags.has(tag.id)).map((tag) => tag.name).join(', ') || 'не выбраны'}</b></span></div><div className="modal-actions"><button type="button" onClick={() => setTagModal(false)}>Отмена</button><button className="primary" type="button" disabled={!selectedTags.size || applyingTags} onClick={() => void applyTags()}>{applyingTags ? 'Применяем…' : 'Применить'}</button></div></section></div>}
  </>;
}
