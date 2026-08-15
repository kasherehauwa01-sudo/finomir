export interface ClipboardWriter {
  writeText(text: string): Promise<void>;
}

export async function copyText(
  text: string,
  clipboard: ClipboardWriter | null =
    typeof navigator === 'undefined' ? null : navigator.clipboard,
): Promise<void> {
  if (clipboard === null) {
    throw new Error('Буфер обмена недоступен');
  }

  await clipboard.writeText(text);
}
