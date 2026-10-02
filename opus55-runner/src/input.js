// Keyboard + touch/mouse swipe input, normalised to named actions.

const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  ArrowDown: 'slide',
  KeyS: 'slide',
  ShiftLeft: 'slide',
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'mute',
  Enter: 'confirm',
};

export function createInput(surface, onAction) {
  function onKeyDown(e) {
    if (e.target instanceof HTMLElement && e.target.closest('button') && (e.code === 'Enter' || e.code === 'Space')) {
      return; // let focused buttons handle their own activation
    }
    const action = KEYMAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (e.repeat && action !== 'left' && action !== 'right') return;
    onAction(action, 'key');
  }

  // Swipes are detected as soon as the finger travels far enough, rather than
  // on release, which makes touch controls feel as immediate as keys.
  let start = null;
  function threshold() {
    return Math.max(24, Math.min(window.innerWidth, window.innerHeight) * 0.05);
  }
  function onPointerDown(e) {
    if (e.target.closest('button, a')) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, fired: false, t: performance.now() };
  }
  function onPointerMove(e) {
    if (!start || start.fired || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) < threshold()) return;
    start.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) onAction(dx < 0 ? 'left' : 'right', 'swipe');
    else onAction(dy < 0 ? 'jump' : 'slide', 'swipe');
  }
  function onPointerUp(e) {
    if (!start || e.pointerId !== start.id) return;
    if (!start.fired && performance.now() - start.t < 300) onAction('tap', 'pointer');
    start = null;
  }

  window.addEventListener('keydown', onKeyDown);
  surface.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', () => (start = null));

  return {
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      surface.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
  };
}
