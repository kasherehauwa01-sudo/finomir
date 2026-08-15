import { describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  it('передает точный текст в буфер обмена', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyText('/var/www/html/vr/update_finomir.sh', { writeText });

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith('/var/www/html/vr/update_finomir.sh');
  });

  it('сообщает, если буфер обмена недоступен', async () => {
    await expect(copyText('text', null)).rejects.toThrow(
      'Буфер обмена недоступен',
    );
  });
});
