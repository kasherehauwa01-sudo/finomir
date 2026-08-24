import { describe, expect, it } from 'vitest';
import { smtpPayload } from './Settings';

describe('сохранение SMTP', () => {
  it('отправляет обязательные значения по умолчанию и не передает служебные поля', () => {
    expect(smtpPayload({
      host: ' smtp.example.ru ', port: 465, security: 'ssl', username: ' user ',
      from_email: ' mail@example.ru ', from_name: ' Finomir ', password_set: false,
      status: 'not_configured', last_error: null,
    }, 'secret')).toEqual({
      host: 'smtp.example.ru', port: 465, security: 'ssl', username: 'user',
      password: 'secret', from_email: 'mail@example.ru', from_name: 'Finomir',
    });
  });
});
