declare const __BASE_PATH__: string;

const base = __BASE_PATH__.replace(/\/$/, '');

function errorMessage(status: number, body: unknown): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (typeof detail === 'object' && detail !== null && 'message' in detail) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  if (status === 413) return 'Фотография слишком большая. Максимальный размер файла — 20 МБ.';
  if ([502, 503, 504].includes(status)) return 'Сервис распознавания временно недоступен. Попробуйте еще раз через несколько минут.';
  return `Не удалось выполнить операцию (ошибка ${status})`;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
  });
  const text = response.status === 204 ? '' : await response.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = null; }
  }
  if (!response.ok) throw new Error(errorMessage(response.status, body));
  return response.status === 204 ? undefined as T : body as T;
}

export { base };
