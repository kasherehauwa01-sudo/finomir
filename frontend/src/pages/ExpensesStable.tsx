import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ExpenseModal } from '../components/ExpenseModalStable';
import { buildExpenseIdsQuery, useExpenses } from '../hooks/useExpenses';
import type { Counterparty, Partner, Store, Tag } from '../types';
import { money } from '../utils/format';
import { NotificationStatus } from '../components/NotificationStatus';
import { MultiSelectFilter } from '../components/MultiSelectFilter';

// Реестр использует один набор состояний selectedIds/bulk* и локальные
// period/paymentStatus. Это предотвращает повторное смешение двух реализаций
// массовых действий при разрешении merge-конфликтов.

const columns = [
  ['period', 'Период'], ['partner', 'Партнер'], ['counterparty', 'Контрагент'],
  ['stores', 'Магазины'], ['tags', 'Тег'], ['service_name', 'Услуга'], ['invoice_total', 'Сумма счетов'],
  ['paid_total', 'Оплачено'], ['remaining_total', 'Остаток'], ['has_invoice_document', 'Счет'], ['has_closing_document', 'Акт'],
] as const;
type Column = typeof columns[number][0];
export const selectAllRowsLabel = (total: number) => `Выделить все строки (${total})`;

export function Expenses() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [period, setPeriod] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [partnerIds, setPartnerIds] = useState<string[]>([]);
  const [counterpartyIds, setCounterpartyIds] = useState<string[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');
  const [invoiceDateFrom, setInvoiceDateFrom] = useState('');
  const [invoiceDateTo, setInvoiceDateTo] = useState('');
  const [invoiceDocument, setInvoiceDocument] = useState('all');
  const [closingDocument, setClosingDocument] = useState('all');
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
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const filters = useMemo(() => ({
    search,
    period, payment_status: paymentStatus, partner_ids: partnerIds, counterparty_ids: counterpartyIds,
    store_ids: storeIds, tag_ids: tagIds, amount_from: amountFrom, amount_to: amountTo,
    invoice_date_from: invoiceDateFrom, invoice_date_to: invoiceDateTo,
    invoice_document: invoiceDocument, closing_document: closingDocument,
  }), [search, period, paymentStatus, partnerIds, counterpartyIds, storeIds, tagIds, amountFrom, amountTo, invoiceDateFrom, invoiceDateTo, invoiceDocument, closingDocument]);

  const { data, error, loading } = useExpenses(filters, page, revision);

  useEffect(() => {
    Promise.all([api<Partner[]>('/partners'), api<Counterparty[]>('/counterparties'), api<Tag[]>('/tags'), api<Store[]>('/stores')])
      .then(([partnerItems, counterpartyItems, tagItems, storeItems]) => { setPartners(partnerItems); setCounterparties(counterpartyItems); setTags(tagItems); setStores(storeItems); })
      .catch((reason: Error) => setBulkError(reason.message));
  }, []);

  const items = data?.items ?? [];
  const hasActiveFilters = Boolean(search || period || paymentStatus !== 'all' || partnerIds.length || counterpartyIds.length || storeIds.length || tagIds.length || amountFrom || amountTo || invoiceDateFrom || invoiceDateTo || invoiceDocument !== 'all' || closingDocument !== 'all');
  const visibleIds = items.map((item) => item.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const availableCounterparties = counterparties.filter((item) => !bulkPartnerId || item.partner_id === bulkPartnerId);

  function renderCell(item: NonNullable<typeof data>['items'][number], column: Column) {
    const value = item[column];
    if (column === 'stores' || column === 'tags') return <div className="store-list">{item[column].map((entry) => <span key={entry}>{entry}</span>)}</div>;
    if (column === 'has_invoice_document' && item.is_cash_payment) return <span className="cash-payment" role="img" aria-label="Оплата наличными">💰</span>;
    if (column === 'has_invoice_document' && value) return <NotificationStatus compact notification={item.notification} />;
    if (column === 'has_invoice_document' || column === 'has_closing_document') return <span className={value ? 'document-ok' : 'document-missing'} aria-label={value ? 'Документ загружен' : 'Документ отсутствует'}>{value ? '✓' : '×'}</span>;
    return ['invoice_total', 'paid_total', 'remaining_total'].includes(column) ? money(value as string) : value;
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleVisible() {
    setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])]);
  }
  const toggleFilter = (values: string[], id: string, update: (next: string[]) => void) => { update(values.includes(id) ? values.filter((item) => item !== id) : [...values, id]); setPage(1); setSelectedIds([]); };
  function resetFilters() { setPeriod(''); setPaymentStatus('all'); setPartnerIds([]); setCounterpartyIds([]); setStoreIds([]); setTagIds([]); setAmountFrom(''); setAmountTo(''); setInvoiceDateFrom(''); setInvoiceDateTo(''); setInvoiceDocument('all'); setClosingDocument('all'); setPage(1); }

  async function selectAllRows() {
    setSelectingAll(true); setBulkError('');
    try {
      const result = await api<{ ids: string[] }>(`/expenses/ids?${buildExpenseIdsQuery(filters)}`);
      setSelectedIds(result.ids ?? []);
    } catch (reason) {
      setBulkError(reason instanceof Error ? reason.message : 'Не удалось выделить все расходы');
    } finally { setSelectingAll(false); }
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    if (!ids.length || !window.confirm(`Удалить выбранные расходы (${ids.length})? Это действие нельзя отменить.`)) return;
    setDeleteBusy(true); setBulkError('');
    try {
      await api('/expenses/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
      setSelectedIds([]);
      if (items.length === ids.length && page > 1) setPage((value) => value - 1);
      else setRevision((value) => value + 1);
    } catch (reason) {
      setBulkError(reason instanceof Error ? reason.message : 'Не удалось удалить выбранные расходы');
    } finally { setDeleteBusy(false); }
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

  return <section className="expenses-page-wide">
    <div className="page-head"><div><h1>Расходы</h1><p>Единый реестр расходов отдела</p></div><button className="primary" onClick={() => setModal(true)}>+ Добавить расход</button></div>
    <div className="toolbar">
      <div className="expense-search"><input type="search" placeholder="Поиск по партнеру, ИНН, счету…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); setSelectedIds([]); }} />{search && <button type="button" aria-label="Очистить поиск" title="Очистить поиск" onClick={() => { setSearch(''); setPage(1); setSelectedIds([]); }}>×</button>}</div>
      <button className={filtersOpen ? 'active-button' : ''} onClick={() => { setFiltersOpen((value) => !value); setColumnsOpen(false); }}>Фильтры</button>
      <button className={columnsOpen ? 'active-button' : ''} onClick={() => { setColumnsOpen((value) => !value); setFiltersOpen(false); }}>Настроить колонки</button>
    </div>
    {selectedIds.length > 0 && <div className="bulk-bar"><b>Выбрано: {selectedIds.length}</b><button type="button" onClick={() => setSelectedIds([])}>Снять выбор</button>{allVisibleSelected && data && selectedIds.length < data.total && <button type="button" className="select-all-rows" disabled={selectingAll} onClick={() => void selectAllRows()}>{selectingAll ? 'Выделяем…' : selectAllRowsLabel(data.total)}</button>}<button type="button" className="primary" disabled={deleteBusy || selectingAll} onClick={() => setBulkOpen(true)}>Изменить выбранные</button><button type="button" className="bulk-delete" disabled={deleteBusy || selectingAll} onClick={() => void deleteSelected()}>{deleteBusy ? 'Удаляем…' : 'Удалить выбранные'}</button></div>}
    {bulkError && !bulkOpen && <div className="notice error" role="alert">{bulkError}</div>}
    {filtersOpen && <section className="toolbar-panel expense-filters"><div className="filter-grid"><label>Период<input type="text" inputMode="numeric" placeholder="ММ.ГГГГ" value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); }} /></label><label>Статус оплаты<select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }}><option value="all">Все</option><option value="paid">Оплачено</option><option value="unpaid">Есть остаток</option></select></label><label>Сумма от<input type="number" min="0" value={amountFrom} onChange={(event) => setAmountFrom(event.target.value)} /></label><label>Сумма до<input type="number" min="0" value={amountTo} onChange={(event) => setAmountTo(event.target.value)} /></label><label>Дата счета от<input type="date" value={invoiceDateFrom} onChange={(event) => setInvoiceDateFrom(event.target.value)} /></label><label>Дата счета до<input type="date" value={invoiceDateTo} onChange={(event) => setInvoiceDateTo(event.target.value)} /></label><label>Документ счета<select value={invoiceDocument} onChange={(event) => setInvoiceDocument(event.target.value)}><option value="all">Любой</option><option value="yes">Загружен</option><option value="no">Не загружен</option><option value="cash">Наличные</option></select></label><label>Закрывающий документ<select value={closingDocument} onChange={(event) => setClosingDocument(event.target.value)}><option value="all">Любой</option><option value="yes">Загружен</option><option value="no">Не загружен</option></select></label></div><div className="filter-grid entity-filter-grid"><MultiSelectFilter label="Партнер" options={partners.map((item)=>({id:item.id,label:item.name}))} selected={partnerIds} onChange={(ids)=>{setPartnerIds(ids);setCounterpartyIds((current)=>current.filter((id)=>counterparties.some((item)=>item.id===id&&(!ids.length||Boolean(item.partner_id&&ids.includes(item.partner_id))))));setPage(1);setSelectedIds([])}}/><MultiSelectFilter label="Контрагент" options={counterparties.filter((item)=>!partnerIds.length||Boolean(item.partner_id&&partnerIds.includes(item.partner_id))).map((item)=>({id:item.id,label:item.full_name,search:item.inn??''}))} selected={counterpartyIds} onChange={(ids)=>{setCounterpartyIds(ids);setPage(1);setSelectedIds([])}}/></div><div className="relation-field"><b>Магазины</b><div className="relation-options">{stores.map((item) => <button type="button" className={`relation-chip ${storeIds.includes(item.id)?'active':'inactive'}`} key={item.id} onClick={() => toggleFilter(storeIds,item.id,setStoreIds)}>{item.name}</button>)}</div></div><div className="relation-field"><b>Теги</b><div className="relation-options">{tags.map((item) => <button type="button" className={`relation-chip ${tagIds.includes(item.id)?'active':'inactive'}`} key={item.id} onClick={() => toggleFilter(tagIds,item.id,setTagIds)}>{item.name}</button>)}</div></div><button type="button" className="link" onClick={resetFilters}>Сбросить все фильтры</button></section>}
    {columnsOpen && <section className="toolbar-panel columns-panel">{columns.map(([key, label]) => <label key={key}><input type="checkbox" checked={visible.includes(key)} disabled={visible.length === 1 && visible.includes(key)} onChange={() => setVisible((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />{label}</label>)}</section>}
    {loading ? <div className="state">Загружаем расходы…</div> : error ? <div className="state error">Нет соединения с сервером. {error}</div> : !items.length ? <section className="empty"><h2>{hasActiveFilters ? 'Ничего не найдено' : 'Расходов пока нет'}</h2><p>{hasActiveFilters ? 'Измените запрос или сбросьте фильтры.' : 'Добавьте первый расход или загрузите счет.'}</p></section> : <div className="table-wrap"><table><thead><tr><th className="select-cell"><input type="checkbox" aria-label="Выбрать все расходы на странице" checked={allVisibleSelected} onChange={toggleVisible} /></th>{columns.filter(([key]) => visible.includes(key)).map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr className="clickable-row" tabIndex={0} key={item.id} onClick={() => navigate(`/expenses/${item.id}`)} onKeyDown={(event) => event.key === 'Enter' && navigate(`/expenses/${item.id}`)}><td className="select-cell" data-label="Выбрать" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Выбрать расход ${item.counterparty}`} checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} /></td>{columns.filter(([key]) => visible.includes(key)).map(([key, label]) => <td key={key} data-label={label}>{renderCell(item, key)}</td>)}</tr>)}</tbody></table></div>}
    {data && data.total > data.page_size && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Назад</button><span>Страница {page}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage((value) => value + 1)}>Далее</button></div>}
    {modal && <ExpenseModal close={() => setModal(false)} onSaved={() => setRevision((value) => value + 1)} />}
    {bulkOpen && <div className="overlay" role="dialog" aria-modal="true"><form className="modal bulk-editor" onSubmit={applyBulk}><button className="close" type="button" onClick={() => setBulkOpen(false)} aria-label="Закрыть">×</button><h2>Изменить {selectedIds.length} расходов</h2><p>Заполните только те поля, которые нужно изменить у всех выбранных строк.</p>{bulkError && <div className="notice error">{bulkError}</div>}<label>Партнер<select value={bulkPartnerId} onChange={(event) => { setBulkPartnerId(event.target.value); setBulkCounterpartyId(''); }}><option value="">Не изменять</option>{partners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Контрагент<select value={bulkCounterpartyId} onChange={(event) => setBulkCounterpartyId(event.target.value)}><option value="">Не изменять</option>{availableCounterparties.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label><fieldset><legend><label className="bulk-toggle"><input type="checkbox" checked={editTags} onChange={(event) => setEditTags(event.target.checked)} />Изменить теги</label></legend><div className={`store-tags ${editTags ? '' : 'disabled-tags'}`}>{tags.map((tag) => { const selected = bulkTagIds.includes(tag.id); return <button disabled={!editTags} type="button" aria-pressed={selected} className={`relation-chip ${selected ? 'active' : 'inactive'}`} key={tag.id} onClick={() => setBulkTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])}>{tag.name}</button>; })}</div><small>{editTags ? 'Выбранный набор полностью заменит текущие теги.' : 'Включите поле, чтобы изменить теги.'}</small></fieldset><div className="modal-actions"><button type="button" onClick={() => setBulkOpen(false)}>Отмена</button><button className="primary" disabled={bulkBusy}>{bulkBusy ? 'Сохраняем…' : 'Применить'}</button></div></form></div>}
  </section>;
}
