// Main Application Entry Point

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const status = document.getElementById('status');
    const debug = document.getElementById('debug');
    const romFile = document.getElementById('romFile');
    const systemSelect = document.getElementById('systemSelect');
    const gbaEngineGroup = document.getElementById('gbaEngineGroup');
    const gbaEngineSelect = document.getElementById('gbaEngineSelect');
    const gbaSaveHint = document.getElementById('gbaSaveHint');

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

    function syncSystemClass() {
        const system = systemSelect.value || emulator.currentSystem;
        document.body.classList.toggle('is-nes', system === 'nes');
        document.body.classList.toggle('is-gba', system === 'gba');
        document.body.classList.toggle('system-nes', system === 'nes');
        document.body.classList.toggle('system-gba', system === 'gba');
        if (gbaEngineGroup) {
            gbaEngineGroup.style.display = system === 'gba' ? 'block' : 'none';
        }
        if (gbaSaveHint) {
            const isEmulatorJsGba = system === 'gba' && (!gbaEngineSelect || gbaEngineSelect.value !== 'iodine');
            gbaSaveHint.style.display = isEmulatorJsGba ? 'block' : 'none';
        }
    }

    function syncTouchOverlay() {
        // Inline NES touch controls — shown only on touch devices with NES selected.
        // No fullscreen requirement; they live below the game screen.
        if (!touchControls.container) return;
        syncSystemClass();
        const shouldShow = isTouchDevice && (systemSelect.value || emulator.currentSystem) === 'nes';
        if (shouldShow) touchControls.show();
        else touchControls.hide();
    }
    window.__syncTouchOverlay = syncTouchOverlay;

    // -----------------------------------------------------------
    // System selection
    // -----------------------------------------------------------
    /*
    systemSelect.addEventListener('change', async (e) => {
        const system = e.target.value;
        emulator.setSystem(system);
        status.textContent = `System: ${systemSelect.options[systemSelect.selectedIndex].text} - Load a ROM file`;
        if (system === 'gba' && gbaEngineSelect && gbaEngineSelect.value === 'iodine') {
            emulator.setGBAEngine('iodine');
            emulator.loadGBA();
        }
        syncTouchOverlay();
    });
    
    if (gbaEngineSelect) {
        gbaEngineSelect.addEventListener('change', async (e) => {
            emulator.setGBAEngine(e.target.value);
            if (emulator.currentSystem !== 'gba') return;

            const file = romFile.files && romFile.files[0];
            if (emulator.gbaEngine === 'iodine' || file) {
                status.textContent = 'Switching GBA engine...';
                try {
                    emulator.stop();
                    await emulator.loadGBA(file);
                } catch (err) {
                    emulator.log('ERROR: ' + err.message);
                    status.textContent = 'Error: ' + err.message;
                    console.error(err);
                }
            } else {
                emulator.setSystem('gba');
                status.textContent = 'GBA engine changed - load a ROM file';
            }
            syncTouchOverlay();
        });
    }
    */

    // -----------------------------------------------------------
    // ROM loader
    // -----------------------------------------------------------
    /*
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
    */
    /* Never tested these functions, just noticed the downlaod feature hidden in settings :cry:
    async function exportState() {
        const romUrl = params.get("rom");
        const fileName = romUrl.split("/").pop() || "game.gba";
        
        const state = await window.EJS_emulator.storage.states.get(fileName);
    
        const blob = new Blob([state], {
            type: "application/octet-stream"
        });
    
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = key;
        a.click();
    
        URL.revokeObjectURL(a.href);
    }
    async function importState(file) {
        const romUrl = params.get("rom");
        const fileName = romUrl.split("/").pop() || "game.gba";
        
        const state = await window.EJS_emulator.storage.states.get(fileName);
    
        const data = new Uint8Array(await file.arrayBuffer());
    
        await window.EJS_emulator.storage.states.put(
            fileName,
            data
        );
    
        alert("State imported");
    }
    */
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
    // Auto-load ROM from URL
    function showGameSelector() {
        document.body.innerHTML = `
            <div class="game-selector">
                <h1>Games</h1>
    
                <input
                    id="gameSearch"
                    type="text"
                    placeholder="Search games..."
                >
    
                <div id="gameList"></div>
            </div>
        `;
    
        const search = document.getElementById("gameSearch");
    
        search.addEventListener("input", () => {
            renderGames(search.value);
        });
    
        renderGames();
    }
    function renderGames(filter = "") {
        const list = document.getElementById("gameList");
    
        const filtered = GAMES.filter(game =>
            game.title.toLowerCase()
                .includes(filter.toLowerCase())
        );
    
        list.innerHTML = filtered.map(game => `
            <button
                class="game-card"
                onclick="launchGame('${game.rom}')"
            >
                ${game.title}
            </button>
        `).join("");
    }
    function launchGame(romLocation) {    
        window.location.search = `?system=gba&rom=${romLocation}`;//href?
    }
    (async () => {
        const params = new URLSearchParams(window.location.search);
    
        const romUrl = params.get("rom");
        const system = params.get("system");
    
        if (!romUrl) {
            showGameSelector();
            return;
        }
    
        const MAX_RETRIES = 5;
        const RETRY_DELAY = 5000; // 5 seconds
    
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (system) {
                    systemSelect.value = system;
                    emulator.setSystem(system);
                }
    
                status.textContent =
                    attempt === 1
                        ? "Downloading ROM..."
                        : `Retrying ROM download (${attempt}/${MAX_RETRIES})...`;
    
                const response = await fetch(romUrl);
    
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
    
                const blob = await response.blob();
    
                const fileName = romUrl.split("/").pop() || "game.gba";
                const file = new File([blob], fileName);
    
                emulator.stop();
    
                if (system === "nes") {
                    await emulator.loadNES(file);
                } else {
                    await emulator.loadGBA(file);
                }
    
                status.textContent = `Playing: ${fileName}`;
                return; // Success, exit retry loop
            } catch (err) {
                console.error(`Attempt ${attempt} failed:`, err);
    
                if (attempt === MAX_RETRIES) {
                    status.textContent = "Failed to load ROM";
                    return;
                }
    
                status.textContent =
                    `Load failed. Retrying in 5 seconds... (${attempt}/${MAX_RETRIES})`;
    
                await new Promise(resolve =>
                    setTimeout(resolve, RETRY_DELAY)
                );
            }
        }
    })();
    const GAMES = [
        {
            id: "pokemonemerald",
            title: "Pokemon Emerald",
            system: "gba",
            rom: "roms/pokemonemerald.gba"
        },
        {
            id: "pokemonfirered",
            title: "Pokemon Fire Red",
            system: "gba",
            rom: "roms/pokemonfirered.gba"
        },
        {
            id: "pokemonleafgreen",
            title: "Pokemon Leaf Green",
            system: "gba",
            rom: "roms/pokemonleafgreen.gba"
        }
    ];
    console.log('stage two.1');
    // Initial sync
    syncSystemClass();
    syncTouchOverlay();
});
