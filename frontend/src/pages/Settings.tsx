import { useEffect, useRef, useState } from 'react';
import { copyText } from '../utils/clipboard';
import { api } from '../api/client';
import type { ExpenseImportResult } from '../types';

const UPDATE_SCRIPT_PATH = '/var/www/html/vr/update_finomir.sh';

type CopyStatus = 'idle' | 'copied' | 'error';
type SMTPData = { host?:string;port?:number;security?:string;username?:string|null;from_email?:string;from_name?:string|null;password_set:boolean;status:string;last_error?:string|null };
type Scenario = { id:string;name:string;enabled:boolean;subject_template?:string;body_template?:string;recipients?:string[];variables?:string[] };
type Notification = { id:string;created_at:string;recipients:string[];subject:string;body:string;status:string;notification_type:string;original_filename?:string|null;attachment_present:boolean };

export function Settings() {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const resetTimer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ExpenseImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [tab,setTab]=useState<'service'|'smtp'|'scenarios'>('service');
  const [smtp,setSmtp]=useState<SMTPData>({password_set:false,status:'not_configured'}); const [smtpPassword,setSmtpPassword]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); const [testOpen,setTestOpen]=useState(false); const [testEmail,setTestEmail]=useState(''); const [history,setHistory]=useState<Notification[]|null>(null);
  const [scenarios,setScenarios]=useState<Scenario[]>([]); const [scenario,setScenario]=useState<Scenario>(); const [recipient,setRecipient]=useState('');

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);
  useEffect(()=>{if(tab==='smtp')api<SMTPData>('/settings/smtp').then(setSmtp).catch((e:Error)=>setMessage(e.message));if(tab==='scenarios')api<Scenario[]>('/settings/scenarios').then(setScenarios).catch((e:Error)=>setMessage(e.message));},[tab]);
  async function saveSmtp(){setBusy(true);setMessage('');try{setSmtp(await api<SMTPData>('/settings/smtp',{method:'PUT',body:JSON.stringify({...smtp,password:smtpPassword||null})}));setSmtpPassword('');setMessage('SMTP-настройки сохранены');}catch(e){setMessage(e instanceof Error?e.message:'Ошибка сохранения');}finally{setBusy(false)}}
  async function sendTest(){setBusy(true);try{const result=await api<{message:string}>('/settings/smtp/test',{method:'POST',body:JSON.stringify({recipient:testEmail})});setMessage(result.message);setTestOpen(false);}catch(e){setMessage(e instanceof Error?e.message:'Не удалось отправить тестовое письмо');}finally{setBusy(false)}}
  async function openScenario(id:string){setScenario(await api<Scenario>(`/settings/scenarios/${id}`));}
  async function saveScenario(){if(!scenario)return;setBusy(true);try{await api(`/settings/scenarios/${scenario.id}`,{method:'PUT',body:JSON.stringify({enabled:scenario.enabled,subject_template:scenario.subject_template,body_template:scenario.body_template,recipients:scenario.recipients??[]})});setMessage('Сценарий сохранен');setScenario(undefined);setScenarios(await api<Scenario[]>('/settings/scenarios'));}catch(e){setMessage(e instanceof Error?e.message:'Ошибка сохранения');}finally{setBusy(false)}}

  async function handleCopy() {
    window.clearTimeout(resetTimer.current);

    try {
      await copyText(UPDATE_SCRIPT_PATH);
      setStatus('copied');
    } catch {
      setStatus('error');
    }

    resetTimer.current = window.setTimeout(() => setStatus('idle'), 2500);
  }

  async function handleImport(file?: File) {
    if (!file) return;
    setImporting(true); setImportResult(null); setImportError('');
    const data = new FormData(); data.append('file', file);
    try {
      setImportResult(await api<ExpenseImportResult>('/expenses/import-xlsx', { method: 'POST', body: data }));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Не удалось загрузить файл');
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const feedback =
    status === 'copied'
      ? 'Путь скопирован в буфер обмена'
      : status === 'error'
        ? 'Не удалось скопировать. Скопируйте путь вручную.'
        : 'Нажмите на путь, чтобы скопировать его';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Настройки</h1>
          <p>Системные параметры и команды обслуживания</p>
        </div>
      </div>
      <div className="settings-tabs"><button className={tab==='service'?'active-button':''} onClick={()=>setTab('service')}>Общие</button><button className={tab==='smtp'?'active-button':''} onClick={()=>setTab('smtp')}>SMTP</button><button className={tab==='scenarios'?'active-button':''} onClick={()=>setTab('scenarios')}>Сценарии</button></div>
      {message&&<p className="notice" role="status">{message}</p>}

      {tab==='service'&&<>
      <section className="settings-card" aria-labelledby="update-title">
        <div className="settings-card__icon" aria-hidden="true">↑</div>
        <div className="settings-card__content">
          <h2 id="update-title">Обновление сервиса</h2>
          <p>Путь к сценарию обновления на сервере</p>
          <button
            type="button"
            className="copy-field"
            onClick={handleCopy}
            aria-describedby="copy-feedback"
          >
            <code>{UPDATE_SCRIPT_PATH}</code>
            <span aria-hidden="true">{status === 'copied' ? '✓' : '⧉'}</span>
          </button>
          <p
            id="copy-feedback"
            className={`copy-feedback copy-feedback--${status}`}
            role="status"
            aria-live="polite"
          >
            {feedback}
          </p>
        </div>
      </section>
      <section className="settings-card" aria-labelledby="import-title">
        <div className="settings-card__icon" aria-hidden="true">⇧</div>
        <div className="settings-card__content">
          <h2 id="import-title">Загрузка расходов из XLSX / XLS</h2>
          <p>Каждая заполненная строка файла будет добавлена как отдельный расход.</p>
          <input ref={fileInput} className="visually-hidden" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => void handleImport(event.target.files?.[0])} />
          <button type="button" className="primary" disabled={importing} onClick={() => fileInput.current?.click()}>{importing ? 'Загрузка…' : 'Выбрать Excel-файл'}</button>
          {importError && <p className="import-result import-result--error" role="alert">{importError}</p>}
          {importResult && <div className="import-result" role="status">
            <strong>Загрузка завершена</strong>
            <p>Загружено строк: {importResult.loaded}. Ошибок: {importResult.errors_count}.</p>
            {importResult.errors.length > 0 && <details><summary>Лог ошибок</summary><ul>{importResult.errors.map((error) => <li key={`${error.row}-${error.message}`}>Строка {error.row}: {error.message}</li>)}</ul></details>}
          </div>}
        </div>
      </section>
      </>}
      {tab==='smtp'&&<section className="settings-card email-settings"><div className="settings-card__content"><h2>SMTP</h2><p>Статус: <b>{smtp.status==='not_configured'?'Не настроено':smtp.status==='error'?'Ошибка подключения':'Настроено'}</b>{smtp.last_error&&` — ${smtp.last_error}`}</p><div className="settings-form"><label>SMTP сервер<input value={smtp.host??''} onChange={e=>setSmtp({...smtp,host:e.target.value})}/></label><label>Порт<input type="number" value={smtp.port??465} onChange={e=>setSmtp({...smtp,port:Number(e.target.value)})}/></label><label>Тип защиты<select value={smtp.security??'ssl'} onChange={e=>setSmtp({...smtp,security:e.target.value})}><option value="ssl">SSL/TLS</option><option value="starttls">STARTTLS</option><option value="none">Без шифрования</option></select></label><label>Логин<input value={smtp.username??''} onChange={e=>setSmtp({...smtp,username:e.target.value})}/></label><label>Пароль<input type="password" placeholder={smtp.password_set?'Пароль сохранен':'Введите пароль'} value={smtpPassword} onChange={e=>setSmtpPassword(e.target.value)}/></label><label>Email отправителя<input type="email" value={smtp.from_email??''} onChange={e=>setSmtp({...smtp,from_email:e.target.value})}/></label><label>Имя отправителя<input value={smtp.from_name??''} onChange={e=>setSmtp({...smtp,from_name:e.target.value})}/></label></div><div className="settings-actions"><button className="primary" disabled={busy} onClick={()=>void saveSmtp()}>Сохранить</button><button disabled={busy||smtp.status==='not_configured'} onClick={()=>setTestOpen(true)}>Тест</button><button onClick={()=>api<Notification[]>('/notifications').then(setHistory)}>История уведомлений</button></div></div></section>}
      {tab==='scenarios'&&<section className="settings-card email-settings"><div className="settings-card__content"><h2>Сценарии</h2>{scenarios.map(item=><button className="scenario-row" key={item.id} onClick={()=>void openScenario(item.id)}><span><b>{item.name}</b><small>{item.enabled?'Включен':'Выключен'}</small></span><span>Настроить →</span></button>)}</div></section>}
      {testOpen&&<div className="overlay"><section className="modal editor-modal"><h2>Тест SMTP</h2><label>Email получателя<input type="email" required value={testEmail} onChange={e=>setTestEmail(e.target.value)}/></label><div className="modal-actions"><button onClick={()=>setTestOpen(false)}>Отмена</button><button className="primary" disabled={busy||!testEmail} onClick={()=>void sendTest()}>Отправить</button></div></section></div>}
      {history&&<div className="overlay"><section className="modal notification-history"><button className="close" onClick={()=>setHistory(null)}>×</button><h2>История уведомлений</h2>{!history.length?<p>История пуста.</p>:<div className="table-wrap"><table><thead><tr><th>Дата и время</th><th>Адресат</th><th>Тип</th><th>Тема</th><th>Текст</th><th>Статус</th></tr></thead><tbody>{history.map(item=><tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.recipients.join(', ')}</td><td>{item.notification_type}</td><td>{item.subject}</td><td>{item.body}</td><td>{item.status==='sent'?'Отправлено':<button className="danger" onClick={()=>api<{error:string}>(`/notifications/${item.id}`).then(x=>window.alert(x.error))}>Ошибка — показать</button>}</td></tr>)}</tbody></table></div>}</section></div>}
      {scenario&&<div className="overlay"><section className="modal scenario-editor"><button className="close" onClick={()=>setScenario(undefined)}>×</button><h2>{scenario.name}</h2><label className="switch-field"><input type="checkbox" checked={scenario.enabled} onChange={e=>setScenario({...scenario,enabled:e.target.checked})}/> Включен</label><label>Тема<input value={scenario.subject_template??''} onChange={e=>setScenario({...scenario,subject_template:e.target.value})}/></label><label>Текст<textarea rows={9} value={scenario.body_template??''} onChange={e=>setScenario({...scenario,body_template:e.target.value})}/></label><fieldset><legend>Адресаты</legend><div className="recipient-add"><input type="email" value={recipient} onChange={e=>setRecipient(e.target.value)}/><button onClick={()=>{if(recipient){setScenario({...scenario,recipients:[...(scenario.recipients??[]),recipient]});setRecipient('')}}}>Добавить</button></div>{(scenario.recipients??[]).map((email,index)=><div className="recipient-row" key={`${email}-${index}`}><span>{email}</span><button onClick={()=>setScenario({...scenario,recipients:scenario.recipients?.filter((_,i)=>i!==index)})}>×</button></div>)}</fieldset><p>Переменные: {(scenario.variables??[]).map(x=>`{{${x}}}`).join(', ')}</p><div className="modal-actions"><button onClick={()=>setScenario(undefined)}>Отмена</button><button className="primary" disabled={busy} onClick={()=>void saveScenario()}>Сохранить</button></div></section></div>}
    </>
  );
}
