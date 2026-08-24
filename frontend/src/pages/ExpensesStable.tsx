import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ExpenseModal } from '../components/ExpenseModalStable';
import { useExpenses } from '../hooks/useExpenses';
import type { Counterparty, Partner, Tag } from '../types';
import { money } from '../utils/format';

// Реестр использует один набор состояний selectedIds/bulk* и локальные
// period/paymentStatus. Это предотвращает повторное смешение двух реализаций
// массовых действий при разрешении merge-конфликтов.

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPartnerId, setBulkPartnerId] = useState('');
  const [bulkCounterpartyId, setBulkCounterpartyId] = useState('');
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [editTags, setEditTags] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const filters = useMemo(() => ({
    search,
    period: '',
    payment_status: 'all',
    partner_ids: [],
    counterparty_ids: [],
    store_ids: [],
    tag_ids: [],
    amount_from: '',
    amount_to: '',
    invoice_date_from: '',
    invoice_date_to: '',
    invoice_document: 'all',
    closing_document: 'all',
  }), [search]);

  const { data, error, loading } = useExpenses(filters, page, revision);

  useEffect(() => {
    Promise.all([api<Partner[]>('/partners'), api<Counterparty[]>('/counterparties'), api<Tag[]>('/tags')])
      .then(([partnerItems, counterpartyItems, tagItems]) => { setPartners(partnerItems); setCounterparties(counterpartyItems); setTags(tagItems); })
      .catch((reason: Error) => setBulkError(reason.message));
  }, []);

  const items = useMemo(() => (data?.items ?? []).filter((item) => {
    const periodMatches = !period || item.period === period;
    const remaining = Number(item.remaining_total);
    const statusMatches = paymentStatus === 'all'
      || (paymentStatus === 'paid' && remaining === 0)
      || (paymentStatus === 'unpaid' && remaining > 0);
    return periodMatches && statusMatches;
  }), [data, period, paymentStatus]);
  const visibleIds = items.map((item) => item.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const availableCounterparties = counterparties.filter((item) => !bulkPartnerId || item.partner_id === bulkPartnerId);

  function renderCell(item: NonNullable<typeof data>['items'][number], column: Column) {
    const value = item[column];
    if (column === 'stores' || column === 'tags') return <div className="store-list">{item[column].map((entry) => <span key={entry}>{entry}</span>)}</div>;
    if (column === 'has_invoice_document' || column === 'has_closing_document') return <span className={value ? 'document-ok' : 'document-missing'} aria-label={value ? 'Документ загружен' : 'Документ отсутствует'}>{value ? '✓' : '×'}</span>;
    return ['invoice_total', 'paid_total', 'remaining_total'].includes(column) ? money(value as string) : value;
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleVisible() {
    setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])]);
  }

  async function applyBulk(event: FormEvent) {
    event.preventDefault();
    const payload: Record<string, unknown> = { expense_ids: selectedIds };
    if (bulkPartnerId) payload.partner_id = bulkPartnerId;
    if (bulkCounterpartyId) payload.counterparty_id = bulkCounterpartyId;
    if (editTags) payload.tag_ids = bulkTagIds;
    if (Object.keys(payload).length === 1) { setBulkError('Выберите поля, которые нужно изменить.'); return; }
    setBulkBusy(true); setBulkError('');
    try {
      await api('/expenses/bulk/update', { method: 'PUT', body: JSON.stringify(payload) });
      setBulkOpen(false); setSelectedIds([]); setBulkPartnerId(''); setBulkCounterpartyId(''); setBulkTagIds([]); setEditTags(false);
      setRevision((value) => value + 1);
    } catch (reason) {
      setBulkError(reason instanceof Error ? reason.message : 'Не удалось изменить расходы');
    } finally { setBulkBusy(false); }
  }

  return <>
    <div className="page-head"><div><h1>Расходы</h1><p>Единый реестр расходов отдела</p></div><button className="primary" onClick={() => setModal(true)}>+ Добавить расход</button></div>
    <div className="toolbar">
      <input placeholder="Поиск по партнеру, ИНН, счету…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      <button className={filtersOpen ? 'active-button' : ''} onClick={() => { setFiltersOpen((value) => !value); setColumnsOpen(false); }}>Фильтры</button>
      <button className={columnsOpen ? 'active-button' : ''} onClick={() => { setColumnsOpen((value) => !value); setFiltersOpen(false); }}>Настроить колонки</button>
    </div>
    {selectedIds.length > 0 && <div className="bulk-bar"><b>Выбрано: {selectedIds.length}</b><button type="button" onClick={() => setSelectedIds([])}>Снять выбор</button><button type="button" className="primary" onClick={() => setBulkOpen(true)}>Изменить выбранные</button></div>}
    {filtersOpen && <section className="toolbar-panel"><label>Период<input type="text" inputMode="numeric" placeholder="ММ.ГГГГ" value={period} onChange={(event) => setPeriod(event.target.value)} /></label><label>Статус оплаты<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="all">Все</option><option value="paid">Оплачено</option><option value="unpaid">Есть остаток</option></select></label><button type="button" className="link" onClick={() => { setPeriod(''); setPaymentStatus('all'); }}>Сбросить фильтры</button></section>}
    {columnsOpen && <section className="toolbar-panel columns-panel">{columns.map(([key, label]) => <label key={key}><input type="checkbox" checked={visible.includes(key)} disabled={visible.length === 1 && visible.includes(key)} onChange={() => setVisible((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />{label}</label>)}</section>}
    {loading ? <div className="state">Загружаем расходы…</div> : error ? <div className="state error">Нет соединения с сервером. {error}</div> : !items.length ? <section className="empty"><h2>{search || period || paymentStatus !== 'all' ? 'Ничего не найдено' : 'Расходов пока нет'}</h2><p>{search || period || paymentStatus !== 'all' ? 'Измените запрос или сбросьте фильтры.' : 'Добавьте первый расход или загрузите счет.'}</p></section> : <div className="table-wrap"><table><thead><tr><th className="select-cell"><input type="checkbox" aria-label="Выбрать все расходы на странице" checked={allVisibleSelected} onChange={toggleVisible} /></th>{columns.filter(([key]) => visible.includes(key)).map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr className="clickable-row" tabIndex={0} key={item.id} onClick={() => navigate(`/expenses/${item.id}`)} onKeyDown={(event) => event.key === 'Enter' && navigate(`/expenses/${item.id}`)}><td className="select-cell" data-label="Выбрать" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Выбрать расход ${item.counterparty}`} checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} /></td>{columns.filter(([key]) => visible.includes(key)).map(([key, label]) => <td key={key} data-label={label}>{renderCell(item, key)}</td>)}</tr>)}</tbody></table></div>}
    {data && data.total > data.page_size && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Назад</button><span>Страница {page}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage((value) => value + 1)}>Далее</button></div>}
    {modal && <ExpenseModal close={() => setModal(false)} onSaved={() => setRevision((value) => value + 1)} />}
    {bulkOpen && <div className="overlay" role="dialog" aria-modal="true"><form className="modal bulk-editor" onSubmit={applyBulk}><button className="close" type="button" onClick={() => setBulkOpen(false)} aria-label="Закрыть">×</button><h2>Изменить {selectedIds.length} расходов</h2><p>Заполните только те поля, которые нужно изменить у всех выбранных строк.</p>{bulkError && <div className="notice error">{bulkError}</div>}<label>Партнер<select value={bulkPartnerId} onChange={(event) => { setBulkPartnerId(event.target.value); setBulkCounterpartyId(''); }}><option value="">Не изменять</option>{partners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Контрагент<select value={bulkCounterpartyId} onChange={(event) => setBulkCounterpartyId(event.target.value)}><option value="">Не изменять</option>{availableCounterparties.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label><fieldset><legend><label className="bulk-toggle"><input type="checkbox" checked={editTags} onChange={(event) => setEditTags(event.target.checked)} />Изменить теги</label></legend><div className={`store-tags ${editTags ? '' : 'disabled-tags'}`}>{tags.map((tag) => { const selected = bulkTagIds.includes(tag.id); return <button disabled={!editTags} type="button" aria-pressed={selected} className={`relation-chip ${selected ? 'active' : 'inactive'}`} key={tag.id} onClick={() => setBulkTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])}>{tag.name}</button>; })}</div><small>{editTags ? 'Выбранный набор полностью заменит текущие теги.' : 'Включите поле, чтобы изменить теги.'}</small></fieldset><div className="modal-actions"><button type="button" onClick={() => setBulkOpen(false)}>Отмена</button><button className="primary" disabled={bulkBusy}>{bulkBusy ? 'Сохраняем…' : 'Применить'}</button></div></form></div>}
  </>;
}
