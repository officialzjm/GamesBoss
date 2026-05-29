// Touch Controls Overlay for NES (jsNES has no built-in touch input)
// Multi-touch aware: tracks each touch by identifier so D-pad + A/B can be held together.
// Uses the InputHandler.handleButtonDown/Up pipeline so all existing button logic
// (jsNES.buttonDown, etc.) is reused.

class TouchControls {
    constructor(emulatorManager, inputHandler) {
        this.emulator = emulatorManager;
        this.inputHandler = inputHandler;
        this.container = document.getElementById('touchControls');
        if (!this.container) return;

        // Map of touch identifier -> Set of pressed button names
        // (one touch can drag across multiple buttons; we track entry/exit)
        this.activeTouches = new Map();

        // Map of currently pressed button names -> count of touches holding it.
        // Lets multiple touches hold the same button safely.
        this.pressedButtons = new Map();

        this.buttons = Array.from(this.container.querySelectorAll('[data-touch-button]'));
        this._init();
    }

    _init() {
        // Disable browser default behaviors (scroll/zoom/select) inside the overlay
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());

        // Use Pointer Events when available, fall back to Touch Events for older mobile Safari
        if (window.PointerEvent) {
            this.container.addEventListener('pointerdown',   (e) => this._onPointerDown(e),   { passive: false });
            this.container.addEventListener('pointermove',   (e) => this._onPointerMove(e),   { passive: false });
            this.container.addEventListener('pointerup',     (e) => this._onPointerUp(e),     { passive: false });
            this.container.addEventListener('pointercancel', (e) => this._onPointerUp(e),     { passive: false });
            this.container.addEventListener('pointerleave',  (e) => this._onPointerUp(e),     { passive: false });
        } else {
            this.container.addEventListener('touchstart',  (e) => this._onTouchStart(e),  { passive: false });
            this.container.addEventListener('touchmove',   (e) => this._onTouchMove(e),   { passive: false });
            this.container.addEventListener('touchend',    (e) => this._onTouchEnd(e),    { passive: false });
            this.container.addEventListener('touchcancel', (e) => this._onTouchEnd(e),    { passive: false });
        }

        // Release everything if user backgrounds the tab
        window.addEventListener('blur', () => this.releaseAll());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.releaseAll();
        });
    }

    // Return the button name (e.g. 'A', 'UP') under x,y, or null
    _buttonAt(x, y) {
        const els = document.elementsFromPoint(x, y);
        for (const el of els) {
            if (el && el.dataset && el.dataset.touchButton) {
                return el.dataset.touchButton;
            }
        }
        return null;
    }

    _press(buttonName) {
        if (!buttonName) return;
        const count = (this.pressedButtons.get(buttonName) || 0) + 1;
        this.pressedButtons.set(buttonName, count);
        if (count === 1) {
            this._setVisualPressed(buttonName, true);
            const code = this.inputHandler.BUTTON[buttonName];
            if (code !== undefined) {
                this.inputHandler.handleButtonDown(code);
            }
        }
    }

    _release(buttonName) {
        if (!buttonName) return;
        const count = (this.pressedButtons.get(buttonName) || 0) - 1;
        if (count <= 0) {
            this.pressedButtons.delete(buttonName);
            this._setVisualPressed(buttonName, false);
            const code = this.inputHandler.BUTTON[buttonName];
            if (code !== undefined) {
                this.inputHandler.handleButtonUp(code);
            }
        } else {
            this.pressedButtons.set(buttonName, count);
        }
    }

    _setVisualPressed(buttonName, on) {
        const el = this.container.querySelector(`[data-touch-button="${buttonName}"]`);
        if (el) el.classList.toggle('is-pressed', on);
    }

    // ---- Pointer events --------------------------------------------------
    _onPointerDown(e) {
        e.preventDefault();
        const btn = this._buttonAt(e.clientX, e.clientY);
        if (!btn) return;
        this.activeTouches.set(e.pointerId, new Set([btn]));
        this._press(btn);
        // capture so move events keep firing even outside the original target
        try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    }

    _onPointerMove(e) {
        if (!this.activeTouches.has(e.pointerId)) return;
        e.preventDefault();
        const newBtn = this._buttonAt(e.clientX, e.clientY);
        const held = this.activeTouches.get(e.pointerId);

        // Released anything not under finger anymore (allows slide-off)
        for (const b of held) {
            if (b !== newBtn) {
                this._release(b);
                held.delete(b);
            }
        }
        if (newBtn && !held.has(newBtn)) {
            this._press(newBtn);
            held.add(newBtn);
        }
    }

    _onPointerUp(e) {
        const held = this.activeTouches.get(e.pointerId);
        if (!held) return;
        e.preventDefault();
        for (const b of held) this._release(b);
        this.activeTouches.delete(e.pointerId);
    }

    // ---- Touch events fallback -------------------------------------------
    _onTouchStart(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            const btn = this._buttonAt(t.clientX, t.clientY);
            if (!btn) continue;
            this.activeTouches.set(t.identifier, new Set([btn]));
            this._press(btn);
        }
    }

    _onTouchMove(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (!this.activeTouches.has(t.identifier)) continue;
            const newBtn = this._buttonAt(t.clientX, t.clientY);
            const held = this.activeTouches.get(t.identifier);
            for (const b of held) {
                if (b !== newBtn) {
                    this._release(b);
                    held.delete(b);
                }
            }
            if (newBtn && !held.has(newBtn)) {
                this._press(newBtn);
                held.add(newBtn);
            }
        }
    }

    _onTouchEnd(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            const held = this.activeTouches.get(t.identifier);
            if (!held) continue;
            for (const b of held) this._release(b);
            this.activeTouches.delete(t.identifier);
        }
    }

    releaseAll() {
        for (const [id, held] of this.activeTouches) {
            for (const b of held) this._release(b);
        }
        this.activeTouches.clear();
        // Failsafe — clear any visual leftovers
        for (const el of this.buttons) el.classList.remove('is-pressed');
        this.pressedButtons.clear();
    }

    show() {
        if (this.container) this.container.style.display = 'grid';
    }

    hide() {
        this.releaseAll();
        if (this.container) this.container.style.display = 'none';
    }
}
