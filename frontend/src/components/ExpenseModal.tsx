import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Counterparty, OCRResponse, Partner, Store } from '../types';

type Props = { close: () => void; onSaved?: () => void };
type Allocation = { store_id: string; amount: string };

const today = new Date().toISOString().slice(0, 10);

export function ExpenseModal({ close, onSaved = () => undefined }: Props) {
  const [mode, setMode] = useState<'choice' | 'ocr' | 'manual'>('choice');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [inn, setInn] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState('');
  const [ocrReviewed, setOcrReviewed] = useState(false);
  const [ocrDocumentId, setOcrDocumentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  function requestClose() {
    if (window.confirm('Закрыть окно? Несохраненные данные будут потеряны.')) close();
  }

  useEffect(() => {
    Promise.all([
      api<Partner[]>('/partners'),
      api<Counterparty[]>('/counterparties'),
      api<Store[]>('/stores'),
    ]).then(([partnerItems, counterpartyItems, storeItems]) => {
      setPartners(partnerItems);
      setCounterparties(counterpartyItems);
      setStores(storeItems);
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  const availableCounterparties = counterparties.filter(
    (item) => !partnerId || item.partner_id === partnerId,
  );

  async function upload(file: File) {
    setMessage('Распознаём документ…');
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    try {
      setPreview(URL.createObjectURL(file));
      const response = await api<OCRResponse>('/ocr/invoice', { method: 'POST', body: form });
      setInvoiceNumber(response.fields.invoice_number.value ?? '');
      setInvoiceDate(response.fields.invoice_date.value ?? today);
      setInvoiceAmount(response.fields.amount.value ?? '');
      setRecipient(response.fields.recipient.value ?? ''); setInn(response.fields.inn.value ?? '');
      setOcrConfidence(Object.fromEntries(Object.entries(response.fields).map(([key, field]) => [key, field.confidence])));
      setOcrDocumentId(response.document_id);
      const counterparty = counterparties.find((item) => item.id === response.counterparty.id);
      if (counterparty) {
        setCounterpartyId(counterparty.id);
        setPartnerId(counterparty.partner_id);
      }
      setMessage(response.counterparty.matched ? `Найден контрагент: ${response.counterparty.name}, ИНН ${response.fields.inn.value}` : 'Контрагент с таким ИНН не найден. Выберите его вручную.');
      setOcrReviewed(true);
      setMode('manual');
    } catch (error) {
      setMessage('Не удалось уверенно распознать счет. Вы можете заполнить данные вручную или сфотографировать документ еще раз.');
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
    setBusy(true);
    setMessage('Сохраняем расход…');
    try {
      const expense = await api<{ id: string }>('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          partner_id: partnerId, counterparty_id: counterpartyId, service_name: serviceName,
          expense_month: month, expense_year: year,
          allocations: allocations.filter((item) => item.store_id).map((item) => ({ ...item, amount: item.amount || '0' })),
        }),
      });
      if (ocrDocumentId) await api(`/documents/${ocrDocumentId}/expense/${expense.id}`, { method: 'PUT' });
      if (invoiceAmount) {
        const invoice = await api<{ id: string }>(`/expenses/${expense.id}/invoices`, {
          method: 'POST',
          body: JSON.stringify({
            invoice_number: invoiceNumber || 'Без номера', invoice_date: invoiceDate,
            amount: invoiceAmount,
          }),
        });
        if (paymentAmount) {
          await api(`/invoices/${invoice.id}/payments`, {
            method: 'POST', body: JSON.stringify({ payment_date: today, amount: paymentAmount }),
          });
        }
      }
      onSaved();
      close();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить расход');
    } finally {
      setBusy(false);
    }
  }

  function addAllocation() {
    setAllocations((current) => [...current, { store_id: '', amount: '' }]);
  }

  return <div className="overlay" role="dialog" aria-modal="true">
    <section className="modal">
      <button className="close" type="button" onClick={requestClose} aria-label="Закрыть">×</button>
      <h2>{mode === 'choice' ? 'Как добавить расход?' : mode === 'ocr' ? 'Распознавание счета' : 'Новый расход'}</h2>
      {mode === 'choice' && <div className="choices">
        <button type="button" onClick={() => { setMode('ocr'); setTimeout(() => cameraInput.current?.click()); }}>📷<b>Сфотографировать счет</b><small>Открыть камеру смартфона</small></button>
        <button type="button" onClick={() => { setMode('ocr'); setTimeout(() => input.current?.click()); }}>▣<b>Выбрать файл</b><small>JPEG, PNG или PDF</small></button>
        <button type="button" onClick={() => setMode('manual')}>✎<b>Вручную</b><small>Заполнить данные самостоятельно</small></button>
      </div>}
      <input ref={cameraInput} hidden type="file" accept="image/*" capture="environment" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
      <input ref={input} hidden type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
      {mode === 'ocr' && <>
        <div className="progress">{message || 'Выберите документ'}</div>
        <div className="modal-actions"><button type="button" disabled={busy} onClick={() => cameraInput.current?.click()}>Сфотографировать еще раз</button><button type="button" disabled={busy} onClick={() => setMode('manual')}>Заполнить вручную</button></div>
      </>}
      {mode === 'manual' && <form onSubmit={submit}>
        {message && <div className="notice">{message}</div>}
        {ocrReviewed && <section className="ocr-review"><h3>Проверьте распознанные данные</h3>{preview && <img src={preview} alt="Загруженный счет" />}<div className="row"><label>Получатель<input value={recipient} onChange={(event) => setRecipient(event.target.value)} />{ocrConfidence.recipient < .7 && <small>⚠ Проверьте значение</small>}</label><label>ИНН<input value={inn} onChange={(event) => setInn(event.target.value)} />{ocrConfidence.inn < .7 && <small>⚠ Проверьте значение</small>}</label></div></section>}
        <label>Партнер<select required value={partnerId} onChange={(event) => { setPartnerId(event.target.value); setCounterpartyId(''); }}><option value="">Выберите партнера</option>{partners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button type="button" className="link" onClick={createPartner}>+ Новый партнер</button>
        <label>Контрагент<select required value={counterpartyId} onChange={(event) => setCounterpartyId(event.target.value)}><option value="">Выберите контрагента</option>{availableCounterparties.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label>
        <button type="button" className="link" onClick={createCounterparty}>+ Новый контрагент</button>
        <label>Услуга / товар<input required value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Например, наружная реклама" /></label>
        <div className="row"><label>Месяц<input required type="number" min="1" max="12" value={month} onChange={(event) => setMonth(Number(event.target.value))} /></label><label>Год<input required type="number" min="2000" max="2200" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label></div>
        <fieldset><legend>Счет и оплата</legend>
          <div className="row"><label>Номер счета<input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />{ocrReviewed && ocrConfidence.invoice_number < .7 && <small>⚠ Проверьте значение</small>}</label><label>Дата счета<input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />{ocrReviewed && ocrConfidence.invoice_date < .7 && <small>⚠ Проверьте значение</small>}</label></div>
          <div className="row"><label>Сумма счета<input type="number" min="0" step="0.01" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} />{ocrReviewed && ocrConfidence.amount < .7 && <small>⚠ Проверьте значение</small>}</label><label>Сумма платежа<input type="number" min="0" step="0.01" max={invoiceAmount || undefined} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label></div>
        </fieldset>
        <fieldset><legend>Распределение по магазинам</legend>
          {allocations.map((allocation, index) => <div className="allocation-row" key={index}>
            <select aria-label="Магазин" value={allocation.store_id} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, store_id: event.target.value } : item))}><option value="">Выберите магазин</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select>
            <input aria-label="Сумма распределения" type="number" min="0" step="0.01" placeholder="Сумма" value={allocation.amount} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} />
            <button type="button" aria-label="Удалить распределение" onClick={() => setAllocations((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
          </div>)}
          <button type="button" className="link" onClick={addAllocation}>+ Добавить магазин</button>
        </fieldset>
        <div className="modal-actions"><button type="button" onClick={requestClose}>Закрыть</button><button className="primary" disabled={busy}>Сохранить расход</button></div>
      </form>}
    </section>
  </div>;
}
