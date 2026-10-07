export type ReceiptFile = { name: string; size: number; text: () => Promise<string> };
export type UploadState<T> = { name: string; phase: 'idle' | 'reading' | 'verifying' | 'complete' | 'error'; error: string; result?: T };

// A file's name and verification result are published as one versioned state.
export function createLatestUpload<T>(verify: (value: unknown, signal: AbortSignal) => Promise<T>, update: (state: UploadState<T>) => void) {
 let version = 0;
 let active: AbortController | undefined;
 async function select(file?: ReceiptFile) {
  if (!file) return;
  const ticket = ++version;
  active?.abort();
  const controller = new AbortController();
  active = controller;
  update({ name: file.name, phase: 'reading', error: '' });
  try {
   if (file.size > 500 * 1024) throw new Error('请选择不超过 500 KB 的 JSON 回执。');
   const text = await file.text();
   if (ticket !== version) return;
   let value: unknown;
   try { value = JSON.parse(text); } catch { throw new Error('JSON 格式损坏，请重新选择导出的原始回执。'); }
   if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('回执需要是完整的 JSON 对象。');
   update({ name: file.name, phase: 'verifying', error: '' });
   const result = await verify(value, controller.signal);
   if (ticket === version) update({ name: file.name, phase: 'complete', error: '', result });
  } catch (error) {
   if (ticket === version) update({ name: file.name, phase: 'error', error: error instanceof Error ? error.message : '文件无法读取' });
  }
 }
 return { select, dispose() { version++; active?.abort(); } };
}
