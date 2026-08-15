import { useMemo, useState } from 'react';
import { ExpenseModal } from '../components/ExpenseModal';
import { useExpenses } from '../hooks/useExpenses';
import { money } from '../utils/format';
import { useNavigate } from 'react-router-dom';

const columns = [
  ['period', 'Период'], ['partner', 'Партнер'], ['counterparty', 'Контрагент'],
  ['stores', 'Магазины'], ['tags', 'Тег'], ['service_name', 'Услуга'], ['invoice_total', 'Сумма счетов'],
  ['paid_total', 'Оплачено'], ['remaining_total', 'Остаток'],
] as const;
type Column = typeof columns[number][0];

export function Expenses() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [period, setPeriod] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [visible, setVisible] = useState<Column[]>(columns.map(([key]) => key));
  const [revision, setRevision] = useState(0);
  const { data, error, loading } = useExpenses(search, page, revision);
  const items = useMemo(() => (data?.items ?? []).filter((item) => {
    const periodMatches = !period || item.period === period;
    const remaining = Number(item.remaining_total);
    const statusMatches = paymentStatus === 'all'
      || (paymentStatus === 'paid' && remaining === 0)
      || (paymentStatus === 'unpaid' && remaining > 0);
    return periodMatches && statusMatches;
  }), [data, period, paymentStatus]);

  function renderCell(item: NonNullable<typeof data>['items'][number], column: Column) {
    const value = item[column];
    if (column === 'stores' || column === 'tags') return <div className="store-list">{item[column].map((value) => <span key={value}>{value}</span>)}</div>;
    return ['invoice_total', 'paid_total', 'remaining_total'].includes(column) ? money(value as string) : value;
  }

  return <>
    <div className="page-head"><div><h1>Расходы</h1><p>Единый реестр расходов отдела</p></div><button className="primary" onClick={() => setModal(true)}>+ Добавить расход</button></div>
    <div className="toolbar">
      <input placeholder="Поиск по партнеру, ИНН, счету…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      <button className={filtersOpen ? 'active-button' : ''} onClick={() => { setFiltersOpen((value) => !value); setColumnsOpen(false); }}>Фильтры</button>
      <button className={columnsOpen ? 'active-button' : ''} onClick={() => { setColumnsOpen((value) => !value); setFiltersOpen(false); }}>Настроить колонки</button>
    </div>
    {filtersOpen && <section className="toolbar-panel">
      <label>Период<input type="text" inputMode="numeric" placeholder="ММ.ГГГГ" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
      <label>Статус оплаты<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="all">Все</option><option value="paid">Оплачено</option><option value="unpaid">Есть остаток</option></select></label>
      <button type="button" className="link" onClick={() => { setPeriod(''); setPaymentStatus('all'); }}>Сбросить фильтры</button>
    </section>}
    {columnsOpen && <section className="toolbar-panel columns-panel">
      {columns.map(([key, label]) => <label key={key}><input type="checkbox" checked={visible.includes(key)} disabled={visible.length === 1 && visible.includes(key)} onChange={() => setVisible((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />{label}</label>)}
    </section>}
    {loading ? <div className="state">Загружаем расходы…</div> : error ? <div className="state error">Нет соединения с сервером. {error}</div> : !items.length ? <section className="empty"><h2>{search || period || paymentStatus !== 'all' ? 'Ничего не найдено' : 'Расходов пока нет'}</h2><p>{search || period || paymentStatus !== 'all' ? 'Измените запрос или сбросьте фильтры.' : 'Добавьте первый расход или загрузите счет.'}</p></section> : <div className="table-wrap"><table><thead><tr>{columns.filter(([key]) => visible.includes(key)).map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr className="clickable-row" tabIndex={0} key={item.id} onClick={() => navigate(`/expenses/${item.id}`)} onKeyDown={(event) => event.key === 'Enter' && navigate(`/expenses/${item.id}`)}>{columns.filter(([key]) => visible.includes(key)).map(([key]) => <td key={key}>{renderCell(item, key)}</td>)}</tr>)}</tbody></table></div>}
    {data && data.total > data.page_size && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Назад</button><span>Страница {page}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage((value) => value + 1)}>Далее</button></div>}
    {modal && <ExpenseModal close={() => setModal(false)} onSaved={() => setRevision((value) => value + 1)} />}
  </>;
}
