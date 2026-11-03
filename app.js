(() => {
  const BW = window.BW;
  const en = BW.lang === 'en';
  const T = (a, b) => (en ? a : b);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = v => '$' + v.toFixed(2);

  /* ---------- Hora de Charlotte e status ---------- */
  function clt() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
    const g = t => parts.find(p => p.type === t).value;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
    const h = +g('hour') % 24, m = +g('minute');
    return { day, h, m, t: h + m / 60 };
  }
  const fmt = h => {
    const hh = h % 24;
    if (en) return hh === 0 ? '12 AM' : hh === 12 ? '12 PM' : hh < 12 ? hh + ' AM' : (hh - 12) + ' PM';
    return hh + 'h';
  };
  function status() {
    const n = clt();
    const today = BW.hours[n.day];
    const yest = BW.hours[(n.day + 6) % 7];
    if (yest.c > 24 && n.t < yest.c - 24) return { open: true, until: yest.c, n };
    if (n.t >= today.o && n.t < today.c) return { open: true, until: today.c, n };
    if (n.t < today.o) return { open: false, opens: today.o, when: T('today', 'hoje'), n };
    return { open: false, opens: BW.hours[(n.day + 1) % 7].o, when: T('tomorrow', 'amanhã'), n };
  }
  function paintStatus() {
    const s = status();
    const short = s.open ? T('OPEN', 'ABERTO') : T('CLOSED', 'FECHADO');
    const long = s.open ? T(`OPEN NOW · TILL ${fmt(s.until)}`, `ABERTO · ATÉ ${fmt(s.until)}`) : T(`CLOSED · OPENS ${fmt(s.opens)}`, `FECHADO · ABRE ${fmt(s.opens)}`);
    $$('[data-status]').forEach(el => { el.classList.toggle('is-open', s.open); el.classList.toggle('is-closed', !s.open); });
    $$('[data-status-short]').forEach(el => (el.textContent = short));
    $$('[data-status-long]').forEach(el => {
      if (el.tagName === 'H2') el.textContent = s.open ? T(`Open now, till ${fmt(s.until)}`, `Aberto agora, até ${fmt(s.until)}`) : T(`Closed now, opens ${s.when} ${fmt(s.opens)}`, `Fechado agora, abre ${s.when} às ${fmt(s.opens)}`);
      else { el.textContent = long; el.classList.toggle('is-open', s.open); el.classList.toggle('is-closed', !s.open); }
    });
    const c = $('[data-clock]');
    if (c) c.textContent = `${BW.daysS[s.n.day]} ${String(s.n.h).padStart(2, '0')}:${String(s.n.m).padStart(2, '0')}`;
    $$('[data-hday]').forEach(li => li.classList.toggle('today', +li.dataset.hday === s.n.day));
    return s;
  }
  const st = paintStatus();
  setInterval(paintStatus, 20000);
  const today = st.n.day;

  /* ---------- Placar: gol ---------- */
  const home = $('[data-score-home]');
  if (home) setTimeout(() => { home.textContent = '1'; if (!reduce) home.classList.add('goal'); }, reduce ? 0 : 1100);

  /* ---------- Prato do dia ---------- */
  const sp = BW.specials[today];
  const chip = $('[data-today-chip]');
  if (chip && sp) {
    const late = sp.item === 'executivo' && st.n.t >= 17;
    chip.outerHTML = `<a class="today-chip" href="menu.html#today"><img src="${en ? '' : '../'}img/${sp.img}-s.webp" alt="" width="54" height="54"><span><small>${late ? T('TODAY TILL 5 PM', 'HOJE ATÉ 17H') : T('TODAY\'S SPECIAL', 'PRATO DE HOJE')}</small><b>${en ? sp.en : sp.pt}</b></span><span class="p">${money(sp.price)}</span></a>`;
  }
  const fx = $(`[data-fixtures] [data-day="${today}"]`);
  if (fx) {
    fx.classList.add('is-today');
    const list = fx.parentElement;
    if (list.scrollWidth > list.clientWidth) list.scrollLeft = fx.offsetLeft - list.offsetLeft - 16;
  }
  // Cardápio: marca o prato do dia e bloqueia os de outros dias
  $$('.mcat#today [data-item]').forEach(card => {
    const it = BW.items[card.dataset.item];
    const days = { executivo: [2, 3, 4, 5], feijoada: [6], costela: [0] }[card.dataset.item];
    if (!days) return;
    if (days.includes(today)) card.classList.add('is-today');
    else {
      card.classList.add('is-off');
      const b = $('.add', card);
      if (b) { b.disabled = true; b.querySelector('span').textContent = T('Not today', 'Hoje não'); }
    }
    void it;
  });
  $$('.fx').forEach(li => {
    if (+li.dataset.day !== today) { const b = $('.add', li); if (b) b.remove(); }
  });

  /* ---------- Menu móvel ---------- */
  const burger = $('.burger'), mnav = $('#mnav');
  burger?.addEventListener('click', () => {
    const o = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', o);
    mnav.hidden = !o;
    document.body.style.overflow = o ? 'hidden' : '';
  });

  /* ---------- Pedido (súmula) ---------- */
  const KEY = 'bw-order-v1';
  let lines = [];
  try { lines = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { lines = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {} };
  const sheet = $('#sheet');
  const toast = $('[data-toast]');
  let toastT;
  const say = msg => { toast.textContent = msg; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 1800); };

  function render() {
    const count = lines.reduce((a, l) => a + l.q, 0);
    $$('[data-count]').forEach(el => (el.textContent = count));
    const ol = $('[data-lines]', sheet);
    ol.innerHTML = lines.map((l, k) => `<li><span class="ln-no">${k + 1}</span><span class="ln-name">${l.n}${l.o ? `<small>${l.o}</small>` : ''}<small>${money(l.p)}</small></span><span class="ln-qty"><button type="button" data-dec="${k}" aria-label="${T('Remove one', 'Tirar um')}">−</button><output>${l.q}</output><button type="button" data-inc="${k}" aria-label="${T('Add one', 'Mais um')}">+</button></span></li>`).join('');
    $('[data-empty]', sheet).hidden = lines.length > 0;
    $('[data-total]', sheet).textContent = money(lines.reduce((a, l) => a + l.p * l.q, 0));
  }
  function addLine(id, name, opt, price) {
    const ex = lines.find(l => l.id === id && l.o === opt && l.p === price);
    if (ex) ex.q++; else lines.push({ id, n: name, o: opt, p: price, q: 1 });
    save(); render();
    say(T('Added: ', 'No pedido: ') + name);
  }
  sheet.addEventListener('click', e => {
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
    if (inc) { lines[+inc.dataset.inc].q++; }
    else if (dec) { const k = +dec.dataset.dec; lines[k].q--; if (lines[k].q <= 0) lines.splice(k, 1); }
    else return;
    save(); render();
  });

  let lastFocus;
  function openSheet() {
    lastFocus = document.activeElement;
    sheet.hidden = false; sheet.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => sheet.classList.add('open'));
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('.icon-btn', sheet).focus(), 50);
  }
  function closeSheet() {
    sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { sheet.hidden = true; lastFocus?.focus?.(); }, reduce ? 0 : 320);
  }
  $$('[data-open-sheet]').forEach(b => b.addEventListener('click', openSheet));
  $$('[data-close-sheet]').forEach(b => b.addEventListener('click', closeSheet));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  // Seletor de opções para botões fora dos cards do cardápio
  function pick(id, done) {
    const it = BW.items[id];
    const dlg = document.createElement('div');
    dlg.className = 'sheet open picker';
    dlg.innerHTML = `<div class="sheet-scrim"></div><section class="sheet-panel" role="dialog" aria-modal="true" aria-label="${it.n}" style="transform:none"><header class="sheet-hd"><div><p class="kicker led">${T('Choose', 'Escolha')}</p><h2>${it.n}</h2></div><button type="button" class="icon-btn" data-x aria-label="${T('Close', 'Fechar')}">✕</button></header>
      <div class="sheet-form">${it.v ? `<label class="fld"><span>${T('Size / choice', 'Tamanho / opção')}</span><select data-var>${it.v.map((v, k) => `<option value="${k}">${v[0]} · ${money(v[1])}</option>`).join('')}</select></label>` : ''}
      ${it.oc.map((g, gi) => `<label class="fld"><span>${it.o[gi]}</span><select data-opt>${g.map(c => `<option>${c}</option>`).join('')}</select></label>`).join('')}
      <button type="button" class="btn btn-red btn-block" data-ok>${T('Add to order', 'Pôr no pedido')}</button></div></section>`;
    document.body.appendChild(dlg);
    const close = () => dlg.remove();
    $('.sheet-scrim', dlg).onclick = close; $('[data-x]', dlg).onclick = close;
    dlg.addEventListener('keydown', e => e.key === 'Escape' && close());
    $('[data-ok]', dlg).onclick = () => { done(dlg); close(); };
    $('select', dlg)?.focus();
  }
  function readChoice(scope, it) {
    let name = it.n, price = it.p, opt = [];
    const vs = $('[data-var]', scope);
    if (it.v) { const v = it.v[vs ? +vs.value : 0]; opt.push(v[0]); price = v[1]; }
    $$('[data-opt]', scope).forEach(s => opt.push(s.value));
    return [name, opt.join(' · '), price];
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('button[data-add]');
    if (!b || b.disabled) return;
    const id = b.dataset.add, it = BW.items[id];
    if (!it) return;
    const card = b.closest('.dish, .mini');
    const needs = it.v || (it.oc && it.oc.length);
    const go = scope => { const [n, o, p] = readChoice(scope, it); addLine(id, n, o, p); b.classList.add('added'); setTimeout(() => b.classList.remove('added'), 700); };
    if (card || !needs) go(card || document.createElement('div'));
    else pick(id, go);
  });

  // Entrega mostra endereço
  const form = $('[data-order-form]');
  form.addEventListener('change', () => { $('[data-addr]', form).hidden = form.mode.value !== 'delivery'; });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const err = $('[data-err]', form);
    const fail = m => { err.textContent = m; err.hidden = false; };
    err.hidden = true;
    if (!lines.length) return fail(T('Add at least one dish first.', 'Adicione pelo menos um prato.'));
    if (!form.name.value.trim()) { form.name.focus(); return fail(T('Please add your name.', 'Coloque seu nome.')); }
    const del = form.mode.value === 'delivery';
    if (del && !form.addr.value.trim()) { form.addr.focus(); return fail(T('Please add the delivery address.', 'Coloque o endereço de entrega.')); }
    const total = lines.reduce((a, l) => a + l.p * l.q, 0);
    const msg = [
      T('Hi Brazilian Way! New order from the website:', 'Olá, Brazilian Way! Pedido feito pelo site:'),
      '',
      ...lines.map((l, k) => `${k + 1}. ${l.q}x ${l.n}${l.o ? ` (${l.o})` : ''} · ${money(l.p * l.q)}`),
      '',
      `${T('Estimated total', 'Total estimado')}: ${money(total)}`,
      `${del ? T('Delivery', 'Entrega') : T('Pickup', 'Retirada')}${del ? ': ' + form.addr.value.trim() : ''}`,
      `${T('Name', 'Nome')}: ${form.name.value.trim()}`,
      `${T('When', 'Quando')}: ${form.when.value.trim() || T('As soon as possible', 'O quanto antes')}`,
      form.notes.value.trim() ? `${T('Notes', 'Obs')}: ${form.notes.value.trim()}` : '',
      '',
      T('Could you confirm the total and the time?', 'Podem confirmar o total e o horário?'),
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
    const url = `https://wa.me/${BW.wa}?text=${encodeURIComponent(msg)}`;
    window.__lastWa = url;
    window.open(url, '_blank', 'noopener');
  });
  render();

  /* ---------- Reserva ---------- */
  const rf = $('[data-res-form]');
  if (rf) {
    const d = new Date(); rf.day.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    rf.addEventListener('submit', e => {
      e.preventDefault();
      const msg = [
        T('Hi Brazilian Way! I would like to reserve a table:', 'Olá, Brazilian Way! Quero reservar uma mesa:'),
        `${T('People', 'Pessoas')}: ${rf.people.value}`,
        `${T('Day', 'Dia')}: ${rf.day.value}`,
        `${T('Time', 'Horário')}: ${rf.time.value}`,
        rf.name.value.trim() ? `${T('Name', 'Nome')}: ${rf.name.value.trim()}` : '',
        rf.occ.value.trim() ? `${T('Occasion', 'Ocasião')}: ${rf.occ.value.trim()}` : '',
      ].filter(Boolean).join('\n');
      const url = `https://wa.me/${BW.wa}?text=${encodeURIComponent(msg)}`;
      window.__lastWa = url;
      window.open(url, '_blank', 'noopener');
    });
  }

  /* ---------- Escalação ---------- */
  const ld = $('#lineup-data');
  if (ld) {
    const data = JSON.parse(ld.textContent);
    const scout = $('[data-scout]');
    const R = en ? '' : '../';
    $$('.player').forEach(p => p.addEventListener('click', () => {
      const d = data[p.dataset.player];
      $$('.player').forEach(x => x.classList.toggle('on', x === p));
      const im = $('[data-scout-img]', scout);
      im.src = `${R}img/${d.img}.webp`; im.alt = d.name;
      $('[data-scout-pos]', scout).textContent = `${d.n} · ${d.pos}${d.pos === 'ST' ? T(' · CAPTAIN', ' · CAPITÃ') : ''}`;
      $('[data-scout-name]', scout).textContent = d.name;
      $('[data-scout-desc]', scout).textContent = d.d;
      $('[data-scout-price]', scout).textContent = d.price;
      $('[data-scout-add]', scout).dataset.add = p.dataset.player;
      if (innerWidth < 900) scout.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    }));
    $('.player[data-player="picanha-bw"]')?.classList.add('on');
  }

  /* ---------- Caipirinha ---------- */
  const ht = $('.halftime');
  if (ht) {
    const btns = $$('[data-flavor]', ht);
    const label = $('[data-flavor-label]', ht);
    let auto;
    const set = b => {
      btns.forEach(x => x.setAttribute('aria-checked', x === b));
      ht.style.setProperty('--fa', b.style.getPropertyValue('--a'));
      ht.style.setProperty('--fb', b.style.getPropertyValue('--b'));
      label.textContent = b.textContent.trim().toUpperCase();
    };
    btns.forEach(b => b.addEventListener('click', () => { clearInterval(auto); set(b); }));
    ht.addEventListener('keydown', e => {
      const i = btns.findIndex(b => b.getAttribute('aria-checked') === 'true');
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length]; clearInterval(auto); set(n); n.focus(); }
    });
    if (!reduce) {
      let k = 0;
      new IntersectionObserver(([en_]) => {
        clearInterval(auto);
        if (en_.isIntersecting && !ht.dataset.touched) auto = setInterval(() => set(btns[++k % btns.length]), 2600);
      }).observe(ht);
      btns.forEach(b => b.addEventListener('click', () => (ht.dataset.touched = 1)));
    }
  }

  /* ---------- Cardápio: busca e chips ---------- */
  const q = $('[data-search-input]');
  if (q) {
    const cards = $$('.m-body [data-item]');
    const cats = $$('.mcat');
    q.addEventListener('input', () => {
      const v = q.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      let shown = 0;
      cards.forEach(c => {
        const ok = !v || c.dataset.search.normalize('NFD').replace(/[̀-ͯ]/g, '').includes(v);
        c.hidden = !ok; if (ok) shown++;
      });
      cats.forEach(s => (s.hidden = !$$('[data-item]', s).some(c => !c.hidden)));
      $('[data-no-results]').hidden = shown > 0;
    });
    const chips = $('[data-chips]');
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      $$('a', chips).forEach(a => a.classList.toggle('on', a.dataset.chip === e.target.id));
      const on = $(`a[data-chip="${e.target.id}"]`, chips);
      if (on) chips.scrollTo({ left: on.offsetLeft - 20, behavior: reduce ? 'auto' : 'smooth' });
    }), { rootMargin: '-40% 0px -55% 0px' });
    cats.forEach(c => io.observe(c));
  }

  /* ---------- Revelações e replay ---------- */
  const rv = $$('.sec-hd, .fx, .dish, .v-card, .place-imgs figure, .ht-copy, .scout');
  if (!reduce && 'IntersectionObserver' in window) {
    rv.forEach(el => el.classList.add('rv'));
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(el => io.observe(el));
  }
  window.addEventListener('load', () => {
    const stage = $('.replay-stage');
    if (!stage || reduce || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    const img = $('[data-replay-img]'), tc = $('[data-timecode]');
    gsap.fromTo(img, { scale: 1.02 }, {
      scale: 1.4, yPercent: 6, ease: 'none',
      scrollTrigger: {
        trigger: stage, start: 'top top', end: '+=120%', pin: true, scrub: true,
        onUpdate: s => { const f = Math.round(s.progress * 7 * 30); tc.textContent = `00:${String(Math.floor(f / 30)).padStart(2, '0')}:${String(f % 30).padStart(2, '0')}`; },
      },
    });
  });
})();
