import { useEffect, useMemo, useRef, useState } from 'react';
import { ExpenseModal } from '../components/ExpenseModal';
import { useExpenses } from '../hooks/useExpenses';
import { money } from '../utils/format';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const columns = [
  ['period', 'Период'], ['partner', 'Партнер'], ['counterparty', 'Контрагент'],
  ['stores', 'Магазины'], ['tags', 'Тег'], ['service_name', 'Услуга'], ['invoice_total', 'Сумма счетов'],
  ['paid_total', 'Оплачено'], ['remaining_total', 'Остаток'], ['has_invoice_document', 'Счет'], ['has_closing_document', 'Акт'],
] as const;
type Column = typeof columns[number][0];

export function Expenses() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [period, setPeriod] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [visible, setVisible] = useState<Column[]>(columns.map(([key]) => key));
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);
  const { data, error, loading } = useExpenses(search, page, revision);
  const items = useMemo(() => (data?.items ?? []).filter((item) => {
    const periodMatches = !period || item.period === period;
    const remaining = Number(item.remaining_total);
    const statusMatches = paymentStatus === 'all'
      || (paymentStatus === 'paid' && remaining === 0)
      || (paymentStatus === 'unpaid' && remaining > 0);
    return periodMatches && statusMatches;
  }), [data, period, paymentStatus]);
  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const selectedVisible = visibleIds.filter((id) => selected.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible === visibleIds.length;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedVisible > 0 && !allVisibleSelected;
  }, [selectedVisible, allVisibleSelected]);

  useEffect(() => {
    const available = new Set(visibleIds);
    setSelected((current) => new Set([...current].filter((id) => available.has(id))));
  }, [visibleIds]);

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (!ids.length || !window.confirm(`Удалить выбранные расходы (${ids.length})? Это действие нельзя отменить.`)) return;
    setDeleting(true); setDeleteError('');
    try {
      await api<{ deleted: number }>('/expenses/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
      setSelected(new Set());
      if (items.length === ids.length && page > 1) setPage((value) => value - 1);
      else setRevision((value) => value + 1);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Не удалось удалить расходы');
    } finally {
      setDeleting(false);
    }
  }

  function renderCell(item: NonNullable<typeof data>['items'][number], column: Column) {
    const value = item[column];
    if (column === 'stores') return <div className="store-list">{item.stores.map((store) => <span key={store.name}>{store.name} — {money(store.amount)}</span>)}</div>;
    if (column === 'tags') return <div className="store-list">{item.tags.map((value) => <span key={value}>{value}</span>)}</div>;
    if (column === 'has_invoice_document' || column === 'has_closing_document') return <span className={value ? 'document-ok' : 'document-missing'} aria-label={value ? 'Документ загружен' : 'Документ отсутствует'}>{value ? '✓' : '×'}</span>;
    return ['invoice_total', 'paid_total', 'remaining_total'].includes(column) ? money(value as string) : typeof value === 'string' ? value : '';
  }

  return <>
    <div className="page-head"><div><h1>Расходы</h1><p>Единый реестр расходов отдела</p></div><button className="primary" onClick={() => setModal(true)}>+ Добавить расход</button></div>
    <div className="toolbar">
      <input placeholder="Поиск по партнеру, ИНН, счету…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      <button className={filtersOpen ? 'active-button' : ''} onClick={() => { setFiltersOpen((value) => !value); setColumnsOpen(false); }}>Фильтры</button>
      <button className={columnsOpen ? 'active-button' : ''} onClick={() => { setColumnsOpen((value) => !value); setFiltersOpen(false); }}>Настроить колонки</button>
    </div>
    {filtersOpen && <section className="toolbar-panel">
      <label>Период<input type="text" inputMode="numeric" placeholder="ММ.ГГГГ" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
      <label>Статус оплаты<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="all">Все</option><option value="paid">Оплачено</option><option value="unpaid">Есть остаток</option></select></label>
      <button type="button" className="link" onClick={() => { setPeriod(''); setPaymentStatus('all'); }}>Сбросить фильтры</button>
    </section>}
    {columnsOpen && <section className="toolbar-panel columns-panel">
      {columns.map(([key, label]) => <label key={key}><input type="checkbox" checked={visible.includes(key)} disabled={visible.length === 1 && visible.includes(key)} onChange={() => setVisible((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />{label}</label>)}
    </section>}
    {deleteError && <p className="selection-error error" role="alert">{deleteError}</p>}
    {!loading && !error && items.length > 0 && <div className="selection-bar">
      <label><input ref={selectAllRef} type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />Выбрать все на странице</label>
      <span>Выбрано: {selected.size}</span>
      <button type="button" className="danger" disabled={!selected.size || deleting} onClick={() => void deleteSelected()}>{deleting ? 'Удаление…' : 'Удалить выбранные'}</button>
    </div>}
    {loading ? <div className="state">Загружаем расходы…</div> : error ? <div className="state error">Не удалось загрузить расходы. {error}</div> : !items.length ? <section className="empty"><h2>{search || period || paymentStatus !== 'all' ? 'Ничего не найдено' : 'Расходов пока нет'}</h2><p>{search || period || paymentStatus !== 'all' ? 'Измените запрос или сбросьте фильтры.' : 'Добавьте первый расход или загрузите счет.'}</p></section> : <div className="table-wrap"><table><thead><tr><th className="selection-cell"><span className="visually-hidden">Выбрать</span></th>{columns.filter(([key]) => visible.includes(key)).map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr className={`clickable-row${selected.has(item.id) ? ' selected-row' : ''}`} tabIndex={0} key={item.id} onClick={() => navigate(`/expenses/${item.id}`)} onKeyDown={(event) => event.key === 'Enter' && navigate(`/expenses/${item.id}`)}><td className="selection-cell" data-label="Выбрать" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Выбрать расход: ${item.service_name}`} checked={selected.has(item.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} /></td>{columns.filter(([key]) => visible.includes(key)).map(([key, label]) => <td key={key} data-label={label}>{renderCell(item, key)}</td>)}</tr>)}</tbody></table></div>}
    {data && data.total > data.page_size && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Назад</button><span>Страница {page}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage((value) => value + 1)}>Далее</button></div>}
    {modal && <ExpenseModal close={() => setModal(false)} onSaved={() => setRevision((value) => value + 1)} />}
  </>;
}
