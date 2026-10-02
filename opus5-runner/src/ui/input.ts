import type { Action } from '../core/types';

export interface InputHandlers {
  action(action: Action): void;
  jumpHeld(held: boolean): void;
  /** Start, or restart after a run ends. */
  confirm(): void;
  togglePause(): void;
  toggleMute(): void;
  /** Any interaction at all, used to unlock audio. */
  interacted(): void;
}

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const JUMP = new Set(['ArrowUp', 'KeyW', 'Space']);
const SLIDE = new Set(['ArrowDown', 'KeyS', 'ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter', 'Space', 'NumpadEnter']);
const PAUSE = new Set(['KeyP', 'Escape']);

const SWIPE_MIN = 26;
const TAP_MAX_MS = 320;

/**
 * Keyboard, mouse and touch, normalised into game actions. Listeners live for
 * the lifetime of the page, which is exactly as long as the game runs.
 */
export class Input {
  private touchId: number | null = null;
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private swiped = false;

  constructor(
    private target: HTMLElement,
    private handlers: InputHandlers,
  ) {
    this.attach();
  }

  private on<K extends keyof WindowEventMap>(
    el: Window | HTMLElement,
    type: K,
    fn: (ev: WindowEventMap[K]) => void,
    opts?: AddEventListenerOptions,
  ): void {
    el.addEventListener(type, fn as EventListener, opts);
  }

  private attach(): void {
    this.on(window, 'keydown', (ev) => this.onKeyDown(ev));
    this.on(window, 'keyup', (ev) => this.onKeyUp(ev));
    this.on(window, 'blur', () => this.handlers.jumpHeld(false));

    this.on(this.target, 'touchstart', (ev) => this.onTouchStart(ev), { passive: false });
    this.on(this.target, 'touchmove', (ev) => this.onTouchMove(ev), { passive: false });
    this.on(this.target, 'touchend', (ev) => this.onTouchEnd(ev), { passive: false });
    this.on(this.target, 'touchcancel', () => {
      this.touchId = null;
      this.handlers.jumpHeld(false);
    });

    this.on(this.target, 'pointerdown', (ev) => {
      if (ev.pointerType === 'touch') return; // touch handlers own this
      this.handlers.interacted();
      this.handlers.confirm();
    });
    // Right-click to slide is a nice desktop shortcut; suppress the menu.
    this.on(this.target, 'contextmenu', (ev) => ev.preventDefault());
  }

  private onKeyDown(ev: KeyboardEvent): void {
    if (ev.repeat) {
      // Hold is tracked separately; repeats must not spam the action queue.
      if (JUMP.has(ev.code)) ev.preventDefault();
      return;
    }
    const code = ev.code;
    const interesting =
      LEFT.has(code) || RIGHT.has(code) || JUMP.has(code) || SLIDE.has(code) ||
      CONFIRM.has(code) || PAUSE.has(code) || code === 'KeyM';
    if (!interesting) return;
    ev.preventDefault();
    this.handlers.interacted();

    if (PAUSE.has(code)) {
      this.handlers.togglePause();
      return;
    }
    if (code === 'KeyM') {
      this.handlers.toggleMute();
      return;
    }
    if (CONFIRM.has(code)) this.handlers.confirm();
    if (LEFT.has(code)) this.handlers.action('left');
    if (RIGHT.has(code)) this.handlers.action('right');
    if (JUMP.has(code)) {
      this.handlers.jumpHeld(true);
      this.handlers.action('jump');
    }
    if (SLIDE.has(code)) this.handlers.action('slide');
  }

  private onKeyUp(ev: KeyboardEvent): void {
    if (JUMP.has(ev.code)) this.handlers.jumpHeld(false);
  }

  private onTouchStart(ev: TouchEvent): void {
    ev.preventDefault();
    this.handlers.interacted();
    if (this.touchId !== null) return;
    const t = ev.changedTouches[0];
    if (!t) return;
    this.touchId = t.identifier;
    this.startX = t.clientX;
    this.startY = t.clientY;
    this.startT = performance.now();
    this.swiped = false;
  }

  private current(ev: TouchEvent): Touch | undefined {
    for (let i = 0; i < ev.changedTouches.length; i++) {
      const t = ev.changedTouches[i];
      if (t && t.identifier === this.touchId) return t;
    }
    return undefined;
  }

  private onTouchMove(ev: TouchEvent): void {
    ev.preventDefault();
    const t = this.current(ev);
    if (!t || this.swiped) return;
    const dx = t.clientX - this.startX;
    const dy = t.clientY - this.startY;
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
    this.swiped = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.handlers.action(dx > 0 ? 'right' : 'left');
    } else if (dy < 0) {
      this.handlers.jumpHeld(true);
      this.handlers.action('jump');
    } else {
      this.handlers.action('slide');
    }
  }

  private onTouchEnd(ev: TouchEvent): void {
    ev.preventDefault();
    const t = this.current(ev);
    if (!t) return;
    this.touchId = null;
    this.handlers.jumpHeld(false);
    if (this.swiped) return;
    // A tap confirms on the menus and jumps during play.
    if (performance.now() - this.startT < TAP_MAX_MS) {
      this.handlers.confirm();
      this.handlers.action('jump');
    }
  }

}
