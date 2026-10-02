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

/* ---------- registry ---------- */
const T = (id, name, cat, icon, desc, render) => ({ id, name, cat, icon, desc, render });
const TOOLS = [
  T('age', 'Age Calculator', 'Calculators', 'Age', 'Find exact age in years, months, days and total days.', ageTool),
  T('percentage', 'Percentage Calculator', 'Calculators', '%', 'Calculate percentages, percent-of values, and percentage changes.', pctTool),
  T('word-counter', 'Word Counter', 'Text', 'Wc', 'Count words and related text statistics.', wordTool),
  T('char-counter', 'Character Counter', 'Text', 'Ch', 'Count characters, words and lines.', charTool),
];

/* ---------- home page ---------- */
const CATS = ['All Tools', 'Calculators', 'Text'];
let cat = 'All Tools', query = '';
const favs = () => store.get('tbp:fav', []), recents = () => store.get('tbp:recent', []);
const byId = id => TOOLS.find(t => t.id === id);
function card(t) {
  const on = favs().includes(t.id);
  const c = h('article', { class: 'card' }, h('div', { class: 'card-top' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, t.icon),
    h('button', { class: 'fav' + (on ? ' on' : ''), type: 'button', 'data-id': t.id, 'aria-pressed': String(on), 'aria-label': `${on ? 'Remove' : 'Add'} ${t.name} ${on ? 'from' : 'to'} favorites`, onclick: (e) => { e.stopPropagation(); toggleFav(t.id); } })),
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
function paintTheme() { const d = document.documentElement.dataset.theme === 'dark'; const label = d ? 'Switch to light mode' : 'Switch to dark mode'; themeBtn.textContent = d ? '☀' : '☾'; themeBtn.setAttribute('aria-label', label); }
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
