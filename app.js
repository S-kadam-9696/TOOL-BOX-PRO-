'use strict';
/* ToolBox Pro - browser tools + optional secure AI backend. */
const DEFAULT_API_BASE = 'https://tool-box-pro.onrender.com';
const getApiBase = () => { const saved = store.get('tbp:api', ''); return (saved || DEFAULT_API_BASE).replace(/\/$/, ''); };
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, p = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [a, v] of Object.entries(p)) {
    if (a === 'class') e.className = v;
    else if (a.startsWith('on')) e.addEventListener(a.slice(2), v);
    else if (a === 'value' || a === 'checked') e[a] = v;
    else if (v === true) e.setAttribute(a, '');
    else if (v !== false && v != null) e.setAttribute(a, v);
  }
  e.append(...kids.flat().filter(x => x != null && x !== false));
  return e;
};
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
};
const dlg = $('#dlg');

/* ---------- toast, clipboard, download ---------- */
function toast(msg, type = 'ok') {
  const box = $('#toasts'), host = dlg.open ? dlg : document.body;
  if (box.parentNode !== host) host.append(box);
  const t = h('div', { class: 'toast ' + (type === 'err' ? 'err' : ''), role: type === 'err' ? 'alert' : 'status' }, msg);
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 3200);
}
async function copyText(s) {
  if (!s) { toast('Nothing to copy', 'err'); return false; }
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(s); toast('Copied to clipboard'); return true; } } catch { /* try fallback */ }
  try {
    const t = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0;top:0' }); t.value = s;
    (dlg.open ? dlg : document.body).append(t); t.select();
    const ok = document.execCommand('copy'); t.remove();
    if (ok) { toast('Copied to clipboard'); return true; }
  } catch { /* fall through */ }
  toast('Copy failed. Select the text and copy it manually.', 'err'); return false;
}
function save(name, blob) {
  if (!blob || !blob.size) { toast('Nothing to download', 'err'); return; }
  const u = URL.createObjectURL(blob), a = h('a', { href: u, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000); toast('Downloaded successfully');
}
const saveText = (name, s, type = 'text/plain') => save(name, new Blob([s], { type: type + ';charset=utf-8' }));

/* object URL tracking so everything is revoked when a tool closes */
let urls = [];
const mkUrl = b => { const u = URL.createObjectURL(b); urls.push(u); return u; };
const revUrl = u => { if (u) { URL.revokeObjectURL(u); urls = urls.filter(x => x !== u); } };
const revokeAll = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; };
/* cleanup callbacks (timers etc.) run whenever a tool closes or another opens */
let cleanups = [];
const onClose = fn => cleanups.push(fn);
const runCleanups = () => { const c = cleanups; cleanups = []; c.forEach(f => { try { f(); } catch { /* ignore */ } }); };

/* ---------- ui helpers ---------- */
const field = (label, ctl) => h('label', { class: 'f' }, typeof label === 'string' ? h('span', {}, label) : label, ctl);
const inp = (p = {}) => h('input', p);
const num = (p = {}) => h('input', Object.assign({ type: 'number', step: 'any', inputmode: 'decimal' }, p));
const area = (p = {}) => h('textarea', Object.assign({ rows: 7, spellcheck: 'false' }, p));
const sel = (opts, p = {}) => h('select', p, ...opts.map(o => Array.isArray(o) ? h('option', { value: o[0] }, o[1]) : h('option', { value: o }, o)));
const btn = (t, fn, c = '') => h('button', { type: 'button', class: 'btn ' + c, onclick: fn }, t);
const stat = (k, v) => h('div', { class: 'stat' }, h('span', {}, k), h('strong', {}, String(v)));
const chk = (label, checked = false) => { const c = h('input', { type: 'checkbox', checked }); return [c, h('label', {}, c, label)]; };
const fb = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
const val = e => e.value.trim() === '' ? NaN : Number(e.value);
const fmtN = v => Number.isFinite(v) ? String(+v.toPrecision(12)) : '';
const copyBtn = get => btn('Copy', () => copyText(get()));
const dlBtn = (get, name, label = 'Download TXT', type = 'text/plain') => btn(label, () => { const s = get(); if (!s) { toast('Nothing to download', 'err'); return; } saveText(name, s, type); });
const msgEl = () => { const m = h('p', { class: 'msg', role: 'status' }); m.set = (t, ok) => { m.textContent = t; m.className = 'msg' + (ok ? ' ok' : ''); }; return m; };
const cryptoOk = () => !!(window.crypto && crypto.getRandomValues);
function rnd(n) { const m = Math.floor(2 ** 32 / n) * n, a = new Uint32Array(1); do crypto.getRandomValues(a); while (a[0] >= m); return a[0] % n; }

/* ---------- calculators ---------- */
function ageTool(el) {
  const d = inp({ type: 'date', max: new Date().toLocaleDateString('en-CA') }), out = h('div', { class: 'stats', 'aria-live': 'polite' }), m = msgEl();
  const run = () => {
    out.replaceChildren(); m.set('');
    if (!d.value) { m.set('Please select your date of birth.'); return; }
    const b = new Date(d.value + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0);
    if (isNaN(b) || b > n) { m.set('Date of birth cannot be in the future.'); toast('Invalid date', 'err'); return; }
    let y = n.getFullYear() - b.getFullYear(), mo = n.getMonth() - b.getMonth(), dd = n.getDate() - b.getDate();
    if (dd < 0) { mo--; dd += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); }
    if (mo < 0) { y--; mo += 12; }
    out.append(stat('Years', y), stat('Months', mo), stat('Days', dd), stat('Total days', Math.round((n - b) / 864e5).toLocaleString()));
  };
  el.append(field('Date of birth', d), btn('Calculate age', run, 'pri'), m, out);
}
function pctTool(el) {
  const modes = [['What is X% of Y?', 'X (%)', 'Y'], ['X is what percentage of Y?', 'X', 'Y'], ['Percentage increase', 'From', 'To'], ['Percentage decrease', 'From', 'To']];
  const s = sel(modes.map((x, i) => [i, x[0]])), la = h('span'), lb = h('span'), a = num(), b = num(), out = h('div', { class: 'big', 'aria-live': 'polite' }), m = msgEl();
  const lab = () => { la.textContent = modes[s.value][1]; lb.textContent = modes[s.value][2]; out.textContent = ''; m.set(''); };
  s.onchange = lab; lab();
  const run = () => {
    out.textContent = ''; m.set(''); const x = val(a), y = val(b), i = +s.value;
    if (!Number.isFinite(x) || !Number.isFinite(y)) { m.set('Please enter both numbers.'); return; }
    if (i === 0) out.textContent = `${fmtN(x)}% of ${fmtN(y)} = ${fmtN(x * y / 100)}`;
    else if (i === 1) { if (y === 0) { m.set('Y cannot be zero.'); return; } out.textContent = `${fmtN(x)} is ${fmtN(x / y * 100)}% of ${fmtN(y)}`; }
    else { if (x === 0) { m.set('The starting value cannot be zero.'); return; }
      const c = (i === 2 ? y - x : x - y) / x * 100;
      out.textContent = `${i === 2 ? 'Increase' : 'Decrease'}: ${fmtN(c)}%` + (c < 0 ? (i === 2 ? ' (the value actually decreased)' : ' (the value actually increased)') : ''); }
  };
  el.append(field('Calculation', s), h('div', { class: 'two' }, field(la, a), field(lb, b)), btn('Calculate', run, 'pri'), m, out);
}
function cgpaTool(el) {
  const rows = h('div', { class: 'rows' }), mult = num({ value: '9.5', min: '0' }), out = h('div', { class: 'stats', 'aria-live': 'polite' }), m = msgEl();
  let n = 0;
  const add = () => {
    n++; const r = h('div', { class: 'row' }, inp({ type: 'text', 'aria-label': 'Subject name', value: 'Subject ' + n }),
      num({ 'aria-label': 'Grade points', placeholder: 'Grade points', min: '0' }), num({ 'aria-label': 'Credits', placeholder: 'Credits', min: '0' }),
      btn('Remove', () => { if (rows.children.length > 1) r.remove(); else toast('Keep at least one subject', 'err'); }, 'ghost'));
    rows.append(r);
  };
  add(); add();
  const run = () => {
    out.replaceChildren(); m.set(''); let tp = 0, tc = 0;
    for (const r of rows.children) {
      const [, g, c] = r.querySelectorAll('input'), gp = val(g), cr = val(c);
      if (!(gp >= 0) || !(cr > 0)) { m.set('Enter grade points (0 or more) and credits (above 0) for every subject.'); toast('Check your subjects', 'err'); return; }
      tp += gp * cr; tc += cr;
    }
    const k = val(mult); if (!(k > 0)) { m.set('Enter a valid percentage multiplier.'); return; }
    const cg = tp / tc; out.append(stat('CGPA', cg.toFixed(2)), stat('Percentage', (cg * k).toFixed(2) + '%'), stat('Total credits', fmtN(tc)));
  };
  el.append(rows, h('div', { class: 'acts' }, btn('Add subject', add), btn('Calculate CGPA', run, 'pri')), field('Percentage multiplier (percentage = CGPA × multiplier)', mult), m, out);
}
function bmiTool(el) {
  const u = sel([['m', 'Metric (cm, kg)'], ['i', 'Imperial (in, lb)']]), lh = h('span'), lw = h('span'), ht = num({ min: '0' }), w = num({ min: '0' }), out = h('div', { class: 'stats', 'aria-live': 'polite' }), m = msgEl();
  const lab = () => { lh.textContent = u.value === 'm' ? 'Height (cm)' : 'Height (inches)'; lw.textContent = u.value === 'm' ? 'Weight (kg)' : 'Weight (pounds)'; out.replaceChildren(); };
  u.onchange = lab; lab();
  const run = () => {
    out.replaceChildren(); m.set(''); const H = val(ht), W = val(w);
    if (!(H > 0) || !(W > 0)) { m.set('Please enter a height and weight above zero.'); return; }
    const b = u.value === 'm' ? W / ((H / 100) ** 2) : 703 * W / (H ** 2);
    if (!Number.isFinite(b) || b > 200) { m.set('Those values look unrealistic. Please check the units.'); return; }
    out.append(stat('BMI', b.toFixed(1)), stat('Category', b < 18.5 ? 'Underweight' : b < 25 ? 'Normal weight' : b < 30 ? 'Overweight' : 'Obesity'));
  };
  el.append(field('Units', u), h('div', { class: 'two' }, field(lh, ht), field(lw, w)), btn('Calculate BMI', run, 'pri'), m, out,
    h('p', { class: 'note' }, 'BMI is only a general screening measure. It does not account for muscle mass, age or body composition. Talk to a health professional for advice.'));
}
function discountTool(el) {
  const p = num({ min: '0' }), d = num({ min: '0', max: '100' }), out = h('div', { class: 'stats', 'aria-live': 'polite' }), m = msgEl();
  const run = () => {
    out.replaceChildren(); m.set(''); const P = val(p), D = val(d);
    if (!(P >= 0) || !(D >= 0 && D <= 100)) { m.set('Enter a price of 0 or more and a discount between 0 and 100.'); return; }
    const sv = P * D / 100; out.append(stat('Discount amount', sv.toFixed(2)), stat('Final price', (P - sv).toFixed(2)), stat('Savings', fmtN(D) + '%'));
  };
  el.append(h('div', { class: 'two' }, field('Original price', p), field('Discount (%)', d)), btn('Calculate', run, 'pri'), m, out);
}

/* ---------- text tools ---------- */
function liveCount(el, keys) {
  const t = area({ rows: 9 }), out = h('div', { class: 'stats', 'aria-live': 'polite' });
  const upd = () => {
    const s = t.value, w = s.trim() ? s.trim().split(/\s+/).length : 0;
    const c = { Words: w, Characters: [...s].length, 'Characters without spaces': [...s.replace(/\s/g, '')].length,
      Sentences: s.split(/[.!?]+(?:\s|$)/).filter(x => x.trim()).length, Paragraphs: s.split(/\n\s*\n/).filter(x => x.trim()).length,
      'Reading time': w ? Math.max(1, Math.ceil(w / 200)) + ' min' : '0 min', Lines: s ? s.split(/\r?\n/).length : 0 };
    out.replaceChildren(...keys.map(k => stat(k, typeof c[k] === 'number' ? c[k].toLocaleString() : c[k])));
  };
  t.oninput = upd; upd();
  el.append(field('Your text', t), out, btn('Clear', () => { t.value = ''; upd(); t.focus(); }));
}
const wordTool = el => liveCount(el, ['Words', 'Characters', 'Characters without spaces', 'Sentences', 'Paragraphs', 'Reading time']);
const charTool = el => liveCount(el, ['Characters', 'Characters without spaces', 'Words', 'Lines']);
const SMALL = new Set('a an and as at but by for in nor of on or per the to vs via'.split(' '));
const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
function caseTransformTool(el, mode) {
  const t = area({ rows: 9 }), o = area({ rows: 9, readonly: true });
  const titleCase = s => s.toLowerCase().replace(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu, (w, i, src) => {
    const before = src.slice(0, i);
    const wordIndex = (before.match(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu) || []).length;
    const small = SMALL.has(w.toLowerCase());
    return wordIndex > 0 && small ? w.toLowerCase() : cap(w);
  });
  const apply = transform => {
    if (!t.value) { toast('Please enter some text', 'err'); return; }
    o.value = transform(t.value);
  };
  const controls = mode === 'title'
    ? [btn('Convert to Title Case', () => apply(titleCase), 'pri')]
    : [btn('Uppercase', () => apply(s => s.toUpperCase()), 'pri'), btn('Lowercase', () => apply(s => s.toLowerCase()))];
  el.append(field('Your text', t), h('div', { class: 'acts' }, ...controls), field('Result', o),
    h('div', { class: 'acts' }, copyBtn(() => o.value), dlBtn(() => o.value, 'toolbox-pro-result.txt'), btn('Clear', () => { t.value = ''; o.value = ''; t.focus(); }, 'ghost')));
}

