import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { api } from '../api/client';

export function AuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean>();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { api<{ authenticated: boolean }>('/auth/status').then((result) => setAuthenticated(result.authenticated)).catch(() => setAuthenticated(false)); }, []);

  async function login(event: FormEvent) {
    event.preventDefault(); setMessage('');
    try { await api('/auth/pin', { method: 'POST', body: JSON.stringify({ pin }) }); setAuthenticated(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось войти'); }
  }

  if (authenticated === undefined) return <div className="auth-screen"><p>Проверяем доступ…</p></div>;
  if (!authenticated) return <main className="auth-screen"><form className="auth-card" onSubmit={login}><div className="auth-logo">₽</div><h1>Вход в Финомир</h1><p>Введите PIN-код для доступа к данным.</p><label>PIN-код<input required autoFocus inputMode="numeric" type="password" autoComplete="current-password" value={pin} onChange={(event) => setPin(event.target.value)} /></label>{message && <div className="error">{message}</div>}<button className="primary">Войти</button></form></main>;
  return <>{children}</>;
}
