import type { Command } from './game/config';

export type MenuAction = 'confirm' | 'pause' | 'mute' | 'quality' | 'fullscreen';

export interface InputHandlers {
  command(c: Command): void;
  action(a: MenuAction): void;
}

const KEYMAP: Record<string, Command | MenuAction> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  ArrowDown: 'slide',
  KeyS: 'slide',
  Enter: 'confirm',
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'mute',
  KeyG: 'quality',
  KeyF: 'fullscreen',
};

const COMMANDS = new Set<string>(['left', 'right', 'jump', 'slide']);

/** Keyboard + touch swipe input. */
export function bindInput(target: HTMLElement, h: InputHandlers): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const mapped = KEYMAP[e.code];
    if (!mapped) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    const onButton = tag === 'BUTTON';
    // let Space / Enter activate a focused button normally
    if (onButton && (e.code === 'Space' || e.code === 'Enter')) return;
    e.preventDefault();
    if (e.repeat) return;
    if (COMMANDS.has(mapped)) h.command(mapped as Command);
    else h.action(mapped as MenuAction);
    // Space doubles as "confirm" on menus
    if (e.code === 'Space') h.action('confirm');
  };
  window.addEventListener('keydown', onKey);

  // --- swipe: fire as soon as the finger has moved far enough (responsive)
  let startX = 0;
  let startY = 0;
  let active = false;
  let fired = false;
  const THRESHOLD = 26;
  const down = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    active = true;
    fired = false;
    startX = e.clientX;
    startY = e.clientY;
  };
  const move = (e: PointerEvent): void => {
    if (!active || fired) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
    fired = true;
    if (Math.abs(dx) > Math.abs(dy)) h.command(dx < 0 ? 'left' : 'right');
    else h.command(dy < 0 ? 'jump' : 'slide');
  };
  const up = (): void => {
    active = false;
  };
  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
  target.style.touchAction = 'none';

  return () => {
    window.removeEventListener('keydown', onKey);
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
  };
}
