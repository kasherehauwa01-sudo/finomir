import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Counterparty, OCRResponse, Partner, Store, Tag } from '../types';

type Props = { close: () => void; onSaved?: () => void };
type Allocation = { store_id: string; amount: string };

const today = new Date().toISOString().slice(0, 10);
export function invoiceAmountForSubmission(invoicePayment: boolean, invoiceAmount: string, paymentAmount: string) {
  return invoicePayment ? invoiceAmount : paymentAmount;
}
export const filterExpensePartners = (items:Partner[],search:string,selectedId:string) => { const term=search.trim().toLowerCase(); return items.filter(item=>!term||item.name.toLowerCase().includes(term)||item.id===selectedId); };
export const filterExpenseCounterparties = (items:Counterparty[],partnerId:string,search:string,selectedId:string) => { const term=search.trim().toLowerCase(); return items.filter(item=>(!partnerId||item.partner_id===partnerId)&&(!term||`${item.full_name} ${item.inn??''}`.toLowerCase().includes(term)||item.id===selectedId)); };

function SearchSelect({label,value,placeholder,searchPlaceholder,options,onChange}:{label:string;value:string;placeholder:string;searchPlaceholder:string;options:{id:string;label:string;search:string}[];onChange:(id:string)=>void}) {
  const [search,setSearch]=useState(''); const details=useRef<HTMLDetailsElement>(null); const searchInput=useRef<HTMLInputElement>(null); const term=search.trim().toLowerCase();
  const visible=options.filter(item=>!term||item.search.toLowerCase().includes(term)||item.id===value); const selected=options.find(item=>item.id===value);
  return <div className="search-select-label"><span>{label}</span><details className="search-select" ref={details} onToggle={(event)=>{if(event.currentTarget.open)setTimeout(()=>searchInput.current?.focus());else setSearch('');}}><summary>{selected?.label||placeholder}</summary><div><input ref={searchInput} type="search" aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={search} onChange={event=>setSearch(event.target.value)}/><div className="search-select-options"><button type="button" className={!value?'selected':''} onClick={()=>{onChange('');if(details.current)details.current.open=false;}}>{placeholder}</button>{visible.map(item=><button type="button" className={item.id===value?'selected':''} key={item.id} onClick={()=>{onChange(item.id);if(details.current)details.current.open=false;}}>{item.label}</button>)}{!visible.length&&<small>Ничего не найдено</small>}</div></div></details></div>;
}

