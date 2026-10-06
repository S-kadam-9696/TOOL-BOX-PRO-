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
    try { const d = await crypto.subtle.digest(a.value, new TextEncoder().encode(t.value)); o.va
