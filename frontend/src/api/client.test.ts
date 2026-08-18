import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';

describe('api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('объясняет HTML-ошибку nginx при слишком большой фотографии', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>413</html>', { status: 413, headers: { 'Content-Type': 'text/html' } })));

    await expect(api('/ocr/invoice')).rejects.toThrow('Максимальный размер файла — 20 МБ');
  });

  it('сохраняет пользовательское описание ошибки backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Разрешены только PDF, JPG/JPEG и PNG' }), { status: 422, headers: { 'Content-Type': 'application/json' } })));

    await expect(api('/ocr/invoice')).rejects.toThrow('Разрешены только PDF, JPG/JPEG и PNG');
  });

  it('не называет ошибку реестра расходов ошибкой распознавания', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>503</html>', { status: 503, headers: { 'Content-Type': 'text/html' } })));

    await expect(api('/expenses')).rejects.toThrow('Сервер временно недоступен');
    await expect(api('/expenses')).rejects.not.toThrow('распознавания');
  });

  it('сохраняет специальное сообщение для недоступного OCR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>503</html>', { status: 503, headers: { 'Content-Type': 'text/html' } })));

    await expect(api('/ocr/invoice')).rejects.toThrow('Сервис распознавания временно недоступен');
  });
});
