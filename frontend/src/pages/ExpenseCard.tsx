import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, base } from '../api/client';
import type { Counterparty, ExpenseDetail, Partner, Store, Tag } from '../types';
import { money } from '../utils/format';

type DocumentItem = ExpenseDetail['documents'][number];

export function ExpenseCard() {
  const { expenseId = '' } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState<ExpenseDetail>();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<DocumentItem>();
  const [message, setMessage] = useState('');

  const load = () => api<ExpenseDetail>(`/expenses/${expenseId}`).then(setExpense).catch((error: Error) => setMessage(error.message));
  useEffect(() => {
    load();
    Promise.all([api<Partner[]>('/partners'), api<Counterparty[]>('/counterparties'), api<Store[]>('/stores'), api<Tag[]>('/tags')])
      .then(([partnerItems, counterpartyItems, storeItems, tagItems]) => { setPartners(partnerItems); setCounterparties(counterpartyItems); setStores(storeItems); setTags(tagItems); });
  }, [expenseId]);

  if (!expense) return <div className="state">{message || 'Загружаем карточку…'}</div>;
  const current = expense;
  const update = (field: keyof ExpenseDetail, value: unknown) => setExpense({ ...current, [field]: value });
  const contentUrl = (id: string) => `${base}/api/documents/${id}/content`;

  async function save(event?: FormEvent) {
    event?.preventDefault();
    await api(`/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify({ partner_id: current.partner_id, counterparty_id: current.counterparty_id, service_name: current.service_name, expense_month: current.expense_month, expense_year: current.expense_year, contract_number: current.contract_number || null, contract_date: current.contract_date || null, comment: current.comment || null, allocations: current.allocations.map((item) => ({ store_id: item.store_id, amount: item.amount || 0 })), tag_ids: current.tags.map((item) => item.id) }) });
    setEditing(false); setMessage('Изменения сохранены.'); load();
  }
  async function remove() { if (window.confirm('Удалить расход?')) { await api(`/expenses/${expenseId}`, { method: 'DELETE' }); navigate('/expenses'); } }
  async function addPayment(invoiceId: string) { const amount = window.prompt('Сумма платежа'); if (!amount) return; const payment_date = window.prompt('Дата платежа (ГГГГ-ММ-ДД)', new Date().toISOString().slice(0, 10)); if (!payment_date) return; await api(`/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify({ amount, payment_date }) }); load(); }
  async function editInvoice(invoice: ExpenseDetail['invoices'][number]) { const invoice_number = window.prompt('Номер счета', invoice.invoice_number); if (!invoice_number) return; const invoice_date = window.prompt('Дата счета', invoice.invoice_date); const amount = window.prompt('Сумма счета', invoice.amount); if (!invoice_date || !amount) return; await api(`/invoices/${invoice.id}`, { method: 'PUT', body: JSON.stringify({ invoice_number, invoice_date, amount }) }); load(); }
  async function editPayment(payment: ExpenseDetail['invoices'][number]['payments'][number]) { const payment_date = window.prompt('Дата платежа', payment.payment_date); const amount = window.prompt('Сумма платежа', payment.amount); if (!payment_date || !amount) return; await api(`/payments/${payment.id}`, { method: 'PUT', body: JSON.stringify({ payment_date, amount, comment: payment.comment || null }) }); load(); }
  async function upload(type: 'invoice' | 'closing', file?: File) { if (!file) return; const body = new FormData(); body.append('file', file); await api(`/expenses/${expenseId}/documents?document_type=${type}`, { method: 'POST', body }); load(); }
  function addStore(id: string) { const store = stores.find((item) => item.id === id); if (store && !current.allocations.some((item) => item.store_id === id)) update('allocations', [...current.allocations, { store_id: id, store: store.name, amount: '0' }]); }
  function addTag(id: string) { const tag = tags.find((item) => item.id === id); if (tag && !current.tags.some((item) => item.id === id)) update('tags', [...current.tags, tag]); }

  return <>
    <Link className="back-link" to="/expenses">← К расходам</Link>
    <div className="page-head"><div><h1>Карточка расхода</h1><p>{message || current.service_name}</p></div><div className="head-actions"><button onClick={() => setEditing((value) => !value)}>{editing ? 'Отмена' : 'Редактировать'}</button><button className="danger" onClick={remove}>Удалить</button></div></div>
    <form className="expense-card" onSubmit={save}>
      <section><h2>Основные данные</h2><label>Партнер<select disabled={!editing} value={current.partner_id} onChange={(event) => update('partner_id', event.target.value)}>{partners.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Контрагент<select disabled={!editing} value={current.counterparty_id} onChange={(event) => update('counterparty_id', event.target.value)}>{counterparties.filter((item) => item.partner_id === current.partner_id).map((item) => <option value={item.id} key={item.id}>{item.full_name}</option>)}</select></label><label>Услуга<input disabled={!editing} value={current.service_name} onChange={(event) => update('service_name', event.target.value)} /></label><div className="row"><label>Месяц<input disabled={!editing} type="number" value={current.expense_month} onChange={(event) => update('expense_month', Number(event.target.value))} /></label><label>Год<input disabled={!editing} type="number" value={current.expense_year} onChange={(event) => update('expense_year', Number(event.target.value))} /></label></div><label>Комментарий<textarea disabled={!editing} value={current.comment || ''} onChange={(event) => update('comment', event.target.value)} /></label>{editing && <button className="primary">Сохранить</button>}</section>
      <section><h2>Магазины и теги</h2><div className="relation-field"><b>Магазины</b>{current.allocations.length ? current.allocations.map((item) => <span className="relation-chip" key={item.store_id}>{item.store}{editing && <button type="button" aria-label={`Удалить ${item.store}`} onClick={() => update('allocations', current.allocations.filter((value) => value.store_id !== item.store_id))}>×</button>}</span>) : <small>Не выбраны</small>}{editing && <select value="" onChange={(event) => addStore(event.target.value)}><option value="">+ Добавить магазин</option>{stores.filter((item) => !current.allocations.some((value) => value.store_id === item.id)).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>}</div><div className="relation-field"><b>Теги</b>{current.tags.length ? current.tags.map((item) => <span className="relation-chip" key={item.id}>{item.name}{editing && <button type="button" aria-label={`Удалить ${item.name}`} onClick={() => update('tags', current.tags.filter((value) => value.id !== item.id))}>×</button>}</span>) : <small>Не выбраны</small>}{editing && <select value="" onChange={(event) => addTag(event.target.value)}><option value="">+ Добавить тег</option>{tags.filter((item) => !current.tags.some((value) => value.id === item.id)).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>}</div></section>
      <section className="card-wide"><h2>Счета и платежи</h2>{current.invoices.length ? current.invoices.map((invoice) => <article className="invoice-card" key={invoice.id}><div><b>Счет № {invoice.invoice_number}</b><span>{invoice.invoice_date} · {money(invoice.amount)}</span></div><div className="invoice-actions"><button type="button" onClick={() => editInvoice(invoice)}>Изменить счет</button><button type="button" onClick={() => addPayment(invoice.id)}>+ Добавить платеж</button></div>{invoice.payments.map((payment) => <small key={payment.id}>{payment.payment_date}: {money(payment.amount)} <button type="button" className="link" onClick={() => editPayment(payment)}>Изменить</button></small>)}</article>) : <p>Счетов пока нет.</p>}</section>
      <section className="card-wide"><h2>Документы</h2><div className="upload-actions"><label className="file-button">Загрузить счет<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => upload('invoice', event.target.files?.[0])} /></label><label className="file-button">Загрузить закрывающий документ<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => upload('closing', event.target.files?.[0])} /></label></div><div className="document-grid">{current.documents.map((document) => <button type="button" className="document-thumb" key={document.id} onClick={() => setPreview(document)}>{document.mime_type.startsWith('image/') ? <img src={contentUrl(document.id)} alt="" /> : <span className="pdf-thumb">PDF</span>}<b>{document.document_type === 'invoice' ? 'Счет' : 'Закрывающий документ'}</b><small>{document.original_filename}</small></button>)}</div></section>
    </form>
    {preview && <div className="overlay document-overlay" role="dialog" aria-modal="true" aria-label={preview.original_filename}><section className="document-preview"><button className="close" type="button" onClick={() => setPreview(undefined)} aria-label="Закрыть">×</button><h2>{preview.document_type === 'invoice' ? 'Счет' : 'Закрывающий документ'}</h2>{preview.mime_type === 'application/pdf' ? <iframe title={preview.original_filename} src={contentUrl(preview.id)} /> : <img src={contentUrl(preview.id)} alt={preview.original_filename} />}</section></div>}
  </>;
}
