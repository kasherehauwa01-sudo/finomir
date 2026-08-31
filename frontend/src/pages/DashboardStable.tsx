import { useEffect, useState } from 'react';
import { ExpenseModal } from '../components/ExpenseModalStable';
import { api } from '../api/client';
import type { Counterparty, DashboardSummary, Partner, Store, Tag } from '../types';
import type { StorePreset } from '../types';
import { money } from '../utils/format';
import { StorePresetLinks } from '../components/StorePresetLinks';
import { FilterTagList } from '../components/FilterTagList';
import { compatibleCounterpartyIds } from '../utils/filterSelection';
import { SearchCheckboxFilter } from '../components/SearchCheckboxFilter';

type Period = DashboardSummary['period'];
const labels: Record<Period, string> = { month: 'Месяц', quarter: 'Квартал', year: 'Год' };

// Фильтры дашборда передаются API непосредственно как tag_ids/store_ids;
// удалённые helper-функции старой группировки здесь намеренно не используются.

export function Dashboard() {
  const [modal, setModal] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [summary, setSummary] = useState<DashboardSummary>();
  const [tags, setTags] = useState<Tag[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [presets, setPresets] = useState<StorePreset[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [partnerIds, setPartnerIds] = useState<string[]>([]);
  const [counterpartyIds, setCounterpartyIds] = useState<string[]>([]);
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    Promise.all([api<Tag[]>('/tags'), api<Store[]>('/stores'), api<StorePreset[]>('/store-presets'), api<Partner[]>('/partners'), api<Counterparty[]>('/counterparties')])
      .then(([tagItems, storeItems, presetItems, partnerItems, counterpartyItems]) => { setTags(tagItems); setStores(storeItems); setPresets(presetItems); setPartners(partnerItems); setCounterparties(counterpartyItems); })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    const query = new URLSearchParams({ period });
    tagIds.forEach((id) => query.append('tag_ids', id));
    storeIds.forEach((id) => query.append('store_ids', id));
    partnerIds.forEach((id) => query.append('partner_ids', id));
    counterpartyIds.forEach((id) => query.append('counterparty_ids', id));
    if (paymentStatus !== 'all') query.set('payment_status', paymentStatus);
    setError('');
    setSummary(undefined);
    api<DashboardSummary>(`/dashboard?${query.toString()}`)
      .then(setSummary)
      .catch((reason: Error) => setError(reason.message));
  }, [period, revision, tagIds, storeIds, partnerIds, counterpartyIds, paymentStatus]);

  function updatePartners(next: string[]) {
    setPartnerIds(next);
    setCounterpartyIds((current) => compatibleCounterpartyIds(current, next, counterparties));
  }

  const maxTagAmount = Math.max(...(summary?.tag_totals.map((item) => Number(item.amount)) ?? []), 0);
  const hasFilters = tagIds.length > 0 || storeIds.length > 0 || partnerIds.length > 0 || counterpartyIds.length > 0 || paymentStatus !== 'all';

  return <>
    <div className="page-head"><div><p className="eyebrow">{labels[period]}</p><h1>Дашборд</h1><p>Финансовая картина маркетингового отдела</p></div><button className="primary" onClick={() => setModal(true)}>+ Добавить расход</button></div>
    <div className="period">{(Object.keys(labels) as Period[]).map((key) => <button key={key} className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>{labels[key]}</button>)}</div>
    <section className="dashboard-filters">
      <div className="section-title"><div><h2>Фильтры</h2><p>Можно выбрать несколько значений</p></div>{hasFilters && <button type="button" className="link" onClick={() => { setTagIds([]); setStoreIds([]); setPartnerIds([]); setCounterpartyIds([]); setPaymentStatus('all'); }}>Сбросить</button>}</div>
      <div className="filter-grid dashboard-filter-grid"><label>Статус оплаты<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="all">Все расходы</option><option value="paid">Полностью оплачены</option><option value="unpaid">Есть остаток</option></select></label></div>
      <SearchCheckboxFilter label="Партнеры" options={partners.map((item) => ({ id: item.id, name: item.name }))} selectedIds={partnerIds} onChange={updatePartners} searchPlaceholder="Поиск партнера" emptyText="В справочнике пока нет партнеров." />
      <SearchCheckboxFilter label="Контрагенты" options={counterparties.filter((item) => !partnerIds.length || Boolean(item.partner_id&&partnerIds.includes(item.partner_id))).map((item) => ({ id: item.id, name: item.full_name, search: `${item.full_name} ${item.inn ?? ''}` }))} selectedIds={counterpartyIds} onChange={setCounterpartyIds} searchPlaceholder="Поиск по названию или ИНН" emptyText="Нет доступных контрагентов." />
      <div className="relation-field"><b>Теги</b><FilterTagList items={tags} selectedIds={tagIds} onChange={setTagIds} emptyText="В справочнике пока нет тегов." /></div>
      <div className="relation-field"><b>Магазины</b><StorePresetLinks presets={presets} onSelect={setStoreIds} /><FilterTagList items={stores} selectedIds={storeIds} onChange={setStoreIds} emptyText="В справочнике пока нет магазинов." /></div>
    </section>
    {error ? <div className="state error">Не удалось загрузить данные. {error}</div> : !summary ? <div className="state">Загружаем данные…</div> : <>
      <div className="kpis"><article><small>Сумма счетов</small><b>{money(summary.invoice_total)}</b></article><article><small>Оплачено</small><b>{money(summary.paid_total)}</b></article><article><small>Остаток</small><b>{money(summary.remaining_total)}</b></article><article><small>Расходов</small><b>{summary.expense_count}</b></article></div>
      {summary.tag_totals.length > 0 && <section className="tag-chart"><div><h2>Расходы по тегам</h2><p>Сумма счетов за выбранный период и фильтры</p></div>{summary.tag_totals.map((item) => <article key={item.tag}><div className="tag-chart-label"><b>{item.tag}</b><span>{money(item.amount)} · {item.expense_count}</span></div><div className="tag-chart-track"><span style={{ width: `${maxTagAmount ? Math.max(4, Number(item.amount) / maxTagAmount * 100) : 0}%` }} /></div></article>)}</section>}
      {summary.expense_count === 0 && <section className="empty"><div>₽</div><h2>За выбранный период и фильтры расходов нет</h2><p>Измените фильтры или добавьте новый расход.</p></section>}
    </>}
    {modal && <ExpenseModal close={() => setModal(false)} onSaved={() => setRevision((value) => value + 1)} />}
  </>;
}
