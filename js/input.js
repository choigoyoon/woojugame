import { ACTION, CONFIG } from './config.js';

export function toGamePoint(clientX, clientY, bounds) {
  return {
    x: (clientX - bounds.left) * CONFIG.view.width / bounds.width,
    y: (clientY - bounds.top) * CONFIG.view.height / bounds.height,
  };
}

export function actionAt(point) {
  const { width, height, controlFraction } = CONFIG.view;
  if (point.x < 0 || point.x >= width || point.y < height * (1 - controlFraction) || point.y >= height) return null;
  return point.x < width / 2 ? ACTION.TURN : ACTION.CLIMB;
}

export class Input {
  constructor(element, buttons, onAction, unlockAudio) {
    this.element = element;
    this.active = new Map();
    this.abort = new AbortController();
    const options = { passive: false, signal: this.abort.signal };
    const listen = (target, type, callback) => target.addEventListener(type, callback, options);
    const press = (id, action) => {
      if (!action || this.active.has(id)) return;
      this.active.set(id, action);
      // Synchronous dispatch preserves every changedTouch and its browser event order,
      // including several presses between two requestAnimationFrame callbacks.
      unlockAudio();
      onAction(action);
    };
    const pointAction = (point) => actionAt(toGamePoint(point.clientX, point.clientY, element.getBoundingClientRect()));
    listen(element, 'touchstart', (event) => {
      event.preventDefault();
      for (const touch of event.changedTouches) press(`touch:${touch.identifier}`, pointAction(touch));
    });
    listen(document, 'touchend', (event) => {
      for (const touch of event.changedTouches) this.active.delete(`touch:${touch.identifier}`);
    });
    listen(document, 'touchcancel', (event) => {
      for (const touch of event.changedTouches) this.active.delete(`touch:${touch.identifier}`);
    });
    listen(element, 'touchmove', (event) => event.preventDefault());
    listen(element, 'pointerdown', (event) => {
      // Touch uses touchstart exclusively. Ignore its compatibility pointer/mouse events.
      if (event.pointerType === 'touch' || event.button !== 0) return;
      event.preventDefault();
      press(`pointer:${event.pointerId}`, pointAction(event));
      element.setPointerCapture?.(event.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(document, type, (event) => this.active.delete(`pointer:${event.pointerId}`));
    }
    for (const type of ['contextmenu', 'dragstart', 'selectstart', 'dblclick']) {
      listen(element, type, (event) => event.preventDefault());
    }
    const keyAction = (event) => {
      if (['ArrowLeft', 'KeyZ'].includes(event.code)) return ACTION.TURN;
      if (['ArrowUp', 'ArrowRight', 'KeyX'].includes(event.code)) return ACTION.CLIMB;
      if (['Space', 'Enter'].includes(event.code)) {
        return event.target === buttons.turn ? ACTION.TURN : ACTION.CLIMB;
      }
      return null;
    };
    listen(document, 'keydown', (event) => {
      const action = keyAction(event);
      if (!action) return;
      event.preventDefault();
      if (!event.repeat) press(`key:${event.code}`, action);
    });
    listen(document, 'keyup', (event) => this.active.delete(`key:${event.code}`));
    for (const [action, button] of Object.entries(buttons)) {
      // Assistive technology can activate a button without a pointer or key event.
      listen(button, 'click', (event) => {
        event.preventDefault();
        if (event.detail === 0) { unlockAudio(); onAction(action); }
      });
    }
  }

  isPressed(action) { return [...this.active.values()].includes(action); }
  reset() { this.active.clear(); }
  destroy() { this.abort.abort(); this.reset(); }
}
