// Обычный и Stable-маршруты используют одну реализацию, чтобы логика фильтров
// не расходилась при последующих merge.
export { Dashboard } from './DashboardStable';

type FilterOption = { id: string };
const EMPTY_FILTER_ID = '00000000-0000-0000-0000-000000000000';

// Совместимость с тестами группового выбора из прежней реализации дашборда.
export function toggleTagGroup(selectedIds: string[], options: FilterOption[]) {
  return options.every((item) => selectedIds.includes(item.id)) ? [] : options.map((item) => item.id);
}

export function tagGroupQueryIds(selectedIds: string[], _options: FilterOption[]) {
  return selectedIds.length ? selectedIds : [EMPTY_FILTER_ID];
}
