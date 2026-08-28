export const APP_PATHS = {
  dashboard: '/',
  expenses: '/expenses',
  directories: '/directories',
  partners: '/partners',
  settings: '/settings',
} as const;

export const NAVIGATION_ITEMS = [
  { path: APP_PATHS.dashboard, label: 'Дашборд', mobileLabel: 'Обзор', icon: '⌂' },
  { path: APP_PATHS.expenses, label: 'Расходы', mobileLabel: 'Расходы', icon: '₽' },
  { path: APP_PATHS.directories, label: 'Справочники', mobileLabel: 'Справочники', icon: '▦' },
  { path: APP_PATHS.settings, label: 'Настройки', mobileLabel: 'Настройки', icon: '⚙' },
] as const;