function jsonValidatorTool(el) {
  const t = area({ rows: 12, placeholder: '{"example":true}' }), m = msgEl();
  const run = () => {
    if (!t.value.trim()) { m.set('Please enter JSON to validate.'); return; }
    try { JSON.parse(t.value); m.set('Valid JSON.', true); toast('Valid JSON'); }
    catch (e) { m.set('Invalid JSON: ' + e.message); toast('Invalid JSON', 'err'); }
  };
  el.append(field('JSON input', t), h('div', { class: 'acts' }, btn('Validate JSON', run, 'pri'), btn('Clear', () => { t.value = ''; m.set(''); }, 'ghost')), m);
}

function textExtractorTool(el) {
  const t = area({ rows: 10 }), mode = sel([
    ['emails', 'Email addresses'], ['urls', 'URLs'], ['numbers', 'Numbers'],
    ['hashtags', 'Hashtags'], ['mentions', 'Mentions'], ['lines', 'Non-empty lines']
  ]), o = area({ rows: 10, readonly: true });
  const run = () => {
    const s = t.value;
    let values = [];
    if (mode.value === 'emails') values = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    else if (mode.value === 'urls') values = s.match(/https?:\/\/[^\s<>'"]+/gi) || [];
    else if (mode.value === 'numbers') values = s.match(/[-+]?\d+(?:\.\d+)?/g) || [];
    else if (mode.value === 'hashtags') values = s.match(/#[\p{L}\p{N}_]+/gu) || [];
    else if (mode.value === 'mentions') values = s.match(/@[A-Za-z0-9_]+/g) || [];
    else values = s.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    values = [...new Set(values)];
    o.value = values.join('\n');
    toast(values.length ? `Extracted ${values.length} item(s)` : 'Nothing found');
  };
  el.append(field('Text', t), field('Extract', mode), btn('Extract', run, 'pri'), field('Result', o),
    h('div', { class: 'acts' }, copyBtn(() => o.value), dlBtn(() => o.value, 'toolbox-pro-extracted.txt'), btn('Clear', () => { t.value = ''; o.value = ''; })));
}

function jpgToPngTool(el) {
  imgTool(el, { name: 'jpg-to-png', go: 'Convert JPG to PNG', fixed: 'png', check: f => f.type === 'image/jpeg' ? '' : 'Please select a JPG image.' });
}
function pngToJpgTool(el) {
  imgTool(el, { name: 'png-to-jpg', go: 'Convert PNG to JPG', fixed: 'jpeg', q: true, check: f => f.type === 'image/png' ? '' : 'Please select a PNG image.' });
}

function caseTool(el) {
  const t = area({ rows: 9 });
  const ops = [['UPPERCASE', s => s.toUpperCase()], ['lowercase', s => s.toLowerCase()],
    ['Title Case', s => s.toLowerCase().replace(/[\p{L}\p{N}'’]+/gu, (w, i) => i > 0 && SMALL.has(w) ? w : cap(w))],
    ['Sentence case', s => s.toLowerCase().replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())],
    ['Capitalize Words', s => s.toLowerCase().replace(/[\p{L}\p{N}'’]+/gu, cap)],
    ['Toggle Case', s => [...s].map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('')]];
  el.append(field('Your text', t), h('div', { class: 'acts' }, ...ops.map(([n, f]) => btn(n, () => { if (!t.value) { toast('Please enter some text', 'err'); return; } t.value = f(t.value); }))),
    h('div', { class: 'acts' }, copyBtn(() => t.value), dlBtn(() => t.value, 'toolbox-pro-result.txt'), btn('Clear', () => { t.value = ''; t.focus(); }, 'ghost')));
}
function dedupeTool(el) {
  const t = area({ rows: 8 }), o = area({ rows: 8, readonly: true }), [c1, l1] = chk('Case sensitive', true), [c2, l2] = chk('Trim whitespace', true), [c3, l3] = chk('Keep first occurrence', true), m = msgEl();
  const run = () => {
    if (!t.value) { m.set('Please enter some lines first.'); toast('Please enter some text', 'err'); return; }
    let L = t.value.split(/\r?\n/); if (c2.checked) L = L.map(x => x.trim());
    const key = x => c1.checked ? x : x.toLowerCase(), seen = new Set(), keep = [], src = c3.checked ? L : [...L].reverse();
    for (const x of src) { const k = key(x); if (!seen.has(k)) { seen.add(k); keep.push(x); } }
    if (!c3.checked) keep.reverse();
    o.value = keep.join('\n'); m.set(`Removed ${L.length - keep.length} duplicate line(s). ${keep.length} unique line(s) remain.`, true);
  };
  el.append(field('Lines', t), h('div', { class: 'opts' }, l1, l2, l3), btn('Remove duplicate lines', run, 'pri'), m, field('Result', o),
    h('div', { class: 'acts' }, copyBtn(() => o.value), dlBtn(() => o.value, 'toolbox-pro-result.txt')));
}
function sortTool(el) {
  const t = area({ rows: 8 }), o = area({ rows: 8, readonly: true });
  const nn = l => { const v = parseFloat(l.replace(/,/g, '')); return isNaN(v) ? null : v; };
  const numCmp = dir => (a, b) => { const x = nn(a), y = nn(b); if (x === null && y === null) return 0; if (x === null) return 1; if (y === null) return -1; return dir * (x - y); };
  const modes = { az: L => L.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), za: L => L.sort((a, b) => b.localeCompare(a, undefined, { sensitivity: 'base' })),
    na: L => L.sort(numCmp(1)), nd: L => L.sort(numCmp(-1)), rev: L => L.reverse(),
    rnd: L => { for (let i = L.length - 1; i > 0; i--) { const j = cryptoOk() ? rnd(i + 1) : Math.floor(Math.random() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; } return L; } };
  const s = sel([['az', 'A-Z'], ['za', 'Z-A'], ['na', 'Numeric ascending'], ['nd', 'Numeric descending'], ['rev', 'Reverse'], ['rnd', 'Randomize']]);
  const run = () => { if (!t.value) { toast('Please enter some lines', 'err'); return; } o.value = modes[s.value](t.value.split(/\r?\n/)).join('\n'); };
  el.append(field('Lines', t), field('Sort by', s), btn('Sort lines', run, 'pri'), field('Result', o), h('div', { class: 'acts' }, copyBtn(() => o.value), dlBtn(() => o.value, 'toolbox-pro-result.txt')));
}

/* ---------- developer tools ---------- */
function jsonTool(el) {
  const t = area({ rows: 12 }), m = msgEl(), ind = sel([['2', '2 spaces'], ['4', '4 spaces'], ['tab', 'Tab']]);
  const P = () => {
    if (!t.value.trim()) { m.set('Please enter valid JSON.'); toast('Invalid JSON', 'err'); return null; }
    try { return { v: JSON.parse(t.value) }; } catch (e) { m.set('Invalid JSON: ' + e.message); toast('Invalid JSON', 'err'); return null; }
  };
  el.append(field('JSON input', t), field('Indentation', ind), h('div', { class: 'acts' },
    btn('Format', () => { const p = P(); if (p) { t.value = JSON.stringify(p.v, null, ind.value === 'tab' ? '\t' : +ind.value); m.set('Formatted successfully.', true); } }, 'pri'),
    btn('Minify', () => { const p = P(); if (p) { t.value = JSON.stringify(p.v); m.set('Minified successfully.', true); } }),
    btn('Validate', () => { const p = P(); if (p) { m.set('Valid JSON.', true); toast('Valid JSON'); } }),
    copyBtn(() => t.value),
    btn('Download JSON', () => { const p = P(); if (p) saveText('formatted.json', JSON.stringify(p.v, null, 2), 'application/json'); })), m);
}
function b64Tool(el) {
  const t = area({ rows: 6 }), o = area({ rows: 6, readonly: true }), mode = sel([['e', 'Text to Base64'], ['d', 'Base64 to text']]), m = msgEl();
  const run = () => {
    m.set(''); o.value = '';
    if (!t.value) { m.set('Please enter some input.'); return; }
    try {
      if (mode.value === 'e') {
        const b = new TextEncoder().encode(t.value); let s = '';
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
        o.value = btoa(s);
      } else {
        const bin = atob(t.value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/'));
        const u = Uint8Array.from(bin, c => c.charCodeAt(0));
        try { o.value = new TextDecoder('utf-8', { fatal: true }).decode(u); } catch { m.set('The decoded data is not valid UTF-8 text.'); toast('Decoding failed', 'err'); return; }
      }
      m.set('Done.', true);
    } catch { m.set(mode.value === 'd' ? 'This is not valid Base64.' : 'Something went wrong. Please try again.'); toast('Conversion failed', 'err'); }
  };
  el.append(field('Mode', mode), field('Input', t), btn('Convert', run, 'pri'), m, field('Output', o), h('div', { class: 'acts' }, copyBtn(() => o.value), dlBtn(() => o.value, 'toolbox-pro-result.txt')));
}
function urlTool(el) {
  const t = area({ rows: 5 }), o = area({ rows: 5, readonly: true }), mode = sel([['ec', 'Encode (component)'], ['eu', 'Encode (full URL)'], ['d', 'Decode']]), m = msgEl();
  const run = () => {
    m.set(''); o.value = ''; if (!t.value) { m.set('Please enter some input.'); return; }
    try { o.value = mode.value === 'ec' ? encodeURIComponent(t.value) : mode.value === 'eu' ? encodeURI(t.value) : decodeURIComponent(t.value); m.set('Done.', true); }
    catch { m.set('This input cannot be processed. It may contain invalid percent-encoding.'); toast('Conversion failed', 'err'); }
  };
  el.append(field('Mode', mode), field('Input', t), btn('Convert', run, 'pri'), m, field('Output', o), h('div', { class: 'acts' }, copyBtn(() => o.value), dlBtn(() => o.value, 'toolbox-pro-result.txt')));
}
function uuidV4() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128;
  const x = [...b].map(v => v.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
function uuidTool(el) {
  if (!cryptoOk()) { el.append(h('p', { class: 'msg' }, 'Your browser does not support secure random numbers.')); return; }
  const c = num({ value: '1', min: '1', max: '100', step: '1' }), o = area({ rows: 8, readonly: true }), m = msgEl();
  const run = () => { const n = val(c); if (!Number.isInteger(n) || n < 1 || n > 100) { m.set('Enter a whole number from 1 to 100.'); return; } m.set(''); o.value = Array.from({ length: n }, uuidV4).join('\n'); };
  el.append(field('How many UUIDs (1-100)', c), btn('Generate', run, 'pri'), m, field('UUID v4', o), h('div', { class: 'acts' }, copyBtn(() => o.value), dlBtn(() => o.value, 'toolbox-pro-uuids.txt')));
  run();
}
function hashTool(el) {
  const t = area({ rows: 5 }), a = sel(['SHA-256', 'SHA-384', 'SHA-512']), o = area({ rows: 4, readonly: true }), m = msgEl();
  if (!(window.crypto && crypto.subtle)) { el.append(h('p', { class: 'msg' }, 'Your browser does not support the Web Crypto API. Open this site over HTTPS or localhost.')); return; }
  const run = async () => {
    try { const d = await crypto.subtle.digest(a.value, new TextEncoder().encode(t.value)); o.value = [...new Uint8Array(d)].map(v => v.toString(16).padStart(2, '0')).join(''); m.set(''); }
    catch { m.set('Something went wrong. Please try again.'); toast('Hashing failed', 'err'); }
  };
  t.oninput = run; a.onchange = run;
  el.append(field('Input text', t), field('Algorithm', a), m, field('Hash (hex)', o), h('div', { class: 'acts' }, copyBtn(() => o.value), dlBtn(() => o.value, 'toolbox-pro-hash.txt')));
  run();
}

/* ---------- image tools ---------- */
function pickImage(onImg, opt = {}) {
  const maxMB = opt.maxMB || 25, input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr' });
  const zone = h('label', { class: 'drop' }, input, h('strong', {}, 'Choose an image'), h('span', {}, 'or drop it here (JPG, PNG or WebP, up to ' + maxMB + ' MB)'));
  async function handle(f) {
    if (!f) return;
    if (!f.size) { toast('This file is empty.', 'err'); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast('Please select a JPG, PNG or WebP image.', 'err'); return; }
    if (f.size > maxMB * 1048576) { toast(`This image is larger than ${maxMB} MB.`, 'err'); return; }
    const ce = opt.check && opt.check(f); if (ce) { toast(ce, 'err'); return; }
    const u = mkUrl(f), img = new Image();
    try { img.src = u; await img.decode(); } catch { revUrl(u); toast('Unable to read this image.', 'err'); return; }
    onImg(img, f, u);
  }
  input.onchange = () => { handle(input.files[0]); input.value = ''; };
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); handle(e.dataTransfer.files[0]); });
  return zone;
}
function canvasBlob(img, w, ht, type, q) {
  return new Promise((res, rej) => {
    try {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = ht; const x = cv.getContext('2d');
      if (!x) return rej(new Error('canvas'));
      if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, ht); }
      x.drawImage(img, 0, 0, w, ht);
      cv.toBlob(b => b && b.type === type ? res(b) : rej(new Error('fmt')), type, q);
    } catch { rej(new Error('canvas')); }
  });
}
function imgTool(el, c) {
  const st = { img: null, file: null, src: null, out: null }, info = h('p', { class: 'note' }), prev = h('img', { class: 'prev', alt: 'Preview of the result', hidden: true }), stats = h('div', { class: 'stats', 'aria-live': 'polite' }), m = msgEl();
  const fmt = c.fmts ? sel(c.fmts, {}) : null, mode = c.modes ? sel(c.modes) : null;
  const q = c.q ? inp({ type: 'range', min: '10', max: '100', value: '80' }) : null, qo = h('output', {}, '80%');
  if (q) q.oninput = () => qo.textContent = q.value + '%';
  const MW = c.max ? num({ min: '1', step: '1', placeholder: 'No limit' }) : null, MH = c.max ? num({ min: '1', step: '1', placeholder: 'No limit' }) : null;
  const W = c.resize ? num({ min: '1', step: '1' }) : null, H = c.resize ? num({ min: '1', step: '1' }) : null, [lk, lkl] = chk('Lock aspect ratio', true);
  let ratio = 1;
  if (W) { W.oninput = () => { if (lk.checked && W.value) H.value = Math.max(1, Math.round(W.value / ratio)); }; H.oninput = () => { if (lk.checked && H.value) W.value = Math.max(1, Math.round(H.value * ratio)); }; }
  const fmtOf = () => c.fixed ? (typeof c.fixed === 'function' ? c.fixed(mode) : c.fixed) : fmt.value;
  const chk_ = f => c.check ? c.check(f, mode) : '';
  const zone = pickImage((img, f, u) => {
    revUrl(st.src); st.img = img; st.file = f; st.src = u; ratio = img.naturalWidth / img.naturalHeight;
    if (W) { W.value = img.naturalWidth; H.value = img.naturalHeight; }
    info.textContent = `${f.name}: ${img.naturalWidth} × ${img.naturalHeight} px, ${fb(f.size)}`; m.set(''); stats.replaceChildren();
    revUrl(st.out); st.out = null; st.blob = null; prev.hidden = false; prev.src = u;
  }, { check: f => chk_(f) });
  const run = async () => {
    m.set(''); if (!st.img) { toast('Please select an image first.', 'err'); m.set('Please select an image first.'); return; }
    const ce = chk_(st.file); if (ce) { m.set(ce); toast(ce, 'err'); return; }
    let w = st.img.naturalWidth, ht = st.img.naturalHeight;
    if (W) { w = parseInt(W.value, 10); ht = parseInt(H.value, 10); if (!(w > 0 && ht > 0) || w > 16384 || ht > 16384) { m.set('Enter a width and height between 1 and 16384.'); return; } }
    if (MW) { const r = Math.min(1, (parseInt(MW.value, 10) || Infinity) / w, (parseInt(MH.value, 10) || Infinity) / ht); w = Math.max(1, Math.round(w * r)); ht = Math.max(1, Math.round(ht * r)); }
    const type = 'image/' + fmtOf(); m.set('Processing…', true); await new Promise(r => setTimeout(r, 30));
    try {
      const b = await canvasBlob(st.img, w, ht, type, q ? q.value / 100 : 0.92);
      revUrl(st.out); st.out = mkUrl(b); st.blob = b; prev.src = st.out; prev.hidden = false;
      const ch = (1 - b.size / st.file.size) * 100;
      stats.replaceChildren(stat('Original size', fb(st.file.size)), stat('New size', fb(b.size)), stat(ch >= 0 ? 'Reduction' : 'Increase', Math.abs(ch).toFixed(1) + '%'), stat('Dimensions', `${w} × ${ht}`));
      m.set('Done.', true); toast('Conversion completed');
    } catch (e) {
      const t = e.message === 'fmt' ? (type === 'image/webp' ? 'Your browser does not support WebP encoding.' : 'Your browser does not support this format.') : 'Something went wrong. The image may be too large to process.';
      m.set(t); toast(t, 'err');
    }
  };
  const dl = () => { if (!st.blob) { toast('Process an image first.', 'err'); return; } const f = fmtOf(); save(`${c.name}.${f === 'jpeg' ? 'jpg' : f}`, st.blob); };
  const ctl = [mode && field('Conversion', mode), fmt && field('Output format', fmt), q && field('Quality', h('span', { class: 'rng' }, q, qo)),
    MW && h('div', { class: 'two' }, field('Maximum width (px)', MW), field('Maximum height (px)', MH)),
    W && h('div', { class: 'two' }, field('Width (px)', W), field('Height (px)', H)), W && h('div', { class: 'opts' }, lkl)];
  el.append(zone, info, ...ctl.filter(Boolean), h('div', { class: 'acts' }, btn(c.go, run, 'pri'), btn('Download', dl)), m, prev, stats);
}
function b64ImgTool(el) {
  const du = area({ rows: 5, readonly: true }), b6 = area({ rows: 5, readonly: true }), info = h('p', { class: 'note' });
  const zone = pickImage((img, f) => {
    const r = new FileReader();
    r.onload = () => { du.value = r.result; b6.value = r.result.slice(r.result.indexOf(',') + 1); info.textContent = `${f.name}: ${fb(f.size)} original, ${fb(r.result.length)} as text`; toast('Conversion completed'); };
    r.onerror = () => toast('Unable to read this image.', 'err'); r.readAsDataURL(f);
  }, { maxMB: 5 });
  el.append(zone, info, field('Data URL', du), h('div', { class: 'acts' }, copyBtn(() => du.value), dlBtn(() => du.value, 'image-data-url.txt')),
    field('Base64 only', b6), h('div', { class: 'acts' }, copyBtn(() => b6.value), dlBtn(() => b6.value, 'image-base64.txt')));
}

/* ---------- utilities ---------- */
const QR_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
function qrTool(el) {
  const type = sel([['text', 'Text'], ['url', 'URL'], ['email', 'Email'], ['phone', 'Phone']]), v = inp({ type: 'text' }), size = sel([['256', '256 px'], ['384', '384 px'], ['512', '512 px'], ['768', '768 px']], {});
  const ecc = sel([['L', 'Low (L)'], ['M', 'Medium (M)'], ['Q', 'Quartile (Q)'], ['H', 'High (H)']]), cv = h('canvas', { class: 'qr', hidden: true, role: 'img', 'aria-label': 'Generated QR code' }), m = msgEl(); let ready = false;
  size.value = '384'; ecc.value = 'M';
  const load = () => new Promise((res, rej) => {
    if (window.qrcode) return res();
    const s = h('script', { src: QR_SRC, onload: res, onerror: () => { s.remove(); rej(new Error('load')); } }); document.head.append(s);
  });
  const gen = async () => {
    ready = false; cv.hidden = true; let d = v.value.trim();
    if (!d) { m.set('Please enter the content for your QR code.'); return; }
    if (type.value === 'email') { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d)) { m.set('Please enter a valid email address.'); return; } d = 'mailto:' + d; }
    else if (type.value === 'phone') { if (!/^\+?[\d\s()-]{3,}$/.test(d)) { m.set('Please enter a valid phone number.'); return; } d = 'tel:' + d.replace(/[\s()-]/g, ''); }
    else if (type.value === 'url') { if (!/^[a-z][a-z0-9+.-]*:/i.test(d)) d = 'https://' + d; try { new URL(d); } catch { m.set('Please enter a valid URL.'); return; } }
    try { await load(); } catch { m.set('The QR code library could not be loaded. Check your internet connection and try again.'); toast('QR library failed to load', 'err'); return; }
    try {
      qrcode.stringToBytes = s => Array.from(new TextEncoder().encode(s));
      const q = qrcode(0, ecc.value); q.addData(d); q.make();
      const n = q.getModuleCount(), sc = Math.max(1, Math.floor(+size.value / (n + 8))), px = sc * (n + 8), x = cv.getContext('2d');
      cv.width = px; cv.height = px; x.fillStyle = '#fff'; x.fillRect(0, 0, px, px); x.fillStyle = '#000';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + 4) * sc, (r + 4) * sc, sc, sc);
      cv.hidden = false; ready = true; m.set('QR code generated.', true); toast('QR code generated');
    } catch { m.set('This content is too long for a QR code at this error-correction level.'); toast('QR generation failed', 'err'); }
  };
  const dl = () => { if (!ready) { toast('Generate a QR code first.', 'err'); return; } cv.toBlob(b => b ? save('generated-qr.png', b) : toast('Something went wrong. Please try again.', 'err'), 'image/png'); };
  el.append(h('div', { class: 'two' }, field('Content type', type), field('Content', v)), h('div', { class: 'two' }, field('Size', size), field('Error correction', ecc)),
    h('div', { class: 'acts' }, btn('Generate', gen, 'pri'), btn('Download PNG', dl)), m, cv);
}
const UNITS = {
  Length: { mm: .001, cm: .01, m: 1, km: 1000, in: .0254, ft: .3048, yd: .9144, mi: 1609.344 },
  Weight: { mg: 1e-6, g: .001, kg: 1, t: 1000, oz: .028349523125, lb: .45359237 },
  Area: { 'mm²': 1e-6, 'cm²': 1e-4, 'm²': 1, ha: 1e4, 'km²': 1e6, 'in²': 6.4516e-4, 'ft²': .09290304, acre: 4046.8564224 },
  Volume: { mL: .001, L: 1, 'm³': 1000, tsp: .00492892159375, tbsp: .01478676478125, cup: .2365882365, 'gal (US)': 3.785411784, 'fl oz (US)': .0295735295625 },
  Speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: .44704, knot: 1852 / 3600, 'ft/s': .3048 },
  Time: { ms: .001, s: 1, min: 60, h: 3600, day: 86400, week: 604800 },
  'Data size': { bit: .125, B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 },
  Temperature: { '°C': 1, '°F': 1, K: 1 }
};
function unitTool(el) {
  const cat = sel(Object.keys(UNITS)), a = sel(['x']), b = sel(['x']), v = num({ value: '1' }), out = h('div', { class: 'big', 'aria-live': 'polite' }), m = msgEl();
  const fill = () => { for (const s of [a, b]) s.replaceChildren(...Object.keys(UNITS[cat.value]).map(k => h('option', { value: k }, k))); b.selectedIndex = Math.min(1, b.options.length - 1); calc(); };
  const toC = (x, u) => u === '°C' ? x : u === '°F' ? (x - 32) * 5 / 9 : x - 273.15, fromC = (c, u) => u === '°C' ? c : u === '°F' ? c * 9 / 5 + 32 : c + 273.15;
  function calc() {
    m.set(''); out.textContent = ''; const x = val(v); if (!Number.isFinite(x)) { m.set('Please enter a number.'); return; }
    let r;
    if (cat.value === 'Temperature') { const c = toC(x, a.value); if (c < -273.15 - 1e-9) { m.set('That is below absolute zero.'); return; } r = fromC(c, b.value); }
    else r = x * UNITS[cat.value][a.value] / UNITS[cat.value][b.value];
    out.textContent = `${fmtN(x)} ${a.value} = ${fmtN(r)} ${b.value}`;
  }
  cat.onchange = fill; [a, b].forEach(s => s.onchange = calc); v.oninput = calc;
  el.append(field('Category', cat), field('Value', v), h('div', { class: 'two' }, field('From', a), field('To', b)),
    btn('Swap units', () => { const t = a.value; a.value = b.value; b.value = t; calc(); }), m, out, h('p', { class: 'note' }, 'Data sizes use 1024-based steps (1 KB = 1024 B).'));
  fill();
}
function tsTool(el) {
  const ts = inp({ type: 'text', inputmode: 'numeric', placeholder: 'e.g. 1700000000' }), u = sel([['s', 'Seconds'], ['ms', 'Milliseconds']]), o1 = h('div', { class: 'stats', 'aria-live': 'polite' }), m1 = msgEl();
  const toDate = () => {
    o1.replaceChildren(); m1.set(''); const s = ts.value.trim(), n = Number(s);
    if (!s || !Number.isFinite(n)) { m1.set('Please enter a valid number.'); return; }
    const d = new Date(u.value === 'ms' ? n : n * 1000); if (isNaN(d)) { m1.set('That timestamp is outside the supported date range.'); return; }
    o1.append(stat('Local time', d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })), stat('UTC', d.toUTCString()), stat('ISO 8601', d.toISOString()), stat('Your time zone', Intl.DateTimeFormat().resolvedOptions().timeZone));
  };
  const dt = inp({ type: 'datetime-local', step: '1' }), tz = sel([['l', 'My local time zone'], ['u', 'UTC']]), o2 = h('div', { class: 'stats', 'aria-live': 'polite' }), m2 = msgEl();
  const toTs = () => {
    o2.replaceChildren(); m2.set(''); if (!dt.value) { m2.set('Please choose a date and time.'); return; }
    const d = new Date(tz.value === 'u' ? dt.value + (dt.value.length === 16 ? ':00' : '') + 'Z' : dt.value);
    if (isNaN(d)) { m2.set('That date is not valid.'); return; }
    o2.append(stat('Seconds', Math.floor(d.getTime() / 1000)), stat('Milliseconds', d.getTime()));
  };
  el.append(h('div', { class: 'two' }, field('Unix timestamp', ts), field('Unit', u)), h('div', { class: 'acts' }, btn('Convert to date', toDate, 'pri'),
    btn('Use current time', () => { ts.value = u.value === 'ms' ? Date.now() : Math.floor(Date.now() / 1000); toDate(); })), m1, o1,
    h('div', { class: 'two' }, field('Date and time', dt), field('Interpret as', tz)), btn('Convert to timestamp', toTs, 'pri'), m2, o2);
}
const rgb2hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), n = Math.min(r, g, b), d = M - n, l = (M + n) / 2; let hh = 0, s = 0;
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); hh = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; } return [Math.round(hh), Math.round(s * 100), Math.round(l * 100)]; };
const hsl2rgb = (H, S, L) => { S /= 100; L /= 100; const k = n => (n + H / 30) % 12, a = S * Math.min(L, 1 - L), f = n => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)].map(v => Math.round(v * 255)); };
function colorTool(el) {
  const pick = inp({ type: 'color', value: '#1f5eff' }), hx = inp({ type: 'text' }), rg = inp({ type: 'text' }), hs = inp({ type: 'text' }), sw = h('div', { class: 'swatch', role: 'img', 'aria-label': 'Color preview' }), m = msgEl();
  const toHex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  const parse = {
    hx: s => { const x = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim()); if (!x) return null; let t = x[1]; if (t.length === 3) t = [...t].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(t.slice(i, i + 2), 16)); },
    rg: s => { const x = /^(?:rgb\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/i.exec(s.trim()); if (!x) return null; const c = x.slice(1).map(Number); return c.every(v => v <= 255) ? c : null; },
    hs: s => { const x = /^(?:hsl\()?\s*(\d{1,3}(?:\.\d+)?)\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%?\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%?\s*\)?$/i.exec(s.trim()); if (!x) return null; const [a, b, c] = x.slice(1).map(Number); return a <= 360 && b <= 100 && c <= 100 ? hsl2rgb(a, b, c) : null; }
  };
  const set = (c, src) => {
    const hex = toHex(c), [H, S, L] = rgb2hsl(...c);
    if (src !== 'hx') hx.value = hex; if (src !== 'rg') rg.value = `rgb(${c.join(', ')})`; if (src !== 'hs') hs.value = `hsl(${H}, ${S}%, ${L}%)`; pick.value = hex; sw.style.background = hex; m.set('');
  };
  const on = k => e => { const c = parse[k](e.target.value); if (c) set(c, k); else m.set('That color format is not valid.'); };
  hx.oninput = on('hx'); rg.oninput = on('rg'); hs.oninput = on('hs'); pick.oninput = () => set(parse.hx(pick.value));
  const row = (label, i) => h('div', { class: 'two' }, field(label, i), h('div', { class: 'acts', style: 'align-self:end' }, copyBtn(() => i.value)));
  el.append(field('Color picker', pick), sw, row('HEX', hx), row('RGB', rg), row('HSL', hs), m); set([31, 94, 255]);
}
function pwTool(el) {
  if (!cryptoOk()) { el.append(h('p', { class: 'msg' }, 'Your browser does not support secure random numbers.')); return; }
  const len = inp({ type: 'range', min: '6', max: '64', value: '16' }), lo = h('output', {}, '16'), [cu, lu] = chk('Uppercase (A-Z)', true), [cl, ll] = chk('Lowercase (a-z)', true), [cn, ln] = chk('Numbers (0-9)', true), [cs, ls] = chk('Symbols (!@#…)', true);
  const out = h('div', { class: 'pw', 'aria-live': 'polite' }), bar = h('i'), lab = h('p', { class: 'note' }), m = msgEl();
  const SETS = [[cu, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'], [cl, 'abcdefghijklmnopqrstuvwxyz'], [cn, '0123456789'], [cs, '!@#$%^&*()-_=+[]{};:,.?']];
  const gen = () => {
    const on = SETS.filter(s => s[0].checked).map(s => s[1]); m.set('');
    if (!on.length) { m.set('Select at least one character type.'); toast('Select at least one character type', 'err'); return; }
    const L = +len.value, pool = on.join(''), p = on.map(s => s[rnd(s.length)]);
    while (p.length < L) p.push(pool[rnd(pool.length)]);
    for (let i = p.length - 1; i > 0; i--) { const j = rnd(i + 1); [p[i], p[j]] = [p[j], p[i]]; }
    out.textContent = p.join('');
    const bits = L * Math.log2(pool.length), s = bits < 40 ? 'Weak' : bits < 60 ? 'Fair' : bits < 80 ? 'Strong' : 'Very strong';
    bar.style.width = Math.min(100, bits / 1.28) + '%'; lab.textContent = `Strength: ${s} (about ${Math.round(bits)} bits)`;
  };
  len.oninput = () => { lo.textContent = len.value; gen(); };
  el.append(field('Length', h('span', { class: 'rng' }, len, lo)), h('div', { class: 'opts' }, lu, ll, ln, ls), out, h('div', { class: 'meter', role: 'presentation' }, bar), lab, m,
    h('div', { class: 'acts' }, btn('Generate password', gen, 'pri'), btn('Copy', () => copyText(out.textContent))));
  SETS.forEach(s => s[0].onchange = gen); gen();
}


/* ---------- additional 35 useful tools ---------- */
function simpleCalc(el, title, fields, calc) {
  const controls = fields.map(([label, type='number', placeholder='']) => field(label, inp({type, placeholder, step:type==='number'?'any':undefined})));
  const out=h('div',{class:'big','aria-live':'polite'}), m=msgEl();
  const run=()=>{m.set('');out.textContent='';try{const r=String(calc(controls.map(x=>x.querySelector('input,textarea,select'))));if(/NaN|Infinity/.test(r))throw 0;out.textContent=r}catch{m.set('Please check your inputs.')}};
  el.append(h('p',{class:'note'},title),h('div',{class:'two'},...controls),btn('Calculate',run,'pri'),m,out);
}
function bcomAggTool(el){simpleCalc(el,'Enter total marks from all semesters/subjects.',[['Marks obtained'],['Maximum marks']],x=>{const a=+x[0].value,b=+x[1].value;if(!(b>0)||a<0||a>b)throw 0;return `Aggregate Percentage: ${(a/b*100).toFixed(2)}%`;});}
function sgpaTool(el){const rows=h('div',{class:'rows'}),out=h('div',{class:'big'}),m=msgEl();let n=0;const add=()=>{n++;rows.append(h('div',{class:'row'},num({placeholder:'Grade points'}),num({placeholder:'Credits'}),btn('Remove',e=>e.currentTarget.parentElement.remove(),'ghost')))};add();add();const run=()=>{let p=0,c=0;for(const r of rows.children){const i=r.querySelectorAll('input');const g=+i[0].value,cr=+i[1].value;if(!(g>=0&&cr>0))throw 0;p+=g*cr;c+=cr}out.textContent=`SGPA: ${(p/c).toFixed(2)}`};el.append(h('p',{class:'note'},'Add each subject grade point and credit.'),rows,h('div',{class:'acts'},btn('Add subject',add),btn('Calculate',()=>{try{run();m.set('')}catch{m.set('Enter valid grade points and credits.')}} ,'pri')),m,out)}
function marksGradeTool(el){simpleCalc(el,'Convert marks into a percentage and common grade.',[['Marks'],['Maximum marks']],x=>{if(x.some(i=>i.value===''))throw 0;let p=+x[0].value/+x[1].value*100;if(!Number.isFinite(p)||p<0||p>100)throw 0;let g=p>=90?'A+':p>=80?'A':p>=70?'B':p>=60?'C':p>=50?'D':p>=40?'E':'F';return `${p.toFixed(2)}% — Grade ${g}`})}
function gstTool(el){simpleCalc(el,'Calculate GST inclusive/exclusive amounts.',[['Amount'],['GST rate %']],x=>{let a=+x[0].value,r=+x[1].value,g=a*r/100;return `GST: ${g.toFixed(2)}\nTotal: ${(a+g).toFixed(2)}`})}
function emiTool(el){simpleCalc(el,'Monthly EMI using reducing-balance formula.',[['Loan amount'],['Annual interest %'],['Months']],x=>{let P=+x[0].value,r=+x[1].value/1200,n=+x[2].value;if(!(P>0&&n>0))throw 0;let e=r?P*r*(1+r)**n/((1+r)**n-1):P/n;return `Monthly EMI: ${e.toFixed(2)}`})}
function interestTool(el){simpleCalc(el,'Simple interest calculator.',[['Principal'],['Annual rate %'],['Years']],x=>{let p=+x[0].value,r=+x[1].value,y=+x[2].value;return `Interest: ${(p*r*y/100).toFixed(2)}\nAmount: ${(p+p*r*y/100).toFixed(2)}`})}
function compoundTool(el){simpleCalc(el,'Compound interest calculator.',[['Principal'],['Annual rate %'],['Years'],['Compounds per year']],x=>{let p=+x[0].value,r=+x[1].value/100,n=+x[3].value,y=+x[2].value;if(!(p>0&&n>0))throw 0;let a=p*(1+r/n)**(n*y);return `Amount: ${a.toFixed(2)}\nInterest: ${(a-p).toFixed(2)}`})}
function profitTool(el){simpleCalc(el,'Profit or loss from cost and selling price.',[['Cost price'],['Selling price']],x=>{let c=+x[0].value,s=+x[1].value;if(!(c>0)||!Number.isFinite(s))throw 0;const d=s-c;return d>=0?`Profit: ${d.toFixed(2)} (${(d/c*100).toFixed(2)}%)`:`Loss: ${(-d).toFixed(2)} (${(-d/c*100).toFixed(2)}%)`})}
function ratioTool(el){simpleCalc(el,'Simplify a ratio.',[['First value'],['Second value']],x=>{let a=+x[0].value,b=+x[1].value;if(!Number.isFinite(a)||!Number.isFinite(b)||(!a&&!b))throw 0;const g=(m,n)=>n?g(n,m%n):Math.abs(m);const d=g(a,b);return `${a/d}:${b/d}`})}
function averageTool(el){const a=area({placeholder:'10, 20, 30'}),o=h('div',{class:'big'});el.append(field('Numbers separated by commas',a),btn('Calculate',()=>{let v=a.value.split(',').map(Number).filter(Number.isFinite);o.textContent=v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2):'Enter numbers'},'pri'),o)}
function fractionTool(el){simpleCalc(el,'Add two fractions.',[['Numerator 1'],['Denominator 1'],['Numerator 2'],['Denominator 2']],x=>{let a=+x[0].value,b=+x[1].value,c=+x[2].value,d=+x[3].value;if(!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(c)||!Number.isFinite(d)||!b||!d)throw 0;let n=a*d+c*b,den=b*d;const g=(m,k)=>k?g(k,m%k):Math.abs(m);let z=g(n,den);return `${n/z}/${den/z}`})}
function reverseTool(el){const a=area(),o=h('div',{class:'result'});el.append(field('Text',a),btn('Reverse',()=>o.textContent=[...a.value].reverse().join(''),'pri'),o)}
function whitespaceTool(el){const a=area(),o=h('div',{class:'result'});el.append(field('Text',a),btn('Clean whitespace',()=>o.textContent=a.value.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim(),'pri'),o)}
function lineCountTool(el){const a=area(),o=h('div',{class:'big'});el.append(field('Text',a),btn('Count',()=>o.textContent=`Lines: ${a.value?a.value.split(/\r?\n/).length:0}`,'pri'),o)}
function readingTool(el){const a=area(),w=num({value:'200',min:'1'}),o=h('div',{class:'big'});el.append(field('Text',a),field('Words per minute',w),btn('Estimate',()=>{let c=a.value.trim()?a.value.trim().split(/\s+/).length:0;o.textContent=`About ${Math.max(0,Math.ceil(c/(+w.value||200)))} minute(s)`},'pri'),o)}
function findReplaceTool(el){const a=area(),f=inp(),r=inp(),o=area({readonly:true});el.append(field('Text',a),h('div',{class:'two'},field('Find',f),field('Replace with',r)),btn('Replace all',()=>{o.value=a.value.split(f.value).join(r.value)},'pri'),o)}
function slugTool(el){const a=inp(),o=h('div',{class:'result'});el.append(field('Title',a),btn('Create slug',()=>o.textContent=a.value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-'),'pri'),o)}
function emailsTool(el){const a=area(),o=area({readonly:true});el.append(field('Text',a),btn('Extract emails',()=>o.value=[...new Set(a.value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[])].join('\n'),'pri'),o)}
function urlsTool(el){const a=area(),o=area({readonly:true});el.append(field('Text',a),btn('Extract URLs',()=>o.value=[...new Set(a.value.match(/https?:\/\/[^\s<]+/gi)||[])].join('\n'),'pri'),o)}
function htmlEncodeTool(el){
  const a=area(),o=area({readonly:true}),mode=sel([['e','Encode'],['d','Decode']]),m=msgEl();
  const ENC=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const DEC=s=>{const t=document.createElement('textarea');t.innerHTML=s.replace(/</g,'&lt;');return t.value};
  el.append(field('Mode',mode),field('HTML or text',a),btn('Convert',()=>{m.set('');if(!a.value){o.value='';m.set('Please enter some input.');return}o.value=mode.value==='e'?ENC(a.value):DEC(a.value);m.set('Done.',true)},'pri'),m,field('Output',o),h('div',{class:'acts'},copyBtn(()=>o.value),dlBtn(()=>o.value,'toolbox-pro-result.txt')));
}
function regexTool(el){const p=inp(),s=area(),o=h('div',{class:'result'});el.append(field('Regex',p),field('Test text',s),btn('Test',()=>{try{o.textContent=new RegExp(p.value).test(s.value)?'Match found.':'No match.'}catch{o.textContent='Invalid regular expression.'}},'pri'),o)}
function jwtTool(el){const a=area(),o=area({readonly:true});el.append(field('JWT',a),btn('Decode payload',()=>{try{const x=a.value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');o.value=JSON.stringify(JSON.parse(atob(x)),null,2)}catch{o.value='Invalid JWT payload.'}},'pri'),o)}
function urlParseTool(el){const a=inp(),o=area({readonly:true});el.append(field('URL',a),btn('Parse',()=>{try{let u=new URL(a.value);o.value=`Protocol: ${u.protocol}\nHost: ${u.host}\nPath: ${u.pathname}\nQuery: ${u.search}\nHash: ${u.hash}`}catch{o.value='Invalid URL.'}},'pri'),o)}
function timestampTool(el){simpleCalc(el,'Convert Unix timestamp to local date.',[['Unix timestamp']],x=>{let d=new Date(+x[0].value*1000);if(isNaN(d))throw 0;return d.toString()})}
function randomTool(el){simpleCalc(el,'Generate a random integer in an inclusive range.',[['Minimum'],['Maximum']],x=>{let a=+x[0].value,b=+x[1].value;if(b<a)throw 0;return String(Math.floor(Math.random()*(b-a+1))+a)})}
function numberWordsTool(el){const a=num(),o=h('div',{class:'result'});function w(n){const u=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'],t=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];if(n<20)return u[n];if(n<100)return t[Math.floor(n/10)]+(n%10?'-'+u[n%10]:'');if(n<1000)return u[Math.floor(n/100)]+' hundred'+(n%100?' '+w(n%100):'');if(n<1e6)return w(Math.floor(n/1000))+' thousand'+(n%1000?' '+w(n%1000):'');if(n<1e9)return w(Math.floor(n/1e6))+' million'+(n%1e6?' '+w(n%1e6):'');return 'Number too large';}el.append(field('Integer',a),btn('Convert',()=>{let n=+a.value;o.textContent=Number.isInteger(n)&&n>=0?w(n):'Enter a positive integer.'},'pri'),o)}
function dateDiffTool(el){const a=inp({type:'date'}),b=inp({type:'date'}),o=h('div',{class:'big'});el.append(h('div',{class:'two'},field('Start',a),field('End',b)),btn('Calculate',()=>{let d=Math.abs(new Date(b.value)-new Date(a.value));o.textContent=a.value&&b.value?`${Math.ceil(d/86400000)} day(s)`:'Select both dates'},'pri'),o)}
function dateAddTool(el){const a=inp({type:'date'}),b=num(),o=h('div',{class:'big','aria-live':'polite'});el.append(field('Date',a),field('Days (+/-)',b),btn('Calculate',()=>{if(!a.value){o.textContent='Select a date';return}const d=new Date(a.value+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+(+b.value||0));o.textContent=isNaN(d)?'Select a date':d.toISOString().slice(0,10)},'pri'),o)}
function bmiTool2(el){simpleCalc(el,'BMI = weight / height².',[['Weight kg'],['Height cm']],x=>{let w=+x[0].value,h=+x[1].value/100;if(!(w>0&&h>0))throw 0;let b=w/(h*h);return `BMI: ${b.toFixed(2)} — ${b<18.5?'Underweight':b<25?'Normal':b<30?'Overweight':'Obesity'}`})}
function examCountdownTool(el){const a=inp({type:'date'}),o=h('div',{class:'big','aria-live':'polite'});el.append(field('Exam date',a),btn('Calculate',()=>{if(!a.value){o.textContent='Select a date';return}const d=new Date(a.value+'T00:00:00'),n=new Date();n.setHours(0,0,0,0);const k=Math.round((d-n)/86400000);o.textContent=k<0?'This exam date has already passed.':k===0?'The exam is today. Good luck!':`${k} day(s) remaining`},'pri'),o)}
function studyTimeTool(el){simpleCalc(el,'Plan total study time.',[['Topics'],['Minutes per topic'],['Break minutes']],x=>{let t=(+x[0].value||0)*((+x[1].value||0)+(+x[2].value||0));return `${t} minutes (${(t/60).toFixed(1)} hours)`})}
function textCompareTool(el){const a=area(),b=area(),o=h('div',{class:'result'});el.append(field('Text A',a),field('Text B',b),btn('Compare',()=>{o.textContent=a.value===b.value?'Identical':`Different — length difference ${Math.abs(a.value.length-b.value.length)}`},'pri'),o)}
function csvJsonTool(el){const a=area(),o=area({readonly:true});el.append(field('CSV (first row headers)',a),btn('Convert',()=>{let lines=a.value.trim().split(/\r?\n/);if(!lines.length){o.value='';return}let h=lines.shift().split(',').map(x=>x.trim());o.value=JSON.stringify(lines.map(l=>{let v=l.split(',');return Object.fromEntries(h.map((k,i)=>[k,(v[i]||'').trim()]))}),null,2)},'pri'),o)}
function jsonCsvTool(el){const a=area(),o=area({readonly:true});el.append(field('JSON array',a),btn('Convert',()=>{try{let x=JSON.parse(a.value);if(!Array.isArray(x))throw 0;let h=[...new Set(x.flatMap(o=>Object.keys(o)))];o.value=[h.join(','),...x.map(r=>h.map(k=>JSON.stringify(r[k]??'')).join(','))].join('\n')}catch{o.value='Expected a JSON array of objects.'}},'pri'),o)}
function contrastTool(el){const a=inp({type:'color',value:'#ffffff'}),b=inp({type:'color',value:'#000000'}),o=h('div',{class:'big'});function lum(h){let c=h.value.match(/[\da-f]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]}el.append(h('div',{class:'two'},field('Foreground',a),field('Background',b)),btn('Check',()=>{let x=lum(a),y=lum(b),r=(Math.max(x,y)+.05)/(Math.min(x,y)+.05);o.textContent=`Contrast: ${r.toFixed(2)}:1 — ${r>=4.5?'AA pass for normal text':'Below AA normal-text ratio'}`},'pri'),o)}
function stopwatchTool(el){
  const o=h('div',{class:'big'},'00:00.000');let start=0,elapsed=0,timer=null;
  const p2=v=>String(v).padStart(2,'0');
  const fmtT=ms=>{const t=Math.floor(ms),hh=Math.floor(t/3600000),mm=Math.floor(t/60000)%60,ss=Math.floor(t/1000)%60;return (hh?hh+':':'')+p2(mm)+':'+p2(ss)+'.'+String(t%1000).padStart(3,'0')};
  const tick=()=>{o.textContent=fmtT(elapsed+(start?Date.now()-start:0))};
  onClose(()=>{clearInterval(timer);timer=null});
  el.append(o,h('div',{class:'acts'},
    btn('Start',()=>{if(!timer){start=Date.now();timer=setInterval(tick,50)}},'pri'),
    btn('Stop',()=>{if(timer){elapsed+=Date.now()-start;clearInterval(timer);timer=null;start=0;tick()}}),
    btn('Reset',()=>{clearInterval(timer);timer=null;start=0;elapsed=0;tick()})));
}
function countdownTool(el){
  const a=inp({type:'datetime-local'}),o=h('div',{class:'big','aria-live':'off'}),m=msgEl(); let t=null;
  const stop=()=>{clearInterval(t);t=null};
  const tick=()=>{
    const d=new Date(a.value)-new Date();
    if(d<=0){o.textContent='Time reached.';stop();return;}
    o.textContent=`${Math.floor(d/86400000)}d ${Math.floor(d/3600000)%24}h ${Math.floor(d/60000)%60}m ${Math.floor(d/1000)%60}s`;
  };
  const start=()=>{
    stop();m.set('');
    if(!a.value||isNaN(new Date(a.value))){o.textContent='';m.set('Please choose a target date and time.');return;}
    tick();
    if(new Date(a.value)-new Date()>0) t=setInterval(tick,250);
  };
  onClose(stop);
  el.append(field('Target',a),h('div',{class:'acts'},btn('Start',start,'pri'),btn('Stop',()=>{stop()})),m,o);
}

function notesTool(el){
  const course=sel(['B.Com','B.A.']),year=sel(['FY','SY','TY','Semester 1','Semester 2','Semester 3','Semester 4','Semester 5','Semester 6']),univ=sel(['SPPU','Shivaji University','University of Mumbai','Other']),sub=inp(),topic=inp(),lang=sel(['English','Marathi','Hindi']),type=sel(['Important Exam Notes','Detailed Notes','Short Notes','Quick Revision','Important Questions & Answers']),o=area({readonly:true,rows:16}),msg=msgEl();
  const actions=h('div',{class:'acts'});
  const pdf=btn('Download PDF',async()=>{
    const base=getApiBase();
    if(!base || base.includes('YOUR-RENDER-SERVICE')){msg.set('Set your Render backend URL in DEFAULT_API_BASE in app.js first.');return;}
    if(!o.value || o.value==='Generating…'){msg.set('Generate notes first.');return;}
    try{
      pdf.disabled=true; msg.set('Preparing PDF…');
      const r=await fetch(base+'/api/notes-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:`${subjectLabel(sub.value)} — ${topic.value}`,course:course.value,year:year.value,university:univ.value,language:lang.value,notes:o.value})});
      if(!r.ok) throw 0; const b=await r.blob(); save('toolbox-pro-study-notes.pdf',b); msg.set('PDF downloaded.',true);
    }catch{msg.set('PDF download failed. Check the backend URL and deployment.');toast('PDF generation failed','err');}
    finally{pdf.disabled=false;}
  },'pri');
  function subjectLabel(v){return v.trim()||'Study Notes'}
  pdf.disabled=true; actions.append(pdf);
  el.append(h('div',{class:'two'},field('Course',course),field('Year / Semester',year),field('University',univ),field('Language',lang),field('Subject',sub),field('Topic',topic),field('Notes type',type)),btn('Generate AI notes',async e=>{
    const gb=e.currentTarget, base=getApiBase();
    if(!base || base.includes('YOUR-RENDER-SERVICE')){o.value='';msg.set('Set your Render backend URL in DEFAULT_API_BASE in app.js first.');return;}
    if(!sub.value.trim()||!topic.value.trim()){msg.set('Please enter a subject and a topic.');return;}
    o.value='Generating…'; msg.set('Generating notes. The backend may need up to a minute to wake up.',true); pdf.disabled=true; gb.disabled=true;
    const ac=new AbortController(), tm=setTimeout(()=>ac.abort(),90000);
    try{
      const r=await fetch(base+'/api/generate-notes',{method:'POST',headers:{'Content-Type':'application/json'},signal:ac.signal,body:JSON.stringify({course:course.value,year:year.value,university:univ.value,subject:sub.value.trim(),topic:topic.value.trim(),language:lang.value,notesType:type.value})});
      let j={}; try{j=await r.json();}catch{ /* non-JSON response */ }
      if(!r.ok) throw new Error(typeof j.error==='string'?j.error.slice(0,200):'bad');
      o.value=typeof j.notes==='string'?j.notes:''; if(!o.value.trim()) throw new Error('empty');
      pdf.disabled=false; msg.set('Notes generated.',true);
    }catch(err){
      o.value='';
      msg.set(err.name==='AbortError'?'The backend took too long to respond. Please try again.':(err.message&&err.message!=='bad'&&err.message!=='empty'&&err.name!=='TypeError'?err.message:'AI backend request failed. Check your Render URL, API key and backend logs.'));
    }finally{clearTimeout(tm);gb.disabled=false;}
  },'pri'),msg,o,actions);
}

function imageGrayTool(el){
  const f=inp({type:'file',accept:'image/*'}),fmt=sel([['png','PNG'],['jpeg','JPG']]),q=inp({type:'range',min:'10',max:'100',value:'90'}),out=h('div',{class:'acts'}),prev=h('img',{class:'prev',alt:'Grayscale result preview',hidden:true}),m=msgEl();let ou=null;
  const run=async()=>{
    out.replaceChildren();m.set('');const file=f.files[0];
    if(!file){m.set('Select an image.');return}
    if(!/^image\//.test(file.type)){m.set('Please select an image file.');return}
    const u=mkUrl(file),im=new Image();
    try{im.src=u;await im.decode()}catch{revUrl(u);m.set('Unable to read this image.');toast('Unable to read this image.','err');return}
    try{
      const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d'),type='image/'+fmt.value;
      if(type==='image/jpeg'){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}
      x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height);
      for(let i=0;i<d.data.length;i+=4){const y=.299*d.data[i]+.587*d.data[i+1]+.114*d.data[i+2];d.data[i]=d.data[i+1]=d.data[i+2]=y}
      x.putImageData(d,0,0);
      const b=await new Promise((res,rej)=>c.toBlob(v=>v&&v.type===type?res(v):rej(new Error('fmt')),type,+q.value/100));
      revUrl(ou);ou=mkUrl(b);prev.src=ou;prev.hidden=false;
      out.replaceChildren(btn('Download '+(fmt.value==='png'?'PNG':'JPG'),()=>save('grayscale.'+(fmt.value==='png'?'png':'jpg'),b),'pri'));
      m.set('Done.',true);
    }catch{m.set('Something went wrong. The image may be too large to process.');toast('Conversion failed','err')}
    finally{revUrl(u)}
  };
  el.append(field('Image',f),h('div',{class:'two'},field('Output format',fmt),field('JPG quality',q)),btn('Convert to grayscale',run,'pri'),m,prev,out);
}
function imageDataTool(el){const f=inp({type:'file',accept:'image/*'}),o=area({readonly:true});el.append(field('Image',f),btn('Read metadata',()=>{let x=f.files[0];o.value=x?`Name: ${x.name}\nType: ${x.type}\nSize: ${x.size} bytes\nLast modified: ${new Date(x.lastModified).toString()}`:'Select an image.'},'pri'),o)}

function timeCalculatorTool(el){
  const ah=num({min:0,value:0}),am=num({min:0,max:59,value:0}),bh=num({min:0,value:0}),bm=num({min:0,max:59,value:0}),op=sel([['add','Add'],['subtract','Subtract']]),o=h('div',{class:'big'});
  el.append(h('div',{class:'two'},field('Hours A',ah),field('Minutes A',am),field('Hours B',bh),field('Minutes B',bm),field('Operation',op)),btn('Calculate',()=>{let a=(+ah.value||0)*60+(+am.value||0),b=(+bh.value||0)*60+(+bm.value||0),t=op.value==='add'?a+b:a-b,sg=t<0?'-':'';t=Math.abs(t);o.textContent=`${sg}${Math.floor(t/60)} h ${t%60} min`},'pri'),o);
}
function paletteTool(el){
  const base=inp({type:'color',value:'#6E9BFF'}),count=sel(['5','6','8','10']),wrap=h('div',{class:'palette'}),m=msgEl();
  const make=()=>{wrap.replaceChildren();const n=+count.value,hex=base.value.slice(1),rgb=[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];for(let i=0;i<n;i++){const f=n===1?.5:i/(n-1),mix=(v)=>Math.round(v+(255-v)*f*.72),c='#'+rgb.map(v=>mix(v).toString(16).padStart(2,'0')).join('');const sw=h('button',{type:'button',class:'swatch',title:'Copy '+c,style:`--sw:${c}`},c);sw.addEventListener('click',()=>copyText(c));wrap.append(sw)}};
  el.append(h('div',{class:'two'},field('Base color',base),field('Colors',count)),btn('Generate Palette',()=>{make();m.set('Click a color to copy it.',true)},'pri'),m,wrap);make();
}

/* ---------- tools completing the full tool list ---------- */
function cgpaPctTool(el){
  const c=num({min:'0'}),s=num({value:'10',min:'1'}),mode=sel([['m','CGPA × 9.5 (common Indian university formula)'],['s','CGPA ÷ scale × 100']]),out=h('div',{class:'big','aria-live':'polite'}),m=msgEl();
  const run=()=>{
    out.textContent='';m.set('');const g=val(c),sc=val(s);
    if(!Number.isFinite(g)||g<0){m.set('Enter a valid CGPA.');return;}
    if(mode.value==='s'&&!(sc>0)){m.set('Enter a valid scale above zero.');return;}
    const max=mode.value==='s'?sc:10;
    if(g>max){m.set(`CGPA cannot be above ${fmtN(max)}.`);return;}
    out.textContent=`Percentage: ${(mode.value==='m'?g*9.5:g/sc*100).toFixed(2)}%`;
  };
  el.append(field('CGPA',c),field('Scale (used by the second formula)',s),field('Formula',mode),btn('Convert',run,'pri'),m,out,h('p',{class:'note'},'Universities use different formulas. Check your own university rules for the official conversion.'));
}
function pctChangeTool(el){
  const a=num(),b=num(),out=h('div',{class:'big','aria-live':'polite'}),m=msgEl();
  const run=()=>{
    out.textContent='';m.set('');const x=val(a),y=val(b);
    if(!Number.isFinite(x)||!Number.isFinite(y)){m.set('Please enter both values.');return;}
    if(x===0){m.set('The old value cannot be zero.');return;}
    const c=(y-x)/Math.abs(x)*100;
    out.textContent=c===0?'No change (0%)':`${c>0?'Increase':'Decrease'}: ${Math.abs(c).toFixed(2)}% (change of ${fmtN(y-x)})`;
  };
  el.append(h('div',{class:'two'},field('Old value',a),field('New value',b)),btn('Calculate',run,'pri'),m,out);
}
const LOREM='lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');
const LOREM_START='Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
function loremTool(el){
  const kind=sel([['p','Paragraphs'],['s','Sentences'],['w','Words']]),n=num({value:'3',min:'1',step:'1'}),[cs,ls]=chk('Start with "Lorem ipsum dolor sit amet"',true),o=area({rows:10,readonly:true}),m=msgEl();
  const R=k=>Math.floor(Math.random()*k), words=k=>Array.from({length:k},()=>LOREM[R(LOREM.length)]);
  const sentence=()=>{const w=words(8+R(10));w[0]=cap(w[0]);return w.join(' ')+'.'};
  const run=()=>{
    m.set('');const c=val(n),k=kind.value,lim=k==='w'?1000:50;
    if(!Number.isInteger(c)||c<1||c>lim){m.set(`Enter a whole number from 1 to ${lim}.`);return;}
    const st=cs.checked;let t;
    if(k==='w') t=(st?[...LOREM_START.toLowerCase().replace(/[,.]/g,'').split(' '),...words(Math.max(0,c-8))].slice(0,c):words(c)).join(' ');
    else if(k==='s') t=Array.from({length:c},(_,i)=>i===0&&st?LOREM_START:sentence()).join(' ');
    else t=Array.from({length:c},(_,i)=>{const s=Array.from({length:3+R(3)},sentence);if(i===0&&st)s[0]=LOREM_START;return s.join(' ')}).join('\n\n');
    o.value=t;
  };
  el.append(h('div',{class:'two'},field('Type',kind),field('Amount',n)),h('div',{class:'opts'},ls),h('div',{class:'acts'},btn('Generate',run,'pri'),copyBtn(()=>o.value),dlBtn(()=>o.value,'lorem-ipsum.txt')),m,field('Result',o));
  run();
}
function imagePreviewTool(el){
  const info=h('div',{class:'stats','aria-live':'polite'}),prev=h('img',{class:'prev',alt:'Selected image preview',hidden:true});let cur=null;
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  const zone=pickImage((img,f,u)=>{
    revUrl(cur);cur=u;prev.src=u;prev.hidden=false;
    const W=img.naturalWidth,H=img.naturalHeight,d=gcd(W,H);
    info.replaceChildren(stat('File name',f.name),stat('Type',f.type),stat('File size',fb(f.size)),stat('Dimensions',`${W} × ${H} px`),stat('Aspect ratio',`${W/d}:${H/d}`),stat('Megapixels',(W*H/1e6).toFixed(2)));
  });
  el.append(zone,prev,info);
}
function cropTool(el){
  const st={img:null,x:0,y:0,cw:0,ch:0,out:null,blob:null,base:null};
  const cv=h('canvas',{role:'img','aria-label':'Image with crop selection',hidden:true,style:'max-width:100%;height:auto;touch-action:none;cursor:crosshair;border-radius:12px'});
  const X=num({min:'0',step:'1'}),Y=num({min:'0',step:'1'}),CW=num({min:'1',step:'1'}),CH=num({min:'1',step:'1'}),fmt=sel([['png','PNG'],['jpeg','JPG'],['webp','WebP']]);
  const prev=h('img',{class:'prev',alt:'Cropped result preview',hidden:true}),info=h('p',{class:'note'}),m=msgEl();
  const fit=()=>{const W=st.img.naturalWidth,H=st.img.naturalHeight;st.x=Math.min(Math.max(0,Math.round(st.x)||0),W-1);st.y=Math.min(Math.max(0,Math.round(st.y)||0),H-1);st.cw=Math.min(Math.max(1,Math.round(st.cw)||1),W-st.x);st.ch=Math.min(Math.max(1,Math.round(st.ch)||1),H-st.y)};
  const draw=()=>{
    if(!st.img)return;const x=cv.getContext('2d'),sc=cv.width/st.img.naturalWidth;
    x.drawImage(st.base,0,0);
    const rx=st.x*sc,ry=st.y*sc,rw=st.cw*sc,rh=st.ch*sc;
    x.fillStyle='rgba(0,0,0,.55)';x.fillRect(0,0,cv.width,ry);x.fillRect(0,ry+rh,cv.width,cv.height-ry-rh);x.fillRect(0,ry,rx,rh);x.fillRect(rx+rw,ry,cv.width-rx-rw,rh);
    x.strokeStyle='#fff';x.lineWidth=2;x.strokeRect(rx+1,ry+1,Math.max(0,rw-2),Math.max(0,rh-2));
  };
  const sync=()=>{X.value=st.x;Y.value=st.y;CW.value=st.cw;CH.value=st.ch;draw()};
  const fromInputs=()=>{if(!st.img)return;st.x=+X.value;st.y=+Y.value;st.cw=+CW.value;st.ch=+CH.value;fit();draw()};
  [X,Y,CW,CH].forEach(i=>i.addEventListener('input',fromInputs));
  let drag=null;
  const pt=e=>{const r=cv.getBoundingClientRect(),k=st.img.naturalWidth/r.width;return[Math.min(st.img.naturalWidth,Math.max(0,Math.round((e.clientX-r.left)*k))),Math.min(st.img.naturalHeight,Math.max(0,Math.round((e.clientY-r.top)*k)))]};
  cv.addEventListener('pointerdown',e=>{if(!st.img)return;e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch{ /* ignore */ }drag=pt(e)});
  cv.addEventListener('pointermove',e=>{if(!drag)return;const[a,b]=pt(e);st.x=Math.min(drag[0],a);st.y=Math.min(drag[1],b);st.cw=Math.abs(a-drag[0]);st.ch=Math.abs(b-drag[1]);fit();sync()});
  const end=()=>{drag=null};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  const zone=pickImage(img=>{
    st.img=img;st.x=0;st.y=0;st.cw=img.naturalWidth;st.ch=img.naturalHeight;revUrl(st.out);st.out=null;st.blob=null;prev.hidden=true;m.set('');
    const sc=Math.min(1,720/img.naturalWidth);cv.width=Math.max(1,Math.round(img.naturalWidth*sc));cv.height=Math.max(1,Math.round(img.naturalHeight*sc));
    st.base=document.createElement('canvas');st.base.width=cv.width;st.base.height=cv.height;st.base.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
    cv.hidden=false;info.textContent=`Original: ${img.naturalWidth} × ${img.naturalHeight} px. Drag on the image to select the area to keep, or type exact values.`;sync();
  });
  const run=async()=>{
    m.set('');if(!st.img){m.set('Please select an image first.');toast('Please select an image first.','err');return;}
    fromInputs();const type='image/'+fmt.value;
    try{
      const b=await new Promise((res,rej)=>{
        const c=document.createElement('canvas');c.width=st.cw;c.height=st.ch;const x=c.getContext('2d');
        if(!x)return rej(new Error('canvas'));
        if(type==='image/jpeg'){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}
        x.drawImage(st.img,st.x,st.y,st.cw,st.ch,0,0,st.cw,st.ch);
        c.toBlob(v=>v&&v.type===type?res(v):rej(new Error('fmt')),type,.92);
      });
      revUrl(st.out);st.out=mkUrl(b);st.blob=b;prev.src=st.out;prev.hidden=false;
      m.set(`Cropped to ${st.cw} × ${st.ch} px (${fb(b.size)}).`,true);toast('Crop completed');
    }catch(e){const t=e.message==='fmt'?'Your browser does not support this output format.':'Something went wrong. The image may be too large to process.';m.set(t);toast(t,'err')}
  };
  const dl=()=>{if(!st.blob){toast('Crop an image first.','err');return}save('cropped-image.'+(fmt.value==='jpeg'?'jpg':fmt.value),st.blob)};
  el.append(zone,info,cv,h('div',{class:'two'},field('X (px)',X),field('Y (px)',Y),field('Width (px)',CW),field('Height (px)',CH)),field('Output format',fmt),
    h('div',{class:'acts'},btn('Crop image',run,'pri'),btn('Download',dl),
      btn('Select all',()=>{if(!st.img)return;st.x=0;st.y=0;st.cw=st.img.naturalWidth;st.ch=st.img.naturalHeight;sync()},'ghost'),
      btn('Center square',()=>{if(!st.img)return;const s=Math.min(st.img.naturalWidth,st.img.naturalHeight);st.x=Math.round((st.img.naturalWidth-s)/2);st.y=Math.round((st.img.naturalHeight-s)/2);st.cw=s;st.ch=s;sync()},'ghost')),m,prev);
}
const COMMON_PW=['password','123456','12345678','qwerty','abc123','letmein','welcome','admin','iloveyou','monkey','dragon','111111','123123','football','login','princess','sunshine','000000'];
function pwCheckTool(el){
  const p=inp({type:'password',autocomplete:'off',spellcheck:'false'}),[sh,shl]=chk('Show password'),bar=h('i'),lab=h('p',{class:'note','aria-live':'polite'}),tips=h('ul',{});
  const run=()=>{
    const s=p.value;tips.replaceChildren();
    if(!s){bar.style.width='0%';lab.textContent='Type a password to check its strength.';return}
    let pool=0;if(/[a-z]/.test(s))pool+=26;if(/[A-Z]/.test(s))pool+=26;if(/\d/.test(s))pool+=10;if(/[^A-Za-z0-9]/.test(s))pool+=32;
    let bits=s.length*Math.log2(pool||1);const low=s.toLowerCase(),issues=[];
    if(COMMON_PW.some(c=>low.includes(c))){bits=Math.min(bits,25);issues.push('Contains a very common password or word.')}
    if(/(.)\1{2,}/.test(s)){bits-=8;issues.push('Avoid repeating the same character.')}
    if(/(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|wert|erty|asdf|zxcv)/i.test(s)){bits-=10;issues.push('Avoid simple sequences and keyboard patterns.')}
    if(s.length<12)issues.push('Use at least 12 characters.');
    if(!/[a-z]/.test(s)||!/[A-Z]/.test(s))issues.push('Mix uppercase and lowercase letters.');
    if(!/\d/.test(s))issues.push('Add numbers.');
    if(!/[^A-Za-z0-9]/.test(s))issues.push('Add symbols.');
    bits=Math.max(0,bits);
    const lvl=bits<28?'Very weak':bits<40?'Weak':bits<60?'Fair':bits<80?'Strong':'Very strong';
    bar.style.width=Math.min(100,bits/1.28)+'%';lab.textContent=`Strength: ${lvl} (estimated ${Math.round(bits)} bits)`;
    tips.append(...issues.map(t=>h('li',{},t)));
  };
  p.addEventListener('input',run);sh.addEventListener('change',()=>{p.type=sh.checked?'text':'password'});
  el.append(field('Password to check',p),h('div',{class:'opts'},shl),h('div',{class:'meter',role:'presentation'},bar),lab,tips,
    h('p',{class:'note'},'Checked only inside your browser. Nothing is sent or stored. This is an estimate, not a guarantee.'));
  run();
}
function randStrTool(el){
  if(!cryptoOk()){el.append(h('p',{class:'msg'},'Your browser does not support secure random numbers.'));return;}
  const len=num({value:'16',min:'1',step:'1'}),cnt=num({value:'5',min:'1',step:'1'}),[cu,lu]=chk('Uppercase (A-Z)',true),[cl,ll]=chk('Lowercase (a-z)',true),[cn,ln]=chk('Numbers (0-9)',true),[cs,ls]=chk('Symbols (!@#…)',false),o=area({rows:8,readonly:true}),m=msgEl();
  const run=()=>{
    const L=val(len),N=val(cnt);
    if(!Number.isInteger(L)||L<1||L>256||!Number.isInteger(N)||N<1||N>100){m.set('Length must be 1-256 and count 1-100 (whole numbers).');return;}
    const pool=[cu.checked&&'ABCDEFGHIJKLMNOPQRSTUVWXYZ',cl.checked&&'abcdefghijklmnopqrstuvwxyz',cn.checked&&'0123456789',cs.checked&&'!@#$%^&*()-_=+[]{};:,.?'].filter(Boolean).join('');
    if(!pool){m.set('Select at least one character type.');return;}
    m.set('');o.value=Array.from({length:N},()=>Array.from({length:L},()=>pool[rnd(pool.length)]).join('')).join('\n');
  };
  el.append(h('div',{class:'two'},field('String length (1-256)',len),field('How many (1-100)',cnt)),h('div',{class:'opts'},lu,ll,ln,ls),h('div',{class:'acts'},btn('Generate',run,'pri'),copyBtn(()=>o.value),dlBtn(()=>o.value,'toolbox-pro-random-strings.txt')),m,field('Result',o));
  run();
}
const TZ_FALLBACK=['UTC','Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo','Asia/Shanghai','Australia/Sydney','Europe/London','Europe/Paris','Europe/Berlin','Africa/Johannesburg','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Sao_Paulo','Pacific/Auckland'];
function tzList(){let l=[];try{if(Intl.supportedValuesOf)l=Intl.supportedValuesOf('timeZone')}catch{ /* use fallback */ }if(!l.length)l=TZ_FALLBACK.slice();if(!l.includes('UTC'))l=['UTC',...l];return l}
function tzOffsetMs(ts,tz){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(ts)).map(x=>[x.type,x.value]));
  return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute,+p.second)-Math.floor(ts/1000)*1000;
}
function wallToUtc(s,tz){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);if(!m)return NaN;
  const g=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));let t=g-tzOffsetMs(g,tz);t=g-tzOffsetMs(t,tz);return t;
}
function tzTool(el){
  const zones=tzList(),local=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  if(!zones.includes(local))zones.unshift(local);
  const dt=inp({type:'datetime-local',value:new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}),from=sel(zones),to=sel(zones),out=h('div',{class:'stats','aria-live':'polite'}),m=msgEl();
  from.value=local;to.value=local==='UTC'?'America/New_York':'UTC';
  const run=()=>{
    out.replaceChildren();m.set('');
    if(!dt.value){m.set('Please choose a date and time.');return;}
    try{
      const t=wallToUtc(dt.value,from.value);if(!Number.isFinite(t)||isNaN(new Date(t)))throw 0;
      const f=z=>new Intl.DateTimeFormat(undefined,{timeZone:z,dateStyle:'full',timeStyle:'long'}).format(new Date(t));
      out.append(stat(from.value,f(from.value)),stat(to.value,f(to.value)),stat('UTC',new Date(t).toUTCString()));
    }catch{m.set('Could not convert that date and time. Please check your input.');}
  };
  [dt,from,to].forEach(c=>c.addEventListener('change',run));
  el.append(field('Date and time',dt),h('div',{class:'two'},field('From time zone',from),field('To time zone',to)),
    h('div',{class:'acts'},btn('Convert',run,'pri'),btn('Swap zones',()=>{const a=from.value;from.value=to.value;to.value=a;run()})),m,out);
  run();
}

/* ---------- registry ---------- */
const T = (id, name, cat, icon, desc, render) => ({ id, name, cat, icon, desc, render });
const TOOLS = [
  T('bcom-aggregate', 'B.Com Aggregate Percentage Calculator', 'Education', 'B.Com', 'Calculate overall aggregate percentage from total marks.', bcomAggTool),
  T('percentage', 'Percentage Calculator', 'Calculators', '%', 'Calculate percentages, percent-of values, and percentage changes.', pctTool),
  T('cgpa', 'CGPA Calculator', 'Education', 'GPA', 'Calculate a credit-weighted CGPA from subjects.', cgpaTool),
  T('sgpa', 'SGPA Calculator', 'Education', 'SGPA', 'Calculate a credit-weighted semester GPA.', sgpaTool),
  T('gpa', 'GPA Calculator', 'Education', 'GPA', 'Calculate GPA from points and the selected scale.', el => simpleCalc(el, 'Enter GPA points and the maximum GPA scale.', [['GPA points'], ['Scale']], x => { const p = +x[0].value, s = +x[1].value; if (!(s > 0) || !(p >= 0) || p > s) throw 0; return `GPA: ${p.toFixed(2)} / ${fmtN(s)} (${(p / s * 100).toFixed(2)}% of scale)`; })),
  T('marks-grade', 'Marks to Grade', 'Education', 'Grade', 'Convert marks into a percentage and common grade.', marksGradeTool),
  T('cgpa-percentage', 'CGPA to Percentage', 'Education', 'CGPA%', 'Convert CGPA to percentage using a selectable multiplier.', cgpaPctTool),
  T('study-time', 'Study Time Calculator', 'Education', 'Study', 'Calculate total study time including breaks.', studyTimeTool),
  T('exam-countdown', 'Exam Countdown', 'Education', 'Exam', 'Count the days remaining until an exam.', examCountdownTool),
  T('ai-notes', 'AI Study Notes Generator', 'Education', 'AI', 'Generate structured exam-oriented study notes through the secure backend.', notesTool),

  T('age', 'Age Calculator', 'Calculators', 'Age', 'Find exact age in years, months, days and total days.', ageTool),
  T('bmi', 'BMI Calculator', 'Calculators', 'BMI', 'Calculate BMI in metric or imperial units.', bmiTool),
  T('discount', 'Discount Calculator', 'Calculators', '−%', 'Calculate discount amount, final price and savings.', discountTool),
  T('gst', 'GST Calculator', 'Calculators', 'GST', 'Calculate GST amount and total price.', gstTool),
  T('emi', 'EMI Calculator', 'Calculators', 'EMI', 'Calculate monthly loan EMI using the reducing-balance formula.', emiTool),
  T('simple-interest', 'Simple Interest Calculator', 'Calculators', 'SI', 'Calculate simple interest and total amount.', interestTool),
  T('compound-interest', 'Compound Interest Calculator', 'Calculators', 'CI', 'Calculate compound interest and final amount.', compoundTool),
  T('average', 'Average Calculator', 'Calculators', 'AVG', 'Calculate the arithmetic mean of a list of numbers.', averageTool),
  T('ratio', 'Ratio Calculator', 'Calculators', 'Ratio', 'Simplify a ratio.', ratioTool),
  T('profit-loss', 'Profit & Loss Calculator', 'Calculators', 'P/L', 'Calculate profit or loss and percentage.', profitTool),
  T('fraction', 'Fraction Calculator', 'Calculators', '½', 'Add two fractions and simplify the result.', fractionTool),
  T('time-calculator', 'Time Calculator', 'Utilities', '⏱', 'Add or subtract hours and minutes.', timeCalculatorTool),
  T('date-difference', 'Date Difference Calculator', 'Utilities', 'Δ', 'Calculate the number of days between two dates.', dateDiffTool),
  T('percentage-change', 'Percentage Change Calculator', 'Calculators', 'Δ%', 'Find percentage increase or decrease between values.', pctChangeTool),

  T('word-counter', 'Word Counter', 'Text', 'Wc', 'Count words and related text statistics.', wordTool),
  T('char-counter', 'Character Counter', 'Text', 'Ch', 'Count characters, words and lines.', charTool),
  T('line-counter', 'Line Counter', 'Text', 'Lines', 'Count lines in text.', lineCountTool),
  T('reading-time', 'Reading Time Calculator', 'Text', 'Read', 'Estimate reading time from word count.', readingTool),
  T('uppercase-lowercase', 'Uppercase/Lowercase Converter', 'Text', 'Aa', 'Convert text to uppercase or lowercase.', el => caseTransformTool(el, 'upper-lower')),
  T('title-case', 'Title Case Converter', 'Text', 'Title', 'Convert text to title case while handling common small words.', el => caseTransformTool(el, 'title')),
  T('reverse-text', 'Text Reverser', 'Text', '↔', 'Reverse the characters in text.', reverseTool),
  T('duplicate-lines', 'Duplicate Line Remover', 'Text', '≠', 'Remove repeated lines with case and whitespace options.', dedupeTool),
  T('text-sorter', 'Text Sorter', 'Text', 'A↓Z', 'Sort lines alphabetically, numerically, reverse or randomly.', sortTool),
  T('whitespace', 'Text Cleaner', 'Text', 'Clean', 'Normalize whitespace and excess blank lines.', whitespaceTool),
  T('lorem-ipsum', 'Lorem Ipsum Generator', 'Text', 'Lorem', 'Generate placeholder paragraphs, sentences or words.', loremTool),
  T('text-extractor', 'Text Extractor', 'Text', 'Extract', 'Extract emails, URLs, numbers, hashtags, mentions or non-empty lines.', textExtractorTool),

  T('json', 'JSON Formatter', 'Developer', '{ }', 'Format and minify JSON with validation.', jsonTool),
  T('json-validator', 'JSON Validator', 'Developer', '✓', 'Validate JSON and show parse errors.', jsonValidatorTool),
  T('base64', 'Base64 Encoder/Decoder', 'Developer', '64', 'Encode text to Base64 or decode Base64 as UTF-8 text.', b64Tool),
  T('url-codec', 'URL Encoder/Decoder', 'Developer', '%20', 'Percent-encode or decode URLs and query text.', urlTool),
  T('uuid', 'UUID Generator', 'Developer', 'ID', 'Generate random version 4 UUIDs.', uuidTool),
  T('hash', 'Hash Generator', 'Developer', '#', 'Generate SHA-256, SHA-384 or SHA-512 hashes locally.', hashTool),
  T('jwt-decoder', 'JWT Decoder', 'Developer', 'JWT', 'Decode a JWT payload locally without sending it anywhere.', jwtTool),
  T('html-encode', 'HTML Entity Encoder/Decoder', 'Developer', '&', 'Encode or decode common HTML entities.', htmlEncodeTool),
  T('timestamp', 'Unix Timestamp Converter', 'Developer', 'Unix', 'Convert Unix timestamps to dates and dates to Unix timestamps.', tsTool),
  T('regex-tester', 'Regex Tester', 'Developer', '.*', 'Test regular expressions against text.', regexTool),
  T('color', 'Color Converter', 'Developer', 'HEX', 'Convert between HEX, RGB and HSL with a live preview.', colorTool),

  T('image-compressor', 'Image Compressor', 'Image', 'Zip', 'Compress JPG, PNG or WebP images in the browser.', el => imgTool(el, { name: 'compressed-image', go: 'Compress image', fmts: [['jpeg', 'JPG'], ['png', 'PNG'], ['webp', 'WebP']], q: true, max: true })),
  T('image-resizer', 'Image Resizer', 'Image', '⤢', 'Resize images to exact dimensions and export them.', el => imgTool(el, { name: 'resized-image', go: 'Resize image', fmts: [['jpeg', 'JPG'], ['png', 'PNG'], ['webp', 'WebP']], resize: true })),
  T('jpg-to-png', 'JPG to PNG', 'Image', 'J→P', 'Convert a JPG image to PNG using canvas.', jpgToPngTool),
  T('png-to-jpg', 'PNG to JPG', 'Image', 'P→J', 'Convert a PNG image to JPG using canvas.', pngToJpgTool),
  T('image-webp', 'Image to WebP', 'Image', 'WebP', 'Convert an image to WebP in the browser.', el => imgTool(el, { name: 'image-webp', go: 'Convert to WebP', fixed: 'webp', q: true })),
  T('image-base64', 'Image to Base64', 'Image', '</>', 'Convert an image into a data URL or Base64 text.', b64ImgTool),
  T('image-cropper', 'Image Cropper', 'Image', 'Crop', 'Select an area and crop an image locally.', cropTool),
  T('image-grayscale', 'Grayscale Image', 'Image', 'Gray', 'Convert an image to grayscale with canvas.', imageGrayTool),
  T('image-preview', 'Image Preview', 'Image', 'View', 'Preview an image and inspect dimensions and file size.', imagePreviewTool),

  T('password', 'Password Generator', 'Security', '•••', 'Generate strong random passwords locally.', pwTool),
  T('password-strength', 'Password Strength Checker', 'Security', 'Safe', 'Check password strength privately in your browser.', pwCheckTool),
  T('random-number', 'Random Number Generator', 'Utilities', 'RNG', 'Generate a random integer in an inclusive range.', randomTool),
  T('random-string', 'Random String Generator', 'Utilities', 'Rand', 'Generate random strings with custom character sets.', randStrTool),
  T('units', 'Unit Converter', 'Utilities', 'm↔ft', 'Convert length, weight, temperature, area, volume, speed, time and data.', unitTool),
  T('timezone', 'Time Zone Converter', 'Utilities', 'TZ', 'Convert a date and time between world time zones.', tzTool),
  T('countdown', 'Countdown Timer', 'Utilities', '⏳', 'Count down to a selected date and time.', countdownTool),
  T('stopwatch', 'Stopwatch', 'Utilities', '⏱', 'Start, stop and reset a browser stopwatch.', stopwatchTool),
  T('qr', 'QR Code Generator', 'Utilities', 'QR', 'Generate a real scannable QR code and download it as PNG.', qrTool),
  T('color-palette', 'Color Palette Generator', 'Utilities', '🎨', 'Generate a useful palette from a base color.', paletteTool),
  T('contrast', 'Color Contrast Checker', 'Utilities', '◐', 'Calculate the contrast ratio between two colors.', contrastTool)
];

/* ---------- home page ---------- */
const CATS = ['All Tools', 'Calculators', 'Education', 'Text', 'Developer', 'Image', 'Utilities', 'Security', 'Date'];
let cat = 'All Tools', query = '';
const favs = () => store.get('tbp:fav', []), recents = () => store.get('tbp:recent', []);
const byId = id => TOOLS.find(t => t.id === id);
function card(t) {
  const on = favs().includes(t.id);
  const c = h('article', { class: 'card' }, h('div', { class: 'card-top' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, t.icon),
    h('button', { class: 'fav' + (on ? ' on' : ''), type: 'button', 'data-id': t.id, 'aria-pressed': String(on), 'aria-label': `${on ? 'Remove' : 'Add'} ${t.name} ${on ? 'from' : 'to'} favorites`, onclick: e => { e.stopPropagation(); toggleFav(t.id); } }, on ? '★' : '☆')),
    h('h3', {}, t.name), h('p', {}, t.desc), h('div', { class: 'card-bot' }, h('span', { class: 'tag' }, t.cat),
      h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Open ' + t.name, onclick: e => { e.stopPropagation(); openTool(t.id, e.currentTarget); } }, 'Open Tool')));
  c.addEventListener('click', () => openTool(t.id, $('.btn', c)));
  return c;
}
function toggleFav(id) {
  let f = favs(); f = f.includes(id) ? f.filter(x => x !== id) : [...f, id]; store.set('tbp:fav', f);
  toast(f.includes(id) ? 'Added to favorites' : 'Removed from favorites'); render(false);
  const b = document.querySelector(`#grid .fav[data-id="${id}"]`); if (b) b.focus();
}
function render(anim = true) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const list = TOOLS.filter(t => (cat === 'All Tools' || t.cat === cat) && words.every(w => (t.name + ' ' + t.desc + ' ' + t.cat).toLowerCase().includes(w)));
  const grid = $('#grid'); grid.replaceChildren(...list.map(card));
  if (anim) { grid.classList.remove('swap'); void grid.offsetWidth; grid.classList.add('swap'); }
  $('#empty').hidden = list.length > 0; $('#all-h').hidden = list.length === 0;
  $('#count').textContent = list.length ? `${list.length} tool${list.length === 1 ? '' : 's'}` : 'No tools found';
  const home = !words.length && cat === 'All Tools';
  const fl = favs().map(byId).filter(Boolean), rl = recents().map(byId).filter(Boolean);
  $('#favs-sec').hidden = !(home && fl.length); $('#favs').replaceChildren(...fl.map(card));
  $('#recent-sec').hidden = !(home && rl.length); $('#recent').replaceChildren(...rl.map(card));
  $('#chips').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === cat)));
}
$('#chips').append(...CATS.map(c => h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: () => { cat = c; render(); } }, c)));
$('#q').addEventListener('input', e => { query = e.target.value; render(); });

/* ---------- tool dialog ---------- */
let lastFocus = null;
function initToolAds() {
  const slots = document.querySelectorAll('#dlg .tool-ad .adsbygoogle');
  slots.forEach(ins => {
    if (ins.dataset.tbpAdInitialized === '1') return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      ins.dataset.tbpAdInitialized = '1';
    } catch { /* AdSense can retry when its script is ready. */ }
  });
}

