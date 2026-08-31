type LinkedItem = { id: string; partner_id: string | null };

/** Добавляет значение в множественный фильтр или удаляет его повторным нажатием. */
export function toggleSelectedId(selectedIds: string[], id: string) {
  return selectedIds.includes(id)
    ? selectedIds.filter((item) => item !== id)
    : [...selectedIds, id];
}

/** Оставляет только контрагентов, совместимых с выбранными партнерами. */
export function compatibleCounterpartyIds(selectedIds: string[], partnerIds: string[], counterparties: LinkedItem[]) {
  return selectedIds.filter((id) => counterparties.some((item) => (
    item.id === id && (!partnerIds.length || Boolean(item.partner_id && partnerIds.includes(item.partner_id)))
  )));
}
