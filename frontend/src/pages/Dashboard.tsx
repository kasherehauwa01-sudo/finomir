import { useEffect, useState } from 'react';
import { ExpenseModal } from '../components/ExpenseModal';
import { api } from '../api/client';
import type { Counterparty, DashboardSummary, Partner, Store, Tag } from '../types';
import { money } from '../utils/format';

type Period = DashboardSummary['period'];
const labels: Record<Period, string> = { month: 'Месяц', quarter: 'Квартал', year: 'Год', custom: 'Произвольный' };
const emptySelectionId = '00000000-0000-0000-0000-000000000000';
export const toggleTagGroup = (selected:string[],options:{id:string}[]) => options.length > 0 && options.every(item=>selected.includes(item.id)) ? [] : options.map(item=>item.id);
export const tagGroupQueryIds = (selected:string[],options:{id:string}[]) => options.length > 0 && selected.length === 0 ? [emptySelectionId] : selected;

function MultiFilter({ label, selected, options, update }: { label: string; selected: string[]; options: { id: string; name: string }[]; update: (ids: string[]) => void }) {
  return <details className="checkbox-filter"><summary>{label}: {selected.length ? selected.length : 'Все'}</summary><div>{options.map((item) => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => update(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])} />{item.name}</label>)}</div></details>;
}

function TagFilter({ label, selected, options, update }: { label: string; selected: string[]; options: { id: string; name: string }[]; update: (ids: string[]) => void }) {
  const allSelected=options.length>0&&options.every(item=>selected.includes(item.id));
  return <section><div className="tag-filter-title"><b>{label}</b><button type="button" className="tag-toggle-all" onClick={()=>update(toggleTagGroup(selected,options))}>{allSelected?'Снять все':'Выделить все'}</button></div><div>{options.map((item)=><button type="button" key={item.id} className={selected.includes(item.id)?'active':''} onClick={()=>update(selected.includes(item.id)?selected.filter((id)=>id!==item.id):[...selected,item.id])}>{item.name}</button>)}</div></section>;
}

