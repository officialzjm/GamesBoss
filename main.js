// Main Application Entry Point

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const status = document.getElementById('status');
    const debug = document.getElementById('debug');
    const romFile = document.getElementById('romFile');
    const systemSelect = document.getElementById('systemSelect');

    // Core managers
    const emulator = new EmulatorManager(canvas, ctx, status, debug);
    const inputHandler = new InputHandler(emulator);
    const controlSettings = new ControlSettings(inputHandler);
    const touchControls = new TouchControls(emulator, inputHandler);

    emulator.touchControls = touchControls;

    // Initial canvas
    emulator.initCanvas('nes');

    // -----------------------------------------------------------
    // Touch device detection
    // -----------------------------------------------------------
    const isTouchDevice = (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches)
                         || ('ontouchstart' in window);

    function syncTouchOverlay() {
        // Inline NES touch controls — shown only on touch devices with NES selected.
        // No fullscreen requirement; they live below the game screen.
        if (!touchControls.container) return;
        const shouldShow = isTouchDevice && emulator.currentSystem === 'nes';
        if (shouldShow) touchControls.show();
        else touchControls.hide();
    }
    window.__syncTouchOverlay = syncTouchOverlay;

    // -----------------------------------------------------------
    // System selection
    // -----------------------------------------------------------
    systemSelect.addEventListener('change', (e) => {
        const system = e.target.value;
        emulator.setSystem(system);
        status.textContent = `System: ${systemSelect.options[systemSelect.selectedIndex].text} - Load a ROM file`;
        syncTouchOverlay();
    });

    // -----------------------------------------------------------
    // ROM loader
    // -----------------------------------------------------------
    romFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        status.textContent = 'Loading ROM...';
        emulator.log('Reading ROM file...');

        try {
            emulator.stop();

            if (emulator.currentSystem === 'nes') {
                await emulator.loadNES(file);
            } else if (emulator.currentSystem === 'gba') {
                await emulator.loadGBA(file);
            }

            syncTouchOverlay();
        } catch (err) {
            emulator.log('ERROR: ' + err.message);
            status.textContent = 'Error: ' + err.message;
            console.error(err);
        }
    });

    // Canvas focus helper for keyboard input
    canvas.setAttribute('tabindex', '0');
    canvas.addEventListener('keydown', (e) => e.preventDefault());

    // file:// protocol warning
    if (window.location.protocol === 'file:') {
        const warning = document.getElementById('fileProtocolWarning');
        if (warning) warning.style.display = 'block';
        status.textContent = '⚠ Please use a web server (see warning above)';
        emulator.log('⚠ Running from file:// - CORS restrictions will prevent loading external resources');
    } else {
        status.textContent = 'Ready! Select a system and load a ROM file.';
        emulator.log('Emulator ready');
    }

    // Initial sync
    syncTouchOverlay();
});
