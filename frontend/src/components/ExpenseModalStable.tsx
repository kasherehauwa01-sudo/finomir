import { FormEvent, useEffect, useRef, useState } from 'react';
import { StorePresetLinks } from './StorePresetLinks';
import { api } from '../api/client';
import type { Counterparty, OCRResponse, OCRSource, Partner, Store, StorePreset, Tag } from '../types';

// Компонент намеренно хранит единый согласованный набор состояний формы:
// invoiceDate, hasPayment и paymentAmount. Не смешивать его с устаревшими
// invoicePayment/invoiceFieldsBeforeCash из параллельных веток.

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
  const [presets, setPresets] = useState<StorePreset[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
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
  const [kpp, setKpp] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState('');
  const [ocrReviewed, setOcrReviewed] = useState(false);
  const [ocrDocumentId, setOcrDocumentId] = useState('');
  const [aiLogId, setAiLogId] = useState<string | null>(null);
  const [sources, setSources] = useState<Record<string, OCRSource>>({});
  const [paymentAmount, setPaymentAmount] = useState('');
  const [hasPayment, setHasPayment] = useState(false);
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
      api<StorePreset[]>('/store-presets'),
    ]).then(([partnerItems, counterpartyItems, storeItems, tagItems, presetItems]) => {
      setPartners(partnerItems);
      setCounterparties(counterpartyItems);
      setStores(storeItems);
      setTags(tagItems);
      setPresets(presetItems);
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
      // После OCR неизвестная дата должна оставаться пустой, а не выглядеть
      // как успешно распознанная текущая дата.
      setInvoiceDate(response.fields.invoice_date.value ?? '');
      setInvoiceAmount(response.fields.amount.value ?? '');
      setPaymentAmount(response.fields.amount.value ?? '');
      setRecipient(response.fields.recipient.value ?? ''); setInn(response.fields.inn.value ?? ''); setKpp(response.fields.kpp.value ?? '');
      setOcrConfidence(Object.fromEntries(Object.entries(response.fields).map(([key, field]) => [key, field.confidence])));
      setOcrDocumentId(response.document_id);
      setServiceName(response.fields.service_name.value ?? '');
      setAiLogId(response.ai_fallback.log_id);
      setSources({partner:response.partner.source,counterparty:response.counterparty.source,service_name:response.fields.service_name.source ?? 'original',invoice_number:response.fields.invoice_number.source ?? 'original',invoice_date:response.fields.invoice_date.source ?? 'original',amount:response.fields.amount.source ?? 'original'});
      const counterparty = counterparties.find((item) => item.id === response.counterparty.id);
      if (counterparty?.partner_id) {
        setCounterpartyId(counterparty.id);
        setPartnerId(counterparty.partner_id);
      }
      if (response.partner.id) setPartnerId(response.partner.id);
      setMessage(response.ai_fallback.error ? `${response.ai_fallback.error}. Проверьте и заполните недостающие поля вручную.` : response.counterparty.matched ? `Найден контрагент: ${response.counterparty.name}, ИНН ${response.fields.inn.value}` : `Контрагент не сопоставлен${response.counterparty.suggestion ? ` (предложение: ${response.counterparty.suggestion})` : ''}. Выберите запись вручную; автоматически она не создаётся.`);
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
    setBusy(true);
    setMessage('Сохраняем расход…');
    try {
      const selectedCounterpartyId = counterpartyId;
      const expense = await api<{ id: string }>('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          partner_id: partnerId, counterparty_id: selectedCounterpartyId, service_name: serviceName,
          expense_month: month, expense_year: year,
          allocations: allocations.filter((item) => item.store_id).map((item) => ({ ...item, amount: item.amount || '0' })),
          tag_ids: tagIds,
          ai_log_id: aiLogId,
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
        if (hasPayment && paymentAmount) {
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

  const sourceBadge = (field: string) => ocrReviewed && <small className={`source-badge source-badge--${sources[field] ?? 'manual'}`}>{sources[field] === 'ai' ? 'ИИ' : sources[field] === 'original' ? 'Распознано' : 'Вручную'}</small>;

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
        <label>Партнер {sourceBadge('partner')}<select required value={partnerId} onChange={(event) => { setPartnerId(event.target.value); setCounterpartyId(''); setSources((x)=>({...x,partner:'manual',counterparty:'manual'})); }}><option value="">Выберите партнера</option>{partners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button type="button" className="link" onClick={createPartner}>+ Новый партнер</button>
        <label>Контрагент {sourceBadge('counterparty')}<select required value={counterpartyId} onChange={(event) => {setCounterpartyId(event.target.value);setSources((x)=>({...x,counterparty:'manual'}));}}><option value="">Выберите контрагента</option>{availableCounterparties.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label>
        <button type="button" className="link" onClick={createCounterparty}>+ Новый контрагент</button>
        <label>Услуга / товар {sourceBadge('service_name')}<input required value={serviceName} onChange={(event) => {setServiceName(event.target.value);setSources((x)=>({...x,service_name:'manual'}));}} placeholder="Например, наружная реклама" /></label>
        <div className="row"><label>Месяц<input required type="number" min="1" max="12" value={month} onChange={(event) => setMonth(Number(event.target.value))} /></label><label>Год<input required type="number" min="2000" max="2200" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label></div>
        <fieldset><legend>Счет и оплата</legend>
          <div className="row"><label>Номер счета {sourceBadge('invoice_number')}<input required value={invoiceNumber} onChange={(event) => {setInvoiceNumber(event.target.value);setSources((x)=>({...x,invoice_number:'manual'}));}} />{ocrReviewed && ocrConfidence.invoice_number < .7 && <small>⚠ Проверьте значение</small>}</label><label>Дата счета {sourceBadge('invoice_date')}<input required type="date" value={invoiceDate} onChange={(event) => {setInvoiceDate(event.target.value);setSources((x)=>({...x,invoice_date:'manual'}));}} />{ocrReviewed && ocrConfidence.invoice_date < .7 && <small>⚠ Проверьте значение</small>}</label></div>
          <label>Сумма счета {sourceBadge('amount')}<input required type="number" min="0.01" step="0.01" value={invoiceAmount} onChange={(event) => {setInvoiceAmount(event.target.value);setSources((x)=>({...x,amount:'manual'}));}} />{ocrReviewed && ocrConfidence.amount < .7 && <small>⚠ Проверьте значение</small>}</label>
          <label className="switch-field"><input type="checkbox" checked={hasPayment} onChange={(event) => { const checked = event.target.checked; setHasPayment(checked); if (checked && !paymentAmount) setPaymentAmount(invoiceAmount); }} /><span>Оплата по счету</span></label>
          {hasPayment && <label>Сумма платежа<input type="number" min="0" step="0.01" max={invoiceAmount || undefined} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>}
        </fieldset>
        <fieldset><legend>Распределение по магазинам</legend>
          <StorePresetLinks presets={presets} onSelect={(ids) => setAllocations(ids.map((store_id) => ({ store_id, amount: '0' })))} disabled={busy}/>{!!stores.length && <button type="button" className="link select-all-stores" onClick={toggleAllStores}>{allocations.length === stores.length ? 'Снять выбор' : 'Выбрать все'}</button>}
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
