import { useEffect, useState } from 'react';
import { ExpenseModal } from '../components/ExpenseModalStable';
import { StorePresetLinks } from '../components/StorePresetLinks';
import { api } from '../api/client';
import type { Counterparty, DashboardSummary, Partner, Store, Tag } from '../types';
import type { StorePreset } from '../types';
import { money } from '../utils/format';
import { StorePresetLinks } from '../components/StorePresetLinks';
import { MultiSelectFilter } from '../components/MultiSelectFilter';

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

  function toggle(selected: string[], id: string, update: (value: string[]) => void) {
    update(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  const maxTagAmount = Math.max(...(summary?.tag_totals.map((item) => Number(item.amount)) ?? []), 0);
  const hasFilters = tagIds.length > 0 || storeIds.length > 0 || partnerIds.length > 0 || counterpartyIds.length > 0 || paymentStatus !== 'all';

  return <>
    <div className="page-head"><div><p className="eyebrow">{labels[period]}</p><h1>Дашборд</h1><p>Финансовая картина маркетингового отдела</p></div><button className="primary" onClick={() => setModal(true)}>+ Добавить расход</button></div>
    <div className="period">{(Object.keys(labels) as Period[]).map((key) => <button key={key} className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>{labels[key]}</button>)}</div>
    <section className="dashboard-filters">
      <div className="section-title"><div><h2>Фильтры</h2><p>Можно выбрать несколько значений</p></div>{hasFilters && <button type="button" className="link" onClick={() => { setTagIds([]); setStoreIds([]); setPartnerIds([]); setCounterpartyIds([]); setPaymentStatus('all'); }}>Сбросить</button>}</div>
      <div className="filter-grid dashboard-filter-grid"><label>Статус оплаты<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="all">Все расходы</option><option value="paid">Полностью оплачены</option><option value="unpaid">Есть остаток</option></select></label><MultiSelectFilter label="Партнер" options={partners.map((item)=>({id:item.id,label:item.name}))} selected={partnerIds} onChange={(ids)=>{setPartnerIds(ids);setCounterpartyIds((current)=>current.filter((id)=>counterparties.some((item)=>item.id===id&&(!ids.length||Boolean(item.partner_id&&ids.includes(item.partner_id))))))}}/><MultiSelectFilter label="Контрагент" options={counterparties.filter((item)=>!partnerIds.length||Boolean(item.partner_id&&partnerIds.includes(item.partner_id))).map((item)=>({id:item.id,label:item.full_name,search:item.inn??''}))} selected={counterpartyIds} onChange={setCounterpartyIds}/></div>
      <div className="relation-field"><b>Теги</b><div className="relation-options">{tags.map((tag) => { const active = tagIds.includes(tag.id); return <button type="button" aria-pressed={active} className={`relation-chip ${active ? 'active' : 'inactive'}`} key={tag.id} onClick={() => toggle(tagIds, tag.id, setTagIds)}>{tag.name}</button>; })}</div></div>
      <div className="relation-field"><b>Магазины</b><StorePresetLinks presets={presets} onSelect={setStoreIds} /><div className="relation-options">{stores.map((store) => { const active = storeIds.includes(store.id); return <button type="button" aria-pressed={active} className={`relation-chip ${active ? 'active' : 'inactive'}`} key={store.id} onClick={() => toggle(storeIds, store.id, setStoreIds)}>{store.name}</button>; })}</div></div>
    </section>
    {error ? <div className="state error">Не удалось загрузить данные. {error}</div> : !summary ? <div className="state">Загружаем данные…</div> : <>
      <div className="kpis"><article><small>Сумма счетов</small><b>{money(summary.invoice_total)}</b></article><article><small>Оплачено</small><b>{money(summary.paid_total)}</b></article><article><small>Остаток</small><b>{money(summary.remaining_total)}</b></article><article><small>Расходов</small><b>{summary.expense_count}</b></article></div>
      <section className="dashboard-insights"><article><small>Доля оплаты</small><b>{Number(summary.invoice_total)>0?`${Math.min(100,Math.round(Number(summary.paid_total)/Number(summary.invoice_total)*100))}%`:'0%'}</b><div className="payment-progress"><span style={{width:`${Number(summary.invoice_total)>0?Math.min(100,Number(summary.paid_total)/Number(summary.invoice_total)*100):0}%`}}/></div></article><article><small>Средний расход</small><b>{money(String(summary.expense_count?Number(summary.invoice_total)/summary.expense_count:0))}</b><p>Средняя сумма счетов на один расход</p></article><article><small>Активные фильтры</small><b>{tagIds.length+storeIds.length+partnerIds.length+counterpartyIds.length+(paymentStatus==='all'?0:1)}</b><p>{hasFilters?'Показатели пересчитаны по выборке':'Показан весь выбранный период'}</p></article></section>
      {summary.tag_totals.length > 0 && <section className="tag-chart"><div><h2>Расходы по тегам</h2><p>Сумма счетов за выбранный период и фильтры</p></div>{summary.tag_totals.map((item) => <article key={item.tag}><div className="tag-chart-label"><b>{item.tag}</b><span>{money(item.amount)} · {item.expense_count}</span></div><div className="tag-chart-track"><span style={{ width: `${maxTagAmount ? Math.max(4, Number(item.amount) / maxTagAmount * 100) : 0}%` }} /></div></article>)}</section>}
      {summary.expense_count === 0 && <section className="empty"><div>₽</div><h2>За выбранный период и фильтры расходов нет</h2><p>Измените фильтры или добавьте новый расход.</p></section>}
    </>}
    {modal && <ExpenseModal close={() => setModal(false)} onSaved={() => setRevision((value) => value + 1)} />}
  </>;
}
