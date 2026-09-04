import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { api } from '../api/client';

const encode = (value: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const decode = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((value.length + 3) % 4)), (char) => char.charCodeAt(0));
export const supportsBiometrics = () => Boolean(window.PublicKeyCredential && navigator.credentials);

function registrationCredential(value: PublicKeyCredential) {
  const response = value.response as AuthenticatorAttestationResponse;
  return { id: value.id, rawId: encode(value.rawId), type: value.type, response: { clientDataJSON: encode(response.clientDataJSON), attestationObject: encode(response.attestationObject), transports: response.getTransports?.() ?? [] } };
}

function authenticationCredential(value: PublicKeyCredential) {
  const response = value.response as AuthenticatorAssertionResponse;
  return { id: value.id, rawId: encode(value.rawId), type: value.type, response: { clientDataJSON: encode(response.clientDataJSON), authenticatorData: encode(response.authenticatorData), signature: encode(response.signature), userHandle: response.userHandle ? encode(response.userHandle) : null } };
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean>();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { api<{ authenticated: boolean; biometric_available: boolean }>('/auth/status').then((result) => { setAuthenticated(result.authenticated); setBiometricAvailable(result.biometric_available); }).catch(() => setAuthenticated(false)); }, []);

  async function login(event: FormEvent) {
    event.preventDefault(); setMessage('');
    try { await api('/auth/pin', { method: 'POST', body: JSON.stringify({ pin }) }); setAuthenticated(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось войти'); }
  }

  async function biometricLogin() {
    try {
      setMessage('Подтвердите вход на устройстве…');
      const options = await api<PublicKeyCredentialRequestOptionsJSON>('/auth/biometric/options', { method: 'POST' });
      const credential = await navigator.credentials.get({ publicKey: { ...options, challenge: decode(options.challenge), allowCredentials: options.allowCredentials?.map((item) => ({ ...item, id: decode(item.id) })) } as PublicKeyCredentialRequestOptions }) as PublicKeyCredential;
      await api('/auth/biometric/verify', { method: 'POST', body: JSON.stringify({ credential: authenticationCredential(credential) }) });
      setAuthenticated(true); setMessage('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Вход по отпечатку отменен'); }
  }

  async function registerBiometrics() {
    try {
      const options = await api<PublicKeyCredentialCreationOptionsJSON>('/auth/biometric/register/options', { method: 'POST' });
      const credential = await navigator.credentials.create({ publicKey: { ...options, challenge: decode(options.challenge), user: { ...options.user, id: decode(options.user.id) }, excludeCredentials: options.excludeCredentials?.map((item) => ({ ...item, id: decode(item.id) })) } as PublicKeyCredentialCreationOptions }) as PublicKeyCredential;
      await api('/auth/biometric/register/verify', { method: 'POST', body: JSON.stringify({ credential: registrationCredential(credential) }) });
      setBiometricAvailable(true); setMessage('Вход по отпечатку настроен.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось настроить отпечаток'); }
  }

  if (authenticated === undefined) return <div className="auth-screen"><p>Проверяем доступ…</p></div>;
  if (!authenticated) return <main className="auth-screen"><form className="auth-card" onSubmit={login}><div className="auth-logo">₽</div><h1>Вход в Финомир</h1><p>Введите PIN-код для доступа к данным.</p><label>PIN-код<input required autoFocus inputMode="numeric" type="password" autoComplete="current-password" value={pin} onChange={(event) => setPin(event.target.value)} /></label>{message && <div className="error">{message}</div>}<button className="primary">Войти</button>{biometricAvailable && supportsBiometrics() && <button type="button" className="biometric-button" onClick={biometricLogin}>☝ Войти по отпечатку</button>}</form></main>;
  return <>{children}{supportsBiometrics() && !biometricAvailable && <button type="button" className="biometric-setup" onClick={registerBiometrics}>☝ Настроить вход по отпечатку</button>}{message && <div className="auth-toast">{message}</div>}</>;
}