export function ExpenseModal({ close, onSaved = () => undefined }: Props) {
  const [mode, setMode] = useState<'choice' | 'ocr' | 'manual'>('choice');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [counterpartySearch, setCounterpartySearch] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [inn, setInn] = useState('');
  const [kpp, setKpp] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState('');
  const [ocrReviewed, setOcrReviewed] = useState(false);
  const [ocrDocumentId, setOcrDocumentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [invoicePayment, setInvoicePayment] = useState(true);
  const invoiceFieldsBeforeCash = useRef({ number: '', date: today, amount: '' });
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const cameraInput = useRef<HTMLInputElement>(null);

  function requestClose() {
    if (window.confirm('Закрыть окно? Несохраненные данные будут потеряны.')) close();
  }

  useEffect(() => {
    Promise.all([
      api<Partner[]>('/partners'),
      api<Counterparty[]>('/counterparties'),
      api<Store[]>('/stores'),
      api<Tag[]>('/tags'),
    ]).then(([partnerItems, counterpartyItems, storeItems, tagItems]) => {
      setPartners(partnerItems);
      setCounterparties(counterpartyItems);
      setStores(storeItems);
      setTags(tagItems);
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  const availableCounterparties = counterparties.filter(item=>!partnerId||item.partner_id===partnerId);

  function toggleInvoicePayment() {
    if (invoicePayment) {
      invoiceFieldsBeforeCash.current = { number: invoiceNumber, date: invoiceDate, amount: invoiceAmount };
      setInvoicePayment(false); setInvoiceNumber('Наличные'); setInvoiceDate(today); setInvoiceAmount('');
    } else {
      const previous = invoiceFieldsBeforeCash.current;
      setInvoicePayment(true); setInvoiceNumber(previous.number); setInvoiceDate(previous.date); setInvoiceAmount(previous.amount);
    }
  }

  async function upload(file: File) {
    setMessage('Распознаём документ…');
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    try {
      setPreview(URL.createObjectURL(file));
      const response = await api<OCRResponse>('/ocr/invoice', { method: 'POST', body: form });
      setInvoiceNumber(response.fields.invoice_number.value ?? '');
      // После OCR неизвестная дата должна оставаться пустой, а не выглядеть
      // как успешно распознанная текущая дата.
      setInvoiceDate(response.fields.invoice_date.value ?? '');
      setInvoiceAmount(response.fields.amount.value ?? '');
      setPaymentAmount(response.fields.amount.value ?? '');
      setServiceName(response.fields.service_name.value ?? '');
      setRecipient(response.fields.recipient.value ?? ''); setInn(response.fields.inn.value ?? ''); setKpp(response.fields.kpp.value ?? '');
      setOcrConfidence(Object.fromEntries(Object.entries(response.fields).map(([key, field]) => [key, field.confidence])));
      setOcrDocumentId(response.document_id);
      const counterparty = counterparties.find((item) => item.id === response.counterparty.id);
      if (counterparty?.partner_id) {
        setCounterpartyId(counterparty.id);
        setPartnerId(counterparty.partner_id);
      }
      setMessage(response.counterparty.matched ? `Найден контрагент: ${response.counterparty.name}, ИНН ${response.fields.inn.value}` : 'Контрагент с таким ИНН не найден. После выбора партнера он будет добавлен автоматически при сохранении.');
      setOcrReviewed(true);
      setMode('manual');
    } catch (error) {
      // API уже возвращает безопасное пользовательское описание причины
      // (формат, размер файла или недоступность OCR), не скрываем его общей фразой.
      setMessage(error instanceof Error ? error.message : 'Не удалось распознать счет. Попробуйте еще раз или заполните данные вручную.');
      setMode('ocr');
    } finally {
      setBusy(false);
    }
  }

  async function createPartner() {
    const name = window.prompt('Название нового партнера');
    if (!name?.trim()) return;
    const item = await api<Partner>('/partners', {
      method: 'POST', body: JSON.stringify({ name: name.trim() }),
    });
    setPartners((current) => [...current, item]);
    setPartnerId(item.id);
    setCounterpartyId('');
  }

  async function createCounterparty() {
    if (!partnerId) {
      setMessage('Сначала выберите или создайте партнера.');
      return;
    }
    const fullName = window.prompt('Полное название нового контрагента');
    if (!fullName?.trim()) return;
    const item = await api<Counterparty>('/counterparties', {
      method: 'POST',
      body: JSON.stringify({ partner_id: partnerId, full_name: fullName.trim(), entity_type: 'company' }),
    });
    setCounterparties((current) => [...current, item]);
    setCounterpartyId(item.id);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!partnerId) { setMessage('Выберите партнера.'); return; }
    if (!counterpartyId && (!ocrReviewed || !recipient.trim())) { setMessage('Выберите контрагента.'); return; }
    setBusy(true);
    setMessage('Сохраняем расход…');
    try {
      let selectedCounterpartyId = counterpartyId;
      if (!selectedCounterpartyId && ocrReviewed && partnerId && recipient.trim()) {
        const digits = (value?: string | null) => (value ?? '').replace(/\D/g, '');
        const existing = counterparties.find((item) => item.partner_id === partnerId && digits(item.inn) === digits(inn) && digits(inn));
        if (existing) selectedCounterpartyId = existing.id;
        else {
          const created = await api<Counterparty>('/counterparties', {
            method: 'POST',
            body: JSON.stringify({ partner_id: partnerId, full_name: recipient.trim(), entity_type: recipient.trim().toUpperCase().startsWith('ИП ') ? 'entrepreneur' : 'company', inn: inn.trim() || null, kpp: kpp.trim() || null }),
          });
          setCounterparties((current) => [...current, created]);
          setCounterpartyId(created.id);
          selectedCounterpartyId = created.id;
        }
      }
      const expense = await api<{ id: string }>('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          partner_id: partnerId, counterparty_id: selectedCounterpartyId, service_name: serviceName,
          expense_month: month, expense_year: year,
          allocations: allocations.filter((item) => item.store_id).map((item) => ({ ...item, amount: item.amount || '0' })),
          tag_ids: tagIds,
        }),
      });
      const amountForInvoice = invoiceAmountForSubmission(invoicePayment, invoiceAmount, paymentAmount);
      if (amountForInvoice) {
        const invoice = await api<{ id: string }>(`/expenses/${expense.id}/invoices`, {
          method: 'POST',
          body: JSON.stringify({
            invoice_number: invoiceNumber || 'Без номера', invoice_date: invoiceDate,
            amount: amountForInvoice,
          }),
        });
        if (paymentAmount) {
          await api(`/invoices/${invoice.id}/payments`, {
            method: 'POST', body: JSON.stringify({ payment_date: today, amount: paymentAmount }),
          });
        }
      }
      if (ocrDocumentId) await api(`/documents/${ocrDocumentId}/expense/${expense.id}`, { method: 'PUT' });
      onSaved();
      close();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить расход');
    } finally {
      setBusy(false);
    }
  }

  function toggleStore(storeId: string) {
    setAllocations((current) => current.some((item) => item.store_id === storeId)
      ? current.filter((item) => item.store_id !== storeId)
      : [...current, { store_id: storeId, amount: '0' }]);
  }

  function toggleAllStores() {
    setAllocations((current) => current.length === stores.length
      ? []
      : stores.map((store) => ({ store_id: store.id, amount: '0' })));
  }

  function toggleTag(tagId: string) {
    setTagIds((current) => current.includes(tagId) ? current.filter((item) => item !== tagId) : [...current, tagId]);
  }

  return <div className="overlay" role="dialog" aria-modal="true">
    <section className={`modal expense-modal ${mode === 'manual' && ocrReviewed && preview ? 'ocr-completion' : ''}`}>
      <button className="close" type="button" onClick={requestClose} aria-label="Закрыть">×</button>
      <h2>{mode === 'choice' ? 'Как добавить расход?' : mode === 'ocr' ? 'Распознавание счета' : 'Новый расход'}</h2>
      {mode === 'choice' && <div className="choices">
        <button type="button" onClick={() => { setMode('ocr'); setTimeout(() => cameraInput.current?.click()); }}>📷<b>Сфотографировать счет</b><small>Открыть камеру смартфона</small></button>
        <button type="button" onClick={() => setMode('manual')}>✎<b>Вручную</b><small>Заполнить данные самостоятельно</small></button>
      </div>}
      <input ref={cameraInput} hidden type="file" accept="image/jpeg,image/png" capture="environment" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
      {mode === 'ocr' && <>
        <div className="progress">{message || 'Выберите документ'}</div>
        <div className="modal-actions"><button type="button" disabled={busy} onClick={() => cameraInput.current?.click()}>Сфотографировать еще раз</button><button type="button" disabled={busy} onClick={() => setMode('manual')}>Заполнить вручную</button></div>
      </>}
      {mode === 'manual' && <form className="completion-form" onSubmit={submit}>
        {message && <div className="notice">{message}</div>}
        {ocrReviewed && <section className="ocr-review"><h3>Проверьте распознанные данные</h3><div className="row"><label>Получатель<input value={recipient} onChange={(event) => setRecipient(event.target.value)} />{ocrConfidence.recipient < .7 && <small>⚠ Проверьте значение</small>}</label><label>ИНН<input value={inn} onChange={(event) => setInn(event.target.value)} />{ocrConfidence.inn < .7 && <small>⚠ Проверьте значение</small>}</label></div><label>КПП<input value={kpp} onChange={(event) => setKpp(event.target.value)} /></label></section>}
        <SearchSelect label="Партнер" value={partnerId} placeholder="Выберите партнера" searchPlaceholder="Поиск партнера" options={partners.map(item=>({id:item.id,label:item.name,search:item.name}))} onChange={(id)=>{setPartnerId(id);setCounterpartyId('');}}/>
        <button type="button" className="link" onClick={createPartner}>+ Новый партнер</button>
        <SearchSelect label="Контрагент" value={counterpartyId} placeholder={ocrReviewed&&recipient.trim()?'Будет создан автоматически после сохранения':'Выберите контрагента'} searchPlaceholder="Поиск по названию или ИНН" options={availableCounterparties.map(item=>({id:item.id,label:item.full_name,search:`${item.full_name} ${item.inn??''}`}))} onChange={setCounterpartyId}/>
        <button type="button" className="link" onClick={createCounterparty}>+ Новый контрагент</button>
        <label>Услуга / товар<input required value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Например, наружная реклама" />{ocrReviewed && ocrConfidence.service_name < .7 && <small>⚠ Проверьте наименование товара, работы или услуги</small>}</label>
        <div className="row"><label>Месяц<input required type="number" min="1" max="12" value={month} onChange={(event) => setMonth(Number(event.target.value))} /></label><label>Год<input required type="number" min="2000" max="2200" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label></div>
        <fieldset><legend>Счет и оплата</legend>
          <label className="payment-toggle"><input type="checkbox" role="switch" checked={invoicePayment} onChange={toggleInvoicePayment} /><span aria-hidden="true" />Оплата по счету</label>
          <div className="row"><label>Номер счета<input readOnly={!invoicePayment} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />{invoicePayment && ocrReviewed && ocrConfidence.invoice_number < .7 && <small>⚠ Проверьте значение</small>}</label><label>Дата счета<input readOnly={!invoicePayment} type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />{invoicePayment && ocrReviewed && ocrConfidence.invoice_date < .7 && <small>⚠ Проверьте значение</small>}</label></div>
          {invoicePayment ? <div className="row"><label>Сумма счета<input type="number" min="0" step="0.01" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} />{ocrReviewed && ocrConfidence.amount < .7 && <small>⚠ Проверьте значение</small>}</label><label>Сумма платежа<input type="number" min="0" step="0.01" max={invoiceAmount || undefined} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label></div> : <label>Сумма платежа<input required type="number" min="0" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>}
        </fieldset>
        <fieldset><legend>Распределение по магазинам</legend>
          {!!stores.length && <button type="button" className="link select-all-stores" onClick={toggleAllStores}>{allocations.length === stores.length ? 'Снять выбор' : 'Выбрать все'}</button>}
          <div className="store-tags">{stores.map((store) => { const selected = allocations.some((item) => item.store_id === store.id); return <button type="button" aria-pressed={selected} className={`relation-chip ${selected ? 'active' : 'inactive'}`} key={store.id} onClick={() => toggleStore(store.id)}>{store.name}</button>; })}</div>
        </fieldset>
        <fieldset><legend>Теги</legend>
          <div className="store-tags">{tags.map((tag) => { const selected = tagIds.includes(tag.id); return <button type="button" aria-pressed={selected} className={`relation-chip ${selected ? 'active' : 'inactive'}`} key={tag.id} onClick={() => toggleTag(tag.id)}>{tag.name}</button>; })}</div>
          {!tags.length && <small>В справочнике пока нет тегов.</small>}
        </fieldset>
        <div className="modal-actions"><button type="button" onClick={requestClose}>Закрыть</button><button className="primary" disabled={busy}>Сохранить расход</button></div>
      </form>}
      {mode === 'manual' && ocrReviewed && preview && <aside className="invoice-source" aria-label="Исходный счет"><h3>Исходный счет</h3><div className="invoice-source__viewport"><img src={preview} alt="Исходный счет для проверки распознанных данных" /></div></aside>}
    </section>
  </div>;
}
