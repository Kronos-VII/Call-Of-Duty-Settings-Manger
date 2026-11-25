/* data.js - games, presets, sources, fact-check. ES5, ASCII only. Edit freely: this is the only place settings values live.
   Values are the MAJORITY of the guides listed per game (fetched Nov 2026). Where guides disagree, the note says so. */
var Data = (function () {
  var VERSION = '1.2.0';

  var FILES = {
    cod24: 'Black Ops 6 era file',
    cod25: 'Black Ops 7 era file',
    cod26: 'Modern Warfare 4 era file'
  };

  function upscaler(vendor) { return vendor === 'amd' ? 'FSR' : (vendor === 'intel' ? 'XeSS' : 'DLSS'); }
  function latency(vendor) {
    if (vendor === 'amd') return ['AMD Anti-Lag', 'On'];
    if (vendor === 'intel') return ['Low-latency mode', 'On (if listed)'];
    return ['NVIDIA Reflex Low Latency', 'On + Boost'];
  }
  function pick(p, a, b, c) { return p === 'fps' ? a : (p === 'balanced' ? b : c); }

  // Builds the checklist for one game / preset. ctx = { vendor, lowVram, hz, h }
  function rows(game, p, ctx) {
    var id = game.id, mw = id === 'mw4', b7 = id === 'bo7', b6 = id === 'bo6', wz = id === 'wz', old = !mw;
    var up = upscaler(ctx.vendor), lat = latency(ctx.vendor), low = ctx.lowVram, hz = ctx.hz || 0, qm = Core.scaleMode(ctx.h || 0), R = [], cap;
    function add(g, s, v, n) { R.push({ group: g, setting: s, value: v, note: n || '' }); }

    add('DISPLAY', 'Display Mode', 'Fullscreen Exclusive', 'Nearly every guide. One prefers Borderless for fast alt-tab.');
    add('DISPLAY', 'Screen Refresh Rate', 'Your monitor\'s highest Hz', hz ? 'Windows reports ' + hz + ' Hz' : '');
    add('DISPLAY', lat[0], lat[1], 'Lower input latency. Use plain On if CPU is not the limit.');
    add('DISPLAY', 'V-Sync (Gameplay and Menus)', 'Off', 'All guides');
    if (mw) {
      cap = hz ? 'Custom: ' + (hz - 3) : 'Custom: refresh rate minus 3';
      add('DISPLAY', 'Gameplay Frame Rate Limit', cap, 'Tier1Settings, FpsGen, Astroboost: a few frames below your refresh rate');
    } else {
      cap = hz ? 'Custom: ' + hz : 'Custom: your refresh rate';
      add('DISPLAY', 'Gameplay Frame Rate Limit', cap, b7 ? 'Dot Esports and Dexerto: your refresh rate. Frozen Tweaks: about 3 below (better with G-Sync/FreeSync).' : 'Guides say your refresh rate (some say uncapped)');
    }
    add('DISPLAY', 'Menu Frame Rate Limit', '60', 'Saves heat when you are not playing');
    add('DISPLAY', 'HDR', 'Off', '');
    if (mw) add('DISPLAY', 'Background Shader Preloading', 'On', 'Let it finish before your first match (3 guides)');

    add('QUALITY', 'Graphics Preset', 'Custom', mw ? 'Built-in presets turn ray tracing back on (Tier1Settings)' : 'All guides');
    if (b7) {
      add('QUALITY', 'Upscaling / Sharpening', pick(p, 'FidelityFX CAS 80-90 (native)', up + ' Quality', 'Off / native'), 'Guides split: Dot Esports and Dexerto use CAS at native, Hone and Frozen Tweaks use ' + up + ' Quality');
    } else if (b6) {
      add('QUALITY', 'Upscaling / Sharpening', pick(p, 'FidelityFX CAS 80-85 (native)', up + ' Quality', 'Off / native'), 'Hone and Charlie Intel use CAS; Dexerto says use the upscaler for your GPU');
    } else if (wz) {
      add('QUALITY', 'Upscaling / Sharpening', pick(p, 'FidelityFX CAS 80-85 (native)', up + ' Quality', 'Off / native'), 'Fpstweak and setup.gg: CAS at native, upscaler on Quality only if you need more FPS');
    } else {
      add('QUALITY', 'Upscaling / Sharpening', pick(p, up + ' ' + qm, up + ' ' + qm, up + ' Quality (or off)'), 'Tier1Settings, FpsGen, Astroboost: Quality (Balanced or Performance at 4K). Esports.gg alone says Performance.');
    }
    add('QUALITY', 'Render Resolution / Dynamic Resolution', '100 / Off', 'All guides but one');
    add('QUALITY', 'Frame Generation', 'Off', 'All guides: adds latency');
    add('QUALITY', 'Ray Tracing (every option)', 'Off', 'All guides');
    add('QUALITY', 'VRAM Scale Target', low ? '70' : '80', 'Tier1Settings and Astroboost (70 on 8 GB cards). ' + (b7 ? 'Frozen Tweaks says 60-70.' : 'Default is 90, which leaves no headroom.'));
    if (b7) add('QUALITY', 'Variable Rate Shading', 'On', 'Dot Esports and Dexerto: On. Hone: Off.');
    if (b6 || wz) add('QUALITY', 'Variable Rate Shading', 'Off', 'Dexerto (BO6) and Charlie Intel (Warzone)');

    if (mw) {
      add('DETAILS', 'Texture Resolution', pick(p, low ? 'Medium' : 'High', 'High', 'High'), 'Tier1Settings, FpsGen: High (Medium on 8 GB)');
    } else {
      add('DETAILS', 'Texture Resolution', pick(p, low ? 'Low' : 'Normal', low ? 'Normal' : 'High', 'High'), 'Most guides: Low or Normal. Costs VRAM more than FPS.');
    }
    if (old) {
      add('DETAILS', 'Texture Filter Anisotropic', pick(p, wz ? 'Normal' : 'Low', 'Normal', 'High'), 'Cheap setting. Hone says never below High.');
      add('DETAILS', 'Detail Quality', pick(p, 'Low', 'Normal', 'High'), '');
    }
    add('DETAILS', 'Particle Resolution', pick(p, (b7 || wz) ? 'Very Low' : 'Low', b7 ? 'Low' : 'Normal', 'High'), 'Lower also means thinner smoke and dust');
    add('DETAILS', 'Shadow Quality', pick(p, b6 ? 'Very Low' : 'Low', mw ? 'Medium' : 'Normal', 'High'), b7 ? 'Guides split: Dexerto and Frozen Tweaks say Low, Dot Esports and Hone say Normal. Most expensive setting here.' : 'The most expensive setting in the list');
    add('DETAILS', 'Screen Space Shadows', pick(p, 'Off', 'Off', 'On'), '');
    add('DETAILS', 'Occlusion and Screen Space Lighting', pick(p, mw ? 'Low' : 'Off', mw ? 'Medium' : 'Low', 'Normal'), mw ? 'FpsGen: Low' : 'Off in most guides');
    add('DETAILS', 'Screen Space Reflections', pick(p, 'Off', mw ? 'Normal' : 'Off', 'On'), 'Off in every max-FPS guide');
    if (old) {
      add('DETAILS', 'Static Reflection Quality', pick(p, 'Low', 'Low', 'Normal'), '');
      add('DETAILS', 'Shader Quality', pick(p, b7 ? 'Medium' : 'Low', 'Medium', 'High'), b7 ? 'Dot Esports and Hone: Medium. Dexerto: Low.' : 'All guides: Low. Let shader pre-compile finish first.');
      add('DETAILS', 'Persistent Effects', pick(p, 'Off', 'Off', 'On'), 'Guides split. Off in most max-FPS guides, On in Dexerto and Charlie Intel.');
      add('DETAILS', 'Bullet Impacts', 'On', 'Guides split (Dot Esports BO7 says Off). Small FPS effect.');
      add('DETAILS', 'On-Demand Texture Streaming', pick(p, 'Minimal', 'Optimized', 'Optimized'), 'Minimal in most guides. Dot Esports says Optimized.');
      add('DETAILS', 'Local Texture Streaming Quality', pick(p, b6 ? 'Normal' : 'Low', 'Normal', 'Normal'), '');
    } else {
      add('DETAILS', 'On-Demand Texture Streaming', pick(p, 'Optimized', 'Optimized', 'Optimized'), 'Tier1Settings. FpsGen low-end preset says Minimal.');
    }
    add('DETAILS', 'Volumetric Quality', pick(p, 'Low', mw ? 'Medium' : 'Low', 'Normal'), 'Low in every guide for max FPS');
    if (b6 || wz) add('DETAILS', 'Tessellation', pick(p, 'Near', 'Near', 'All'), 'Hone and Fpstweak: Near or Off');
    if (old) {
      add('DETAILS', 'Deferred Physics Quality', pick(p, b7 ? 'Low' : 'Off', 'Low', 'Normal'), '');
      add('DETAILS', 'Weather Grid Volumes', pick(p, 'Off', 'Low', 'Normal'), '');
      add('DETAILS', 'Water Quality', pick(p, 'Off', 'Low', 'Normal'), '');
    }

    add('EFFECTS', 'Motion Blur (World and Weapon)', 'Off', 'All guides. Hides moving enemies.');
    add('EFFECTS', 'Depth of Field', 'Off', 'All guides');
    add('EFFECTS', 'Film Grain', '0.00', '');

    add('VIEW', 'Field of View', pick(p, '105', '105', '110'), 'Guides range 100-115. Higher costs a little FPS.');
    if (old) add('VIEW', 'ADS Field of View', 'Affected', 'Dot Esports, Dexerto, Hone');
    add('VIEW', '1st-Person Camera Movement', 'Least (50%)', 'Dot Esports, Dexerto, Hone, Charlie Intel');
    return R;
  }

  var PRESET_INFO = {
    fps: { label: 'BEST FPS', blurb: 'The competitive profile: expensive effects trimmed, textures kept sensible, all blur and ray tracing off. Values are what most of the listed guides agree on.' },
    balanced: { label: 'BALANCED', blurb: 'The "balanced" tier from Hone and FpsGen: high refresh without the potato look.' }
  };

  var GAMES = [
    {
      id: 'wz', name: 'WARZONE', tag: 'BATTLE ROYALE // RESURGENCE', art: 'wz',
      config: true, codes: ['cod25', 'cod24'],
      blurb: 'Warzone shares the Call of Duty engine, so the worker-count tweak is applied to your newest Black Ops settings file.',
      sourceNote: 'Settings from Fpstweak (Aug 2026), setup.gg (Sep 2026), Charlie Intel (Feb 2025) and Dexerto (Nov 2026, FOV only). Warzone menus change per season.',
      sources: [
        ['Fpstweak: Best Warzone settings for max FPS', 'https://fpstweak.com/blog/best-warzone-settings-pc'],
        ['setup.gg: Best Warzone settings for high FPS', 'https://www.setup.gg/game/warzone/best-settings/'],
        ['Charlie Intel: Best Warzone PC settings', 'https://charlieintel.com/call-of-duty/best-pc-settings-for-warzone-2-211302'],
        ['Dexerto: Best Warzone PC settings', 'https://dexerto.com/call-of-duty/best-warzone-2-settings-on-pc-for-higher-fps-1986083']
      ]
    },
    {
      id: 'bo6', name: 'BLACK OPS 6', tag: 'MULTIPLAYER // ZOMBIES', art: 'bo6',
      config: true, codes: ['cod24'],
      blurb: 'The worker-count tweak is sourced for this game (Hone, Fpstweak) and is applied to its settings file.',
      sourceNote: 'Two readable guides: Dexerto (updated Aug 2025) and Hone (updated Aug 2026). Destructoid and Dot Esports could not be read, so they are not cited.',
      sources: [
        ['Dexerto: Best Black Ops 6 PC settings', 'https://dexerto.com/call-of-duty/best-black-ops-6-pc-settings-2884210'],
        ['Hone: Best Black Ops 6 settings for FPS', 'https://hone.gg/blog/best-black-ops-6-settings-for-fps/']
      ]
    },
    {
      id: 'bo7', name: 'BLACK OPS 7', tag: 'MULTIPLAYER // ZOMBIES', art: 'bo7',
      config: true, codes: ['cod25'],
      blurb: 'Kernel-level anti-cheat: this app only edits your own settings file, never the game or its folder.',
      sourceNote: 'Best-covered game: Dot Esports, Dexerto (Apr 2026), Frozen Tweaks (Oct 2026), Hone (Aug 2026). Timesaver was too generic to use.',
      sources: [
        ['Dot Esports: Best PC graphics settings in Black Ops 7', 'https://dotesports.com/call-of-duty/news/best-pc-graphics-settings-black-ops-7'],
        ['Dexerto: Best Black Ops 7 PC settings', 'https://www.dexerto.com/wikis/black-ops-7-guides-walkthrough-tips/best-pc-settings-black-ops-7/'],
        ['Frozen Tweaks: BO7 FPS boost', 'https://frozentweaks.com/guides/call-of-duty-black-ops-7-fps-boost'],
        ['Hone: Best BO7 settings for FPS', 'https://hone.gg/blog/cod-bo7-settings-for-fps/']
      ]
    },
    {
      id: 'mw4', name: 'MODERN WARFARE 4', tag: 'MULTIPLAYER // CAMPAIGN', art: 'mw4',
      config: false, codes: ['cod26'],
      configNote: 'Modern Warfare 4 is brand new, so this app only gives the best-FPS in-game settings for it. Config-file tweaks will be added once more guides cover them. Nothing on your PC is changed for this game.',
      blurb: 'Released Oct 23, 2026. Guides agree on the big levers: ray tracing off, VRAM Scale Target 80 (70 on 8 GB), upscaler on Quality.',
      sourceNote: 'Tier1Settings (updated Nov 11), FpsGen (Oct 21), Astroboost (updated Nov 18) and Esports.gg. Activision lists TPM 2.0 and Secure Boot as required.',
      sources: [
        ['Tier1Settings: Best MW4 settings for FPS', 'https://tier1settings.com/best-modern-warfare-4-settings-for-fps/'],
        ['FpsGen: MW4 best PC settings', 'https://fpsgen.com/guides/modern-warfare-4-best-pc-settings'],
        ['Astroboost: MW4 best PC settings for FPS', 'https://astroboost.gg/guides/what-are-the-mw4-best-pc-settings-for-fps'],
        ['Esports.gg: Best PC graphics settings for MW4', 'https://esports.gg/guides/call-of-duty/best-pc-graphics-settings-to-boost-fps-in-modern-warfare-4/']
      ]
    }
  ];

  var FACTCHECK = [
    ['VERIFIED', 'A per-CPU core number in the config file helps FPS and stutter.',
      'The real key is RendererWorkerCount (there is no literal "CCD" setting). Hone, Fpstweak and Frozen Tweaks describe it for Black Ops 6 and 7. The app picks the number automatically: your performance-core count on Intel hybrid chips, cores minus 1 on other chips, never more than 8. Guides differ by one, so judge by 1% lows, not average FPS. Undo is one click.'],
    ['NOT APPLIED', 'The same tweak for Modern Warfare 4.',
      'None of the MW4 guides mention a config edit, so the app leaves MW4 files alone.'],
    ['UNVERIFIED', 'It "forces the game onto P-cores" on Intel hybrid CPUs.',
      'One source claims this. Windows decides thread placement. The setting only controls how many render worker threads the game creates.'],
    ['NOT APPLIED', 'Turn off dead bodies / blood / brass in the config (CorpseLimit, ShowBlood, ShowBrass, GPUUploadHeaps).',
      'One BO6 guide lists these keys and nothing else backs it up, so the app does not touch them. Lowering Persistent Effects and Particle Resolution in-game is the version several guides agree on.'],
    ['SINGLE SOURCE', 'The config also has a VideoMemoryScale value matching the in-game VRAM Scale Target.',
      'One article names this key. Off by default, found under Settings > Advanced.'],
    ['VERIFIED', 'The game rewrites the file sometimes.',
      'Some guides suggest locking the file read-only, but that stops the game saving any menu change. The app does not lock by default. Instead it checks the value each time you open it and shows RE-APPLY if the game changed it back. A lock option remains in Settings > Advanced.'],
    ['GUIDES DISAGREE', 'Variable Rate Shading, Persistent Effects, Bullet Impacts, upscaler vs CAS on BO7/BO6.',
      'The checklist uses the majority and says in the Note column when guides split. If you disagree with a value, your own testing wins.'],
    ['VERIFIED', 'Windows settings the guides mention.',
      'Game Mode On, Power mode Best performance / High performance plan, RAM at XMP/EXPO speed, Game Bar background recording off, TPM 2.0 + Secure Boot for MW4. The Windows checks on Home only read these and open the right Windows page. HAGS: Hone says On, Tier1Settings says test both.'],
    ['NOT APPLIED', 'Turning off VBS / Memory Integrity, timer-resolution tools, Process Lasso, pagefile resizing.',
      'Each comes from one or two guides, lowers security, or needs a third-party tool. The app only shows VBS status. You can decide yourself.'],
    ['SAFETY', 'Why no kernel-driver hardware tools (PawnIO and similar)?',
      'RICOCHET is a kernel-level anti-cheat, and a second kernel driver adds both ban and crash risk for no benefit here. Windows already reports CPU cores, GPU, video memory and refresh rate through built-in read-only queries, which is all this app uses.'],
    ['SAFETY', 'Will this get me banned?',
      'The app edits one text value in a settings file in your own user folders, the same as doing it by hand in Notepad. It never touches the game process, memory or install folder. Nobody outside Activision can promise how they treat it, so stay with this one key, keep the automatic backups, and avoid any tool that hooks the game.']
  ];

  return { VERSION: VERSION, GAMES: GAMES, PRESETS: PRESET_INFO, rows: rows, FACTCHECK: FACTCHECK, FILES: FILES };
})();
if (typeof module !== 'undefined') module.exports = Data;
