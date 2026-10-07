/** Pure gesture state: a quiet interval starts a new gesture, never a timer tick. */
export type PagerState = { lastAt: number; total: number; consumed: boolean; lockedUntil: number };
export const createPagerState = (): PagerState => ({ lastAt: -Infinity, total: 0, consumed: false, lockedUntil: 0 });
export const sceneCooldown = (reduced: boolean) => reduced ? 180 : 1800;
export const clampScene = (index: number, count = 3) => Math.max(0, Math.min(count - 1, index));
export type WheelInput = { deltaX: number; deltaY: number; deltaMode?: number; ctrlKey?: boolean; metaKey?: boolean };
export function normalizedWheel(input: WheelInput, pageHeight: number): number {
 if (input.ctrlKey || input.metaKey || !Number.isFinite(input.deltaY) || Math.abs(input.deltaY) <= Math.abs(input.deltaX)) return 0;
 return input.deltaY * (input.deltaMode === 1 ? 16 : input.deltaMode === 2 ? pageHeight : 1);
}
export function pageWheel(state: PagerState, delta: number, now: number, index: number, reduced = false, blocked = false): { state: PagerState; index: number } {
 if (!delta || !Number.isFinite(delta)) return { state, index };
 const quiet = now - state.lastAt >= 260;
 const next = { ...state, lastAt: now, total: quiet ? 0 : state.total, consumed: quiet ? false : state.consumed };
 if (blocked || now < next.lockedUntil) next.consumed = true;
 if (next.consumed) return { state: next, index };
 // A direction reversal before reaching the threshold starts fresh accumulation.
 if (Math.sign(delta) !== Math.sign(next.total)) next.total = 0;
 next.total += delta;
 if (Math.abs(next.total) < 48) return { state: next, index };
 next.consumed = true;
 const target = clampScene(index + Math.sign(next.total));
 if (target !== index) next.lockedUntil = now + sceneCooldown(reduced);
 return { state: next, index: target };
}
