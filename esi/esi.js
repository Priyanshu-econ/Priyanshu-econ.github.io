/* Energy Security Index dashboard. Plain JavaScript and SVG, no libraries. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var FONT = 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif';
  var SOURCE = 'Source: © 2026 Priyanshu Chavda, Energy Security Index v1.0, priyanshu-econ.github.io/esi · CC BY 4.0, cite when reused';
  var D, META, YEARS, BYISO = {}, WORLD;
  var state = { measure: 'esi', year: 2024, country: null, picked: false, cmpMeasure: 'esi', cmp: [], filter: null };
  var REGIONS = {
    'Europe': ['BEL', 'DNK', 'FIN', 'FRA', 'DEU', 'HUN', 'ITA', 'NLD', 'NOR', 'POL', 'PRT', 'ESP', 'SWE', 'CHE', 'GBR', 'UKR', 'RUS', 'TUR'],
    'Americas': ['ARG', 'BRA', 'CAN', 'CHL', 'COL', 'MEX', 'PER', 'USA', 'VEN'],
    'Asia and Pacific': ['AUS', 'CHN', 'IND', 'IDN', 'JPN', 'MYS', 'PHL', 'KOR', 'THA'],
    'Middle East and Africa': ['EGY', 'ISR', 'SAU', 'ZAF']
  };
  function inFilter(c) { return !state.filter || !!state.filter[c.iso3]; }
  function shown() { return D.countries.filter(inFilter); }
  function filterNote() { var n = shown().length; return n === D.countries.length ? '' : ' Showing ' + n + ' of ' + D.countries.length + ' countries; ranks are among all ' + D.countries.length + '.'; }

  // ---------- helpers ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, a) {
    a = a || {};
    var t = el('text', { x: x, y: y, fill: a.fill || css('--viz-muted'), 'font-size': a.size || 11, 'font-family': FONT,
      'text-anchor': a.anchor || 'start', 'font-weight': a.weight || null, 'dominant-baseline': a.base || null }, parent);
    t.textContent = s;
    return t;
  }
  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function fmt(v, d) { if (v == null || isNaN(v)) return '–'; return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function rawFmt(v) {
    if (v == null) return '–';
    var a = Math.abs(v);
    return fmt(v, a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 1 : 2);
  }
  function yi(y) { return YEARS.indexOf(y); }
  function quantile(arr, q) { var a = arr.slice().sort(function (x, y) { return x - y; }); var p = (a.length - 1) * q, b = Math.floor(p); return a[b] + (a[Math.min(b + 1, a.length - 1)] - a[b]) * (p - b); }
  function niceTicks(lo, hi, n) {
    var span = hi - lo || Math.abs(hi) || 1, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var t = [], s = Math.ceil(lo / step) * step;
    for (var v = s; v <= hi + step * 1e-9; v += step) t.push(+v.toFixed(10));
    return t;
  }
  function tickFmt(v) { var a = Math.abs(v); if (a >= 10000) return (v / 1000).toLocaleString('en-US') + 'K'; return v.toLocaleString('en-US', { maximumFractionDigits: 3 }); }
  function toast(s) { var t = $('#toast'); t.textContent = s; t.classList.add('on'); setTimeout(function () { t.classList.remove('on'); }, 1600); }

  // ---------- measures ----------
  function measures() {
    var m = [{ key: 'esi', label: 'Energy Security Index', group: 'Index', score: 'esi' }];
    META.dimensions.forEach(function (d) { m.push({ key: d.toLowerCase(), label: d, group: 'Dimensions', score: d.toLowerCase() }); });
    META.indicators.forEach(function (i) { m.push({ key: i.key, label: i.label, group: 'Indicators · ' + i.dim, score: i.key + '_score', raw: i.key, ind: i }); });
    return m;
  }
  var MEASURES;
  function M(key) { for (var i = 0; i < MEASURES.length; i++) if (MEASURES[i].key === key) return MEASURES[i]; }
  function fillSelect(sel, list, val) {
    sel.innerHTML = '';
    var groups = {};
    list.forEach(function (m) {
      if (!groups[m.group]) { groups[m.group] = document.createElement('optgroup'); groups[m.group].label = m.group; sel.appendChild(groups[m.group]); }
      var o = document.createElement('option'); o.value = m.key; o.textContent = m.label; groups[m.group].appendChild(o);
    });
    sel.value = val;
  }

  // ---------- colour classes (pooled quintiles, so colours mean the same thing in every year) ----------
  function classes(scoreKey) {
    var all = [];
    D.countries.forEach(function (c) { c.v[scoreKey].forEach(function (x) { if (x != null) all.push(x); }); });
    var b = [quantile(all, .2), quantile(all, .4), quantile(all, .6), quantile(all, .8)];
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    var cols = ['--q1', '--q2', '--q3', '--q4', '--q5'].map(css);
    return {
      breaks: b, lo: lo, hi: hi, cols: cols,
      color: function (v) { if (v == null) return css('--viz-empty'); for (var i = 0; i < 4; i++) if (v <= b[i]) return cols[i]; return cols[4]; },
      labels: function () { var e = [lo].concat(b, [hi]); return cols.map(function (c, i) { return { color: c, label: fmt(e[i], 2) + '–' + fmt(e[i + 1], 2) }; }); }
    };
  }

  // ---------- tooltip ----------
  var tip;
  function showTip(evt, title, rows) {
    tip.innerHTML = '';
    tip.appendChild(h('div', 't', title));
    rows.forEach(function (r) {
      var row = h('div', 'r'), lab = h('span');
      if (r.color) { var i = h('i'); i.style.background = r.color; lab.appendChild(i); }
      lab.appendChild(document.createTextNode(r.label));
      row.appendChild(lab); row.appendChild(h('b', null, r.value));
      tip.appendChild(row);
    });
    tip.classList.add('on');
    moveTip(evt);
  }
  function moveTip(evt) {
    var x = evt.clientX + 14, y = evt.clientY + 14, w = tip.offsetWidth, hh = tip.offsetHeight;
    if (x + w > window.innerWidth - 8) x = evt.clientX - w - 14;
    if (y + hh > window.innerHeight - 8) y = evt.clientY - hh - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.classList.remove('on'); }

  // ---------- legend (HTML on the page, kept for the exported image too) ----------
  function legend(fig, items) {
    fig._legend = items;
    var box = $('.legend', fig); if (!box) return;
    box.innerHTML = '';
    items.forEach(function (it) {
      var k = h('span', 'key'), s = h('span', it.type === 'line' ? 'ln' : 'sw' + (it.type === 'hatch' ? ' hatch' : ''));
      if (it.type !== 'hatch') s.style.background = it.color;
      if (it.type === 'band') s.style.opacity = .25;
      k.appendChild(s); k.appendChild(document.createTextNode(it.label)); box.appendChild(k);
    });
  }
  function heads(fig, title, sub) { $('[data-title]', fig).textContent = title; $('[data-sub]', fig).textContent = sub; fig._title = title; fig._sub = sub; }
  function plotWidth(fig) { return Math.max(280, $('.plot', fig).clientWidth || 600); }
  function newSvg(fig, w, hgt) {
    var p = $('.plot', fig); p.innerHTML = '';
    var s = el('svg', { viewBox: '0 0 ' + w + ' ' + hgt, width: w, height: hgt, role: 'img', 'aria-label': fig._title || '' }, p);
    return s;
  }
  function hatchDef(svg) {
    var defs = el('defs', {}, svg);
    var p = el('pattern', { id: 'hatch', patternUnits: 'userSpaceOnUse', width: 5, height: 5, patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 5, height: 5, fill: css('--viz-empty') }, p);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: css('--viz-hatch'), 'stroke-width': 1.6 }, p);
  }
  function valueRows(c, i, m) {
    var rows = [{ label: 'Score (0–1)', value: fmt(c.v[m.score][i], 3) }];
    if (m.raw) rows.push({ label: m.ind.unit, value: rawFmt(c.v[m.raw][i]) + (c.v[m.raw + '_filled'][i] ? ' (filled)' : '') });
    else rows.push({ label: 'Rank of 40', value: String(rankOf(c, m, i)) });
    return rows;
  }
  function rankOf(c, m, i) {
    var v = c.v[m.score][i], r = 1;
    D.countries.forEach(function (o) { if (o.v[m.score][i] > v) r++; });
    return r;
  }

  // ---------- 1. Map ----------
  function drawMap() {
    var fig = $('[data-fig="map"]'), m = M(state.measure), i = yi(state.year), cl = classes(m.score);
    heads(fig, m.label + ', ' + state.year, 'Score from 0 (least secure) to 1 (most secure); five classes from the pooled 2000–2024 distribution. Hatched countries are outside the sample.' + filterNote());
    var svg = newSvg(fig, WORLD.w, WORLD.h); hatchDef(svg);
    el('rect', { x: 0, y: 0, width: WORLD.w, height: WORLD.h, fill: css('--viz-surface') }, svg);
    var g = el('g', {}, svg), surf = css('--viz-surface');
    WORLD.c.forEach(function (f) {
      var c = BYNUM[f.id], off = c && !inFilter(c);
      var p = el('path', { d: f.d, fill: c ? (off ? css('--viz-empty') : cl.color(c.v[m.score][i])) : 'url(#hatch)', stroke: surf, 'stroke-width': .6 }, g);
      if (c) {
        p.style.cursor = 'pointer';
        p.setAttribute('tabindex', '0');
        p.setAttribute('aria-label', c.name + ' ' + fmt(c.v[m.score][i], 3));
        var on = function (e) { p.setAttribute('stroke', css('--viz-ink')); p.setAttribute('stroke-width', 1.4); g.appendChild(p); showTip(e, c.name + ' · ' + state.year, valueRows(c, i, m)); };
        p.addEventListener('pointermove', on);
        p.addEventListener('focus', function () { var r = p.getBoundingClientRect(); on({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); });
        p.addEventListener('pointerleave', function () { p.setAttribute('stroke', surf); p.setAttribute('stroke-width', .6); hideTip(); });
        p.addEventListener('blur', function () { p.setAttribute('stroke', surf); p.setAttribute('stroke-width', .6); hideTip(); });
        p.addEventListener('click', function () { setCountry(c.iso3, true); });
      }
    });
    legend(fig, cl.labels().map(function (x) { return { type: 'sw', color: x.color, label: x.label }; }).concat([{ type: 'hatch', label: 'Not in sample' }]));
    fig._csv = crossSection(m, i);
  }

  // ---------- 2. Ranking ----------
  function drawRank() {
    var fig = $('[data-fig="rank"]'), m = M(state.measure), i = yi(state.year), cl = classes(m.score);
    heads(fig, 'Ranking, ' + state.year, m.label + ', score 0–1. Click a bar to open that country.' + filterNote());
    var rows = shown().map(function (c) { return { c: c, v: c.v[m.score][i] }; }).sort(function (a, b) { return b.v - a.v; });
    var W = plotWidth(fig), bh = 13, gap = 4, top = 4, left = Math.min(118, W * .34), right = 46, H = top + rows.length * (bh + gap) + 18;
    var svg = newSvg(fig, W, H), x = function (v) { return left + (W - left - right) * v; };
    el('rect', { x: 0, y: 0, width: W, height: H, fill: css('--viz-surface') }, svg);
    [0, .25, .5, .75, 1].forEach(function (t) {
      el('line', { x1: x(t), x2: x(t), y1: top, y2: H - 16, stroke: css('--viz-grid'), 'stroke-width': 1 }, svg);
      txt(svg, x(t), H - 3, fmt(t, 2), { anchor: 'middle', size: 10 });
    });
    rows.forEach(function (r, k) {
      var y = top + k * (bh + gap), sel = state.picked && r.c.iso3 === state.country, rk = rankOf(r.c, m, i), w = Math.max(0, x(r.v) - left);
      var g = el('g', { tabindex: 0, 'aria-label': rk + '. ' + r.c.name + ' ' + fmt(r.v, 3) }, svg); g.style.cursor = 'pointer';
      el('rect', { x: 0, y: y - gap / 2, width: W, height: bh + gap, fill: 'transparent' }, g);
      txt(g, left - 8, y + bh / 2 + .5, rk + '  ' + r.c.name, { anchor: 'end', size: 11, fill: sel ? css('--viz-ink') : css('--viz-ink-2'), weight: sel ? 600 : null, base: 'middle' });
      // 4px rounded data end, square at the baseline
      var rr = Math.min(4, w / 2);
      el('path', { d: 'M' + left + ',' + y + 'h' + (w - rr) + 'a' + rr + ',' + rr + ' 0 0 1 ' + rr + ',' + rr + 'v' + (bh - 2 * rr) + 'a' + rr + ',' + rr + ' 0 0 1 -' + rr + ',' + rr + 'h-' + (w - rr) + 'z', fill: cl.color(r.v) }, g);
      txt(g, x(r.v) + 5, y + bh / 2 + .5, fmt(r.v, 3), { size: 10, base: 'middle', fill: css('--viz-ink-2') });
      if (sel) el('rect', { x: left - 2, y: y - 1.5, width: w + 4, height: bh + 3, fill: 'none', stroke: css('--viz-ink'), 'stroke-width': 1.2, rx: 4 }, g);
      g.addEventListener('pointermove', function (e) { showTip(e, r.c.name + ' · ' + state.year, valueRows(r.c, i, m)); });
      g.addEventListener('pointerleave', hideTip);
      g.addEventListener('click', function () { setCountry(r.c.iso3, true); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter') setCountry(r.c.iso3, true); });
    });
    fig._legend = [];
    fig._csv = crossSection(m, i);
    // table view
    var t = h('table', 'tbl'), th = t.createTHead().insertRow();
    ['Rank', 'Country', 'Score'].concat(m.raw ? [m.ind.unit] : []).forEach(function (s) { th.appendChild(h('th', null, s)); });
    var tb = t.createTBody();
    rows.forEach(function (r, k) {
      var tr = tb.insertRow();
      [String(rankOf(r.c, m, i)), r.c.name, fmt(r.v, 3)].concat(m.raw ? [rawFmt(r.c.v[m.raw][i])] : []).forEach(function (s) { tr.appendChild(h('td', null, s)); });
    });
    var box = $('.tablev .scroll', fig); box.innerHTML = ''; box.appendChild(t);
  }

  // ---------- 3. Heatmap, countries by year ----------
  function drawHeat() {
    var fig = $('[data-fig="heat"]'), m = M(state.measure), cl = classes(m.score), i = yi(state.year);
    heads(fig, m.label + ', all years', 'Rows sorted by the ' + state.year + ' score. Same colour classes as the map.' + filterNote());
    var rows = shown().sort(function (a, b) { return b.v[m.score][i] - a.v[m.score][i]; });
    var W = plotWidth(fig), left = 92, top = 4, ch = 13, bottom = 20, cw = (W - left - 4) / YEARS.length, H = top + rows.length * ch + bottom;
    var svg = newSvg(fig, W, H); el('rect', { x: 0, y: 0, width: W, height: H, fill: css('--viz-surface') }, svg);
    var surf = css('--viz-surface');
    rows.forEach(function (c, r) {
      var y = top + r * ch, sel = state.picked && c.iso3 === state.country;
      txt(svg, left - 6, y + ch / 2 + .5, c.name, { anchor: 'end', size: 10, base: 'middle', fill: sel ? css('--viz-ink') : css('--viz-ink-2'), weight: sel ? 600 : null });
      YEARS.forEach(function (yr, j) {
        var v = c.v[m.score][j];
        var cell = el('rect', { x: left + j * cw, y: y, width: cw, height: ch, fill: cl.color(v), stroke: surf, 'stroke-width': 1 }, svg);
        cell.addEventListener('pointermove', function (e) { cell.setAttribute('stroke', css('--viz-ink')); showTip(e, c.name + ' · ' + yr, valueRows(c, j, m)); });
        cell.addEventListener('pointerleave', function () { cell.setAttribute('stroke', surf); hideTip(); });
        cell.addEventListener('click', function () { setCountry(c.iso3, true); });
      });
    });
    [2000, 2006, 2012, 2018, 2024].forEach(function (yr) { txt(svg, left + (yi(yr) + .5) * cw, H - 5, String(yr), { anchor: 'middle', size: 10 }); });
    el('rect', { x: left + i * cw, y: top - 1, width: cw, height: rows.length * ch + 2, fill: 'none', stroke: css('--viz-ink'), 'stroke-width': 1 }, svg);
    legend(fig, cl.labels().map(function (x) { return { type: 'sw', color: x.color, label: x.label }; }));
    fig._csv = [['country', 'iso3'].concat(YEARS.map(String))].concat(rows.map(function (c) { return [c.name, c.iso3].concat(c.v[m.score].map(function (v) { return num(v); })); }));
    fig._csvName = m.label + ' score, all years';
  }

  // ---------- generic line chart with crosshair ----------
  function lineChart(svg, box, o) {
    // box: {x,y,w,h}; o: {series:[{name,color,values,hollow?}], domain:[lo,hi], band?, ref?, fmtV, endLabels, compact}
    var X = function (j) { return box.x + box.w * j / (YEARS.length - 1); };
    var lo = o.domain[0], hi = o.domain[1], Y = function (v) { return box.y + box.h - (v - lo) / (hi - lo) * box.h; };
    var ticks = o.ticks || niceTicks(lo, hi, o.compact ? 3 : 5);
    ticks.forEach(function (t) {
      el('line', { x1: box.x, x2: box.x + box.w, y1: Y(t), y2: Y(t), stroke: css('--viz-grid'), 'stroke-width': 1 }, svg);
      txt(svg, box.x - 6, Y(t) + 3.5, tickFmt(t), { anchor: 'end', size: o.compact ? 9 : 10 });
    });
    el('line', { x1: box.x, x2: box.x + box.w, y1: box.y + box.h, y2: box.y + box.h, stroke: css('--viz-axis'), 'stroke-width': 1 }, svg);
    (o.compact ? [2000, 2012, 2024] : [2000, 2004, 2008, 2012, 2016, 2020, 2024]).forEach(function (yr) {
      txt(svg, X(yi(yr)), box.y + box.h + (o.compact ? 12 : 15), String(yr), { anchor: 'middle', size: o.compact ? 9 : 10 });
    });
    function pathOf(vals) {
      var d = '', pen = false;
      vals.forEach(function (v, j) { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(j).toFixed(1) + ',' + Y(v).toFixed(1); pen = true; });
      return d;
    }
    if (o.band) {
      var up = o.band[1], dn = o.band[0], d = '';
      up.forEach(function (v, j) { d += (j ? 'L' : 'M') + X(j).toFixed(1) + ',' + Y(v).toFixed(1); });
      for (var j = dn.length - 1; j >= 0; j--) d += 'L' + X(j).toFixed(1) + ',' + Y(dn[j]).toFixed(1);
      el('path', { d: d + 'Z', fill: o.band[2], 'fill-opacity': .14 }, svg);
    }
    if (o.ref) el('path', { d: pathOf(o.ref.values), fill: 'none', stroke: css('--viz-muted'), 'stroke-width': 1.25, 'stroke-opacity': .8 }, svg);
    var surf = css('--viz-surface');
    o.series.forEach(function (s) {
      el('path', { d: pathOf(s.values), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      if (s.hollow) s.values.forEach(function (v, j) {
        if (v != null && s.hollow[j]) el('circle', { cx: X(j), cy: Y(v), r: 2.6, fill: surf, stroke: s.color, 'stroke-width': 1.4 }, svg);
      });
      var last = s.values.length - 1;
      if (s.values[last] != null) el('circle', { cx: X(last), cy: Y(s.values[last]), r: o.compact ? 3 : 4, fill: s.color, stroke: surf, 'stroke-width': 2 }, svg);
    });
    if (o.endLabels) {
      var placed = [];
      o.series.map(function (s) { return { s: s, y: Y(s.values[s.values.length - 1]) }; }).sort(function (a, b) { return a.y - b.y; }).forEach(function (p) {
        if (placed.some(function (q) { return Math.abs(q - p.y) < 13; })) return; // labels that would collide go to legend + tooltip
        placed.push(p.y);
        txt(svg, box.x + box.w + 9, p.y + 3.5, p.s.name, { size: 11, fill: css('--viz-ink-2') });
      });
    }
    // crosshair
    var cross = el('line', { y1: box.y, y2: box.y + box.h, stroke: css('--viz-axis'), 'stroke-width': 1, opacity: 0 }, svg);
    var hit = el('rect', { x: box.x - 6, y: box.y - 4, width: box.w + 12, height: box.h + 8, fill: 'transparent' }, svg);
    hit.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) * (svg.viewBox.baseVal.width / r.width);
      var j = Math.max(0, Math.min(YEARS.length - 1, Math.round((sx - box.x) / box.w * (YEARS.length - 1))));
      cross.setAttribute('x1', X(j)); cross.setAttribute('x2', X(j)); cross.setAttribute('opacity', 1);
      var rows = o.series.map(function (s) { return { color: s.color, label: s.name, value: (o.fmtV || rawFmt)(s.values[j]) + (s.hollow && s.hollow[j] ? ' (filled)' : '') }; });
      if (o.band) rows.push({ label: '5–95% over random weights', value: fmt(o.band[0][j], 3) + '–' + fmt(o.band[1][j], 3) });
      if (o.ref) rows.push({ color: css('--viz-muted'), label: o.ref.name, value: (o.fmtV || rawFmt)(o.ref.values[j]) });
      showTip(e, (o.tipTitle ? o.tipTitle + ' · ' : '') + YEARS[j], rows);
    });
    hit.addEventListener('pointerleave', function () { cross.setAttribute('opacity', 0); hideTip(); });
  }
  function median(key, j) { var a = []; D.countries.forEach(function (c) { if (c.v[key][j] != null) a.push(c.v[key][j]); }); return quantile(a, .5); }
  function medianSeries(key) { return YEARS.map(function (_, j) { return median(key, j); }); }

  // ---------- 4. One country ----------
  function drawCountry() {
    var c = BYISO[state.country], last = YEARS.length - 1, s1 = css('--s1');
    // tiles
    var t = $('#tiles'); t.innerHTML = '';
    var dimsNow = META.dimensions.map(function (d) { return { d: d, v: c.v[d.toLowerCase()][last] }; }).sort(function (a, b) { return a.v - b.v; });
    var ch = c.v.esi[last] - c.v.esi[0];
    [['ESI ' + YEARS[last], fmt(c.v.esi[last], 3), 'out of 1'],
     ['Rank in ' + YEARS[last], String(c.v.esi_rank[last]), 'of 40 (was ' + c.v.esi_rank[0] + ' in ' + YEARS[0] + ')'],
     ['Change since ' + YEARS[0], (ch >= 0 ? '+' : '−') + fmt(Math.abs(ch), 3), 'ESI points'],
     ['Weakest dimension', dimsNow[0].d, fmt(dimsNow[0].v, 3) + ' in ' + YEARS[last]]].forEach(function (x) {
      var d = h('div', 'tile'); d.appendChild(h('span', null, x[0])); d.appendChild(h('b', null, x[1])); d.appendChild(h('small', null, x[2])); t.appendChild(d);
    });

    // ESI line
    var f1 = $('[data-fig="esiline"]');
    heads(f1, 'Energy Security Index, ' + c.name, 'Shaded band: 5th–95th percentile over 1,000 random dimension weightings. Grey line: sample median.');
    var W = plotWidth(f1), H = 270, svg = newSvg(f1, W, H); el('rect', { x: 0, y: 0, width: W, height: H, fill: css('--viz-surface') }, svg);
    lineChart(svg, { x: 34, y: 10, w: W - 48, h: H - 40 }, { series: [{ name: 'ESI', color: s1, values: c.v.esi }], domain: [0, 1], ticks: [0, .25, .5, .75, 1],
      band: [c.v.esi_mc_p05, c.v.esi_mc_p95, s1], ref: { name: 'Sample median', values: medianSeries('esi') }, fmtV: function (v) { return fmt(v, 3); }, tipTitle: c.name });
    legend(f1, [{ type: 'line', color: s1, label: c.name }, { type: 'band', color: s1, label: 'Range over random weights' }, { type: 'line', color: css('--viz-muted'), label: 'Sample median' }]);
    var medE = medianSeries('esi');
    f1._csv = [['country', 'year', 'esi', 'esi_rank', 'esi_random_weights_p05', 'esi_random_weights_p95', 'sample_median_esi']].concat(YEARS.map(function (yr, j) { return [c.name, yr, num(c.v.esi[j]), c.v.esi_rank[j], num(c.v.esi_mc_p05[j]), num(c.v.esi_mc_p95[j]), num(medE[j])]; }));

    // dimensions
    var f2 = $('[data-fig="dims"]'), cols = ['--s1', '--s2', '--s3', '--s4'].map(css);
    heads(f2, 'Four dimensions, ' + c.name, 'Each dimension is the mean of its two indicator scores (0–1).');
    W = plotWidth(f2); svg = newSvg(f2, W, H); el('rect', { x: 0, y: 0, width: W, height: H, fill: css('--viz-surface') }, svg);
    var ser = META.dimensions.map(function (d, k) { return { name: d, color: cols[k], values: c.v[d.toLowerCase()] }; });
    lineChart(svg, { x: 34, y: 10, w: W - 48 - 86, h: H - 40 }, { series: ser, domain: [0, 1], ticks: [0, .25, .5, .75, 1], endLabels: true, fmtV: function (v) { return fmt(v, 3); }, tipTitle: c.name });
    legend(f2, ser.map(function (s) { return { type: 'line', color: s.color, label: s.name }; }));
    f2._csv = [['country', 'year'].concat(META.dimensions.map(function (d) { return d.toLowerCase(); }))].concat(YEARS.map(function (yr, j) { return [c.name, yr].concat(META.dimensions.map(function (d) { return num(c.v[d.toLowerCase()][j]); })); }));

    // indicators small multiples
    var f3 = $('[data-fig="inds"]');
    heads(f3, 'Eight indicators, ' + c.name, 'Original units. Grey line: sample median. Hollow points: values filled because the source had none.');
    W = plotWidth(f3);
    var ncol = W < 560 ? 2 : 4, nrow = Math.ceil(8 / ncol), pw = W / ncol, ph = 168, Ht = nrow * ph;
    svg = newSvg(f3, W, Ht); el('rect', { x: 0, y: 0, width: W, height: Ht, fill: css('--viz-surface') }, svg);
    META.indicators.forEach(function (ind, k) {
      var col = k % ncol, row = Math.floor(k / ncol), ox = col * pw, oy = row * ph;
      var vals = c.v[ind.key], med = medianSeries(ind.key);
      var all = vals.concat(med).filter(function (v) { return v != null; });
      var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
      if (ind.key === 'access_electricity') hi = Math.max(hi, 100);
      if (lo >= 0 && lo < (hi - lo) * .6) lo = 0;
      var tk = niceTicks(lo, hi, 3); lo = Math.min(lo, tk[0]); hi = Math.max(hi, tk[tk.length - 1]);
      if (hi === lo) { hi = lo + 1; }
      txt(svg, ox + 4, oy + 13, ind.label, { size: 11.5, weight: 600, fill: css('--viz-ink') });
      txt(svg, ox + 4, oy + 27, ind.unit + (ind.dir > 0 ? ' · higher is more secure' : ' · lower is more secure'), { size: 9.5 });
      lineChart(svg, { x: ox + 38, y: oy + 40, w: pw - 52, h: ph - 72 }, { series: [{ name: c.name, color: s1, values: vals, hollow: c.v[ind.key + '_filled'] }],
        domain: [lo, hi], ticks: niceTicks(lo, hi, 3), ref: { name: 'Sample median', values: med }, compact: true, tipTitle: ind.label });
    });
    legend(f3, [{ type: 'line', color: s1, label: c.name }, { type: 'line', color: css('--viz-muted'), label: 'Sample median' }]);
    var ih = ['country', 'year'], meds = {};
    META.indicators.forEach(function (ind) { ih.push(ind.key, ind.key + '_score', ind.key + '_sample_median'); meds[ind.key] = medianSeries(ind.key); });
    f3._csv = [ih].concat(YEARS.map(function (yr, j) { var r = [c.name, yr]; META.indicators.forEach(function (ind) { r.push(num(c.v[ind.key][j]), num(c.v[ind.key + '_score'][j]), num(meds[ind.key][j])); }); return r; }));

    // table
    var tb = h('table', 'tbl'), hr = tb.createTHead().insertRow();
    ['Year', 'ESI', 'Rank'].concat(META.dimensions, META.indicators.map(function (i) { return i.label; })).forEach(function (s) { hr.appendChild(h('th', null, s)); });
    var body = tb.createTBody();
    YEARS.forEach(function (yr, j) {
      var tr = body.insertRow();
      [String(yr), fmt(c.v.esi[j], 3), String(c.v.esi_rank[j])].concat(META.dimensions.map(function (d) { return fmt(c.v[d.toLowerCase()][j], 3); }),
        META.indicators.map(function (i) { return rawFmt(c.v[i.key][j]) + (c.v[i.key + '_filled'][j] ? '*' : ''); })).forEach(function (s) { tr.appendChild(h('td', null, s)); });
    });
    var box = $('.tablev .scroll', f3); box.innerHTML = ''; box.appendChild(tb);
    var n = h('p', 'note-sm', '* filled value (no value in the source).'); box.appendChild(n);
  }

  // ---------- 5. Compare ----------
  function drawCompare() {
    var fig = $('[data-fig="cmp"]'), m = M(state.cmpMeasure), key = m.raw || m.score, cols = ['--s1', '--s2', '--s3'].map(css);
    var unit = m.raw ? m.ind.unit : 'score 0–1';
    heads(fig, m.label, (m.raw ? unit + (m.ind.dir > 0 ? ', higher is more secure' : ', lower is more secure') : 'Score from 0 to 1') + '. Grey line: sample median.');
    var ser = state.cmp.map(function (iso, k) { var c = BYISO[iso]; return { name: c.name, color: cols[k], values: c.v[key], hollow: m.raw ? c.v[m.raw + '_filled'] : null }; });
    var med = medianSeries(key), all = [].concat.apply(med.slice(), ser.map(function (s) { return s.values; })).filter(function (v) { return v != null; });
    var lo, hi, tk;
    if (!m.raw) { lo = 0; hi = 1; tk = [0, .25, .5, .75, 1]; }
    else { lo = Math.min.apply(null, all); hi = Math.max.apply(null, all); if (lo >= 0 && lo < (hi - lo) * .6) lo = 0; tk = niceTicks(lo, hi, 5); lo = Math.min(lo, tk[0]); hi = Math.max(hi, tk[tk.length - 1]); }
    var W = plotWidth(fig), H = 320, svg = newSvg(fig, W, H); el('rect', { x: 0, y: 0, width: W, height: H, fill: css('--viz-surface') }, svg);
    var lw = Math.min(110, W * .22);
    lineChart(svg, { x: 46, y: 10, w: W - 60 - lw, h: H - 40 }, { series: ser, domain: [lo, hi], ticks: tk, endLabels: true, ref: { name: 'Sample median', values: med },
      fmtV: m.raw ? rawFmt : function (v) { return fmt(v, 3); }, tipTitle: m.label });
    legend(fig, ser.map(function (s) { return { type: 'line', color: s.color, label: s.name }; }).concat([{ type: 'line', color: css('--viz-muted'), label: 'Sample median' }]));
    fig._csv = [['year'].concat(ser.map(function (s) { return s.name; }), ['sample_median'])].concat(YEARS.map(function (yr, j) { return [yr].concat(ser.map(function (s) { return num(s.values[j]); }), [num(med[j])]); }));
    fig._csvName = m.label + (m.raw ? ' (' + unit + ')' : ' score');
    // chips
    var chips = $('#cmp-chips'); chips.innerHTML = '';
    state.cmp.forEach(function (iso, k) {
      var cp = h('span', 'chip'), i = h('i'); i.style.background = cols[k]; cp.appendChild(i); cp.appendChild(document.createTextNode(BYISO[iso].name));
      if (state.cmp.length > 1) { var x = h('button', null, '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + BYISO[iso].name); x.addEventListener('click', function () { state.cmp.splice(k, 1); drawCompare(); }); cp.appendChild(x); }
      chips.appendChild(cp);
    });
    var add = $('#cmp-add'); add.disabled = state.cmp.length >= 3;
  }

  // ---------- data behind a figure, as CSV ----------
  function num(v) { return v == null || isNaN(v) ? '' : +Number(v).toFixed(6); }
  function crossSection(m, i) {
    var head = ['country', 'iso3', 'year', m.key === 'esi' ? 'esi' : (m.raw ? m.key + '_score' : m.key), 'rank_of_' + D.countries.length];
    if (m.raw) head.push(m.key + ' (' + m.ind.unit + ')');
    var rows = shown().map(function (c) { var r = [c.name, c.iso3, YEARS[i], num(c.v[m.score][i]), rankOf(c, m, i)]; if (m.raw) r.push(num(c.v[m.raw][i])); return r; });
    rows.sort(function (a, b) { return a[4] - b[4]; });
    return [head].concat(rows);
  }
  function exportCsv(fig) {
    if (!fig._csv) return;
    var q = function (x) { x = String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var body = fig._csv.map(function (r) { return r.map(q).join(','); }).join('\n');
    body += '\n\n' + q(SOURCE) + '\n' + q('Cite: ' + META.cite_paper) + '\n';
    var b = new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' });
    var name = (fig._csvName || fig._title || 'esi-data').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'ESI_' + name + '.csv'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------- export a figure as PNG or JPG, with title, legend and source line ----------
  function exportFig(fig, type) {
    var src = $('.plot svg', fig); if (!src) return;
    var vb = src.viewBox.baseVal, W = Math.max(vb.width, 640), pad = 24, scale = W / vb.width;
    var legendItems = fig._legend || [], lh = legendItems.length ? 22 : 0;
    var head = 62, foot = 34 + lh, H = head + vb.height * scale + foot;
    var out = document.createElementNS(NS, 'svg');
    out.setAttribute('xmlns', NS); out.setAttribute('width', W + pad * 2); out.setAttribute('height', H + pad);
    out.setAttribute('viewBox', '0 0 ' + (W + pad * 2) + ' ' + (H + pad));
    el('rect', { x: 0, y: 0, width: W + pad * 2, height: H + pad, fill: css('--viz-surface') }, out);
    txt(out, pad, pad + 14, fig._title || '', { size: 17, weight: 600, fill: css('--viz-ink') });
    var sub = fig._sub || '';
    txt(out, pad, pad + 36, sub.length > 150 ? sub.slice(0, 147) + '…' : sub, { size: 11.5, fill: css('--viz-ink-2') });
    var g = el('g', { transform: 'translate(' + pad + ',' + (pad + head - 10) + ') scale(' + scale + ')' }, out);
    var clone = src.cloneNode(true); clone.removeAttribute('width'); clone.removeAttribute('height');
    clone.setAttribute('width', vb.width); clone.setAttribute('height', vb.height);
    g.appendChild(clone);
    var ly = pad + head - 10 + vb.height * scale + 18, lx = pad;
    if (legendItems.length) {
      var hd = el('defs', {}, out), pt = el('pattern', { id: 'hatchx', patternUnits: 'userSpaceOnUse', width: 5, height: 5, patternTransform: 'rotate(45)' }, hd);
      el('rect', { width: 5, height: 5, fill: css('--viz-empty') }, pt); el('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: css('--viz-hatch'), 'stroke-width': 1.6 }, pt);
      legendItems.forEach(function (it) {
        if (it.type === 'line') el('rect', { x: lx, y: ly - 5, width: 16, height: 2, fill: it.color }, out);
        else el('rect', { x: lx, y: ly - 9, width: 14, height: 10, rx: 2, fill: it.type === 'hatch' ? 'url(#hatchx)' : it.color, 'fill-opacity': it.type === 'band' ? .25 : 1 }, out);
        var t = txt(out, lx + 21, ly, it.label, { size: 11, fill: css('--viz-ink-2') });
        lx += 21 + it.label.length * 6.2 + 16;
        if (lx > W) { lx = pad; ly += 18; }
      });
      ly += lh;
    }
    txt(out, pad, H + pad - 12, SOURCE, { size: 10.5, fill: css('--viz-muted') });
    var xml = new XMLSerializer().serializeToString(out);
    var img = new Image(), k = 2;
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = (W + pad * 2) * k; cv.height = (H + pad) * k;
      var ctx = cv.getContext('2d'); ctx.fillStyle = css('--viz-surface'); ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob(function (b) {
        var a = document.createElement('a'), name = (fig._title || 'esi-figure').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        a.href = URL.createObjectURL(b); a.download = 'ESI_' + name + '.' + type; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }, type === 'jpg' ? 'image/jpeg' : 'image/png', .95);
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  }

  // ---------- wiring ----------
  var BYNUM = {};
  function drawAll() { drawMap(); drawRank(); drawHeat(); drawCountry(); drawCompare(); }
  function drawYearViews() { drawMap(); drawRank(); drawHeat(); }
  function setCountry(iso, scroll) {
    state.country = iso; state.picked = true; $('#country-sel').value = iso;
    drawRank(); drawHeat(); drawCountry();
    if (scroll) $('#country').scrollIntoView({ behavior: 'smooth' });
  }

  function staticText() {
    $$('[data-meta="version"]').forEach(function (n) { n.textContent = META.version; });
    $$('[data-meta="filled"]').forEach(function (n) { n.textContent = META.sensitivity.filled_share; });
    $('#cite-paper').textContent = META.cite_paper;
    $('#cite-data').textContent = META.cite_data;
    var bib = '@unpublished{chavda2026energy,\n  author = {Chavda, Priyanshu},\n  title  = {Geopolitical Risk and Energy Security: Quantile and Logit Evidence from a Composite Index},\n  note   = {Job market paper, Pandit Deendayal Energy University},\n  year   = {2026}\n}\n\n@misc{chavda2026esi,\n  author = {Chavda, Priyanshu},\n  title  = {Energy Security Index ({ESI}), 40 countries, 2000--2024},\n  version = {' + META.version + '},\n  year   = {2026},\n  url    = {https://priyanshu-econ.github.io/esi/}\n}';
    $('#bibtex').textContent = bib;
    $$('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = b.getAttribute('data-copy') === 'bib' ? bib : META.cite_paper + '\n' + META.cite_data;
        (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(function () { toast('Copied'); }, function () { toast('Select the text to copy it'); });
      });
    });
    var tb = $('#frame-table tbody');
    META.indicators.forEach(function (i, k) {
      var tr = tb.insertRow();
      [k % 2 === 0 ? i.dim : '', i.label, i.unit, i.dir > 0 ? 'Higher is more secure' : 'Lower is more secure', i.source].forEach(function (s, j) { var td = h('td', null, s); if (j) td.style.textAlign = 'left'; tr.appendChild(td); });
    });
    var S = META.sensitivity;
    $('#sens-text').textContent = 'Under 1,000 random weightings of the four dimensions, the average country moves ' + fmt(S.shift_mean, 2) + ' places in the yearly ranking (at most ' + S.shift_max + '). The geometric ESI correlates ' + fmt(S.pearson_arith, 2) + ' with an arithmetic version (rank correlation ' + fmt(S.spearman_arith, 2) + '), and the gap reflects how much more the geometric mean penalises one weak dimension.' + (S.pearson_z ? ' It correlates ' + fmt(S.pearson_z, 2) + ' with a z-score version and ' + fmt(S.pearson_pca, 2) + ' with a PCA-weighted version.' : '');
  }

  function buildFilter(sorted) {
    var box = $('#cf-list'), pre = $('#cf-presets'), sum = $('#cf-sum');
    function sync() {
      var n = shown().length;
      sum.textContent = n === D.countries.length ? 'All ' + n : n + ' of ' + D.countries.length;
      $$('input', box).forEach(function (cb) { cb.checked = inFilter(BYISO[cb.value]); });
      drawYearViews();
    }
    function setSet(list) {
      if (!list) { state.filter = null; }
      else { state.filter = {}; list.forEach(function (iso) { state.filter[iso] = true; }); }
      sync();
    }
    sorted.forEach(function (c) {
      var l = h('label'), cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = c.iso3; cb.checked = true;
      cb.addEventListener('change', function () {
        var cur = {}; D.countries.forEach(function (o) { if (inFilter(o)) cur[o.iso3] = true; });
        if (cb.checked) cur[c.iso3] = true; else delete cur[c.iso3];
        var keys = Object.keys(cur); setSet(keys.length === D.countries.length ? null : keys);
      });
      l.appendChild(cb); l.appendChild(document.createTextNode(' ' + c.name)); box.appendChild(l);
    });
    [['All', null], ['None', []]].concat(Object.keys(REGIONS).map(function (r) { return [r, REGIONS[r]]; })).forEach(function (p) {
      var b = h('button', 'btn small', p[0]); b.type = 'button'; b.addEventListener('click', function () { setSet(p[1]); }); pre.appendChild(b);
    });
  }

  function init() {
    tip = $('#tip');
    MEASURES = measures();
    D.countries.forEach(function (c) { BYISO[c.iso3] = c; BYNUM[c.num] = c; });
    staticText();
    fillSelect($('#measure'), MEASURES, state.measure);
    fillSelect($('#cmp-measure'), MEASURES, state.cmpMeasure);
    var cs = $('#country-sel'), ca = $('#cmp-add');
    var sorted = D.countries.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    sorted.forEach(function (c) { var o = document.createElement('option'); o.value = c.iso3; o.textContent = c.name; cs.appendChild(o); });
    var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Choose…'; ca.appendChild(o0);
    sorted.forEach(function (c) { var o = document.createElement('option'); o.value = c.iso3; o.textContent = c.name; ca.appendChild(o); });
    state.country = sorted[0].iso3;
    state.cmp = sorted.slice(0, 3).map(function (c) { return c.iso3; });
    var hash = (location.hash.match(/country=([A-Z]{3})/) || [])[1]; if (hash && BYISO[hash]) { state.country = hash; state.picked = true; }
    buildFilter(sorted);
    cs.value = state.country;

    $('#measure').addEventListener('change', function (e) { state.measure = e.target.value; drawYearViews(); });
    var yr = $('#year'), out = $('#yearOut');
    yr.min = YEARS[0]; yr.max = YEARS[YEARS.length - 1]; yr.value = state.year;
    yr.addEventListener('input', function () { state.year = +yr.value; out.textContent = yr.value; drawYearViews(); });
    var timer = null, play = $('#play');
    play.addEventListener('click', function () {
      if (timer) { clearInterval(timer); timer = null; play.textContent = 'Play'; return; }
      if (state.year >= YEARS[YEARS.length - 1]) { state.year = YEARS[0] - 1; }
      play.textContent = 'Pause';
      timer = setInterval(function () {
        state.year++; yr.value = state.year; out.textContent = state.year; drawYearViews();
        if (state.year >= YEARS[YEARS.length - 1]) { clearInterval(timer); timer = null; play.textContent = 'Play'; }
      }, 700);
    });
    cs.addEventListener('change', function () { setCountry(cs.value, false); });
    $('#cmp-measure').addEventListener('change', function (e) { state.cmpMeasure = e.target.value; drawCompare(); });
    ca.addEventListener('change', function () { var v = ca.value; if (v && state.cmp.indexOf(v) < 0 && state.cmp.length < 3) state.cmp.push(v); ca.value = ''; drawCompare(); });
    $$('.fig-tools').forEach(function (t) { var b = h('button', 'btn small', 'CSV'); b.type = 'button'; b.setAttribute('data-export', 'csv'); b.title = 'Download the data in this figure'; t.appendChild(b); });
    $$('[data-export]').forEach(function (b) { b.addEventListener('click', function () { var f = b.closest('.fig'), t = b.getAttribute('data-export'); if (t === 'csv') exportCsv(f); else exportFig(f, t); }); });

    drawAll();
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(drawAll, 150); });
    new MutationObserver(drawAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // theme button (same behaviour as the home page)
  (function () {
    var root = document.documentElement, btn = document.querySelector('.theme');
    function label() { btn.setAttribute('aria-label', root.getAttribute('data-theme') === 'dark' ? 'Switch to day mode' : 'Switch to night mode'); }
    label();
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('ready'); }); });
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next); try { localStorage.setItem('theme', next); } catch (e) {} label();
    });
  })();

  Promise.all([fetch('data/esi.json').then(function (r) { return r.json(); }), fetch('data/world.json').then(function (r) { return r.json(); })])
    .then(function (res) { D = res[0]; META = D.meta; YEARS = META.years; WORLD = res[1]; init(); })
    .catch(function (e) { var p = $('#dashboard .sub'); if (p) p.textContent = 'The data could not be loaded (' + e.message + '). Open this page through a web server, not as a local file.'; });
})();