export function Dashboard() {
  const [modal, setModal] = useState(false); const [period, setPeriod] = useState<Period>('month');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 7)); const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<DashboardSummary>(); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  const [tags, setTags] = useState<Tag[]>([]); const [stores, setStores] = useState<Store[]>([]); const [partners, setPartners] = useState<Partner[]>([]); const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]); const [storeIds, setStoreIds] = useState<string[]>([]); const [partnerIds, setPartnerIds] = useState<string[]>([]); const [counterpartyIds, setCounterpartyIds] = useState<string[]>([]);
  const [paymentStatus, setPaymentStatus] = useState('all'); const [amountFrom, setAmountFrom] = useState(''); const [amountTo, setAmountTo] = useState(''); const [invoiceDocument, setInvoiceDocument] = useState('all'); const [closingDocument, setClosingDocument] = useState('all');
  const availableCounterparties = partnerIds.length ? counterparties.filter((item) => item.partner_id && partnerIds.includes(item.partner_id)) : counterparties;

  useEffect(() => {
    Promise.all([api<Tag[]>('/tags'), api<Store[]>('/stores'), api<Partner[]>('/partners'), api<Counterparty[]>('/counterparties')])
      .then(([tagItems, storeItems, partnerItems, counterpartyItems]) => { const safeTags=tagItems??[]; const safeStores=storeItems??[]; setTags(safeTags); setTagIds(safeTags.map((item)=>item.id)); setStores(safeStores); setStoreIds(safeStores.map((item)=>item.id)); setPartners(partnerItems??[]); setCounterparties(counterpartyItems??[]); })
      .catch((reason: Error) => setError(reason.message));
  }, []);
  useEffect(() => {
    const query = new URLSearchParams({ period });
    if (period === 'custom') { query.set('date_from', dateFrom); query.set('date_to', dateTo); }
    tagGroupQueryIds(tagIds,tags).forEach((id) => query.append('tag_ids', id)); tagGroupQueryIds(storeIds,stores).forEach((id) => query.append('store_ids', id)); partnerIds.forEach((id) => query.append('partner_ids', id)); counterpartyIds.forEach((id) => query.append('counterparty_ids', id));
    if (paymentStatus !== 'all') query.set('payment_status', paymentStatus); if (amountFrom) query.set('amount_from', amountFrom); if (amountTo) query.set('amount_to', amountTo); if (invoiceDocument !== 'all') query.set('invoice_document', invoiceDocument); if (closingDocument !== 'all') query.set('closing_document', closingDocument);
    setError(''); setSummary(undefined); api<DashboardSummary>(`/dashboard?${query}`).then(setSummary).catch((reason: Error) => setError(reason.message));
  }, [period,dateFrom,dateTo,revision,tagIds,storeIds,partnerIds,counterpartyIds,paymentStatus,amountFrom,amountTo,invoiceDocument,closingDocument]);
  function updatePartners(ids:string[]){ setPartnerIds(ids); setCounterpartyIds((current)=>current.filter((id)=>counterparties.some((item)=>item.id===id&&(!ids.length||Boolean(item.partner_id&&ids.includes(item.partner_id)))))); }
  function reset(){ setTagIds(tags.map((item)=>item.id)); setStoreIds(stores.map((item)=>item.id)); setPartnerIds([]); setCounterpartyIds([]); setPaymentStatus('all'); setAmountFrom(''); setAmountTo(''); setInvoiceDocument('all'); setClosingDocument('all'); }
  const maxTagAmount=Math.max(...(summary?.tag_totals.map((item)=>Number(item.amount))??[]),0);

  return <>
    <div className="page-head"><div><p className="eyebrow">{labels[period]}</p><h1>Дашборд</h1><p>Финансовая картина маркетингового отдела</p></div><button className="primary" onClick={()=>setModal(true)}>+ Добавить расход</button></div>
    <div className="period">{(['month','quarter','year'] as Period[]).map((key)=><button key={key} className={period===key?'active':''} onClick={()=>setPeriod(key)}>{labels[key]}</button>)}<button className={period==='custom'?'active':''} onClick={()=>setPeriod('custom')}>Произвольный</button></div>
    {period==='custom'&&<div className="custom-period"><label>С<input type="month" value={dateFrom} onChange={(event)=>setDateFrom(event.target.value)}/></label><label>По<input type="month" value={dateTo} onChange={(event)=>setDateTo(event.target.value)}/></label></div>}
    <div className="dashboard-tag-filters"><TagFilter label="Магазины" selected={storeIds} options={stores} update={setStoreIds}/><TagFilter label="Теги" selected={tagIds} options={tags} update={setTagIds}/></div>
    <details className="dashboard-filters"><summary><b>Фильтры</b><span>Нажмите, чтобы развернуть</span></summary><div className="dashboard-filter-grid">
      <MultiFilter label="Партнеры" selected={partnerIds} options={partners} update={updatePartners}/><MultiFilter label="Контрагенты" selected={counterpartyIds} options={availableCounterparties.map((item)=>({id:item.id,name:item.full_name}))} update={setCounterpartyIds}/>
      <label>Статус оплаты<select value={paymentStatus} onChange={(event)=>setPaymentStatus(event.target.value)}><option value="all">Все</option><option value="paid">Оплачено</option><option value="unpaid">Есть остаток</option></select></label><label>Сумма от<input type="number" min="0" value={amountFrom} onChange={(event)=>setAmountFrom(event.target.value)}/></label><label>Сумма до<input type="number" min="0" value={amountTo} onChange={(event)=>setAmountTo(event.target.value)}/></label><label>Счет<select value={invoiceDocument} onChange={(event)=>setInvoiceDocument(event.target.value)}><option value="all">Все</option><option value="yes">Есть</option><option value="no">Нет</option><option value="cash">Наличные</option></select></label><label>Акт<select value={closingDocument} onChange={(event)=>setClosingDocument(event.target.value)}><option value="all">Все</option><option value="yes">Есть</option><option value="no">Нет</option></select></label><button type="button" className="link" onClick={reset}>Сбросить фильтры</button>
    </div></details>
    {error?<div className="state error">Не удалось загрузить данные. {error}</div>:!summary?<div className="state">Загружаем данные…</div>:<><div className="kpis"><article><small>Сумма счетов</small><b>{money(summary.invoice_total)}</b></article><article><small>Оплачено</small><b>{money(summary.paid_total)}</b></article><article><small>Остаток</small><b>{money(summary.remaining_total)}</b></article><article><small>Расходов</small><b>{summary.expense_count}</b></article></div>{summary.tag_totals.length>0&&<section className="tag-chart"><div><h2>Расходы по тегам</h2><p>Сумма счетов за выбранный период и фильтры</p></div>{summary.tag_totals.map((item)=><article key={item.tag}><div className="tag-chart-label"><b>{item.tag}</b><span>{money(item.amount)} · {item.expense_count}</span></div><div className="tag-chart-track"><span style={{width:`${maxTagAmount?Math.max(4,Number(item.amount)/maxTagAmount*100):0}%`}}/></div></article>)}</section>}{summary.expense_count===0&&<section className="empty"><div>₽</div><h2>За выбранный период и фильтры расходов нет</h2><p>Измените период или фильтры.</p></section>}</>}
    {modal&&<ExpenseModal close={()=>setModal(false)} onSaved={()=>setRevision((value)=>value+1)}/>}</>;
}
