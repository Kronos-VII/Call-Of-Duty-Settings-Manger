/* art.js - original SVG banners (no official logos or trademarked art). ES5. */
var Art = (function () {
  var W = 1400, H = 190;

  function defs(id) {
    return '<defs>' +
      '<linearGradient id="bg' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#050506"/><stop offset=".55" stop-color="#14090a"/><stop offset="1" stop-color="#4a0200"/></linearGradient>' +
      '<linearGradient id="rd' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff3a2e"/><stop offset="1" stop-color="#9a0500"/></linearGradient>' +
      '<pattern id="st' + id + '" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="9" height="18" fill="#e10600" opacity=".10"/></pattern>' +
      '<pattern id="gr' + id + '" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity=".035"/></pattern>' +
      '</defs>';
  }

  function title(name, tag, size) {
    return '<g font-family="Impact, Arial Narrow, sans-serif">' +
      '<text x="62" y="112" font-size="' + size + '" fill="none" stroke="#ff2a1f" stroke-width="2" letter-spacing="6" opacity=".55" transform="translate(5,5)">' + name + '</text>' +
      '<text x="62" y="112" font-size="' + size + '" fill="#ffffff" letter-spacing="6">' + name + '</text>' +
      '<rect x="62" y="130" width="86" height="4" fill="#e10600"/>' +
      '<text x="162" y="136" font-size="15" fill="#ff5a50" letter-spacing="5" font-family="Bahnschrift, Segoe UI, Arial">' + tag + '</text></g>';
  }

  function crosshair(cx, cy, r, op) {
    return '<g stroke="#ff2a1f" fill="none" opacity="' + op + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke-width="2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.62) + '" stroke-width="1" stroke-dasharray="4 6"/>' +
      '<path d="M' + (cx - r - 30) + ' ' + cy + 'H' + (cx - r * 0.35) + 'M' + (cx + r * 0.35) + ' ' + cy + 'H' + (cx + r + 30) + 'M' + cx + ' ' + (cy - r - 30) + 'V' + (cy - r * 0.35) + 'M' + cx + ' ' + (cy + r * 0.35) + 'V' + (cy + r + 30) + '" stroke-width="2"/></g>';
  }

  function chevrons(x, y, n, op) {
    var s = '<g fill="#e10600" opacity="' + op + '">';
    for (var i = 0; i < n; i++) {
      var o = x + i * 34;
      s += '<path d="M' + o + ' ' + y + 'l26 0 l26 40 l-26 40 l-26 0 l26 -40z"/>';
    }
    return s + '</g>';
  }

  function hex(cx, cy, r) {
    var p = [], i, a;
    for (i = 0; i < 6; i++) { a = Math.PI / 3 * i + Math.PI / 6; p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
    return '<polygon points="' + p.join(' ') + '"/>';
  }

  function base(id, inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMinYMid slice">' + defs(id) +
      '<rect width="' + W + '" height="' + H + '" fill="url(#bg' + id + ')"/>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#gr' + id + ')"/>' + inner +
      '<rect y="' + (H - 5) + '" width="' + W + '" height="5" fill="url(#rd' + id + ')"/>' +
      '<path d="M0 0H' + W + 'V' + H + 'H0z" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="2"/></svg>';
  }

  var pieces = {
    wz: function () {
      var rings = '', i;
      for (i = 1; i <= 5; i++) rings += '<circle cx="1120" cy="105" r="' + (i * 34) + '" fill="none" stroke="#ff2a1f" stroke-opacity="' + (0.5 - i * 0.07) + '" stroke-width="1.5"/>';
      return '<rect x="760" width="700" height="' + H + '" fill="url(#st' + 'wz)"/>' + rings +
        '<path d="M1120 105 L1290 20 A190 190 0 0 1 1310 90z" fill="#e10600" opacity=".22"/>' +
        '<circle cx="1200" cy="62" r="5" fill="#ff3a2e"/><circle cx="1040" cy="150" r="4" fill="#ff3a2e" opacity=".7"/><circle cx="1230" cy="140" r="3" fill="#fff" opacity=".6"/>' +
        chevrons(560, 55, 4, 0.55) + title('WARZONE', 'BATTLE ROYALE  //  RESURGENCE', 84);
    },
    bo6: function () {
      var g = '<g fill="none" stroke="#ff2a1f" stroke-opacity=".35" stroke-width="1.5">', r, c;
      for (r = 0; r < 4; r++) for (c = 0; c < 9; c++) g += hex(790 + c * 69 + (r % 2) * 34, 28 + r * 60, 40);
      g += '</g>';
      return '<rect x="700" width="700" height="' + H + '" fill="url(#st' + 'bo6)"/>' + g +
        '<text x="1010" y="160" font-family="Impact, Arial Narrow, sans-serif" font-size="210" fill="#e10600" opacity=".30" letter-spacing="-6">06</text>' +
        crosshair(1250, 95, 52, 0.7) + title('BLACK OPS 6', 'MULTIPLAYER  //  ZOMBIES', 78);
    },
    bo7: function () {
      return '<path d="M880 0 L1400 0 L1400 190 L800 190z" fill="#e10600" opacity=".08"/>' +
        '<path d="M960 0 L1010 0 L900 190 L850 190z" fill="#e10600" opacity=".35"/><path d="M1040 0 L1070 0 L960 190 L930 190z" fill="#fff" opacity=".10"/>' +
        '<text x="1060" y="168" font-family="Impact, Arial Narrow, sans-serif" font-size="230" fill="none" stroke="#ff2a1f" stroke-width="3" opacity=".55" letter-spacing="-4">07</text>' +
        '<rect x="1200" y="30" width="150" height="3" fill="#ff2a1f" opacity=".6"/><rect x="1240" y="42" width="110" height="3" fill="#ff2a1f" opacity=".4"/>' +
        chevrons(700, 55, 3, 0.45) + title('BLACK OPS 7', 'MULTIPLAYER  //  ZOMBIES', 78);
    },
    mw4: function () {
      var lines = '', i;
      for (i = 0; i < 12; i++) lines += '<path d="M1180 95 L' + (1180 + Math.cos(i * 0.52) * 260) + ' ' + (95 + Math.sin(i * 0.52) * 260) + '" stroke="#ff2a1f" stroke-opacity=".12" stroke-width="2"/>';
      return '<rect x="720" width="700" height="' + H + '" fill="url(#st' + 'mw4)"/>' + lines +
        crosshair(1180, 95, 66, 0.8) +
        '<path d="M1180 95 m-96 0 a96 96 0 0 1 192 0" fill="none" stroke="#fff" stroke-opacity=".15" stroke-width="10"/>' +
        chevrons(900, 55, 3, 0.5) + title('MODERN WARFARE 4', 'MULTIPLAYER  //  CAMPAIGN', 58);
    },
    home: function () {
      var rings = '', i;
      for (i = 1; i <= 4; i++) rings += '<circle cx="1160" cy="95" r="' + (i * 40) + '" fill="none" stroke="#ff2a1f" stroke-opacity="' + (0.45 - i * 0.08) + '" stroke-width="1.5"/>';
      return '<rect x="760" width="700" height="' + H + '" fill="url(#st' + 'home)"/>' + rings + crosshair(1160, 95, 54, 0.75) +
        '<path d="M700 190 L860 0 L900 0 L740 190z" fill="#e10600" opacity=".35"/><path d="M760 190 L920 0 L935 0 L775 190z" fill="#fff" opacity=".08"/>' +
        chevrons(640, 58, 3, 0.5) + title('CONFIGURATOR', 'WARZONE  //  BO6  //  BO7  //  MW4', 80);
    },
    settings: function () {
      return '<rect x="720" width="700" height="' + H + '" fill="url(#st' + 'settings)"/>' + crosshair(1190, 95, 58, 0.55) + chevrons(600, 55, 3, 0.45) + title('SETTINGS', 'UPDATES  //  CUSTOM ART  //  YOUR PC', 84);
    },
    about: function () {
      return '<rect x="700" width="700" height="' + H + '" fill="url(#st' + 'about)"/>' + crosshair(1180, 95, 60, 0.6) + chevrons(930, 55, 3, 0.5) + title('SOURCES &amp; SAFETY', 'WHAT IS VERIFIED  //  WHAT IS NOT', 70);
    }
  };

  function banner(kind) { return base(kind, pieces[kind]()); }
  return { banner: banner };
})();
if (typeof module !== 'undefined') module.exports = Art;
