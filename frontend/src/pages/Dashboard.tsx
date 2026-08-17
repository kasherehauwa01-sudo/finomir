import { useEffect, useState } from 'react';
import { ExpenseModal } from '../components/ExpenseModal';
import { api } from '../api/client';
import type { DashboardSummary } from '../types';
import { money } from '../utils/format';

type Period = DashboardSummary['period'];
const labels: Record<Period, string> = { month: 'Месяц', quarter: 'Квартал', year: 'Год' };

export function Dashboard() {
  const [modal, setModal] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [summary, setSummary] = useState<DashboardSummary>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setError('');
    api<DashboardSummary>(`/dashboard?period=${period}`).then(setSummary).catch((reason: Error) => setError(reason.message));
  }, [period, revision]);

  return <><div className="page-head"><div><p className="eyebrow">{labels[period]}</p><h1>Дашборд</h1><p>Финансовая картина маркетингового отдела</p></div><button className="primary" onClick={() => setModal(true)}>+ Добавить расход</button></div><div className="period">{(Object.keys(labels) as Period[]).map((key) => <button key={key} className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>{labels[key]}</button>)}</div>{error ? <div className="state error">Не удалось загрузить данные. {error}</div> : !summary ? <div className="state">Загружаем данные…</div> : <><div className="kpis"><article><small>Сумма счетов</small><b>{money(summary.invoice_total)}</b></article><article><small>Оплачено</small><b>{money(summary.paid_total)}</b></article><article><small>Остаток</small><b>{money(summary.remaining_total)}</b></article><article><small>Расходов</small><b>{summary.expense_count}</b></article></div>{summary.expense_count === 0 && <section className="empty"><div>₽</div><h2>За выбранный период расходов нет</h2><p>Добавьте расход вручную или сфотографируйте счёт.</p></section>}</>}{modal && <ExpenseModal close={() => setModal(false)} onSaved={() => setRevision((value) => value + 1)} />}</>;
}
