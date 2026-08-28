import type { ExpenseNotification } from '../types';

export const notificationStatusLabel = (status?: string) => status === 'sent' ? 'Отправлено' : status === 'error' ? 'Ошибка отправки' : 'Не отправлялось';

export function NotificationStatus({ notification, compact = false }: { notification: ExpenseNotification | null; compact?: boolean }) {
  const content = <div className="notification-status-content">
    <b>Статус отправки уведомления</b>
    {notification ? <><span><small>Дата и время</small>{new Date(notification.created_at).toLocaleString('ru-RU')}</span><span><small>Адресат</small>{notification.recipients.join(', ') || 'Не указан'}</span><span><small>Статус</small><strong className={`notification-state notification-state--${notification.status}`}>{notificationStatusLabel(notification.status)}</strong></span></> : <p>Уведомление по этому расходу не отправлялось.</p>}
  </div>;
  return compact ? <span className="notification-tooltip" tabIndex={0}><span className="document-ok" aria-label="Счет загружен, показать статус уведомления">✓</span><span className="notification-popover" role="tooltip">{content}</span></span> : <section className="notification-status-card">{content}</section>;
}
