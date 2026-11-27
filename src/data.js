/* data.js - games, presets, sources, fact-check. ES5, ASCII only. Edit freely: this is the only place settings values live.
   Values are the MAJORITY of the guides listed per game (fetched Nov 2026). Where guides disagree, the note says so. */
var Data = (function () {
  var VERSION = '1.3.0';

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


  // ---------- Modern Warfare 4 (launch menus, Oct 2026) ----------
  // Best FPS = what most launch guides agree on: Hone (Oct 20), Dexerto, esports.gg, Dot Esports, backed by the
  // PC Gamer benchmark (four settings cost most: Detail, Shadow, Shadow filtering, Terrain) and TroubleChute's
  // per-setting tests. Quality = PC Gamer's high-end advice (Ultra-level detail) with TroubleChute's
  // "big cost, little visual gain" settings kept down, so it still plays well.
  function mw4Rows(p, ctx) {
    var up = upscaler(ctx.vendor), lat = latency(ctx.vendor), low = ctx.lowVram, hz = ctx.hz || 0, qm = Core.scaleMode(ctx.h || 0), R = [], q = p === 'quality';
    function add(g, s, v, n) { R.push({ group: g, setting: s, value: v, note: n || '' }); }
    function v(fps, quality) { return q ? quality : fps; }

    add('DISPLAY', 'Display Mode', 'Fullscreen Exclusive', 'Dexerto, esports.gg, NoobFeed. Unlocks the refresh-rate and resolution controls. Borderless if you alt-tab a lot.');
    add('DISPLAY', 'Screen Refresh Rate', 'Your monitor\'s highest Hz', hz ? 'Windows reports ' + hz + ' Hz' : '');
    add('DISPLAY', 'Display Resolution', 'Native', 'Hone: the menu itself recommends native for HUD clarity');
    add('DISPLAY', lat[0], lat[1], 'Dexerto and esports.gg: On + Boost. Plain On saves GPU power.');
    add('DISPLAY', 'V-Sync (Gameplay)', 'Off', 'Every guide. Adds input lag.');
    add('DISPLAY', 'Custom Frame Rate Limit', hz ? 'Custom: ' + (hz - 3) : 'Custom: refresh rate minus 3', 'Dexerto, Tier1Settings, FpsGen: a few frames under your refresh rate keeps frame times steady');
    add('DISPLAY', 'Focused Mode', '0', 'Dexerto and esports.gg');
    add('DISPLAY', 'High Dynamic Range (HDR)', 'Off', 'Dexerto');
    add('DISPLAY', 'Background Shader Preloading', 'On', 'Hone, Dexerto, AllThings.How. Let it finish before your first match and again after a driver update.');

    add('QUALITY', 'Graphic Preset', v('Custom', 'Ultra, then change the rows below'), q ? 'PC Gamer: Ultra for high-end PCs, Balanced for mid-range' : 'Every guide. Built-in presets turn costly options back on.');
    add('QUALITY', 'Upscaling / Sharpening', v(up + ' ' + qm, ctx.vendor === 'nvidia' ? 'DLAA (or DLSS Quality below your refresh rate)' : up + ' Native AA (or ' + up + ' Quality below your refresh rate)'),
      q ? 'TroubleChute: DLAA for image quality on NVIDIA' : 'Hone and PC Gamer: Quality mode (Balanced at 4K). esports.gg alone uses Performance.');
    add('QUALITY', 'Sharpness', '75-80', 'Dexerto 80, esports.gg 75');
    add('QUALITY', 'Frame Generation', 'Off', 'Hone, Dexerto, esports.gg: adds input latency');
    add('QUALITY', 'Ray Tracing', 'Off', q ? 'TroubleChute: the biggest cost after upscaling and preset. Campaign only if you want it.' : 'Every guide');
    add('QUALITY', 'VRAM Scale Target', low ? '70' : '80', 'esports.gg and Tier1Settings 80 (70 on 8 GB cards). Dexerto 75, Hone 85.');
    add('QUALITY', 'Variable Rate Shading', 'On', 'Dexerto. On is the default.');

    add('DETAILS', 'Texture Resolution', v(low ? 'Low' : 'Normal', low ? 'Normal' : 'High'), 'Dexerto, esports.gg, Dot Esports: Normal. TroubleChute: almost no FPS cost if it fits your VRAM.');
    add('DETAILS', 'Texture Filter Anisotropic', v('Low', 'High'), 'Hone, Dexerto, esports.gg, Dot Esports: Low. TroubleChute: almost no cost.');
    add('DETAILS', 'Detail Quality', v('Low', 'High'), q ? 'PC Gamer: do not go below High if blocky trees bother you' : 'Hone and Dexerto: Low. esports.gg and Dot Esports: Normal. One of PC Gamer\'s four costliest settings.');
    add('DETAILS', 'Particle Resolution', v('Very Low', 'Normal'), 'Hone, Dexerto, Dot Esports: Very Low. Lower also means thinner smoke.');
    add('DETAILS', 'Bullet Impacts', 'On', 'Hone, Dexerto, Dot Esports. Shows where shots land.');
    add('DETAILS', 'Persistent Effects', 'Off', 'Hone and esports.gg. TroubleChute: big FPS drops during explosions.');
    add('DETAILS', 'Shader Quality', v('Low', 'Medium'), 'Hone, Dexerto, esports.gg: Low. TroubleChute: Medium helps 1% lows over High.');
    add('DETAILS', 'Shading Quality', v('Low', 'High'), 'Hone and esports.gg: Low. TroubleChute: negligible cost.');
    add('DETAILS', 'Terrain Quality', v('Very Low', 'High'), 'Hone and Dexerto: Very Low. TroubleChute: Very High costs a lot for a tiny visual gain.');
    add('DETAILS', 'On-Demand Texture Streaming', v('Minimal', 'Optimized'), 'Hone and Dexerto: Minimal. esports.gg: Optimized.');
    add('DETAILS', 'Local Texture Streaming Quality', v('Low', 'Normal'), 'Hone, Dexerto, esports.gg');
    add('DETAILS', 'In-Game Video Quality', 'Standard', 'Hone, Dexerto, esports.gg');

    add('SHADOWS AND LIGHTING', 'Shadow Quality', v('Very Low', 'Normal'), 'Hone, Dexerto, esports.gg: Very Low. TroubleChute: the biggest single FPS gain when lowered.');
    add('SHADOWS AND LIGHTING', 'Shadow Filtering Quality', v('Low', 'Normal'), 'Hone, Dexerto, esports.gg: Low. TroubleChute: surprisingly costly at High.');
    add('SHADOWS AND LIGHTING', 'Screen Space Shadows', v('Off', 'On'), 'Every Best FPS guide: Off');
    add('SHADOWS AND LIGHTING', 'Occlusion and Screen Space Lighting', v('Off', 'Medium'), 'Hone, Dexerto, esports.gg: Off. TroubleChute: little difference between levels.');
    add('SHADOWS AND LIGHTING', 'Screen Space Reflections', v('Off', 'High'), 'Off in every Best FPS guide. TroubleChute: High if you keep it on.');
    add('SHADOWS AND LIGHTING', 'Static Reflection Quality', v('Low', 'Normal'), 'Hone, Dexerto, esports.gg. Needs a game restart.');
    add('SHADOWS AND LIGHTING', 'Volumetric Quality', v('Low', 'Medium'), 'Hone, Dexerto, esports.gg');
    add('SHADOWS AND LIGHTING', 'Deferred Physics Quality', v('Off', 'Medium'), 'Hone, Dexerto, esports.gg: Off. TroubleChute: Medium for quality.');
    add('SHADOWS AND LIGHTING', 'Weather Grid Volumes Quality', v('Off', 'Low'), 'Dexerto and esports.gg: Off. Hone: Low.');
    add('SHADOWS AND LIGHTING', 'Water Quality', v('Off', 'Low'), 'Hone, Dexerto, esports.gg. TroubleChute: noticeable FPS gain when off.');

    add('EFFECTS', 'World and Weapon Motion Blur', 'Off', 'Every guide. Hides moving enemies.');
    add('EFFECTS', 'World and Weapon Depth of Field', 'Off', 'Hone, Dexerto, esports.gg. TroubleChute: Off makes aiming down sights clearer.');
    add('EFFECTS', 'Film Grain', '0.00', 'Dexerto and AllThings.How (Hone keeps the 0.20 default)');

    add('VIEW', 'Field of View', v('110', '105'), 'Guides range 100-120. 120 shows the most; 105-110 makes targets bigger.');
    add('VIEW', 'Enhanced FOV', 'Off', 'Dexerto and esports.gg');
    add('VIEW', 'ADS Field of View', 'Affected', 'Dexerto');
    add('VIEW', '1st and 3rd Person Camera Movement', 'Minimal (25%)', 'Dexerto, esports.gg, Dot Esports. Less screen shake.');
    return R;
  }

  // Builds the checklist for one game / preset. ctx = { vendor, lowVram, hz, h }
  function rows(game, p, ctx) {
    if (game.id === 'mw4') return mw4Rows(p, ctx);
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
    fps: { label: 'Best FPS', blurb: 'The competitive profile: expensive effects trimmed, textures kept sensible, all blur and ray tracing off. Values are what most of the listed guides agree on.' },
    balanced: { label: 'Balanced', blurb: 'The "balanced" tier from Hone and FpsGen: high refresh without the potato look.' },
    quality: { label: 'Quality', blurb: 'For strong PCs: Ultra-level detail and sharp textures, with the settings that cost a lot for little visual gain (ray tracing, persistent effects, top terrain and shadow filtering) kept down so it still plays smoothly.' }
  };

  var GAMES = [
    {
      id: 'wz', name: 'WARZONE', tag: 'Battle royale and Resurgence', art: 'wz',
      config: true, codes: ['cod25', 'cod24'], presets: ['fps', 'balanced'],
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
      id: 'bo6', name: 'BLACK OPS 6', tag: 'Multiplayer and Zombies', art: 'bo6',
      config: true, codes: ['cod24'], presets: ['fps', 'balanced'],
      blurb: 'The worker-count tweak is sourced for this game (Hone, Fpstweak) and is applied to its settings file.',
      sourceNote: 'Two readable guides: Dexerto (updated Aug 2025) and Hone (updated Aug 2026). Destructoid and Dot Esports could not be read, so they are not cited.',
      sources: [
        ['Dexerto: Best Black Ops 6 PC settings', 'https://dexerto.com/call-of-duty/best-black-ops-6-pc-settings-2884210'],
        ['Hone: Best Black Ops 6 settings for FPS', 'https://hone.gg/blog/best-black-ops-6-settings-for-fps/']
      ]
    },
    {
      id: 'bo7', name: 'BLACK OPS 7', tag: 'Multiplayer, Zombies and Endgame', art: 'bo7',
      config: true, codes: ['cod25'], presets: ['fps', 'balanced'],
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
      id: 'mw4', name: 'MODERN WARFARE 4', tag: 'Multiplayer, DMZ and Campaign', art: 'mw4',
      config: 'optin', codes: ['cod26'], presets: ['fps', 'quality'],
      optinNote: 'Turned on by you. Modern Warfare 4 has the same render-thread line in its settings file, but no MW4 guide has tested the tweak yet. Turn off puts the original value back.',
      configNote: 'Modern Warfare 4 keeps the same render-thread line in its settings file (s.1.0.cod26), but no MW4 guide has tested the tweak yet, so it is off unless you turn it on. Your in-game settings are set with the checklist.',
      blurb: 'Released Oct 23, 2026. Every launch guide agrees on the big levers: ray tracing and frame generation off, shadows and shadow filtering low, persistent effects off, upscaler on Quality.',
      sourceNote: 'Launch-menu guides: Hone (Oct 20, 2026), Dexerto, esports.gg and Dot Esports. Benchmarks: PC Gamer (RX 9070 XT, 7800X3D, 1440p) and TroubleChute. Earlier: Tier1Settings and FpsGen. No pro player has published a verified MW4 graphics list yet, so the values are what the most guides agree on.',
      sources: [
        ['Hone: Modern Warfare 4 best PC settings for FPS and visibility', 'https://hone.gg/blog/modern-warfare-4-best-pc-settings'],
        ['Dexerto: Best MW4 PC settings', 'https://www.dexerto.com/wikis/modern-warfare-4/best-pc-settings/'],
        ['esports.gg: Best PC graphics settings for MW4', 'https://esports.gg/guides/call-of-duty/best-pc-graphics-settings-to-boost-fps-in-modern-warfare-4/'],
        ['Dot Esports: Best MW4 PC graphics settings', 'https://dotesports.com/call-of-duty/guides/best-cod-mw4-pc-graphics-settings'],
        ['PC Gamer: Every MW4 graphics setting tested', 'https://pcgamer.com/games/call-of-duty/ive-tested-every-graphics-setting-in-call-of-duty-modern-warfare-4-tweak-these-four-options-for-the-best-performance'],
        ['TroubleChute: MW4 optimization benchmarks', 'https://fps.tcno.co/mw4-optimization/'],
        ['Tier1Settings: Best MW4 settings for FPS', 'https://tier1settings.com/best-modern-warfare-4-settings-for-fps/']
      ]
    }
  ];

  var FACTCHECK = [
    ['VERIFIED', 'A per-CPU core number in the config file helps FPS and stutter.',
      'The real key is RendererWorkerCount (there is no literal "CCD" setting). Hone, Fpstweak and Frozen Tweaks describe it for Black Ops 6 and 7. The app picks the number automatically from the core layout Windows reports: your performance-core count on Intel hybrid chips, cores minus 1 on other chips, no more than one chiplet\'s cores on dual-chiplet Ryzen (Hone: keep threads on one CCD), never more than 8. Guides differ by one, so judge by 1% lows, not average FPS. Undo puts the old value back.'],
    ['VERIFIED', 'Guides show the line as RendererWorkerCount = "8".',
      'The real files write it differently per game: RendererWorkerCount:0.0 = "4" in Modern Warfare II, and RendererWorkerCount@0;51989;59387 = 16 in MW III, Black Ops 6 and Black Ops 7, often in two copies (.txt0 and .txt1). The app reads all of these, changes every live copy, keeps the comment and the allowed range, and never touches commented-out lines.'],
    ['OPTIONAL', 'The same tweak for Modern Warfare 4.',
      'MW4 keeps the RendererWorkerCount line in its settings file, but the launch guides (Hone, Dexerto, esports.gg) do not test it, and some warn that no MW4 config edit is verified yet. So it is off by default. You can turn it on for MW4 on its page; it is applied and undone the same way as the other games.'],
    ['NOT VERIFIED', 'Pro players\' MW4 graphics settings.',
      'No pro player or team has published a verified MW4 graphics list yet. Sites that claim "pro consensus" give no source. The MW4 Best FPS list is what the most launch guides agree on, checked against the PC Gamer and TroubleChute benchmarks.'],
    ['UNVERIFIED', 'It "forces the game onto P-cores" on Intel hybrid CPUs.',
      'One source claims this. Windows decides thread placement. The setting only controls how many render worker threads the game creates.'],
    ['NOT APPLIED', 'Turn off dead bodies / blood / brass in the config (CorpseLimit, ShowBlood, ShowBrass, GPUUploadHeaps).',
      'One BO6 guide lists these keys and nothing else backs it up, so the app does not touch them. Lowering Persistent Effects and Particle Resolution in-game is the version several guides agree on.'],
    ['SINGLE SOURCE', 'The config also has a VideoMemoryScale value matching the in-game VRAM Scale Target.',
      'One article names this key. Off by default, found under Settings > Advanced.'],
    ['VERIFIED', 'The game rewrites the file sometimes.',
      'Some guides suggest locking the file read-only, but that stops the game saving any menu change. The app does not lock by default. Instead it checks the value whenever you switch back to it and puts it back automatically (or shows Re-apply if you turned that off). A lock option remains in Settings, Advanced.'],
    ['GUIDES DISAGREE', 'Variable Rate Shading, Persistent Effects, Bullet Impacts, upscaler vs CAS on BO7/BO6.',
      'The checklist uses the majority and says in the Note column when guides split. If you disagree with a value, your own testing wins.'],
    ['VERIFIED', 'Windows settings the guides mention.',
      'Game Mode On, Power mode Best performance / High performance plan, RAM at XMP/EXPO speed, Game Bar background recording off, TPM 2.0 + Secure Boot for MW4. The Windows checks on Home only read these and open the right Windows page. HAGS: Hone says On, Tier1Settings says test both.'],
    ['NOT APPLIED', 'Turning off VBS / Memory Integrity, timer-resolution tools, Process Lasso, pagefile resizing.',
      'Each comes from one or two guides, lowers security, or needs a third-party tool. The app only shows VBS status. You can decide yourself.'],
    ['SAFETY', 'Why no kernel-driver hardware tools (PawnIO and similar)?',
      'RICOCHET is a kernel-level anti-cheat, and a second kernel driver adds both ban and crash risk for no benefit here. Windows already reports CPU cores, GPU, video memory and refresh rate through built-in read-only queries, which is all this app uses.'],
    ['SAFETY', 'Will this get me banned?',
      'The app edits one value in a settings file in your own user folders, the same as doing it by hand in Notepad, and keeps the rest of the file byte for byte. It never touches the game process, memory or install folder. Nobody outside Activision can promise how they treat it, so stay with this one key, keep the automatic backups, and avoid any tool that hooks the game.']
  ];

  return { VERSION: VERSION, GAMES: GAMES, PRESETS: PRESET_INFO, rows: rows, FACTCHECK: FACTCHECK, FILES: FILES };
})();
if (typeof module !== 'undefined') module.exports = Data;
