import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Partner } from '../types';

const directories = { partners:{title:'Партнеры',icon:'◎',endpoint:'/partners'},counterparties:{title:'Контрагенты',icon:'▣',endpoint:'/counterparties'},stores:{title:'Магазины',icon:'⌂',endpoint:'/stores'},tags:{title:'Теги',icon:'#',endpoint:'/tags'} } as const;
type DirectoryKey=keyof typeof directories;
type Item={id:string;name?:string;full_name?:string;partner_id?:string;entity_type?:string;inn?:string;kpp?:string;address?:string;comment?:string;is_system?:boolean};

export function Directories(){
 const {directory}=useParams<{directory?:string}>(); const selected=directory&&directory in directories?directory as DirectoryKey:undefined;
 const [items,setItems]=useState<Item[]>([]); const [partners,setPartners]=useState<Partner[]>([]); const [editing,setEditing]=useState<Item|null>(); const [error,setError]=useState('');
 const load=()=>selected&&api<Item[]>(directories[selected].endpoint).then(setItems).catch((e:Error)=>setError(e.message));
 useEffect(()=>{load();api<Partner[]>('/partners').then(setPartners);},[selected]);
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!selected||!editing)return;const form=new FormData(event.currentTarget);let body:Record<string,unknown>={};
  if(selected==='partners')body={name:form.get('name'),comment:form.get('comment')||null};
  if(selected==='stores')body={name:form.get('name'),address:form.get('address')||null,comment:form.get('comment')||null};
  if(selected==='tags')body={name:form.get('name')};
  if(selected==='counterparties')body={full_name:form.get('name'),partner_id:form.get('partner_id'),entity_type:editing.entity_type||'company',inn:form.get('inn')||null,kpp:form.get('kpp')||null,comment:form.get('comment')||null};
  await api(`${directories[selected].endpoint}${editing.id?`/${editing.id}`:''}`,{method:editing.id?'PUT':'POST',body:JSON.stringify(body)});setEditing(null);load();}
 async function remove(item:Item){if(!selected||!window.confirm(`Удалить «${item.name??item.full_name}»?`))return;try{await api(`${directories[selected].endpoint}/${item.id}`,{method:'DELETE'});load();}catch(e){setError(e instanceof Error?e.message:'Не удалось удалить запись');}}
 if(selected){const meta=directories[selected];return <><Link className="back-link" to="/directories">← Все справочники</Link><div className="page-head"><div><h1>{meta.title}</h1><p>Добавление, изменение и удаление записей</p></div><button className="primary" onClick={()=>setEditing({id:'',entity_type:'company'})}>+ Добавить</button></div>{error&&<div className="notice">{error}</div>}<div className="directory-list">{items.map(item=><article key={item.id}><div>{selected==='partners'||selected==='counterparties'?<Link className="directory-open" to={`/directories/${selected}/${item.id}`}><b>{item.name??item.full_name}</b></Link>:<b>{item.name??item.full_name}</b>}{item.inn&&<span>ИНН {item.inn}</span>}{item.address&&<span>{item.address}</span>}</div><div className="item-actions"><button onClick={()=>setEditing(item)}>Изменить</button><button className="danger" disabled={item.is_system} onClick={()=>remove(item)}>Удалить</button></div></article>)}</div>{editing&&<div className="overlay"><form className="modal directory-form" onSubmit={save}><h2>{editing.id?'Изменить':'Добавить'} запись</h2><label>Название<input name="name" required defaultValue={editing.name??editing.full_name??''}/></label>{selected==='counterparties'&&<><label>Партнер<select name="partner_id" required defaultValue={editing.partner_id??''}><option value="">Выберите партнера</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>ИНН<input name="inn" defaultValue={editing.inn??''}/></label><label>КПП<input name="kpp" defaultValue={editing.kpp??''}/></label></>}{selected==='stores'&&<label>Адрес<input name="address" defaultValue={editing.address??''}/></label>}{selected!=='tags'&&<label>Комментарий<textarea name="comment" defaultValue={editing.comment??''}/></label>}<div className="modal-actions"><button type="button" onClick={()=>setEditing(null)}>Отмена</button><button className="primary">Сохранить</button></div></form></div>}</>}
 return <><div className="page-head"><div><h1>Справочники</h1><p>Партнеры, контрагенты, магазины и теги</p></div></div><div className="directory-grid">{Object.entries(directories).map(([key,meta])=><article key={key}><span>{meta.icon}</span><h2>{meta.title}</h2><p>Создание, поиск, редактирование и удаление</p><Link className="directory-open" to={`/directories/${key}`}>Открыть →</Link></article>)}</div></>;
}
