import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, base } from '../api/client';
import type { Counterparty, ExpenseDetail, ExpenseInvoice, ExpensePayment, Partner, Store, Tag } from '../types';
import { money } from '../utils/format';

type DocumentItem = ExpenseDetail['documents'][number];
type PaymentEditor = { invoiceId: string; payment?: ExpensePayment; payment_date: string; amount: string; comment: string };

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
  const [saving, setSaving] = useState(false);
  const [invoiceEditor, setInvoiceEditor] = useState<ExpenseInvoice>();
  const [paymentEditor, setPaymentEditor] = useState<PaymentEditor>();

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
    setSaving(true); setMessage('Сохраняем изменения…');
    try {
      await api(`/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify({ partner_id: current.partner_id, counterparty_id: current.counterparty_id, service_name: current.service_name, expense_month: current.expense_month, expense_year: current.expense_year, contract_number: current.contract_number || null, contract_date: current.contract_date || null, comment: current.comment || null, allocations: current.allocations.map((item) => ({ store_id: item.store_id, amount: item.amount || 0 })), tag_ids: current.tags.map((item) => item.id) }) });
      setEditing(false); setMessage('Изменения сохранены.'); load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось сохранить изменения.'); }
    finally { setSaving(false); }
  }
  async function remove() { if (window.confirm('Удалить расход?')) { await api(`/expenses/${expenseId}`, { method: 'DELETE' }); navigate('/expenses'); } }
  async function saveInvoice(event: FormEvent) { event.preventDefault(); if (!invoiceEditor) return; await api(`/invoices/${invoiceEditor.id}`, { method: 'PUT', body: JSON.stringify({ invoice_number: invoiceEditor.invoice_number, invoice_date: invoiceEditor.invoice_date, amount: invoiceEditor.amount }) }); setInvoiceEditor(undefined); setMessage('Счет изменен.'); load(); }
  async function savePayment(event: FormEvent) { event.preventDefault(); if (!paymentEditor) return; const body=JSON.stringify({ payment_date:paymentEditor.payment_date,amount:paymentEditor.amount,comment:paymentEditor.comment||null }); if(paymentEditor.payment) await api(`/payments/${paymentEditor.payment.id}`,{method:'PUT',body}); else await api(`/invoices/${paymentEditor.invoiceId}/payments`,{method:'POST',body}); setPaymentEditor(undefined);setMessage(paymentEditor.payment?'Платеж изменен.':'Платеж добавлен.');load(); }
  async function upload(type: 'invoice' | 'closing', file?: File) { if (!file) return; const body = new FormData(); body.append('file', file); await api(`/expenses/${expenseId}/documents?document_type=${type}`, { method: 'POST', body }); load(); }
  function toggleStore(store: Store) {
    const selected = current.allocations.some((item) => item.store_id === store.id);
    update('allocations', selected ? current.allocations.filter((item) => item.store_id !== store.id) : [...current.allocations, { store_id: store.id, store: store.name, amount: '0' }]);
  }
  function toggleTag(tag: Tag) {
    const selected = current.tags.some((item) => item.id === tag.id);
    update('tags', selected ? current.tags.filter((item) => item.id !== tag.id) : [...current.tags, tag]);
  }

  return <>
    <Link className="back-link" to="/expenses">← К расходам</Link>
    <div className="page-head expense-head"><div><h1>Карточка расхода</h1><p>{message || current.service_name}</p></div><div className="head-actions"><button onClick={() => setEditing((value) => !value)}>{editing ? 'Отмена' : 'Редактировать'}</button><button className="danger" onClick={remove}>Удалить</button></div></div>
    <form className="expense-card" onSubmit={save}>
      <section className="main-data"><h2>Основные данные</h2><label>Партнер<select disabled={!editing} value={current.partner_id} onChange={(event) => update('partner_id', event.target.value)}>{partners.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Контрагент<select disabled={!editing} value={current.counterparty_id} onChange={(event) => update('counterparty_id', event.target.value)}>{counterparties.filter((item) => item.partner_id === current.partner_id).map((item) => <option value={item.id} key={item.id}>{item.full_name}</option>)}</select></label><label>Услуга<input disabled={!editing} value={current.service_name} onChange={(event) => update('service_name', event.target.value)} /></label><div className="row"><label>Месяц<input disabled={!editing} type="number" value={current.expense_month} onChange={(event) => update('expense_month', Number(event.target.value))} /></label><label>Год<input disabled={!editing} type="number" value={current.expense_year} onChange={(event) => update('expense_year', Number(event.target.value))} /></label></div><label>Комментарий<textarea disabled={!editing} value={current.comment || ''} onChange={(event) => update('comment', event.target.value)} /></label></section>
      <section className="relations-card"><h2>Магазины и теги</h2><div className="relation-field"><b>Магазины</b><div className="relation-options">{stores.map((store) => { const active = current.allocations.some((item) => item.store_id === store.id); return <button type="button" disabled={!editing} aria-pressed={active} className={`relation-chip ${active ? 'active' : 'inactive'}`} key={store.id} onClick={() => toggleStore(store)}>{store.name}</button>; })}</div></div><div className="relation-field"><b>Теги</b><div className="relation-options">{tags.map((tag) => { const active = current.tags.some((item) => item.id === tag.id); return <button type="button" disabled={!editing} aria-pressed={active} className={`relation-chip ${active ? 'active' : 'inactive'}`} key={tag.id} onClick={() => toggleTag(tag)}>{tag.name}</button>; })}</div></div><small className="relations-hint">{editing ? 'Нажмите, чтобы добавить или убрать значение.' : 'Цветом отмечены связанные с расходом значения.'}</small></section>
      <section className="documents-card"><div className="section-title"><h2>Документы</h2><div className="upload-actions"><label className="file-button" title="Загрузить счет">+ Счет<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => upload('invoice', event.target.files?.[0])} /></label><label className="file-button" title="Загрузить закрывающий документ">+ Закрывающий<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => upload('closing', event.target.files?.[0])} /></label></div></div><div className="document-grid">{current.documents.map((document) => <button type="button" className="document-thumb" key={document.id} onClick={() => setPreview(document)}>{document.mime_type.startsWith('image/') ? <img src={contentUrl(document.id)} alt="" /> : <span className="pdf-thumb">PDF</span>}<b>{document.document_type === 'invoice' ? 'Счет' : 'Закрывающий документ'}</b><small>{document.original_filename}</small></button>)}</div>{!current.documents.length && <small>Документы не загружены.</small>}</section>
      <section className="invoices-section"><h2>Счета и платежи</h2>{current.invoices.length ? current.invoices.map((invoice) => <article className="invoice-card" key={invoice.id}><div className="invoice-summary"><b>Счет № {invoice.invoice_number}</b><span>{invoice.invoice_date} · {money(invoice.amount)}</span></div><div className="invoice-actions"><button type="button" onClick={() => setInvoiceEditor({ ...invoice })}>Изменить счет</button><button type="button" className="primary-soft" onClick={() => setPaymentEditor({ invoiceId:invoice.id,payment_date:new Date().toISOString().slice(0,10),amount:'',comment:'' })}>+ Добавить платеж</button></div><div className="payments-list">{invoice.payments.length ? invoice.payments.map((payment) => <div className="payment-row" key={payment.id}><span><b>{money(payment.amount)}</b><small>{payment.payment_date}{payment.comment?` · ${payment.comment}`:''}</small></span><button type="button" onClick={() => setPaymentEditor({ invoiceId:invoice.id,payment,payment_date:payment.payment_date,amount:payment.amount,comment:payment.comment||'' })}>Изменить</button></div>) : <small>Платежей по счету пока нет.</small>}</div></article>) : <p>Счетов пока нет.</p>}</section>
      {editing && <div className="expense-save-actions"><button type="submit" className="primary" disabled={saving}>{saving?'Сохраняем…':'Сохранить изменения'}</button></div>}
    </form>
    {preview && <div className="overlay document-overlay" role="dialog" aria-modal="true" aria-label={preview.original_filename}><section className="document-preview"><button className="close" type="button" onClick={() => setPreview(undefined)} aria-label="Закрыть">×</button><h2>{preview.document_type === 'invoice' ? 'Счет' : 'Закрывающий документ'}</h2>{preview.mime_type === 'application/pdf' ? <iframe title={preview.original_filename} src={contentUrl(preview.id)} /> : <img src={contentUrl(preview.id)} alt={preview.original_filename} />}</section></div>}
    {invoiceEditor && <div className="overlay" role="dialog" aria-modal="true"><form className="modal editor-modal" onSubmit={saveInvoice}><h2>Изменить счет</h2><label>Номер счета<input required value={invoiceEditor.invoice_number} onChange={event=>setInvoiceEditor({...invoiceEditor,invoice_number:event.target.value})}/></label><label>Дата счета<input required type="date" value={invoiceEditor.invoice_date} onChange={event=>setInvoiceEditor({...invoiceEditor,invoice_date:event.target.value})}/></label><label>Сумма счета<input required type="number" min="0" step="0.01" value={invoiceEditor.amount} onChange={event=>setInvoiceEditor({...invoiceEditor,amount:event.target.value})}/></label><div className="modal-actions"><button type="button" onClick={()=>setInvoiceEditor(undefined)}>Отмена</button><button className="primary">Сохранить счет</button></div></form></div>}
    {paymentEditor && <div className="overlay" role="dialog" aria-modal="true"><form className="modal editor-modal" onSubmit={savePayment}><h2>{paymentEditor.payment?'Изменить платеж':'Добавить платеж'}</h2><label>Дата платежа<input required type="date" value={paymentEditor.payment_date} onChange={event=>setPaymentEditor({...paymentEditor,payment_date:event.target.value})}/></label><label>Сумма платежа<input required type="number" min="0" step="0.01" value={paymentEditor.amount} onChange={event=>setPaymentEditor({...paymentEditor,amount:event.target.value})}/></label><label>Комментарий<textarea value={paymentEditor.comment} onChange={event=>setPaymentEditor({...paymentEditor,comment:event.target.value})}/></label><div className="modal-actions"><button type="button" onClick={()=>setPaymentEditor(undefined)}>Отмена</button><button className="primary">{paymentEditor.payment?'Сохранить платеж':'Добавить платеж'}</button></div></form></div>}
  </>;
}
