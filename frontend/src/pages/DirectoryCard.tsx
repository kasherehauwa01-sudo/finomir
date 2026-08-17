import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Counterparty, Partner, PartnerDetail } from '../types';

export function DirectoryCard() {
  const { directory = '', itemId = '' } = useParams();
  const isPartner = directory === 'partners';
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partner, setPartner] = useState<PartnerDetail>();
  const [counterparty, setCounterparty] = useState<Counterparty>();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isPartner) api<PartnerDetail>(`/partners/${itemId}`).then(setPartner).catch((error: Error) => setMessage(error.message));
    else api<Counterparty>(`/counterparties/${itemId}`).then(setCounterparty).catch((error: Error) => setMessage(error.message));
    api<Partner[]>('/partners').then(setPartners);
  }, [isPartner, itemId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    if (isPartner && partner) {
      const updated = await api<Partner>(`/partners/${itemId}`, { method: 'PUT', body: JSON.stringify({ name: data.get('name'), comment: partner.comment ?? null }) });
      setPartner({ ...partner, ...updated });
    } else if (counterparty) {
      const updated = await api<Counterparty>(`/counterparties/${itemId}`, { method: 'PUT', body: JSON.stringify({ partner_id: data.get('partner_id') || null, full_name: data.get('full_name'), entity_type: counterparty.entity_type, inn: data.get('inn') || null, kpp: data.get('kpp') || null, comment: data.get('comment') || null }) });
      setCounterparty(updated);
    }
    setMessage('Изменения сохранены.');
  }

  if (isPartner && !partner) return <div className="state">{message || 'Загружаем карточку…'}</div>;
  if (!isPartner && !counterparty) return <div className="state">{message || 'Загружаем карточку…'}</div>;
  return <><Link className="back-link" to={`/directories/${directory}`}>← К справочнику</Link><div className="page-head"><div><h1>{isPartner ? 'Карточка партнера' : 'Карточка контрагента'}</h1><p>{message}</p></div></div><form className="directory-card" onSubmit={save}>{isPartner && partner ? <><label>Наименование<input name="name" required value={partner.name} onChange={(event) => setPartner({ ...partner, name: event.target.value })} /></label><section className="linked-counterparties"><h2>Все привязанные контрагенты</h2>{partner.counterparties.length ? partner.counterparties.map((item) => <Link key={item.id} to={`/directories/counterparties/${item.id}`}>{item.full_name}{item.inn ? ` · ИНН ${item.inn}` : ''}</Link>) : <p>Связанных контрагентов пока нет.</p>}</section></> : counterparty && <><label>Наименование<input name="full_name" required value={counterparty.full_name} onChange={(event) => setCounterparty({ ...counterparty, full_name: event.target.value })} /></label><div className="row"><label>ИНН<input name="inn" value={counterparty.inn ?? ''} onChange={(event) => setCounterparty({ ...counterparty, inn: event.target.value })} /></label><label>КПП<input name="kpp" value={counterparty.kpp ?? ''} onChange={(event) => setCounterparty({ ...counterparty, kpp: event.target.value })} /></label></div><label>Партнер<select name="partner_id" value={counterparty.partner_id??''} onChange={(event) => setCounterparty({ ...counterparty, partner_id: event.target.value||null })}><option value="">Без партнера</option>{partners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Комментарий<textarea name="comment" value={counterparty.comment ?? ''} onChange={(event) => setCounterparty({ ...counterparty, comment: event.target.value })} /></label></>}<button className="primary">Сохранить</button></form></>;
}
