import { useRef, useState } from 'react';
import { copyText } from '../utils/clipboard';

const UPDATE_SCRIPT_PATH = '/var/www/html/vr/update_finomir.sh';

export function Settings() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  async function copyPath() {
    await copyText(UPDATE_SCRIPT_PATH); setCopied(true); window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2500);
  }
  return <><div className="page-head"><div><h1>Настройки</h1><p>Системные параметры</p></div></div>
    <section className="settings-card"><div className="settings-card__icon">↑</div><div className="settings-card__content"><h2>Обновление сервиса</h2><p>Путь к сценарию обновления на сервере</p><button className="copy-field" onClick={copyPath}><code>{UPDATE_SCRIPT_PATH}</code><span>{copied ? '✓' : '⧉'}</span></button>{copied && <p className="copy-feedback copy-feedback--copied">Путь скопирован</p>}</div></section>
  </>;
}
