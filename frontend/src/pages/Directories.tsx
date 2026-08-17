import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';

const directories = {
  partners: { title: 'Партнеры', icon: '◎', endpoint: '/partners' },
  counterparties: { title: 'Контрагенты', icon: '▣', endpoint: '/counterparties' },
  stores: { title: 'Магазины', icon: '⌂', endpoint: '/stores' },
  tags: { title: 'Теги', icon: '#', endpoint: '/tags' },
} as const;

type DirectoryKey = keyof typeof directories;
type DirectoryItem = { id: string; name?: string; full_name?: string; inn?: string; address?: string };

export function Directories() {
  const { directory } = useParams<{ directory?: string }>();
  const selected = directory && directory in directories ? directory as DirectoryKey : undefined;
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError('');
    api<DirectoryItem[]>(directories[selected].endpoint)
      .then(setItems).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, [selected]);

  if (selected) {
    const meta = directories[selected];
    return <>
      <Link className="back-link" to="/directories">← Все справочники</Link>
      <div className="page-head"><div><h1>{meta.title}</h1><p>Просмотр записей справочника</p></div></div>
      {loading ? <div className="state">Загружаем данные…</div> : error ? <div className="state error">{error}</div> : !items.length ? <section className="empty"><h2>Записей пока нет</h2><p>Добавить записи можно при создании расхода.</p></section> : <div className="directory-list">{items.map((item) => <article key={item.id}><b>{item.name ?? item.full_name}</b>{item.inn && <span>ИНН {item.inn}</span>}{item.address && <span>{item.address}</span>}</article>)}</div>}
    </>;
  }

  return <>
    <div className="page-head"><div><h1>Справочники</h1><p>Партнеры, контрагенты, магазины и теги</p></div></div>
    <div className="directory-grid">{Object.entries(directories).map(([key, meta]) => <article key={key}><span>{meta.icon}</span><h2>{meta.title}</h2><p>Создание, поиск, редактирование и архивирование</p><Link className="directory-open" to={`/directories/${key}`}>Открыть →</Link></article>)}</div>
  </>;
}
