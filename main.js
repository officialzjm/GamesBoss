// Main Application Entry Point
const GAMES = [
    {
        title: "Pokémon Red",
        rom: "roms/pokemon_red.gb"
    },
    {
        title: "Pokémon Blue",
        rom: "roms/pokemon_blue.gb"
    },
    {
        title: "Pokémon Yellow",
        rom: "roms/pokemon_yellow.gbc"
    },
    {
        title: "Pokémon Gold",
        rom: "roms/pokemon_gold.gbc"
    },
    {
        title: "Pokémon Silver",
        rom: "roms/pokemon_silver.gbc"
    },
    {
        title: "Pokémon Crystal",
        rom: "roms/pokemon_crystal.gbc"
    },
    {
        title: "Pokémon Ruby",
        rom: "roms/pokemon_ruby.gba"
    },
    {
        title: "Pokémon Sapphire",
        rom: "roms/pokemon_sapphire.gba"
    },
    {
        title: "Pokémon Emerald",
        rom: "roms/pokemon_emerald.gba"
    },
    {
        title: "Pokémon FireRed",
        rom: "roms/pokemon_firered.gba"
    },
    {
        title: "Pokémon LeafGreen",
        rom: "roms/pokemon_leafgreen.gba"
    },
    {
        title: "Pokémon Mystery Dungeon: Red Rescue Team",
        rom: "roms/pokemon_red_rescue.gba"
    },
    {
        title: "The Legend of Zelda: Link's Awakening DX",
        rom: "roms/zelda_awakening_dx.gbc"
    },
    {
        title: "The Legend of Zelda: Oracle of Seasons",
        rom: "roms/zelda_oracle_seasons.gbc"
    },
    {
        title: "The Legend of Zelda: Oracle of Ages",
        rom: "roms/zelda_oracle_ages.gbc"
    },
    {
        title: "The Legend of Zelda: A Link to the Past & Four Swords",
        rom: "roms/zelda_past.gba"
    },
    {
        title: "The Legend of Zelda: The Minish Cap",
        rom: "roms/zelda_minish_cap.gba"
    }
];
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
          game.title.toLowerCase().includes(filter.toLowerCase())
        );
        
        list.innerHTML = filtered.map(game => `
          <button class="game-card" data-rom="${game.rom}">
            ${game.title}
          </button>
        `).join("");
        
        list.querySelectorAll(".game-card").forEach(btn => {
          btn.addEventListener("click", () => launchGame(btn.dataset.rom));
        });
    }
    function launchGame(romLocation) {
        const system = game.rom.split('.').pop();
        if (system == "gbc" || system == "gb") {
            system = "gba";
        }
        window.location.search = `?system=${system}&rom=${romLocation}`;//href?
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
    console.log('stage two.12');
    // Initial sync
    syncSystemClass();
    syncTouchOverlay();
});