function openTool(id, trigger, fromPop) {
  const t = byId(id); if (!t) return;
  lastFocus = trigger || lastFocus; revokeAll(); runCleanups();
  $('#dlg-title').textContent = t.name; $('#dlg-desc').textContent = t.desc;
  const body = $('#dlg-body'); body.replaceChildren();
  try { t.render(body); } catch { body.replaceChildren(h('p', { class: 'msg' }, 'Something went wrong. Please try again.')); }
  dlg.classList.remove('closing'); if (!dlg.open) dlg.showModal();
  requestAnimationFrame(() => requestAnimationFrame(initToolAds));
  if (!fromPop && location.hash !== '#tool-' + id) history.pushState(null, '', '#tool-' + id);
  const r = recents().filter(x => x !== id); r.unshift(id); store.set('tbp:recent', r.slice(0, 6));
  body.scrollTop = 0; $('#dlg-title').focus({ preventScroll: true });
}
function closeDlg() {
  if (!dlg.open) return; dlg.classList.add('closing');
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160;
  setTimeout(() => { dlg.classList.remove('closing'); if (dlg.open) dlg.close(); }, ms);
}
const requestClose = () => location.hash.startsWith('#tool-') ? history.back() : closeDlg();
$('#dlg-close').addEventListener('click', requestClose);
dlg.addEventListener('cancel', e => { e.preventDefault(); requestClose(); });
dlg.addEventListener('click', e => { if (e.target === dlg) requestClose(); });
dlg.addEventListener('close', () => { revokeAll(); runCleanups(); $('#dlg-body').replaceChildren(); document.body.append($('#toasts')); render(false); if (lastFocus && lastFocus.isConnected) lastFocus.focus(); });
addEventListener('popstate', () => { const m = location.hash.match(/^#tool-(.+)$/); if (m && byId(m[1])) openTool(m[1], null, true); else closeDlg(); });

/* ---------- theme ---------- */
const themeBtn = $('#theme');
function paintTheme() { const d = document.documentElement.dataset.theme === 'dark'; const label = d ? 'Switch to light mode' : 'Switch to dark mode'; themeBtn.textContent = d ? '☀' : '☾'; themeBtn.setAttribute('aria-label', label); themeBtn.title = label; }
themeBtn.addEventListener('click', () => { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; try { localStorage.setItem('tbp:theme', n); } catch { /* ignore */ } paintTheme(); });
if (!document.documentElement.dataset.theme) document.documentElement.dataset.theme = 'dark';
paintTheme(); render(false);
{ const m = location.hash.match(/^#tool-(.+)$/); if (m && byId(m[1])) { history.replaceState(null, '', location.pathname + location.search); openTool(m[1], null); } }

/* ---------- premium navigation + reveal ---------- */
const menuToggle = document.getElementById('menu-toggle');
const mainNav = document.getElementById('main-nav');
if (menuToggle && mainNav) {
  const closeMenu = () => { mainNav.classList.remove('open'); menuToggle.setAttribute('aria-expanded','false'); menuToggle.setAttribute('aria-label','Open navigation'); };
  menuToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('click', e => {
    if (mainNav.classList.contains('open') && !mainNav.contains(e.target) && e.target !== menuToggle) closeMenu();
  });
  window.addEventListener('resize', () => { if (innerWidth > 760) closeMenu(); });
}
const revealTargets = document.querySelectorAll('.about-card,.panel,.legal article,.ad,.foot');
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.animate(
          [{opacity:0, transform:'translateY(16px)'},{opacity:1, transform:'translateY(0)'}],
          {duration:520, easing:'cubic-bezier(.2,.75,.2,1)', fill:'both'}
        );
        io.unobserve(entry.target);
      }
    });
  }, {threshold:.08});
  revealTargets.forEach(el => io.observe(el));
}
