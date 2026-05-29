// Touch Controls Overlay — drives NES (jsNES) AND GBA (EmulatorJS) input
// Multi-touch aware: each touch is tracked by identifier so D-pad + A/B
// can be held simultaneously. Buttons can also be slid into / out of.

class TouchControls {
    constructor(emulatorManager, inputHandler) {
        this.emulator = emulatorManager;
        this.inputHandler = inputHandler;
        this.container = document.getElementById('touchControls');
        if (!this.container) return;

        // EmulatorJS GBA button IDs (player 1) used by simulateInput()
        // https://emulatorjs.org/docs/customizing#button-codes
        this.GBA_BUTTON_IDS = {
            A: 0, B: 1, SELECT: 2, START: 3,
            RIGHT: 4, LEFT: 5, UP: 6, DOWN: 7,
            R: 8, L: 9
        };

        // Track touches: touch id -> Set of button names currently held by that touch
        this.activeTouches = new Map();
        // Reference-count button presses (in case multiple touches hold the same)
        this.pressedButtons = new Map();

        this.buttons = Array.from(this.container.querySelectorAll('[data-touch-button]'));
        this._init();
    }

    _init() {
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());

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

        window.addEventListener('blur', () => this.releaseAll());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.releaseAll();
        });
    }

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
            this._dispatchDown(buttonName);
        }
    }

    _release(buttonName) {
        if (!buttonName) return;
        const count = (this.pressedButtons.get(buttonName) || 0) - 1;
        if (count <= 0) {
            this.pressedButtons.delete(buttonName);
            this._setVisualPressed(buttonName, false);
            this._dispatchUp(buttonName);
        } else {
            this.pressedButtons.set(buttonName, count);
        }
    }

    // Send "button down" to whichever emulator is currently active
    _dispatchDown(buttonName) {
        const system = this.emulator.currentSystem;
        if (system === 'nes') {
            const code = this.inputHandler.BUTTON[buttonName];
            if (code !== undefined) this.inputHandler.handleButtonDown(code);
        } else if (system === 'gba') {
            this._gbaButton(buttonName, 1);
        }
    }

    _dispatchUp(buttonName) {
        const system = this.emulator.currentSystem;
        if (system === 'nes') {
            const code = this.inputHandler.BUTTON[buttonName];
            if (code !== undefined) this.inputHandler.handleButtonUp(code);
        } else if (system === 'gba') {
            this._gbaButton(buttonName, 0);
        }
    }

    // value: 1 = pressed, 0 = released
    _gbaButton(buttonName, value) {
        const ejs = window.EJS_emulator;
        const id = this.GBA_BUTTON_IDS[buttonName];
        if (id === undefined) return;
        try {
            // Newer EmulatorJS: gameManager.functions.simulateInput(player, btn, value)
            if (ejs && ejs.gameManager && ejs.gameManager.functions && ejs.gameManager.functions.simulateInput) {
                ejs.gameManager.functions.simulateInput(0, id, value);
                return;
            }
            // Older / alt API: gameManager.simulateInput(player, btn, value)
            if (ejs && ejs.gameManager && typeof ejs.gameManager.simulateInput === 'function') {
                ejs.gameManager.simulateInput(0, id, value);
                return;
            }
        } catch (err) {
            console.warn('GBA touch input failed:', err);
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
        try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    }

    _onPointerMove(e) {
        if (!this.activeTouches.has(e.pointerId)) return;
        e.preventDefault();
        const newBtn = this._buttonAt(e.clientX, e.clientY);
        const held = this.activeTouches.get(e.pointerId);

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
