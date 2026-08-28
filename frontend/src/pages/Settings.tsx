import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { AISettings } from '../types';
import { copyText } from '../utils/clipboard';

const UPDATE_SCRIPT_PATH = '/var/www/html/vr/update_finomir.sh';
type Tab = 'system' | 'ai';

export function Settings() {
  const [tab,setTab]=useState<Tab>('system'); const [settings,setSettings]=useState<AISettings|null>(null);
  const [enabled,setEnabled]=useState(false); const [model,setModel]=useState('gpt-4.1-mini'); const [apiKey,setApiKey]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false); const timer=useRef<number | undefined>(undefined);
  useEffect(()=>{api<AISettings>('/settings/ai').then((x)=>{setSettings(x);setEnabled(x.enabled);setModel(x.model);}).catch((e:Error)=>setMessage(e.message));return()=>window.clearTimeout(timer.current);},[]);
  async function save(event:FormEvent){event.preventDefault();setBusy(true);setMessage('');try{const x=await api<AISettings>('/settings/ai',{method:'PUT',body:JSON.stringify({enabled,model,api_key:apiKey||null})});setSettings(x);setApiKey('');setMessage('Настройки сохранены');}catch(e){setMessage(e instanceof Error?e.message:'Не удалось сохранить настройки');}finally{setBusy(false);}}
  async function test(){setBusy(true);setMessage('');try{const x=await api<{message:string}>('/settings/ai/test',{method:'POST'});setMessage(x.message);const current=await api<AISettings>('/settings/ai');setSettings(current);}catch(e){setMessage(e instanceof Error?e.message:'Ошибка подключения');}finally{setBusy(false);}}
  async function copyPath(){await copyText(UPDATE_SCRIPT_PATH);setCopied(true);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setCopied(false),2500);}
  return <><div className="page-head"><div><h1>Настройки</h1><p>Системные параметры и интеграции</p></div></div>
    <div className="settings-tabs"><button className={tab==='system'?'active':''} onClick={()=>setTab('system')}>Система</button><button className={tab==='ai'?'active':''} onClick={()=>setTab('ai')}>API ИИ</button></div>
    {tab==='system'?<section className="settings-card"><div className="settings-card__icon">↑</div><div className="settings-card__content"><h2>Обновление сервиса</h2><p>Путь к сценарию обновления на сервере</p><button className="copy-field" onClick={copyPath}><code>{UPDATE_SCRIPT_PATH}</code><span>{copied?'✓':'⧉'}</span></button>{copied&&<p className="copy-feedback copy-feedback--copied">Путь скопирован</p>}</div></section>:
    <form className="settings-card ai-settings" onSubmit={save}><div className="settings-card__icon">AI</div><div className="settings-card__content"><h2>Распознавание через OpenAI</h2><p>ИИ вызывается только как резервный механизм, когда основной OCR не заполнил 6 обязательных полей.</p>
      <label className="switch-field"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/><span>Использовать ИИ для распознавания счетов</span></label>
      <label>API-ключ OpenAI<input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={settings?.api_key_saved?'API-ключ сохранен':'sk-…'}/></label>
      <small>Ключ шифруется на backend и никогда не возвращается браузеру.</small>
      <label>Модель<input value={model} onChange={e=>setModel(e.target.value)} required/></label>
      <div className="ai-status"><b>ИИ: {enabled?'включен':'выключен'}</b><span>API: {settings?.connection_status==='connected'?'подключен':settings?.connection_status==='error'?'ошибка':'не проверен'}</span></div>
      {settings?.connection_error&&<div className="notice error-notice">{settings.connection_error}</div>}{message&&<div className="notice">{message}</div>}
      <div className="modal-actions"><button type="button" disabled={busy||!settings?.api_key_saved} onClick={test}>Проверить подключение</button><button className="primary" disabled={busy}>Сохранить</button></div>
    </div></form>}
  </>;
}
