import { describe, expect, it } from 'vitest';
import { notificationStatusLabel } from './NotificationStatus';

describe('статус уведомления', () => {
  it('переводит серверные статусы', () => {
    expect(notificationStatusLabel('sent')).toBe('Отправлено');
    expect(notificationStatusLabel('error')).toBe('Ошибка отправки');
  });
});
