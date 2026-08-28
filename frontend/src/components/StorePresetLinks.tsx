import type { StorePreset } from '../types';

export function StorePresetLinks({ presets, onSelect, disabled = false }: { presets: StorePreset[]; onSelect: (storeIds: string[]) => void; disabled?: boolean }) {
  if (!presets.length) return null;
  return <div className="store-presets"><span>Пресеты:</span>{presets.map((preset) => <button type="button" disabled={disabled} key={preset.id} title={preset.stores.join(', ')} onClick={() => onSelect(preset.store_ids)}>{preset.name}</button>)}</div>;
}
