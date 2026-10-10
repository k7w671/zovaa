/* ZOVA storefront — vanilla JS single-page app (RTL, hash routes) */
(function () {
  'use strict';
  const D = window.ZOVA_DATA, C = window.ZOVA_CONFIG, IC = window.ZOVA_ICONS, CATI = window.ZOVA_CAT_ICONS;
  const P = Object.fromEntries(D.products.map(p => [p.id, p]));
  const CAT = Object.fromEntries(D.categories.map(c => [c.id, c.ar]));
  const COLL = Object.fromEntries(D.collections.map(c => [c.id, c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const ic = (n, cls) => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;
  const catIc = k => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CATI[k] || ''}</svg>`;
  const money = n => `${Math.round(n).toLocaleString('en-US')} ${C.currency}`;
  const off = p => p.old ? Math.round((1 - p.price / p.old) * 100) : 0;
  const colorOf = k => D.colors[k] || { hex: '#ccc', ar: k, en: k };
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CAT_ICON = { handbags: 'top', shoulder: 'hobo', buckets: 'bucket', crossbody: 'crossbody', totes: 'tote', evening: 'clutch', wallets: 'wallet' };
  const OFFER = D.offer || { before: 0, now: 0, percent: 0 };
  const BADGE = { best: ['الأكثر طلباً', 'b-best'], new: ['جديد', 'b-new'], limited: ['إصدار محدود', 'b-limited'] };
  const nounOf = p => (p.cat === 'wallets' ? '' : 'حقيبة ');

  /* ------------------------------------------------------------ storage */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('zova.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('zova.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const S = {
    cart: LS.get('cart', []).filter(i => P[i.id] && P[i.id].colors.some(c => c.key === i.color) && i.qty > 0),
    wish: LS.get('wish', []).filter(id => P[id]),
    orders: LS.get('orders', []),
    profile: LS.get('profile', {}),
    coupon: null,
    view: LS.get('view', 4)
  };
  const saveCart = () => { LS.set('cart', S.cart); updateCounts(); if ($('#cart').classList.contains('on')) renderCart(); if (S.onCart) S.onCart(); };

  /* ------------------------------------------------------------ cart logic */
  function totals(opts = {}) {
    const sub = S.cart.reduce((a, i) => a + P[i.id].price * i.qty, 0);
    const count = S.cart.reduce((a, i) => a + i.qty, 0);
    let discount = 0;
    if (S.coupon && C.coupons[S.coupon]) {
      const cp = C.coupons[S.coupon];
      discount = cp.type === 'percent' ? Math.round(sub * cp.value / 100) : Math.min(sub, cp.value);
    }
    const method = opts.method || 'standard';
    const after = sub - discount;
    let ship = 0;
    if (count) ship = method === 'express' ? C.shipping.express.price : (after >= C.freeShippingOver ? 0 : C.shipping.standard.price);
    const cod = opts.pay === 'cod' ? C.codFee : 0;
    const total = after + ship + cod;
    const vat = total - total / (1 + C.vatRate);
    return { sub, count, discount, ship, cod, total, vat };
  }
  function addToCart(id, color, qty = 1) {
    const p = P[id]; if (!p) return;
    color = p.colors.some(c => c.key === color) ? color : p.colors[0].key;
    const it = S.cart.find(i => i.id === id && i.color === color);
    if (it) it.qty = Math.min(9, it.qty + qty); else S.cart.push({ id, color, qty: Math.min(9, qty) });
    saveCart();
    bump('#cartCount');
    const img = p.colors.find(c => c.key === color).img;
    toast(`<img src="${img}" alt=""><span>أُضيفت <b>${esc(nounOf(p) + p.ar)}</b> إلى سلتكِ</span><button type="button" data-act="cart">عرض السلة</button>`);
  }
  function toggleWish(id) {
    const i = S.wish.indexOf(id);
    if (i >= 0) S.wish.splice(i, 1); else S.wish.push(id);
    LS.set('wish', S.wish);
    const on = S.wish.includes(id);
    $$(`[data-act="wish"][data-id="${id}"]`).forEach(b => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    updateCounts(); bump('#wishCount');
    toast(`<span class="ok">${ic('heart')}</span><span>${on ? 'حُفظت في المفضلة' : 'أُزيلت من المفضلة'}</span>${on ? '<button type="button" data-go="wishlist">المفضلة</button>' : ''}`);
    if (route.name === 'wishlist' && !on) render();
  }
  function updateCounts() {
    const n = S.cart.reduce((a, i) => a + i.qty, 0);
    const c = $('#cartCount'), w = $('#wishCount');
    if (c) { c.textContent = n; c.hidden = !n; }
    if (w) { w.textContent = S.wish.length; w.hidden = !S.wish.length; }
  }
  function bump(sel) { const el = $(sel); if (!el) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

  /* ------------------------------------------------------------ toasts */
  function toast(html, ms = 3200) {
    const box = $('#toasts'); const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = html; box.appendChild(t);
    while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 360); }, ms);
  }

  /* ------------------------------------------------------------ components */
  const badgeHTML = p => p.badge && BADGE[p.badge] ? `<span class="badge ${BADGE[p.badge][1]}">${BADGE[p.badge][0]}</span>` : '';
  const discHTML = p => p.old ? `<span class="disc" aria-label="خصم ${off(p)}٪"><span dir="ltr">-${off(p)}%</span></span>` : '';
  const priceHTML = (p, extra = '') => `<div class="price"><b class="num">${money(p.price)}</b>${p.old ? `<s class="num">${money(p.old)}</s>` : ''}${extra}</div>`;
  const wishOn = id => S.wish.includes(id) ? ' on' : '';
  function card(p, v = '') {
    const c0 = p.colors[0];
    return `<article class="card ${v}" data-card="${p.id}">
      <div class="card-media">
        <a href="#p-${p.id}" aria-label="${esc(nounOf(p) + p.ar)}"><img src="${c0.img}" alt="${esc(`${nounOf(p)}${p.ar} باللون ${colorOf(c0.key).ar}`)}" loading="lazy" decoding="async" width="880" height="1100"></a>
        ${badgeHTML(p)}${discHTML(p)}
        <div class="card-actions">
          <button type="button" class="act-add" data-act="add" data-id="${p.id}" data-color="${c0.key}" aria-label="أضيفي ${esc(p.ar)} إلى السلة">${ic('bag')}<span>أضيفي للسلة</span></button>
          <button type="button" class="act-wish${wishOn(p.id)}" data-act="wish" data-id="${p.id}" aria-pressed="${S.wish.includes(p.id)}" aria-label="حفظ ${esc(p.ar)} في المفضلة">${ic('heart')}</button>
        </div>
      </div>
      <div class="card-body">
        <p class="card-eyebrow">${esc(CAT[p.cat])}</p>
        <h3 class="card-title"><a href="#p-${p.id}">${esc(p.ar)}</a><span class="la" lang="en">${esc(p.en)}</span></h3>
        ${priceHTML(p)}
        <div class="sw" role="group" aria-label="الألوان">${p.colors.map((c, i) => `<button type="button" class="${i ? '' : 'on'}" style="background:${colorOf(c.key).hex}" data-act="sw" data-id="${p.id}" data-color="${c.key}" aria-label="${esc(colorOf(c.key).ar)}" title="${esc(colorOf(c.key).ar)}"></button>`).join('')}</div>
      </div>
    </article>`;
  }
  function secHead(title, sub, trackId, la) {
    return `<div class="sec-h"><div><h2>${title}${la ? `<span class="la" lang="en">${la}</span>` : ''}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
      ${trackId ? `<div class="arrows"><button type="button" class="round" data-act="prev" data-for="${trackId}" aria-label="السابق">${ic('chevron', 'flip')}</button><button type="button" class="round" data-act="next" data-for="${trackId}" aria-label="التالي">${ic('chevron')}</button></div>` : ''}</div>`;
  }
  let trackN = 0;
  function carousel(title, sub, items, v = '', la = '', cls = 'sec') {
    const id = 'trk' + (++trackN);
    return `<section class="${cls}"><div class="wrap">${secHead(title, sub, id, la)}
      <div class="track ${v}" id="${id}">${items.map(p => card(p, v)).join('')}</div></div></section>`;
  }
  function feature(p, opts = {}) {
    const c0 = p.colors[0];
    return `<article class="feature" data-card="${p.id}">
      <div class="media"><a href="#p-${p.id}" aria-label="${esc(p.ar)}"><img src="${opts.img || p.wide}" alt="${esc(nounOf(p) + p.ar)}" loading="lazy" decoding="async"></a>${badgeHTML(p)}
        <button type="button" class="round wish-float act-wish${wishOn(p.id)}" data-act="wish" data-id="${p.id}" aria-pressed="${S.wish.includes(p.id)}" aria-label="حفظ في المفضلة">${ic('heart')}</button></div>
      <div class="info">
        <span class="cat">${esc(CAT[p.cat])} · ${esc(p.typeAr)}</span>
        <h3>${esc(p.ar)}<span class="la" lang="en">${esc(p.en)}</span></h3>
        <p>${esc(p.short)}</p>
        ${priceHTML(p, p.old ? `<span class="chip-off">-${off(p)}%</span>` : '')}
        <div class="row">
          <button type="button" class="btn btn-primary" data-act="add" data-id="${p.id}" data-color="${c0.key}">${ic('bag')}أضيفي للسلة</button>
          <a class="btn btn-ghost" href="#p-${p.id}">التفاصيل</a>
        </div>
      </div></article>`;
  }
  const empty = (icon, title, text, cta = '<a class="btn btn-primary" href="#shop">ابدئي التسوق</a>') =>
    `<div class="empty"><i>${ic(icon)}</i><h3>${title}</h3><p>${text}</p>${cta}</div>`;
  const crumbs = list => `<nav class="crumbs" aria-label="مسار التصفح">${list.map((c, i) => i < list.length - 1 ? `<a href="${c[1]}">${c[0]}</a>${ic('chevron')}` : `<b>${c[0]}</b>`).join('')}</nav>`;

  /* ------------------------------------------------------------ pages */
  const byAdded = () => [...D.products].sort((a, b) => a.added - b.added);
  const onSale = () => D.products.filter(p => p.old).sort((a, b) => off(b) - off(a));
  const maxOff = () => Math.max(...D.products.map(off));
  const saleLive = () => Date.parse(C.saleEndsAt) > Date.now();

  function countdownHTML(id) {
    return saleLive() ? `<div class="count" id="${id}" aria-label="الوقت المتبقي على نهاية العرض">
      <div><b data-u="d">00</b><small>يوم</small></div><div><b data-u="h">00</b><small>ساعة</small></div><div><b data-u="m">00</b><small>دقيقة</small></div><div><b data-u="s">00</b><small>ثانية</small></div></div>` : '';
  }

  function home() {
    const H = D.hero.map(id => P[id]);
    const h0 = H[0];
    const HM = D.home;
    const story = COLL[HM.edit.story];
    const tick = [['tag', `خصم ${OFFER.percent}% على جميع الحقائب`], ['sparkle', 'جودة ممتازة بسعر مناسب'], ['shield', 'دفع آمن بخيارات متعددة'], ['truck', 'توصيل لجميع مدن المملكة'],
      ['gift', 'تغليف أنيق لكل طلب'], ['chat', 'خدمة عميلات عبر واتساب'], ['return', `استرجاع سهل خلال ${C.returnsDays} يوماً`]];
    const tickHTML = tick.map(t => `<span>${ic(t[0])}${t[1]}</span>`).join('');
    const html = `
    <div class="wrap">
      <div class="strip" aria-label="قطع مختارة">
        <div class="strip-track" id="strip">${D.strip.map(id => { const p = P[id]; return `<a class="strip-item${id === h0.id ? ' on' : ''}" data-id="${id}" href="#p-${id}"><img src="${p.colors[0].img}" alt="" decoding="async"><span class="cap"><small lang="en">${esc(p.en)} · ${esc(p.typeEn)}</small><b>${esc(p.ar)}</b></span></a>`; }).join('')}</div>
        <div class="strip-bar" aria-hidden="true"><i id="stripBar"></i></div>
      </div>
      <section class="hero" id="hero" aria-roledescription="عرض متحرك">
        <div class="hero-copy" id="heroCopy">
          <span class="pill">${ic('tag')}خصم ${OFFER.percent}% على جميع الحقائب</span>
          ${heroCopy(h0)}
          <div class="hero-ctrl">
            <button type="button" class="round" data-act="hero" data-d="-1" aria-label="الشريحة السابقة">${ic('chevron', 'flip')}</button>
            <button type="button" class="round" data-act="hero" data-d="1" aria-label="الشريحة التالية">${ic('chevron')}</button>
            <div class="dots" id="heroDots">${H.map((p, i) => `<button type="button" class="${i ? '' : 'on'}" data-act="slide" data-i="${i}" aria-label="${esc(p.ar)}"></button>`).join('')}</div>
          </div>
        </div>
        <div class="bento" id="bento">${bentoHTML(0)}</div>
      </section>
    </div>
    <div class="ticker" aria-hidden="true"><div class="ticker-track">${tickHTML}${tickHTML}</div></div>
    <div class="wrap"><div class="perks-row">
      <div class="perk"><i>${ic('truck')}</i><div><b>شحن مجاني</b><span>للطلبات فوق ${C.freeShippingOver} ${C.currency}</span></div></div>
      <div class="perk"><i>${ic('card')}</i><div><b>دفع آمن</b><span>مدى، Apple Pay، تابي، تمارا</span></div></div>
      <div class="perk"><i>${ic('return')}</i><div><b>استرجاع سهل</b><span>خلال ${C.returnsDays} يوماً من الاستلام</span></div></div>
      <div class="perk"><i>${ic('gift')}</i><div><b>تغليف أنيق</b><span>لكل طلب، وبطاقة إهداء عند الطلب</span></div></div>
    </div></div>
    ${noticeBand()}
    <div class="band">
      ${carousel('تشكيلة زوفا', `كل الحقائب بـ ${money(OFFER.now)} بدلاً من ${money(OFFER.before)}`, D.products)}
      <div class="wrap" style="padding-bottom:64px">${feature(P[HM.feature])}</div>
    </div>
    <section class="sec"><div class="wrap">
      ${secHead('اختيارات زوفا', 'قطع نحبّها ونرشّحها لكِ')}
      <div class="edit">
        <div class="edit-col">
          ${feature(P[HM.edit.feature], { img: P[HM.edit.feature].colors[0].img })}
          <a class="story" href="#c-${story.id}"><img src="${story.img}" alt="" loading="lazy"><span class="la" lang="en">${esc(story.en)}</span><h3>${esc(story.ar)}</h3><p>${esc(story.sub)}</p><span class="btn btn-light btn-sm" style="align-self:flex-start">تسوّقي المجموعة${ic('arrow')}</span></a>
        </div>
        <div class="edit-col">${HM.edit.cards.slice(0, 2).map(id => card(P[id])).join('')}</div>
        <div class="edit-col">${HM.edit.cards.slice(2, 4).map(id => card(P[id])).join('')}</div>
      </div>
    </div></section>
    <section class="sec" style="padding-top:8px"><div class="wrap">
      ${secHead('حكايات زوفا', 'قصص قصيرة عن القطع التي نحبها')}
      <div class="ed">${D.editorial.map(e => `<a class="ed-card" href="#p-${e.id}"><img src="${e.img}" alt="" loading="lazy">
        <div class="ed-txt"><small>${esc(e.eyebrow)}</small><h3>${esc(e.title)}<span class="la" lang="en">${esc(e.la)}</span></h3><p>${esc(e.text)}</p></div><span class="ed-go">${ic('go')}</span></a>`).join('')}</div>
    </div></section>
    <section class="sec band"><div class="wrap">
      <div class="sec-h center"><div><h2>المجموعات</h2><p>مجموعات مختارة لكل يوم ولكل مناسبة</p></div></div>
      <div class="cols">${D.collections.map(c => colCard(c)).join('')}</div>
    </div></section>
    <section class="sec-tight" style="padding-top:56px"><div class="wrap">
      <div class="flash">
        <div>
          <span class="glass">${ic('clock')}${esc(C.saleTitle)} — لفترة محدودة</span>
          <h2>خصم ${OFFER.percent}% على جميع الحقائب</h2>
          <p>كل الحقائب بـ ${money(OFFER.now)} بدلاً من ${money(OFFER.before)}، والكميات محدودة.</p>
          <div class="cta-row" style="margin-top:0">
            <a class="btn btn-light" href="#deals">تسوّقي العروض${ic('arrow')}</a>
            ${countdownHTML('cd1')}
          </div>
        </div>
        <div class="flash-art" aria-hidden="true">${HM.flash.map(id => `<div class="ft"><img src="${P[id].colors[0].img}" alt=""></div>`).join('')}</div>
      </div>
    </div></section>
    <section class="sec"><div class="wrap">
      <div class="sec-h center"><div><h2>وعدنا لكِ</h2><p>ما نلتزم به في كل طلب</p></div></div>
      <div class="promise">
        <article class="pcard"><div class="q" aria-hidden="true">”</div><p>نفحص كل حقيبة قبل شحنها، وإن لم تكن كما توقعتِ فالاسترجاع سهل خلال ${C.returnsDays} يوماً.</p><footer><i>${ic('shield')}</i><div><b>ضمان الجودة</b><span>فريق زوفا</span></div></footer></article>
        <article class="pcard"><div class="q" aria-hidden="true">”</div><p>نغلّف طلبكِ بعناية، وإن كان هدية نضيف بطاقة إهداء بلا فاتورة داخل الطلب.</p><footer><i>${ic('gift')}</i><div><b>تغليف يليق بكِ</b><span>فريق التغليف</span></div></footer></article>
        <article class="pcard"><div class="q" aria-hidden="true">”</div><p>نساعدكِ في اختيار الحقيبة واللون المناسب، ونرد على رسائلكِ عبر واتساب خلال ساعات العمل.</p><footer><i>${ic('chat')}</i><div><b>نسمعكِ دائماً</b><span>خدمة العميلات</span></div></footer></article>
      </div>
    </div></section>`;
    return { html, title: '', nav: 'home', mount: mountHome };
  }
  const noticeBand = () => `<section class="sec-tight notice-sec"><div class="wrap"><div class="notice-band">
      <div class="nb"><i>${ic('tag')}</i><div><b>خصم ${OFFER.percent}% على جميع الحقائب</b><span>كانت <s class="num">${money(OFFER.before)}</s> والآن <b class="num">${money(OFFER.now)}</b> فقط، لفترة محدودة.</span></div></div>
      <div class="nb"><i>${ic('shield')}</i><div><b>جودة ممتازة بسعر مناسب</b><span>تصاميم عصرية مختارة بعناية، وحقائبنا غير تابعة لأي ماركة أو دار أزياء عالمية.</span></div></div>
      <a class="btn btn-primary" href="#shop">تسوّقي الآن${ic('arrow')}</a>
    </div></div></section>`;
  function heroCopy(p) {
    return `<p class="eyebrow">${esc(CAT[p.cat])} · ${esc(p.badge && BADGE[p.badge] ? BADGE[p.badge][0] : p.typeAr)}</p>
      <h1>${esc(nounOf(p) + p.ar)}</h1>
      <p class="sig la" lang="en">The ${esc(p.en)} ${esc(p.typeEn)}</p>
      <p class="lead">${esc(p.short)}</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="#p-${p.id}">اكتشفيها الآن${ic('arrow')}</a>
        <span class="price-pill"><b class="num">${money(p.price)}</b>${p.old ? `<s class="num">${money(p.old)}</s><span class="chip-off">-${off(p)}%</span>` : ''}</span>
      </div>`;
  }
  function bentoHTML(i) {
    const H = D.hero.map(id => P[id]); const n = H.length; const p = H[i];
    const mini = k => { const q = H[(i + k) % n]; const idx = (i + k) % n; return { q, idx }; };
    const m = [1, 2, 3].map(mini);
    return `<a class="tile spot" href="#p-${p.id}"><img src="${p.colors[0].img}" alt="${esc(nounOf(p) + p.ar)}" decoding="async">
        <span class="chip glass">${ic('sparkle')}قطعة مميزة</span>
        <span class="t"><small lang="en">${esc(p.en)} · ${esc(p.typeEn)}</small><b>${esc(nounOf(p) + p.ar)}</b></span>
        <span class="glass price-tag num">${money(p.price)}</span></a>
      ${m.slice(0, 2).map(({ q, idx }) => `<button type="button" class="tile" data-act="slide" data-i="${idx}" aria-label="عرض ${esc(q.ar)}"><img src="${q.colors[0].img}" alt="" decoding="async"><span class="t"><span class="no">0${idx + 1}</span><b>${esc(q.ar)}</b></span></button>`).join('')}
      <button type="button" class="tile wide4" data-act="slide" data-i="${m[2].idx}" aria-label="عرض ${esc(m[2].q.ar)}"><img src="${m[2].q.wide}" alt="" decoding="async"><span class="t"><span class="no" style="color:var(--muted)">0${m[2].idx + 1}</span><small lang="en">${esc(m[2].q.en)} · ${esc(m[2].q.typeEn)}</small><b>${esc(nounOf(m[2].q) + m[2].q.ar)}</b></span><span class="round go">${ic('arrow')}</span></button>`;
  }
  function colCard(c, big) {
    return `<a class="col-card${big ? ' big' : ''}" href="#c-${c.id}"><img src="${c.img}" alt="" loading="lazy"><span class="t">${big ? `<span class="la" lang="en">${esc(c.en)}</span>` : ''}<small>${c.items.length} قطع</small><h3>${esc(c.ar)}</h3><p>${esc(c.sub)}</p></span></a>`;
  }

  /* ---------- shop */
  const PRICE = [['all', 'كل الأسعار'], ['u200', 'أقل من 200 ر.س'], ['200-400', '200 – 400 ر.س'], ['o400', 'أكثر من 400 ر.س']];
  const SORT = [['featured', 'المميزة'], ['new', 'الأحدث'], ['low', 'السعر: من الأقل'], ['high', 'السعر: من الأعلى'], ['off', 'الأعلى خصماً']];
  const QUICK = { new: 'وصل حديثاً', best: 'الأكثر طلباً', sale: 'العروض' };
  function shop(preset) {
    const st = { q: '', cat: 'all', price: 'all', sort: 'featured', color: '', quick: '' };
    if (preset && CAT[preset]) st.cat = preset;
    if (preset && QUICK[preset]) { st.quick = preset; if (preset === 'new') st.sort = 'new'; }
    const usedColors = [...new Set(D.products.flatMap(p => p.colors.map(c => c.key)))].filter(k => !/satin/.test(k));
    // one price for the whole catalogue: price filter and price sorts add nothing, so hide them
    const oneP = new Set(D.products.map(p => p.price)).size < 2;
    const sorts = oneP ? SORT.filter(s => !['low', 'high', 'off'].includes(s[0])) : SORT;
    const html = `<div class="wrap">
      <header class="phead"><h1>المتجر<span class="la" lang="en">The Shop</span></h1><p>كل تشكيلة زوفا في مكان واحد</p></header>
      <div class="fbar" role="search">
        <label class="fsearch">${ic('search')}<span class="sr">ابحثي في المتجر</span><input id="fq" type="search" placeholder="ابحثي باسم الحقيبة أو اللون…" autocomplete="off"></label>
        <div class="pills" id="fcat">${[['all', 'الكل'], ...D.categories.map(c => [c.id, c.ar])].map(([k, v]) => `<button type="button" class="pbtn${st.cat === k ? ' on' : ''}" data-cat="${k}">${v}</button>`).join('')}</div>
        ${oneP ? '' : `<div class="sel"><label class="sr" for="fprice">السعر</label><select id="fprice">${PRICE.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>${ic('chevron')}</div>`}
        <div class="sel"><label class="sr" for="fsort">الترتيب</label><select id="fsort">${sorts.map(([k, v]) => `<option value="${k}"${st.sort === k ? ' selected' : ''}>${v}</option>`).join('')}</select>${ic('chevron')}</div>
        <div class="view" role="group" aria-label="طريقة العرض"><button type="button" data-view="3" aria-label="ثلاثة أعمدة">${ic('grid4')}</button><button type="button" data-view="4" aria-label="أربعة أعمدة">${ic('grid9')}</button></div>
      </div>
      <div class="cfilter" id="fcolor"><span>اللون:</span>${usedColors.map(k => `<button type="button" class="cdot" data-color="${k}" style="background:${colorOf(k).hex}" aria-label="${esc(colorOf(k).ar)}" title="${esc(colorOf(k).ar)}"></button>`).join('')}</div>
      <div class="meta-row"><span id="fcount" aria-live="polite"></span><span id="fquick"></span></div>
      <div id="fgrid"></div>
    </div>`;
    function apply() {
      let list = D.products.filter(p => {
        if (st.cat !== 'all' && p.cat !== st.cat) return false;
        if (st.quick === 'best' && p.badge !== 'best') return false;
        if (st.quick === 'sale' && !p.old) return false;
        if (st.quick === 'new' && p.added > 4) return false;
        if (st.price === 'u200' && p.price >= 200) return false;
        if (st.price === '200-400' && (p.price < 200 || p.price > 400)) return false;
        if (st.price === 'o400' && p.price <= 400) return false;
        if (st.color && !p.colors.some(c => c.key === st.color)) return false;
        if (st.q) {
          const q = norm(st.q);
          const hay = norm([p.ar, p.en, p.typeAr, p.typeEn, CAT[p.cat], ...p.colors.map(c => colorOf(c.key).ar + ' ' + colorOf(c.key).en)].join(' '));
          if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
        }
        return true;
      });
      const sorters = { featured: (a, b) => D.products.indexOf(a) - D.products.indexOf(b), new: (a, b) => a.added - b.added, low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, off: (a, b) => off(b) - off(a) };
      list.sort(sorters[st.sort]);
      $('#fcount').textContent = `${list.length} ${list.length === 1 ? 'منتج' : (list.length === 2 ? 'منتجان' : (list.length <= 10 ? 'منتجات' : 'منتجاً'))}`;
      $('#fquick').innerHTML = st.quick ? `<button type="button" class="pbtn on" data-clear-quick>${QUICK[st.quick]} ${ic('close')}</button>` : '';
      const g = $('#fgrid');
      if (!list.length) { g.innerHTML = empty('search', 'لا توجد نتائج مطابقة', 'جرّبي كلمات أخرى أو خففي الفلاتر لرؤية المزيد من القطع.', '<button type="button" class="btn btn-ghost" id="freset">مسح الفلاتر</button>'); }
      else {
        // pre-select the filtered colour on each card
        g.innerHTML = `<div class="grid${S.view === 3 ? ' g3' : ''}">${list.map(p => card(p)).join('')}</div>`;
        if (st.color) $$('.card', g).forEach(el => { const b = el.querySelector(`[data-act="sw"][data-color="${st.color}"]`); if (b) swatch(b); });
      }
      $$('#fcat .pbtn').forEach(b => b.classList.toggle('on', b.dataset.cat === st.cat));
      $$('#fcolor .cdot').forEach(b => b.classList.toggle('on', b.dataset.color === st.color));
      $$('.view button').forEach(b => { b.classList.toggle('on', +b.dataset.view === S.view); b.setAttribute('aria-pressed', +b.dataset.view === S.view); });
    }
    function mount() {
      let tmr;
      $('#fq').addEventListener('input', e => { clearTimeout(tmr); tmr = setTimeout(() => { st.q = e.target.value.trim(); apply(); }, 160); });
      $('#fcat').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { st.cat = b.dataset.cat; apply(); } });
      if ($('#fprice')) $('#fprice').addEventListener('change', e => { st.price = e.target.value; apply(); });
      $('#fsort').addEventListener('change', e => { st.sort = e.target.value; apply(); });
      $('#fcolor').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (b) { st.color = st.color === b.dataset.color ? '' : b.dataset.color; apply(); } });
      $('.view').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) { S.view = +b.dataset.view; LS.set('view', S.view); apply(); } });
      $('#fgrid').addEventListener('click', e => { if (e.target.closest('#freset')) { Object.assign(st, { q: '', cat: 'all', price: 'all', color: '', quick: '' }); $('#fq').value = ''; if ($('#fprice')) $('#fprice').value = 'all'; apply(); } });
      $('#fquick').addEventListener('click', e => { if (e.target.closest('[data-clear-quick]')) { st.quick = ''; apply(); } });
      apply();
    }
    return { html, title: 'المتجر', nav: 'shop', mount };
  }
  const norm = s => String(s).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ًٌٍَُِّْـ]/g, '');

  /* ---------- collections */
  function collections() {
    const html = `<div class="wrap">
      <header class="phead"><h1>المجموعات<span class="la" lang="en">Collections</span></h1><p>مجموعات مختارة بعناية لكل يوم ولكل مناسبة</p></header>
      <div class="cols" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))">${D.collections.map(c => colCard(c, true)).join('')}</div>
    </div>
    ${D.collections.map((c, i) => carousel(esc(c.ar), esc(c.sub), c.items.map(id => P[id]), '', esc(c.en), i % 2 ? 'sec' : 'sec band')).join('')}
    <div class="wrap" style="text-align:center;padding-top:8px"><a class="btn btn-dark" href="#shop">عرض كل المنتجات${ic('arrow')}</a></div>`;
    return { html, title: 'المجموعات', nav: 'collections' };
  }
  function collection(id) {
    const c = COLL[id]; if (!c) return notFound();
    const items = c.items.map(k => P[k]);
    const html = `<div class="wrap">${crumbs([['الرئيسية', '#'], ['المجموعات', '#collections'], [esc(c.ar)]])}
      <header class="phead" style="padding-top:18px">
        <div class="feature" style="grid-template-columns:1fr 1.2fr">
          <div class="info"><span class="cat la" lang="en" style="font-size:20px">${esc(c.en)}</span><h3 style="font-size:clamp(32px,4vw,48px)">${esc(c.ar)}</h3><p>${esc(c.sub)}</p><p style="color:var(--muted);font-size:14px">${items.length} قطع في المجموعة</p></div>
          <div class="media"><img src="${c.img}" alt=""></div>
        </div>
      </header>
      <div class="grid" style="margin-top:12px">${items.map(p => card(p)).join('')}</div>
    </div>
    <section class="sec"><div class="wrap">${secHead('مجموعات أخرى', '')}<div class="cols">${D.collections.filter(x => x.id !== id).map(x => colCard(x)).join('')}</div></div></section>`;
    return { html, title: c.ar, nav: 'collections' };
  }

  /* ---------- deals */
  function deals() {
    const list = onSale(); const top = P[D.home.feature] || list[0];
    const html = `<div class="wrap">
      <header class="phead"><span class="redpill">${ic('clock')}عرض لفترة محدودة</span><h1 style="margin-top:12px">عروض زوفا<span class="la" lang="en">The Sale</span></h1><p>خصم ${OFFER.percent}% على جميع الحقائب: ${money(OFFER.now)} بدلاً من ${money(OFFER.before)}</p></header>
      <div class="deal-hero"><div class="l"><i>${ic('tag')}</i><div><h2>${esc(C.saleTitle)}</h2><p>${saleLive() ? 'ينتهي العرض خلال' : 'تابعي عروضنا القادمة'}</p></div></div>${countdownHTML('cd2')}</div>
      ${feature(top)}
    </div>
    <section class="sec"><div class="wrap">${secHead('كل الحقائب المخفّضة', `${list.length} ${list.length > 2 && list.length < 11 ? 'قطع' : 'قطعة'} بسعر ${money(OFFER.now)}`)}<div class="grid">${list.map(p => card(p)).join('')}</div></div></section>`;
    return { html, title: 'العروض', nav: 'deals', mount: () => startCountdown('#cd2') };
  }

  /* ---------- about */
  function about() {
    const colorsUsed = new Set(D.products.flatMap(p => p.colors.map(c => c.key.replace('satin', '')))).size;
    const html = `<div class="wrap">
      <section class="about-hero">
        <div><span class="pill">${ic('sparkle')}حكاية زوفا</span>
          <h1 style="margin-top:18px">حقائب تُشبهكِ<br><em>بفخامة ناعمة</em></h1>
          <p>زوفا متجر إلكتروني للحقائب النسائية في المملكة، وُلد من فكرة بسيطة: أن تحصل كل امرأة على حقيبة أنيقة بجودة ممتازة وسعر مناسب. نختار كل حقيبة بعناية من موردين نثق بهم، وحقائبنا غير تابعة لأي ماركة أو دار أزياء عالمية.</p>
          <a class="btn btn-primary" href="#shop">تصفّحي المجموعة${ic('arrow')}</a></div>
        <figure><img src="img/ui/atelier.webp" alt="ثلاث حقائب من تشكيلة زوفا معروضة داخل أقواس وردية" width="1200" height="1000"></figure>
      </section>
    </div>
    <section class="sec band"><div class="wrap">
      <div class="sec-h center"><div><h2>ما نؤمن به</h2><p>أربعة مبادئ ترافق كل قطعة</p></div></div>
      <div class="values">
        <div class="value"><i>${ic('shield')}</i><h3>الجودة أولاً</h3><p>نفحص كل قطعة قبل شحنها ونختار خامات تحافظ على شكلها مع الاستعمال.</p></div>
        <div class="value"><i>${ic('tag')}</i><h3>جودة بسعر مناسب</h3><p>تصاميم عصرية بأسعار تناسب يومكِ، بلا مبالغة وبلا تنازل عن الجودة.</p></div>
        <div class="value"><i>${ic('sparkle')}</i><h3>الرقة في التفاصيل</h3><p>من القفل الذهبي إلى الغرزة الأخيرة، نختار القطع التي تهتم بالتفاصيل.</p></div>
        <div class="value"><i>${ic('gift')}</i><h3>تجربة تُسعدكِ</h3><p>تغليف أنيق، توصيل سريع، وخدمة تسمعكِ قبل الشراء وبعده.</p></div>
      </div>
    </div></section>
    <section class="sec"><div class="wrap"><div class="facts">
      <div><b class="num">${D.products.length}</b><span>تصميمات في تشكيلتنا الحالية</span></div>
      <div><b class="num">${colorsUsed}</b><span>ألوان مختارة</span></div>
      <div><b class="num">${C.returnsDays}</b><span>يوماً للاسترجاع السهل</span></div>
      <div><b class="num">13</b><span>منطقة في المملكة نوصل إليها</span></div>
    </div></div></section>
    <div class="wrap" style="padding-top:64px"><div class="cta-dark"><h2>جاهزة لاختيار حقيبتكِ؟</h2><p>كل الحقائب الآن بـ ${money(OFFER.now)} بدلاً من ${money(OFFER.before)}، من يومكِ العادي إلى مناسباتكِ الخاصة.</p><a class="btn btn-light" href="#shop">ابدئي التسوق${ic('arrow')}</a></div></div>`;
    return { html, title: 'من نحن', nav: 'about' };
  }

  /* ---------- product */
  function product(id, color) {
    const p = P[id]; if (!p) return notFound();
    let ci = Math.max(0, p.colors.findIndex(c => c.key === color));
    const c = p.colors[ci];
    const related = [...D.products.filter(x => x.id !== id && x.cat === p.cat), ...D.products.filter(x => x.id !== id && x.cat !== p.cat && D.collections.some(k => k.items.includes(id) && k.items.includes(x.id)))].slice(0, 8);
    const split = Math.ceil(p.price / 4);
    const html = `<div class="wrap">
      ${crumbs([['الرئيسية', '#'], ['المتجر', '#shop'], [esc(CAT[p.cat]), `#shop-${p.cat}`], [esc(p.ar)]])}
      <section class="pdp">
        <div class="gallery">
          <div class="gmain" id="gmain" role="button" tabindex="0" aria-label="تكبير الصورة">${badgeHTML(p)}<img id="gimg" src="${c.img}" alt="${esc(`${nounOf(p)}${p.ar} باللون ${colorOf(c.key).ar}`)}" width="880" height="1100"><span class="glass hint">${ic('zoom')}اضغطي للتكبير</span></div>
          <div class="thumbs" id="thumbs">${thumbs(c)}</div>
        </div>
        <div class="pinfo">
          <span class="cat">${esc(CAT[p.cat])} · ${esc(p.typeAr)}</span>
          <h1>${esc(p.ar)}<span class="la" lang="en">${esc(p.en)} ${esc(p.typeEn)}</span></h1>
          ${priceHTML(p, p.old ? `<span class="chip-off">وفّري ${money(p.old - p.price)}</span>` : '')}
          <div class="vat">السعر شامل ضريبة القيمة المضافة · خصم ${OFFER.percent}% لفترة محدودة</div>
          <div class="honest">${ic('info')}<span>جودة ممتازة بسعر مناسب. حقائبنا غير تابعة لأي ماركة أو دار أزياء عالمية.</span></div>
          <div class="split-note">${ic('split')}<span>أو قسّميها على 4 دفعات بقيمة <b class="num">${money(split)}</b> بدون فوائد مع تابي أو تمارا</span></div>
          <p class="desc">${esc(p.short)}</p>
          <div><span class="opt-label">اللون: <span id="cname">${esc(colorOf(c.key).ar)}</span></span>
            <div class="swl" id="swl" role="radiogroup" aria-label="اختاري اللون">${p.colors.map((x, i) => `<button type="button" role="radio" aria-checked="${i === ci}" class="${i === ci ? 'on' : ''}" data-i="${i}" style="background:${colorOf(x.key).hex};color:${lum(colorOf(x.key).hex) > .5 ? '#3E2A30' : '#fff'}" aria-label="${esc(colorOf(x.key).ar)}">${ic('tick')}</button>`).join('')}</div></div>
          <div><span class="opt-label">الكمية</span>
            <div class="qty" id="pqty"><button type="button" data-q="1" aria-label="زيادة">${ic('plus')}</button><output aria-live="polite">1</output><button type="button" data-q="-1" aria-label="إنقاص">${ic('minus')}</button></div></div>
          <div class="buy" id="buy">
            <button type="button" class="btn btn-primary" id="padd">${ic('bag')}<span>أضيفي إلى السلة — <span class="num" id="ptotal">${money(p.price)}</span></span></button>
            <button type="button" class="wish-btn act-wish${wishOn(p.id)}" data-act="wish" data-id="${p.id}" aria-pressed="${S.wish.includes(p.id)}" aria-label="حفظ في المفضلة">${ic('heart')}</button>
          </div>
          <div class="perks3"><div>${ic('truck')}شحن مجاني فوق ${C.freeShippingOver} ${C.currency}</div><div>${ic('shield')}فحص جودة قبل الشحن</div><div>${ic('return')}استرجاع خلال ${C.returnsDays} يوماً</div></div>
          <div>
            <div class="tabs" role="tablist" id="ptabs">
              <button type="button" role="tab" class="on" data-tab="0" aria-selected="true">التفاصيل</button>
              <button type="button" role="tab" data-tab="1" aria-selected="false">الشحن والاسترجاع</button>
              <button type="button" role="tab" data-tab="2" aria-selected="false">العناية</button>
              <button type="button" role="tab" data-tab="3" aria-selected="false">التقييمات</button>
            </div>
            <div class="tabpane" role="tabpanel" id="tp0" style="margin-top:16px"><dl class="specs">${p.specs.filter(s => s[1] !== '—').map(s => `<dt>${esc(s[0])}</dt><dd>${esc(s[1])}</dd>`).join('')}<dt>الألوان</dt><dd>${p.colors.map(x => esc(colorOf(x.key).ar)).join('، ')}</dd></dl></div>
            <div class="tabpane" role="tabpanel" id="tp1" hidden style="margin-top:16px"><ul class="bullets">
              <li>توصيل عادي خلال ${esc(C.shipping.standard.days)}، ومجاني للطلبات فوق ${C.freeShippingOver} ${C.currency}.</li>
              <li>توصيل سريع خلال ${esc(C.shipping.express.days)} برسوم ${money(C.shipping.express.price)}.</li>
              <li>استرجاع أو استبدال خلال ${C.returnsDays} يوماً من الاستلام إذا كانت القطعة بحالتها الأصلية.</li>
              <li>نغلّف كل طلب بعناية قبل شحنه.</li></ul></div>
            <div class="tabpane" role="tabpanel" id="tp2" hidden style="margin-top:16px"><ul class="bullets">
              <li>احفظيها في كيس قماشي بعيداً عن الشمس المباشرة والرطوبة.</li>
              <li>املئيها بورق ناعم عند التخزين لتحافظ على شكلها.</li>
              <li>امسحي البقع بقطعة قماش ناعمة ومبللة قليلاً، وتجنبي المنظفات القوية.</li>
              <li>أبعدي العطور ومستحضرات التجميل عن القطع المعدنية الذهبية.</li></ul></div>
            <div class="tabpane" role="tabpanel" id="tp3" hidden style="margin-top:16px">${empty('star', 'لا توجد تقييمات بعد', 'ستظهر هنا تقييمات العميلات بعد استلام أولى الطلبات.', '')}</div>
          </div>
        </div>
      </section>
    </div>
    ${related.length ? carousel('قد يعجبكِ أيضاً', 'قطع قريبة من ذوقكِ', related) : ''}
    <div class="sticky-buy" id="stickyBuy" aria-hidden="true"><img id="sbimg" src="${c.img}" alt=""><div class="n"><b>${esc(nounOf(p) + p.ar)}</b><span class="num">${money(p.price)}</span></div><button type="button" class="btn btn-primary btn-sm" id="sbadd" tabindex="-1">${ic('bag')}أضيفي للسلة</button></div>`;
    function mount() {
      let qty = 1;
      const gm = $('#gmain'), gi = $('#gimg');
      const setImg = src => { gi.style.opacity = .35; const im = new Image(); im.onload = im.onerror = () => { gi.src = src; gi.style.opacity = 1; }; im.src = src; };
      $('#thumbs').addEventListener('click', e => { const t = e.target.closest('.thumb'); if (!t) return; $$('.thumb').forEach(x => { x.classList.toggle('on', x === t); x.setAttribute('aria-current', x === t); }); setImg(t.dataset.src); });
      const zoomTo = (x, y) => { gm.style.setProperty('--zx', x + '%'); gm.style.setProperty('--zy', y + '%'); };
      gm.addEventListener('click', e => { const r = gm.getBoundingClientRect(); zoomTo((e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100); gm.classList.toggle('zoom'); });
      gm.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoomTo(50, 50); gm.classList.toggle('zoom'); } });
      gm.addEventListener('mousemove', e => { if (!gm.classList.contains('zoom')) return; const r = gm.getBoundingClientRect(); zoomTo((e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100); });
      gm.addEventListener('mouseleave', () => gm.classList.remove('zoom'));
      $('#swl').addEventListener('click', e => {
        const b = e.target.closest('[data-i]'); if (!b) return;
        ci = +b.dataset.i; const cc = p.colors[ci];
        $$('#swl button').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
        $('#cname').textContent = colorOf(cc.key).ar;
        $('#thumbs').innerHTML = thumbs(cc); setImg(cc.img); $('#sbimg').src = cc.img;
        gi.alt = `${nounOf(p)}${p.ar} باللون ${colorOf(cc.key).ar}`;
        try { history.replaceState(null, '', `#p-${p.id}-${cc.key}`); } catch (err) { /* ignore */ }
      });
      $('#pqty').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (!b) return; qty = Math.max(1, Math.min(9, qty + +b.dataset.q)); $('#pqty output').textContent = qty; $('#ptotal').textContent = money(p.price * qty); });
      const add = () => addToCart(p.id, p.colors[ci].key, qty);
      $('#padd').addEventListener('click', add); $('#sbadd').addEventListener('click', add);
      $('#ptabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; $$('#ptabs button').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); }); [0, 1, 2, 3].forEach(k => { $('#tp' + k).hidden = +b.dataset.tab !== k; }); });
      const sb = $('#stickyBuy');
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(([en]) => { const on = !en.isIntersecting && en.boundingClientRect.top < 0; sb.classList.toggle('on', on); sb.setAttribute('aria-hidden', !on); $('#sbadd').tabIndex = on ? 0 : -1; });
        io.observe($('#buy')); cleanup.push(() => io.disconnect());
      }
    }
    return { html, title: p.ar, nav: 'shop', mount };
  }
  const thumbs = c => [[c.img, 'الصورة الرئيسية'], [c.scene, 'صورة في مشهد'], [c.detail, 'لقطة قريبة']].map((t, i) => `<button type="button" class="thumb${i ? '' : ' on'}" data-src="${t[0]}" aria-label="${t[1]}"${i ? '' : ' aria-current="true"'}><img src="${t[0]}" alt="" loading="lazy"></button>`).join('');
  function lum(hex) { const n = parseInt(hex.slice(1), 16); const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

  /* ---------- wishlist */
  function wishlist() {
    const items = S.wish.map(id => P[id]).filter(Boolean);
    const html = `<div class="wrap"><header class="phead"><h1>المفضلة<span class="la" lang="en">Wishlist</span></h1><p>${items.length ? `${items.length} ${items.length > 2 && items.length < 11 ? 'قطع' : 'قطعة'} محفوظة` : 'احفظي القطع التي تعجبكِ لتعودي إليها لاحقاً'}</p></header>
      ${items.length ? `<div class="grid">${items.map(p => card(p)).join('')}</div>` : empty('heart', 'لم تحفظي أي قطعة بعد', 'اضغطي على رمز القلب في أي منتج لحفظه هنا.')}</div>`;
    return { html, title: 'المفضلة', nav: 'wishlist' };
  }

  /* ---------- account */
  function account(tab) {
    tab = ['orders', 'profile', 'addresses'].includes(tab) ? tab : 'orders';
    const pr = S.profile || {};
    const lastAddr = S.orders.length ? S.orders[S.orders.length - 1].customer : null;
    const html = `<div class="wrap"><header class="phead"><h1>حسابي<span class="la" lang="en">My Account</span></h1><p>طلباتكِ وبياناتكِ في مكان واحد</p></header>
      <div class="acct">
        <nav aria-label="أقسام الحساب" id="atabs">
          <button type="button" data-t="orders" class="${tab === 'orders' ? 'on' : ''}">${ic('box')}طلباتي</button>
          <button type="button" data-t="profile" class="${tab === 'profile' ? 'on' : ''}">${ic('user')}بياناتي</button>
          <button type="button" data-t="addresses" class="${tab === 'addresses' ? 'on' : ''}">${ic('pin')}عناويني</button>
          <a href="#wishlist" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px">${ic('heart')}المفضلة</a>
        </nav>
        <div>
          <section data-p="orders" ${tab === 'orders' ? '' : 'hidden'}>
            ${S.orders.length ? `<div style="display:grid;gap:12px">${[...S.orders].reverse().map(o => `<a class="order" href="#order-${o.no}">
              <div class="pics">${o.items.slice(0, 3).map(i => `<img src="${(P[i.id] && P[i.id].colors.find(c => c.key === i.color) || {}).img || ''}" alt="">`).join('')}</div>
              <div><b>${o.no}</b><span>${fmtDate(o.date)} · ${o.items.reduce((a, i) => a + i.qty, 0)} قطع</span></div>
              <div style="text-align:left"><span class="status">قيد التجهيز</span><div class="num" style="font-weight:600;margin-top:4px">${money(o.total)}</div></div></a>`).join('')}</div>`
              : empty('box', 'لا توجد طلبات بعد', 'عندما تُتمّين أول طلب سيظهر هنا مع حالته.')}
          </section>
          <section data-p="profile" ${tab === 'profile' ? '' : 'hidden'}><form class="panel" id="pform" novalidate><h2>${ic('user')}بياناتي</h2>
            <div class="fgrid">
              <div class="field"><label for="pf-name">الاسم</label><input class="input" id="pf-name" name="name" value="${esc(pr.name || '')}" autocomplete="name"></div>
              <div class="field"><label for="pf-phone">رقم الجوال</label><div class="phone"><span>+966</span><input class="input" id="pf-phone" name="phone" inputmode="tel" value="${esc(pr.phone || '')}" placeholder="5XXXXXXXX" autocomplete="tel-national"></div></div>
              <div class="field full"><label for="pf-email">البريد الإلكتروني <span>(اختياري)</span></label><input class="input" id="pf-email" name="email" type="email" value="${esc(pr.email || '')}" autocomplete="email" dir="ltr"></div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;margin-top:18px;flex-wrap:wrap"><button class="btn btn-primary" type="submit">حفظ البيانات</button><span style="font-size:12.5px;color:var(--muted)">تُحفظ بياناتكِ على هذا الجهاز فقط في النسخة التجريبية.</span></div></form></section>
          <section data-p="addresses" ${tab === 'addresses' ? '' : 'hidden'}>${lastAddr ? `<div class="panel"><h2>${ic('pin')}عنوان التوصيل الأخير</h2><p style="margin:0;color:var(--ink-2)">${esc(lastAddr.name)}<br>${esc(lastAddr.city)}، ${esc(lastAddr.district)}<br>${esc(lastAddr.address)}<br><span class="ltr">+966 ${esc(lastAddr.phone)}</span></p></div>` : empty('pin', 'لا توجد عناوين محفوظة', 'يُحفظ عنوانكِ تلقائياً عند إتمام أول طلب.')}</section>
        </div>
      </div></div>`;
    function mount() {
      $('#atabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; $$('#atabs [data-t]').forEach(x => x.classList.toggle('on', x === b)); $$('[data-p]').forEach(s => { s.hidden = s.dataset.p !== b.dataset.t; }); });
      $('#pform').addEventListener('submit', e => { e.preventDefault(); const f = e.target; S.profile = { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim() }; LS.set('profile', S.profile); toast(`<span class="ok">${ic('tick')}</span><span>حُفظت بياناتكِ</span>`); });
    }
    return { html, title: 'حسابي', nav: 'account', mount };
  }
  const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return iso.slice(0, 10); } };

  /* ---------- checkout */
  const PAY = [
    ['mada', 'بطاقة مدى', 'الدفع المباشر ببطاقتكِ البنكية', 'card'],
    ['card', 'بطاقة ائتمانية', 'فيزا وماستركارد', 'card'],
    ['applepay', 'Apple Pay', 'ادفعي بلمسة من جوالكِ', 'lock'],
    ['tabby', 'تابي', 'قسّميها على 4 دفعات بدون فوائد', 'split'],
    ['tamara', 'تمارا', 'ادفعي لاحقاً أو على دفعات', 'split'],
    ['cod', 'الدفع عند الاستلام', `رسوم إضافية ${C.codFee} ${C.currency}`, 'cash']
  ];
  function checkout() {
    if (!S.cart.length) {
      return { html: `<div class="wrap" style="padding-block:40px">${empty('bag', 'سلتكِ فارغة', 'أضيفي القطع التي تعجبكِ ثم عودي لإتمام الطلب.')}</div>`, title: 'إتمام الطلب', nav: '' };
    }
    const f = Object.assign({ name: '', phone: '', email: '', city: '', district: '', address: '', notes: '' }, S.profile, S.draft || {});
    const st = { step: 1, method: 'standard', pay: 'mada', gift: false, giftMsg: '' };
    const html = `<div class="wrap">
      <div class="co-head"><a class="round" href="#shop" aria-label="العودة إلى المتجر">${ic('arrow', 'flip')}</a><div><h1>إتمام الطلب</h1><p>خطوتان وتصلكِ حقيبتكِ</p></div></div>
      <div class="co">
        <div>
          <div class="steps" aria-label="مراحل الطلب"><div class="step on" id="s1"><b>1</b>التوصيل</div><hr><div class="step" id="s2"><b>2</b>الدفع</div></div>
          <form class="panel" id="f1" novalidate>
            <h2>${ic('truck')}بيانات التوصيل</h2>
            <div class="fgrid">
              <div class="field full"><label for="c-name">الاسم الكامل</label><input class="input" id="c-name" name="name" value="${esc(f.name)}" autocomplete="name" required><span class="err" data-for="name"></span></div>
              <div class="field"><label for="c-phone">رقم الجوال</label><div class="phone"><span>+966</span><input class="input" id="c-phone" name="phone" inputmode="tel" value="${esc(f.phone)}" placeholder="5XXXXXXXX" autocomplete="tel-national" required></div><span class="err" data-for="phone"></span></div>
              <div class="field"><label for="c-email">البريد الإلكتروني <span>(اختياري)</span></label><input class="input" id="c-email" name="email" type="email" dir="ltr" value="${esc(f.email)}" autocomplete="email"><span class="err" data-for="email"></span></div>
              <div class="field"><label for="c-city">المدينة</label><select class="input" id="c-city" name="city" required><option value="">اختاري المدينة</option>${C.cities.map(x => `<option${x === f.city ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select><span class="err" data-for="city"></span></div>
              <div class="field"><label for="c-district">الحي</label><input class="input" id="c-district" name="district" value="${esc(f.district)}" required><span class="err" data-for="district"></span></div>
              <div class="field full"><label for="c-address">العنوان التفصيلي</label><input class="input" id="c-address" name="address" value="${esc(f.address)}" placeholder="الشارع، رقم المبنى، أو العنوان الوطني المختصر" autocomplete="street-address" required><span class="err" data-for="address"></span></div>
              <div class="field full"><label for="c-notes">ملاحظات للمندوب <span>(اختياري)</span></label><input class="input" id="c-notes" name="notes" value="${esc(f.notes)}"></div>
            </div>
            <h2 style="margin-top:26px">${ic('clock')}طريقة الشحن</h2>
            <div class="opts" id="ship"></div>
            <label class="chk" style="margin-top:18px"><input type="checkbox" id="gift"> <span>أرسليها كهدية: تغليف هدية وبطاقة إهداء بخط اليد، بدون فاتورة داخل الطلب</span></label>
            <div class="field" id="giftBox" hidden style="margin-top:10px"><label for="c-gift">رسالة بطاقة الإهداء</label><textarea class="input" id="c-gift" maxlength="200" placeholder="اكتبي رسالتكِ هنا…"></textarea></div>
            <button class="btn btn-primary btn-block" type="submit" style="margin-top:24px">متابعة إلى الدفع${ic('arrow')}</button>
          </form>
          <form class="panel" id="f2" hidden novalidate>
            <h2>${ic('lock')}طريقة الدفع</h2>
            <div class="opts" id="payopts">${PAY.map(([k, t, s, i]) => `<label class="opt${k === st.pay ? ' on' : ''}"><input type="radio" name="pay" value="${k}"${k === st.pay ? ' checked' : ''}><span class="rd"></span><span class="oi">${ic(i)}</span><span class="ot"><b>${t}</b><span>${s}</span></span></label>`).join('')}</div>
            ${C.demo ? `<div class="note" style="margin-top:18px">${ic('info')}<span>هذه نسخة عرض تجريبية: لن يُطلب منكِ إدخال بيانات بطاقة ولن يُخصم أي مبلغ. في المتجر الحقيقي يتم تحويلكِ إلى بوابة الدفع الآمنة لإكمال العملية.</span></div>` : ''}
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:22px"><button class="btn btn-primary" type="submit" style="flex:1" id="placeBtn">تأكيد الطلب</button><button class="btn btn-ghost" type="button" id="back1">تعديل بيانات التوصيل</button></div>
          </form>
        </div>
        <aside class="summary" aria-label="ملخص الطلب"><div class="panel" id="sum"></div></aside>
      </div></div>`;
    function renderShip() {
      const t = totals({ method: 'standard' });
      const freeStd = t.sub - t.discount >= C.freeShippingOver;
      $('#ship').innerHTML = ['standard', 'express'].map(k => {
        const m = C.shipping[k]; const price = k === 'standard' && freeStd ? 0 : m.price;
        return `<label class="opt${st.method === k ? ' on' : ''}"><input type="radio" name="method" value="${k}"${st.method === k ? ' checked' : ''}><span class="rd"></span><span class="ot"><b>${m.label}</b><span>${esc(m.days)}</span></span><span class="ov${price ? '' : ' free'}">${price ? money(price) : 'مجاني'}</span></label>`;
      }).join('');
    }
    function renderSum() {
      const t = totals({ method: st.method, pay: st.step === 2 ? st.pay : '' });
      $('#sum').innerHTML = `<h2 style="margin-bottom:6px">ملخص الطلب</h2>
        ${S.cart.map(i => { const p = P[i.id]; const c = p.colors.find(x => x.key === i.color); return `<div class="sum-item"><img src="${c.img}" alt=""><div><b>${esc(p.ar)}</b><span>${esc(colorOf(i.color).ar)} · الكمية ${i.qty}</span></div><span class="num" style="font-weight:600">${money(p.price * i.qty)}</span></div>`; }).join('')}
        <form class="coupon" id="cpf"><label class="sr" for="cp">كود الخصم</label><input class="input" id="cp" placeholder="كود الخصم" value="${esc(S.coupon || '')}" autocomplete="off"><button class="btn btn-ghost" type="submit">تطبيق</button></form>
        ${S.coupon ? `<div style="font-size:12.5px;color:var(--ok);margin-top:-4px">${esc(C.coupons[S.coupon].label)} <button type="button" id="cprm" class="link" style="font-size:12.5px">إزالة</button></div>` : `<div style="font-size:12px;color:var(--muted);margin-top:-4px">جرّبي الكود <b class="ltr">ZOVA10</b> في النسخة التجريبية</div>`}
        <div class="sumrow"><span>المجموع الفرعي</span><span class="num">${money(t.sub)}</span></div>
        ${t.discount ? `<div class="sumrow"><span>الخصم</span><span class="num" style="color:var(--ok)">- ${money(t.discount)}</span></div>` : ''}
        <div class="sumrow"><span>الشحن</span>${t.ship ? `<span class="num">${money(t.ship)}</span>` : '<span class="free">مجاني</span>'}</div>
        ${t.cod ? `<div class="sumrow"><span>رسوم الدفع عند الاستلام</span><span class="num">${money(t.cod)}</span></div>` : ''}
        <div class="sumrow total"><span>الإجمالي</span><span class="num">${money(t.total)}</span></div>
        <div style="font-size:12px;color:var(--muted)">شامل ضريبة القيمة المضافة ${Math.round(C.vatRate * 100)}%: <span class="num">${money(t.vat)}</span></div>`;
      $('#placeBtn').textContent = `تأكيد الطلب — ${money(t.total)}`;
    }
    function validate(form) {
      const v = Object.fromEntries(new FormData(form).entries());
      const errs = {};
      if (!v.name || v.name.trim().length < 3) errs.name = 'اكتبي اسمكِ الكامل.';
      const ph = (v.phone || '').replace(/\D/g, '').replace(/^966/, '').replace(/^0/, '');
      if (!/^5\d{8}$/.test(ph)) errs.phone = 'رقم الجوال يبدأ بـ 5 ويتكون من 9 أرقام، مثل 5XXXXXXXX.';
      if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errs.email = 'تأكدي من صيغة البريد الإلكتروني.';
      if (!v.city) errs.city = 'اختاري مدينة التوصيل.';
      if (!v.district || !v.district.trim()) errs.district = 'اكتبي اسم الحي.';
      if (!v.address || v.address.trim().length < 5) errs.address = 'اكتبي العنوان بتفصيل يكفي للمندوب.';
      $$('.err', form).forEach(el => { el.textContent = errs[el.dataset.for] || ''; });
      $$('.input', form).forEach(el => el.classList.toggle('bad', !!errs[el.name]));
      v.phone = ph;
      return Object.keys(errs).length ? (form.querySelector('.bad') && form.querySelector('.bad').focus(), null) : v;
    }
    function mount() {
      renderShip(); renderSum();
      S.onCart = () => { if (!S.cart.length) render(); else { renderShip(); renderSum(); } };
      cleanup.push(() => { S.onCart = null; });
      let data = null;
      $('#f1').addEventListener('input', e => { const f1 = e.currentTarget; S.draft = Object.fromEntries(new FormData(f1).entries()); });
      $('#ship').addEventListener('change', e => { st.method = e.target.value; renderShip(); renderSum(); });
      $('#gift').addEventListener('change', e => { st.gift = e.target.checked; $('#giftBox').hidden = !st.gift; });
      $('#f1').addEventListener('submit', e => {
        e.preventDefault(); data = validate(e.target); if (!data) return;
        st.step = 2; $('#f1').hidden = true; $('#f2').hidden = false;
        $('#s1').className = 'step done'; $('#s1 b').innerHTML = ic('tick'); $('#s2').className = 'step on';
        renderSum(); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      });
      $('#back1').addEventListener('click', () => { st.step = 1; $('#f1').hidden = false; $('#f2').hidden = true; $('#s1').className = 'step on'; $('#s1 b').textContent = '1'; $('#s2').className = 'step'; renderSum(); });
      $('#payopts').addEventListener('change', e => { st.pay = e.target.value; $$('#payopts .opt').forEach(o => o.classList.toggle('on', o.querySelector('input').checked)); renderSum(); });
      $('#sum').addEventListener('submit', e => {
        if (e.target.id !== 'cpf') return; e.preventDefault();
        const code = $('#cp').value.trim().toUpperCase();
        if (C.coupons[code]) { S.coupon = code; toast(`<span class="ok">${ic('tag')}</span><span>تم تطبيق الكود: ${esc(C.coupons[code].label)}</span>`); }
        else { S.coupon = null; toast(`<span class="ok">${ic('info')}</span><span>الكود غير صالح، تأكدي من كتابته.</span>`); }
        renderShip(); renderSum();
      });
      $('#sum').addEventListener('click', e => { if (e.target.id === 'cprm') { S.coupon = null; renderShip(); renderSum(); } });
      $('#f2').addEventListener('submit', e => {
        e.preventDefault(); if (!data) return;
        const t = totals({ method: st.method, pay: st.pay });
        const no = 'ZV' + String(Date.now()).slice(-6) + Math.floor(Math.random() * 10);
        const order = { no, date: new Date().toISOString(), items: S.cart.map(i => ({ id: i.id, color: i.color, qty: i.qty, price: P[i.id].price })),
          sub: t.sub, discount: t.discount, ship: t.ship, cod: t.cod, total: t.total, vat: t.vat, method: st.method, pay: st.pay,
          gift: st.gift ? { msg: ($('#c-gift').value || '').trim() } : null, customer: data, coupon: S.coupon };
        S.orders.push(order); LS.set('orders', S.orders.slice(-20));
        S.profile = Object.assign({}, S.profile, { name: data.name, phone: data.phone, email: data.email, city: data.city, district: data.district, address: data.address });
        LS.set('profile', S.profile);
        S.onCart = null; S.cart = []; S.coupon = null; S.draft = null; saveCart();
        location.hash = 'order-' + no;
      });
    }
    return { html, title: 'إتمام الطلب', nav: '', mount };
  }

  function orderPage(no) {
    const o = S.orders.find(x => x.no === no);
    if (!o) return { html: `<div class="wrap" style="padding-block:40px">${empty('box', 'لم نجد هذا الطلب', 'قد يكون الطلب محفوظاً على جهاز آخر.', '<a class="btn btn-primary" href="#account">طلباتي</a>')}</div>`, title: 'الطلب' };
    const first = (o.customer.name || '').split(' ')[0];
    const payName = (PAY.find(p => p[0] === o.pay) || [])[1];
    const ship = C.shipping[o.method];
    const wa = C.whatsapp ? `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(waText(o))}` : '';
    const html = `<div class="wrap"><section class="success">
      <div class="tickc">${ic('tick')}</div>
      <h1>شكراً لكِ${first ? ` يا ${esc(first)}` : ''}!</h1>
      <p style="color:var(--ink-2);margin:8px 0 0">تم تسجيل طلبكِ بنجاح، وسنبدأ بتجهيزه وتغليفه بعناية.</p>
      <span class="ono">${o.no}</span>
      ${C.demo ? `<div class="note" style="margin:22px auto 0;max-width:560px;text-align:start">${ic('info')}<span>نسخة عرض تجريبية: لم يُرسل الطلب إلى أي جهة ولم يُخصم أي مبلغ. يُحفظ الطلب على هذا الجهاز فقط لتجربة صفحة «طلباتي».</span></div>` : ''}
      <div class="timeline"><div>${ic('check')}<b>تأكيد الطلب</b>تم الآن</div><div>${ic('gift')}<b>التجهيز والتغليف</b>خلال يوم عمل</div><div>${ic('truck')}<b>الشحن والتوصيل</b>${esc(ship ? ship.days : '')}</div></div>
      <div class="panel" style="text-align:start;display:grid;gap:10px">
        ${o.items.map(i => { const p = P[i.id]; if (!p) return ''; const c = p.colors.find(x => x.key === i.color) || p.colors[0]; return `<div class="sum-item"><img src="${c.img}" alt=""><div><b>${esc(p.ar)}</b><span>${esc(colorOf(i.color).ar)} · الكمية ${i.qty}</span></div><span class="num" style="font-weight:600">${money(i.price * i.qty)}</span></div>`; }).join('')}
        <div class="sumrow" style="margin-top:6px"><span>طريقة الدفع</span><span>${esc(payName || '')}</span></div>
        <div class="sumrow"><span>الشحن</span><span>${esc(ship ? ship.label : '')} · ${o.ship ? `<span class="num">${money(o.ship)}</span>` : 'مجاني'}</span></div>
        ${o.discount ? `<div class="sumrow"><span>الخصم</span><span class="num">- ${money(o.discount)}</span></div>` : ''}
        ${o.cod ? `<div class="sumrow"><span>رسوم الدفع عند الاستلام</span><span class="num">${money(o.cod)}</span></div>` : ''}
        <div class="sumrow total"><span>الإجمالي</span><span class="num">${money(o.total)}</span></div>
        <div class="sumrow" style="font-size:13px"><span>التوصيل إلى</span><span>${esc(o.customer.city)}، ${esc(o.customer.district)}</span></div>
      </div>
      <div class="cta-row" style="justify-content:center">
        <a class="btn btn-primary" href="#shop">متابعة التسوق</a>
        ${wa ? `<a class="btn btn-ghost" href="${wa}" target="_blank" rel="noopener">${ic('chat')}إرسال الطلب عبر واتساب</a>` : ''}
        <a class="btn btn-ghost" href="#account">طلباتي</a>
      </div>
    </section></div>`;
    return { html, title: 'تم استلام طلبكِ', nav: 'account' };
  }
  function waText(o) {
    const lines = [`طلب جديد من متجر زوفا`, `رقم الطلب: ${o.no}`, `الاسم: ${o.customer.name}`, `الجوال: +966${o.customer.phone}`, `المدينة: ${o.customer.city} - ${o.customer.district}`, `العنوان: ${o.customer.address}`, '', 'المنتجات:'];
    o.items.forEach(i => { const p = P[i.id]; if (p) lines.push(`- ${p.ar} (${colorOf(i.color).ar}) × ${i.qty} = ${money(i.price * i.qty)}`); });
    lines.push('', `الإجمالي: ${money(o.total)}`, `الدفع: ${(PAY.find(p => p[0] === o.pay) || [])[1] || ''}`);
    if (o.gift) lines.push(`هدية: نعم${o.gift.msg ? ` — ${o.gift.msg}` : ''}`);
    return lines.join('\n');
  }

  /* ---------- info pages */
  const DOCS = {
    faq: ['الأسئلة الشائعة', 'FAQ', () => `<div class="faq">${[
      ['هل حقائبكم من ماركات عالمية؟', 'لا. حقائب زوفا تصاميم عصرية مختارة بعناية بجودة ممتازة، وهي غير تابعة لأي ماركة أو دار أزياء عالمية، ولذلك أسعارها مناسبة.'],
      ['كم سعر الحقائب الآن؟', `جميع الحقائب حالياً بـ ${money(OFFER.now)} بدلاً من ${money(OFFER.before)}، بخصم ${OFFER.percent}% لفترة محدودة.`],
      ['متى يصل طلبي؟', `التوصيل العادي خلال ${C.shipping.standard.days} داخل المملكة، والتوصيل السريع خلال ${C.shipping.express.days}.`],
      ['هل الشحن مجاني؟', `نعم، الشحن العادي مجاني للطلبات فوق ${C.freeShippingOver} ${C.currency}، وأقل من ذلك برسوم ${money(C.shipping.standard.price)}.`],
      ['ما طرق الدفع المتاحة؟', `مدى، البطاقات الائتمانية، Apple Pay، التقسيط مع تابي وتمارا، والدفع عند الاستلام برسوم ${money(C.codFee)}.`],
      ['هل الأسعار شاملة الضريبة؟', `نعم، جميع الأسعار المعروضة شاملة ضريبة القيمة المضافة ${Math.round(C.vatRate * 100)}%.`],
      ['كيف أسترجع أو أستبدل قطعة؟', `يمكنكِ طلب الاسترجاع أو الاستبدال خلال ${C.returnsDays} يوماً من الاستلام إذا كانت القطعة بحالتها الأصلية مع التغليف والبطاقات.`],
      ['هل يمكن إرسال الطلب كهدية؟', 'نعم، اختاري «أرسليها كهدية» عند إتمام الطلب، وسنضيف بطاقة إهداء بخط اليد دون فاتورة داخل الطلب.'],
      ['هل الألوان في الصور مطابقة للواقع؟', 'نحرص على أن تكون الصور قريبة من اللون الحقيقي، وقد يختلف اللون قليلاً حسب إعدادات شاشتكِ.'],
      ['كيف أعتني بحقيبتي؟', 'احفظيها في كيس قماشي بعيداً عن الشمس والرطوبة، وتجدين نصائح أكثر في صفحة العناية بالحقيبة.']
    ].map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${q}${ic('plus')}</summary><p>${a}</p></details>`).join('')}</div>`],
    shipping: ['الشحن والتوصيل', 'Shipping', () => `<div class="doc"><p>نوصل طلباتكِ إلى جميع مناطق المملكة عبر شركات شحن موثوقة، ويصلكِ رقم تتبع برسالة نصية فور شحن الطلب.</p>
      <h2>خيارات التوصيل</h2><ul><li><b>${C.shipping.standard.label}:</b> ${C.shipping.standard.days} — ${money(C.shipping.standard.price)}، ومجاني للطلبات فوق ${C.freeShippingOver} ${C.currency}.</li><li><b>${C.shipping.express.label}:</b> ${C.shipping.express.days} — ${money(C.shipping.express.price)}.</li></ul>
      <h2>التجهيز</h2><p>نجهّز الطلبات خلال يوم عمل واحد، ونغلّف كل قطعة بعناية قبل شحنها.</p></div>`],
    returns: ['الاسترجاع والاستبدال', 'Returns', () => `<div class="doc"><p>نريدكِ أن تحبي حقيبتكِ. إن لم تكن كما توقعتِ فيمكنكِ استرجاعها أو استبدالها خلال ${C.returnsDays} يوماً من الاستلام.</p>
      <h2>الشروط</h2><ul><li>أن تكون القطعة غير مستخدمة وبحالتها الأصلية.</li><li>أن تُعاد مع تغليفها الأصلي والبطاقات المرفقة بها.</li><li>لا يشمل الاسترجاع القطع المخفّضة بنسبة تزيد على 30% ما لم يكن بها عيب مصنعي.</li></ul>
      <h2>طريقة الاسترجاع</h2><p>تواصلي معنا برقم الطلب، وسنرتب استلام القطعة من عنوانكِ، ويُعاد المبلغ إلى وسيلة الدفع نفسها خلال 5–10 أيام عمل من فحصها.</p></div>`],
    care: ['العناية بالحقيبة', 'Care Guide', () => `<div class="doc"><p>حقيبتكِ من زوفا صُنعت لترافقكِ طويلاً، وهذه نصائح بسيطة تحافظ على جمالها:</p>
      <ul><li>احفظيها في كيس قماشي بعيداً عن الشمس المباشرة والحرارة والرطوبة.</li><li>املئيها بورق ناعم عند التخزين لتحافظ على شكلها، ولا تعلّقيها من المقبض لفترات طويلة.</li><li>امسحي البقع فوراً بقطعة قماش ناعمة ومبللة قليلاً، وجففيها في الظل.</li><li>أبعدي العطور ومستحضرات التجميل والمعقمات عن السطح والقطع المعدنية الذهبية.</li><li>لحقائب الشامواه: تجنبي الماء، واستخدمي فرشاة ناعمة لإزالة الغبار.</li></ul></div>`],
    privacy: ['سياسة الخصوصية', 'Privacy', () => `<div class="doc"><p>نحترم خصوصيتكِ ونستخدم بياناتكِ فقط لإتمام طلباتكِ وتحسين تجربتكِ.</p><h2>البيانات التي نجمعها</h2><ul><li>الاسم ورقم الجوال والعنوان لإتمام التوصيل.</li><li>البريد الإلكتروني إن أضفتِه لإرسال تأكيد الطلب.</li></ul><h2>حماية البيانات</h2><p>لا نبيع بياناتكِ لأي طرف، ولا نشاركها إلا مع شركات الشحن والدفع بالقدر اللازم لتنفيذ الطلب.</p><p class="ph-note">نص مبدئي للعرض — يُستبدل بسياسة المتجر المعتمدة قبل الإطلاق.</p></div>`],
    terms: ['الشروط والأحكام', 'Terms', () => `<div class="doc"><p>باستخدامكِ متجر زوفا فإنكِ توافقين على الشروط التالية:</p><ul><li>الأسعار بالريال السعودي وشاملة ضريبة القيمة المضافة.</li><li>يُؤكَّد الطلب بعد إتمام الدفع أو اختيار الدفع عند الاستلام.</li><li>تخضع العروض لتوفر الكمية وفترة العرض المعلنة.</li><li>تُطبق سياسة الاسترجاع والاستبدال الموضحة في صفحتها.</li></ul><p class="ph-note">نص مبدئي للعرض — يُستبدل بالشروط المعتمدة قبل الإطلاق.</p></div>`],
    contact: ['تواصلي معنا', 'Contact', () => `<div class="contact">
      <div class="cinfo">
        <div><i>${ic('chat')}</i><span><b>واتساب</b><span class="ltr">${esc(C.whatsapp ? '+' + C.whatsapp : C.contact.phone)}</span></span></div>
        <div><i>${ic('mail')}</i><span><b>البريد الإلكتروني</b><span class="ltr">${esc(C.contact.email)}</span></span></div>
        <div><i>${ic('clock')}</i><span><b>ساعات العمل</b><span>${esc(C.contact.hours)}</span></span></div>
      </div>
      <form class="panel" id="cform" novalidate><h2>${ic('mail')}أرسلي رسالتكِ</h2><div class="fgrid">
        <div class="field"><label for="m-name">الاسم</label><input class="input" id="m-name" name="name" required></div>
        <div class="field"><label for="m-phone">رقم الجوال</label><div class="phone"><span>+966</span><input class="input" id="m-phone" name="phone" inputmode="tel" placeholder="5XXXXXXXX"></div></div>
        <div class="field full"><label for="m-topic">الموضوع</label><select class="input" id="m-topic" name="topic"><option>استفسار عن منتج</option><option>طلب قائم</option><option>استرجاع أو استبدال</option><option>أخرى</option></select></div>
        <div class="field full"><label for="m-msg">الرسالة</label><textarea class="input" id="m-msg" name="msg" required></textarea></div></div>
        <button class="btn btn-primary" type="submit" style="margin-top:18px">إرسال</button></form></div>`]
  };
  function doc(key) {
    const d = DOCS[key];
    const html = `<div class="wrap"><header class="phead"><h1>${d[0]}<span class="la" lang="en">${d[1]}</span></h1></header>${d[2]()}
      <div class="panel" style="margin-top:40px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><b>لم تجدي ما تبحثين عنه؟</b><p style="margin:2px 0 0;color:var(--muted);font-size:14px">فريق زوفا يسعد بمساعدتكِ.</p></div><a class="btn btn-dark" href="#contact">تواصلي معنا</a></div></div>`;
    const mount = key === 'contact' ? () => $('#cform').addEventListener('submit', e => {
      e.preventDefault(); const f = e.target;
      if (!f.name.value.trim() || !f.msg.value.trim()) { toast(`<span class="ok">${ic('info')}</span><span>اكتبي اسمكِ ورسالتكِ أولاً.</span>`); return; }
      f.reset(); toast(`<span class="ok">${ic('tick')}</span><span>${C.demo ? 'تمت التجربة: في المتجر الحقيقي تصل رسالتكِ مباشرة إلى فريق زوفا.' : 'وصلتنا رسالتكِ، وسنرد عليكِ قريباً.'}</span>`, 4200);
    }) : null;
    return { html, title: d[0], nav: '', mount };
  }
  function notFound() {
    return { html: `<div class="wrap" style="padding-block:48px">${empty('question', 'الصفحة غير موجودة', 'ربما تغيّر الرابط، جرّبي العودة إلى الرئيسية.', '<a class="btn btn-primary" href="#">الرئيسية</a>')}</div>`, title: 'غير موجودة' };
  }

  /* ------------------------------------------------------------ home mount */
  function mountHome() {
    const H = D.hero; let i = 0, t = null, paused = false;
    const copy = $('#heroCopy'), bento = $('#bento');
    function show(n, user) {
      i = (n + H.length) % H.length; const p = P[H[i]];
      copy.classList.add('swap');
      setTimeout(() => {
        const keep = $$('.pill, .hero-ctrl', copy);
        copy.innerHTML = ''; copy.appendChild(keep[0]);
        copy.insertAdjacentHTML('beforeend', heroCopy(p)); copy.appendChild(keep[1]);
        requestAnimationFrame(() => copy.classList.remove('swap'));
        bento.innerHTML = bentoHTML(i);
      }, reduced ? 0 : 280);
      $$('#heroDots button').forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-current', k === i); });
      const strip = $('#strip');
      $$('.strip-item', strip).forEach(s => s.classList.toggle('on', s.dataset.id === p.id));
      const on = $(`.strip-item[data-id="${p.id}"]`, strip);
      if (on) { const r = on.getBoundingClientRect(), sr = strip.getBoundingClientRect(); if (r.left < sr.left || r.right > sr.right) strip.scrollBy({ left: r.right > sr.right ? r.right - sr.right + 12 : r.left - sr.left - 12, behavior: reduced ? 'auto' : 'smooth' }); }
      if (user) restart();
    }
    function restart() { clearInterval(t); if (!reduced) t = setInterval(() => { if (!paused && !document.hidden) show(i + 1); }, 6500); }
    heroCtl = { show: k => show(k, true), step: d => show(i + d, true) };
    const hero = $('#hero');
    hero.addEventListener('mouseenter', () => { paused = true; }); hero.addEventListener('mouseleave', () => { paused = false; });
    hero.addEventListener('focusin', () => { paused = true; }); hero.addEventListener('focusout', () => { paused = false; });
    restart();
    cleanup.push(() => { clearInterval(t); heroCtl = null; });
    const strip = $('#strip'), bar = $('#stripBar');
    const upd = () => { const max = strip.scrollWidth - strip.clientWidth; const frac = strip.clientWidth / strip.scrollWidth; bar.style.width = (frac * 100) + '%'; const pos = max > 0 ? Math.abs(strip.scrollLeft) / max : 0; bar.style.transform = `translateX(${-pos * (1 - frac) / frac * 100}%)`; };
    strip.addEventListener('scroll', upd, { passive: true }); upd();
    startCountdown('#cd1');
  }
  let heroCtl = null;
  function startCountdown(sel) {
    const el = $(sel); if (!el) return;
    const end = Date.parse(C.saleEndsAt);
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      let s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      if (!s) { el.remove(); clearInterval(tm); return; }
      const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
      el.querySelector('[data-u="d"]').textContent = pad(d); el.querySelector('[data-u="h"]').textContent = pad(h);
      el.querySelector('[data-u="m"]').textContent = pad(m); el.querySelector('[data-u="s"]').textContent = pad(s);
    };
    const tm = setInterval(tick, 1000); tick(); cleanup.push(() => clearInterval(tm));
  }

  /* ------------------------------------------------------------ card swatches + carousels */
  function swatch(b) {
    const cardEl = b.closest('[data-card]'); if (!cardEl) return;
    const p = P[b.dataset.id]; const c = p.colors.find(x => x.key === b.dataset.color); if (!c) return;
    $$('.sw button', cardEl).forEach(x => x.classList.toggle('on', x === b));
    const img = $('.card-media img', cardEl); img.src = c.img; img.alt = `${nounOf(p)}${p.ar} باللون ${colorOf(c.key).ar}`;
    const add = $('[data-act="add"]', cardEl); if (add) add.dataset.color = c.key;
    $$('a[href^="#p-"]', cardEl).forEach(a => { a.href = `#p-${p.id}-${c.key}`; });
  }
  function scrollTrack(id, dir) {
    const tr = document.getElementById(id); if (!tr) return;
    const rtl = getComputedStyle(tr).direction === 'rtl';
    tr.scrollBy({ left: (rtl ? -1 : 1) * dir * tr.clientWidth * .82, behavior: reduced ? 'auto' : 'smooth' });
  }

  /* ------------------------------------------------------------ overlays */
  let lastFocus = null;
  function openLayer(id) {
    closeLayers(true);
    lastFocus = document.activeElement;
    const el = $('#' + id); el.classList.add('on'); el.setAttribute('aria-hidden', 'false');
    if (id !== 'search') $('#scrim').classList.add('on');
    document.body.classList.add('lock');
    setTimeout(() => { const f = el.querySelector('input') || el.querySelector('.dh [data-act="close"]') || el.querySelector('button, a[href]'); if (f) f.focus({ preventScroll: true }); }, 60);
  }
  function closeLayers(silent) {
    let any = false;
    $$('.drawer.on, .search.on').forEach(el => { el.classList.remove('on'); el.setAttribute('aria-hidden', 'true'); any = true; });
    $('#scrim').classList.remove('on'); document.body.classList.remove('lock');
    if (any && !silent && lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openCart() { $('#toasts').innerHTML = ''; renderCart(); openLayer('cart'); }
  function renderCart() {
    const t = totals();
    const left = Math.max(0, C.freeShippingOver - (t.sub - t.discount));
    $('#cartN').textContent = t.count ? `(${t.count} ${t.count > 2 && t.count < 11 ? 'قطع' : 'قطعة'})` : '';
    $('#cartBody').innerHTML = S.cart.length ? `
      <div class="ship-meter">${left > 0 ? `أضيفي <b class="num">${money(left)}</b> للحصول على شحن مجاني` : `<b>رائع!</b> طلبكِ مؤهل للشحن المجاني`}<div class="bar"><i style="width:${Math.min(100, (t.sub - t.discount) / C.freeShippingOver * 100)}%"></i></div></div>
      ${S.cart.map((i, k) => { const p = P[i.id]; const c = p.colors.find(x => x.key === i.color); return `<div class="line-item"><a href="#p-${p.id}-${c.key}"><img src="${c.img}" alt="${esc(p.ar)}"></a><div><b><a href="#p-${p.id}-${c.key}">${esc(p.ar)}</a></b><span class="meta"><i style="background:${colorOf(c.key).hex}"></i>${esc(colorOf(c.key).ar)}</span><div class="p num">${money(p.price)}</div></div>
        <div class="side"><button type="button" class="rm" data-act="rm" data-i="${k}" aria-label="حذف ${esc(p.ar)}">${ic('trash')}</button><div class="qty sm"><button type="button" data-act="qty" data-i="${k}" data-d="1" aria-label="زيادة">${ic('plus')}</button><output>${i.qty}</output><button type="button" data-act="qty" data-i="${k}" data-d="-1" aria-label="إنقاص">${ic('minus')}</button></div></div></div>`; }).join('')}`
      : empty('bag', 'سلتكِ فارغة', 'ابدئي بإضافة القطع التي تعجبكِ.', '<a class="btn btn-primary" href="#shop" data-act="close">تصفّحي المتجر</a>');
    $('#cartFoot').hidden = !S.cart.length;
    $('#cartFoot').innerHTML = `<div class="sumrow"><span>المجموع الفرعي</span><span class="num">${money(t.sub)}</span></div>
      <div class="sumrow"><span>الشحن</span>${t.ship ? `<span class="num">${money(t.ship)}</span>` : '<span class="free">مجاني</span>'}</div>
      <div class="sumrow total"><span>الإجمالي</span><span class="num">${money(t.total)}</span></div>
      <a class="btn btn-primary btn-block" href="#checkout" data-act="close" style="margin-top:6px">إتمام الطلب${ic('arrow')}</a>
      <button type="button" class="btn btn-ghost btn-block btn-sm" data-act="close">متابعة التسوق</button>`;
  }
  function searchResults(q) {
    const box = $('#sres');
    if (!q) { box.hidden = true; return; }
    const w = norm(q).split(/\s+/).filter(Boolean);
    const list = D.products.filter(p => { const hay = norm([p.ar, p.en, p.typeAr, p.typeEn, CAT[p.cat], ...p.colors.map(c => colorOf(c.key).ar + ' ' + colorOf(c.key).en)].join(' ')); return w.every(x => hay.includes(x)); }).slice(0, 7);
    box.hidden = false;
    box.innerHTML = list.length ? list.map(p => `<a href="#p-${p.id}" data-act="close"><img src="${p.colors[0].img}" alt=""><span class="n"><b>${esc(p.ar)} <span class="la" lang="en" style="color:var(--mauve);font-weight:500">${esc(p.en)}</span></b><span>${esc(CAT[p.cat])} · ${p.colors.length === 1 ? 'لون واحد' : (p.colors.length === 2 ? 'لونان' : p.colors.length + ' ألوان')}</span></span><span class="pr num">${money(p.price)}</span>${ic('chevron')}</a>`).join('')
      + `<a href="#shop" data-act="close" data-q="${esc(q)}" style="justify-content:center;color:var(--mauve-700);font-weight:500">عرض كل النتائج في المتجر</a>`
      : `<div class="none">لا توجد نتائج لـ «${esc(q)}». جرّبي: دلو، هلالية، عنابي.</div>`;
  }

  /* ------------------------------------------------------------ shell */
  function shell() {
    const tb = $('#topbar');
    if (tb && OFFER.percent) tb.innerHTML = `<div class="wrap"><span>${ic('tag')}<b>خصم ${OFFER.percent}% على جميع الحقائب</b><span class="tb-p">كانت <s class="num">${money(OFFER.before)}</s> والآن <b class="num">${money(OFFER.now)}</b></span></span><a href="#deals">تسوّقي العروض${ic('arrow')}</a></div>`;
    const navs = [['shop', 'المتجر'], ['collections', 'المجموعات'], ['deals', 'العروض'], ['about', 'من نحن']];
    $('#hdr').innerHTML = `<div class="wrap hdr-in">
      <a class="brand" href="#" aria-label="زوفا — الرئيسية">${window.ZOVA_LOGO}</a>
      <nav class="nav" aria-label="القائمة الرئيسية">${navs.map(([k, v]) => `<a href="#${k}" data-nav="${k}">${v}</a>`).join('')}</nav>
      <div class="tools">
        <button type="button" class="ibtn" data-act="search" aria-label="البحث">${ic('search')}</button>
        <a class="ibtn" href="#wishlist" aria-label="المفضلة" data-nav="wishlist">${ic('heart')}<span class="cnt" id="wishCount" hidden></span></a>
        <button type="button" class="ibtn" data-act="cart" aria-label="السلة">${ic('bag')}<span class="cnt" id="cartCount" hidden></span></button>
        <a class="ibtn" href="#account" aria-label="حسابي" data-nav="account">${ic('user')}</a>
        <button type="button" class="ibtn menu-btn" data-act="menu" aria-label="القائمة">${ic('menu')}</button>
      </div></div>`;
    const flinks = {
      'تسوّقي': [['حقائب اليد', '#shop-handbags'], ['حقائب الكتف', '#shop-shoulder'], ['المجموعات', '#collections'], ['العروض', '#deals']],
      'المساعدة': [['تواصلي معنا', '#contact'], ['الشحن والتوصيل', '#shipping'], ['الاسترجاع والاستبدال', '#returns'], ['الأسئلة الشائعة', '#faq']],
      'زوفا': [['من نحن', '#about'], ['العناية بالحقيبة', '#care'], ['سياسة الخصوصية', '#privacy'], ['الشروط والأحكام', '#terms']]
    };
    $('#ftr').innerHTML = `<div class="wrap">
      <div class="news"><div><h3>كوني أول من يعرف</h3><p>عروض خاصة وأحدث القطع تصلكِ أولاً.</p></div>
        <form id="newsf" novalidate><label class="sr" for="nemail">بريدكِ الإلكتروني</label><input id="nemail" type="email" placeholder="بريدكِ الإلكتروني" dir="ltr" autocomplete="email"><button class="btn btn-primary" type="submit">اشتركي${ic('arrow')}</button></form></div>
      <div class="fcols">
        <div><a class="brand" href="#" aria-label="زوفا">${window.ZOVA_LOGO_LIGHT}</a><p class="about">حقائب نسائية بجودة ممتازة وسعر مناسب، مختارة بعناية لتُرافق يومكِ ومناسباتكِ.</p><p class="about honest-f">حقائبنا غير تابعة لأي ماركة أو دار أزياء عالمية.</p><div class="motto" lang="en">Softly Yours</div></div>
        ${Object.entries(flinks).map(([h, l]) => `<div><h4>${h}</h4><ul>${l.map(([t, u]) => `<li><a href="${u}">${t}</a></li>`).join('')}</ul></div>`).join('')}
      </div>
      <div class="fbot"><span>© ${new Date().getFullYear()} زوفا. جميع الحقوق محفوظة · الأسعار شاملة ضريبة القيمة المضافة</span>
        <div class="pay" aria-label="طرق الدفع"><span>مدى</span><span>Visa</span><span>Mastercard</span><span>Apple Pay</span><span>تابي</span><span>تمارا</span></div></div>
    </div>`;
    $('#menuLogo').innerHTML = window.ZOVA_LOGO;
    $('#menu .mnav').innerHTML = `${[['', 'الرئيسية'], ...navs, ['wishlist', 'المفضلة'], ['account', 'حسابي']].map(([k, v]) => `<a href="#${k}" data-nav="${k || 'home'}" data-act="close">${v}${ic('chevron')}</a>`).join('')}
      <h4>تسوّقي حسب النوع</h4>${D.categories.map(c => `<a href="#shop-${c.id}" data-act="close">${c.ar}${ic('chevron')}</a>`).join('')}
      <h4>المساعدة</h4><a href="#contact" data-act="close">تواصلي معنا${ic('chevron')}</a><a href="#faq" data-act="close">الأسئلة الشائعة${ic('chevron')}</a>`;
    $('#chips').innerHTML = ['دلو', 'هلالية', 'عنابي', 'أسود', 'كتف', 'بقفل'].map(t => `<button type="button" data-chip="${t}">${t}</button>`).join('');
    $('#chips').insertAdjacentHTML('afterend', `<p class="slabel">تصفّحي حسب النوع</p><div class="chips">${D.categories.map(c => `<a class="pbtn" href="#shop-${c.id}" data-act="close"><span style="width:20px;height:20px;display:inline-grid">${catIc(CAT_ICON[c.id])}</span>${c.ar}</a>`).join('')}</div>`);
    updateCounts();
  }

  /* ------------------------------------------------------------ router */
  const route = { name: '' };
  let cleanup = [];
  const ROUTES = [
    [/^$/, () => home(), 'home'], [/^shop(?:-([a-z]+))?$/, m => shop(m[1]), 'shop'], [/^collections$/, () => collections(), 'collections'],
    [/^c-([a-z]+)$/, m => collection(m[1]), 'collection'], [/^deals$/, () => deals(), 'deals'], [/^about$/, () => about(), 'about'],
    [/^p-([a-z]+)(?:-([a-z]+))?$/, m => product(m[1], m[2]), 'product'], [/^wishlist$/, () => wishlist(), 'wishlist'],
    [/^account(?:-([a-z]+))?$/, m => account(m[1]), 'account'], [/^checkout$/, () => checkout(), 'checkout'], [/^order-(ZV\d+)$/, m => orderPage(m[1]), 'order'],
    [/^(faq|shipping|returns|contact|care|privacy|terms)$/, m => doc(m[1]), 'doc']
  ];
  function render() {
    cleanup.forEach(f => { try { f(); } catch (e) { /* noop */ } }); cleanup = [];
    closeLayers(true);
    trackN = 0;
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    let out = null;
    for (const [re, fn, name] of ROUTES) { const m = h.match(re); if (m) { out = fn(m); route.name = name; break; } }
    if (!out) { out = notFound(); route.name = '404'; }
    const app = $('#app');
    app.innerHTML = `<div class="glow" aria-hidden="true"></div>${out.html}`;
    document.title = out.title ? `${out.title} | زوفا ZOVA` : 'زوفا ZOVA | حقائب نسائية بجودة ممتازة وسعر مناسب';
    $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === out.nav));
    window.scrollTo(0, 0);
    if (out.mount) out.mount();
  }

  /* ------------------------------------------------------------ events */
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) { location.hash = go.dataset.go; return; }
    const t = e.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act;
    if (a === 'add') { e.preventDefault(); addToCart(t.dataset.id, t.dataset.color); }
    else if (a === 'wish') { e.preventDefault(); toggleWish(t.dataset.id); }
    else if (a === 'sw') { e.preventDefault(); swatch(t); }
    else if (a === 'cart') { e.preventDefault(); openCart(); }
    else if (a === 'search') { openLayer('search'); }
    else if (a === 'menu') { openLayer('menu'); }
    else if (a === 'close') {
      if (t.dataset.q) { S.pendingQ = t.dataset.q; if (location.hash === '#shop') { e.preventDefault(); closeLayers(true); render(); return; } }
      if (t.tagName === 'A' && t.getAttribute('href') === location.hash) { closeLayers(true); return; }
      closeLayers(t.tagName === 'A');
    }
    else if (a === 'prev' || a === 'next') { scrollTrack(t.dataset.for, a === 'next' ? 1 : -1); }
    else if (a === 'hero' && heroCtl) { heroCtl.step(+t.dataset.d); }
    else if (a === 'slide' && heroCtl) { heroCtl.show(+t.dataset.i); }
    else if (a === 'qty') { const it = S.cart[+t.dataset.i]; if (!it) return; it.qty = Math.max(0, Math.min(9, it.qty + +t.dataset.d)); if (!it.qty) S.cart.splice(+t.dataset.i, 1); saveCart(); }
    else if (a === 'rm') { S.cart.splice(+t.dataset.i, 1); saveCart(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLayers(); });
  $('#scrim').addEventListener('click', () => closeLayers());
  $('#search').addEventListener('click', e => { if (e.target.id === 'search' || e.target.classList.contains('sbox')) closeLayers(); const c = e.target.closest('[data-chip]'); if (c) { $('#sq').value = c.dataset.chip; searchResults(c.dataset.chip); $('#sq').focus(); } });
  $('#sq').addEventListener('input', e => searchResults(e.target.value.trim()));
  $('#sq').addEventListener('keydown', e => { if (e.key === 'Enter') { const q = e.target.value.trim(); if (!q) return; S.pendingQ = q; closeLayers(true); if (location.hash === '#shop') render(); else location.hash = 'shop'; } });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'newsf') return; e.preventDefault();
    const v = $('#nemail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast(`<span class="ok">${ic('info')}</span><span>اكتبي بريداً إلكترونياً صحيحاً.</span>`); return; }
    $('#nemail').value = '';
    toast(`<span class="ok">${ic('tick')}</span><span>${C.demo ? 'شكراً لكِ! تُفعَّل النشرة البريدية عند إطلاق المتجر.' : 'شكراً لكِ! ستصلكِ أخبارنا أولاً.'}</span>`, 4000);
  });
  window.addEventListener('hashchange', render);
  const hdrScroll = () => $('#hdr').classList.toggle('scrolled', window.scrollY > 6);
  window.addEventListener('scroll', hdrScroll, { passive: true });

  // apply a search handed over from the search overlay to the shop page
  const _shop = shop;
  shop = function (preset) {
    const out = _shop(preset); const q = S.pendingQ; S.pendingQ = null;
    if (!q) return out;
    const m = out.mount;
    out.mount = () => { m(); const inp = $('#fq'); inp.value = q; inp.dispatchEvent(new Event('input')); };
    return out;
  };

  shell(); render(); hdrScroll();
})();
