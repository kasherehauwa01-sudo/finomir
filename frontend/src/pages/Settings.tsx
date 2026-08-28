import { useEffect, useRef, useState } from 'react';
import { copyText } from '../utils/clipboard';

const UPDATE_SCRIPT_PATH = '/var/www/html/vr/update_finomir.sh';
type CopyStatus = 'idle' | 'copied' | 'error';

export function Settings() {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

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

  return <>
    <div className="page-head"><div><h1>Настройки</h1><p>Системные параметры и команды обслуживания</p></div></div>
    <section className="settings-card" aria-labelledby="update-title">
      <div className="settings-card__icon" aria-hidden="true">↑</div>
      <div className="settings-card__content">
        <h2 id="update-title">Обновление сервиса</h2>
        <p>Путь к сценарию обновления на сервере</p>
        <button type="button" className="copy-field" onClick={handleCopy} aria-describedby="copy-feedback"><code>{UPDATE_SCRIPT_PATH}</code><span aria-hidden="true">{status === 'copied' ? '✓' : '⧉'}</span></button>
        <p id="copy-feedback" className={`copy-feedback copy-feedback--${status}`} role="status" aria-live="polite">{status === 'copied' ? 'Путь скопирован в буфер обмена' : status === 'error' ? 'Не удалось скопировать. Скопируйте путь вручную.' : 'Нажмите на путь, чтобы скопировать его'}</p>
      </div>
    </section>
  </>;
}
