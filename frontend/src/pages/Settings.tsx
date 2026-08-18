import { useEffect, useRef, useState } from 'react';
import { copyText } from '../utils/clipboard';
import { api } from '../api/client';
import type { ExpenseImportResult } from '../types';

const UPDATE_SCRIPT_PATH = '/var/www/html/vr/update_finomir.sh';

type CopyStatus = 'idle' | 'copied' | 'error';

export function Settings() {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const resetTimer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ExpenseImportResult | null>(null);
  const [importError, setImportError] = useState('');

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
          <h2 id="import-title">Загрузка расходов из XLSX</h2>
          <p>Каждая заполненная строка файла будет добавлена как отдельный расход.</p>
          <input ref={fileInput} className="visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void handleImport(event.target.files?.[0])} />
          <button type="button" className="primary" disabled={importing} onClick={() => fileInput.current?.click()}>{importing ? 'Загрузка…' : 'Выбрать XLSX-файл'}</button>
          {importError && <p className="import-result import-result--error" role="alert">{importError}</p>}
          {importResult && <div className="import-result" role="status">
            <strong>Загрузка завершена</strong>
            <p>Загружено строк: {importResult.loaded}. Ошибок: {importResult.errors_count}.</p>
            {importResult.errors.length > 0 && <details><summary>Лог ошибок</summary><ul>{importResult.errors.map((error) => <li key={`${error.row}-${error.message}`}>Строка {error.row}: {error.message}</li>)}</ul></details>}
          </div>}
        </div>
      </section>
    </>
  );
}
