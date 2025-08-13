/* =========================
   1) 導覽列：設定高度與隱藏/顯示
   ========================= */
// 1.1 量測 nav 高度，寫到 --nav-h，避免 fixed 造成版面跳動
(function(){
  const nav = document.querySelector('.nav');
  if (!nav) return;

  function setNavH(){
    document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
  }
  setNavH();
  window.addEventListener('resize', setNavH);
  // 字體載入或方向改變時重算
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', setNavH);
  }
  window.addEventListener('orientationchange', setNavH);
})();

// 1.2 向下捲動隱藏、向上顯示（全頁有效）
(function(){
  const nav = document.querySelector('.nav');
  if (!nav) return;

  let lastY = window.scrollY || 0;
  let ticking = false;

  const MIN_DELTA = 8;   // 忽略微小捲動
  const MIN_TOP   = 10;  // 接近頂部時維持顯示

  function onScroll(){
    const y = window.scrollY || 0;
    const delta = y - lastY;

    if (Math.abs(delta) >= MIN_DELTA){
      if (y > MIN_TOP && delta > 0) {
        // 往下捲 -> 隱藏
        nav.classList.add('nav--hidden');
      } else if (delta < 0) {
        // 往上捲 -> 顯示
        nav.classList.remove('nav--hidden');
      }
      lastY = y;
    } else {
      lastY = y;
    }
  }

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });

  // 初始狀態顯示
  nav.classList.remove('nav--hidden');
})();


/* =========================
   2) 無縫膠片帶：照片 + 方孔同速同層移動
   - HTML 只放一組 .frame，這裡啟動時複製一次
   - 以「A 起點到 B 起點」的實際距離作為一輪位移長度
   ========================= */
(function () {
  const belt = document.getElementById('belt');
  if (!belt) return;

  // 2.1 啟動時把既有 frame 複製一次（仍然只需維護一組 HTML）
  const clone = belt.cloneNode(true);
  while (clone.firstElementChild) belt.appendChild(clone.firstElementChild);

  // 2.2 量測一個 set 的實際寬度（A 第一張 與 B 第一張的 left 差）
  let setW = 0;
  function recalc(){
    const frames = belt.querySelectorAll('.frame');
    const half = frames.length / 2 | 0;
    if (!half) return;
    const a = frames[0].getBoundingClientRect();
    const b = frames[half].getBoundingClientRect();
    setW = Math.round(b.left - a.left);
  }

  function onAllImages(cb){
    const imgs = belt.querySelectorAll('img');
    if (!imgs.length) return cb();
    let loaded = 0;
    imgs.forEach(img => {
      if (img.complete) { if (++loaded === imgs.length) cb(); }
      else img.addEventListener('load', () => { if (++loaded === imgs.length) cb(); }, { once: true });
    });
  }

  const speed = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pxps')) || 80;
  let x = 0, last = performance.now();

  function tick(now){
    const dt = (now - last) / 1000;
    last = now;
    x -= speed * dt;

    if (setW > 0 && x <= -setW) {
      // 精準在一組長度處 wrap，避免 ±1px 造成「跳」
      x += setW;
    }

    // 像素對齊，避免 iOS/Safari 重複漸層在副像素上閃爍
    belt.style.transform = `translate3d(${Math.round(x)}px,0,0)`;
    requestAnimationFrame(tick);
  }

  onAllImages(() => {
    recalc();
    requestAnimationFrame(tick);
  });

  // 視窗改變時重量測
  let recalcT;
  window.addEventListener('resize', () => {
    clearTimeout(recalcT);
    recalcT = setTimeout(recalc, 100);
  });
})();


/* =========================
   3) FAQ 下拉動畫（高度與文字同時動）
   - 需要 CSS 配合：
     #faq .faq-item.is-opening .answer__inner > *,
     #faq .faq-item.is-open    .answer__inner > * { opacity:1; transform:translateY(0); }
   ========================= */
(function(){
  const items = document.querySelectorAll('#faq details.faq-item');
  if (!items.length) return;

  items.forEach(d => {
    const summary = d.querySelector('summary');
    const answer  = d.querySelector('.answer');
    const inner   = d.querySelector('.answer__inner');
    if (!summary || !answer || !inner) return;

    // 預設收合（如需預設展開，可自行移除）
    d.removeAttribute('open');
    answer.style.height = '0px';

    summary.addEventListener('click', (e) => {
      e.preventDefault(); // 攔截 details 預設 toggle，改用動畫
      const isOpen = d.classList.contains('is-open');

      if (!isOpen) {
        // 開啟：先設 open 以便量測高度
        d.setAttribute('open','');
        d.classList.add('is-opening'); // 讓文字與高度一起淡入
        const target = inner.scrollHeight;   // 實際內容高度
        // 從 0 動到 target
        answer.style.height = '0px';
        requestAnimationFrame(() => { answer.style.height = target + 'px'; });

        const done = (ev) => {
          if (ev.propertyName !== 'height') return;
          answer.removeEventListener('transitionend', done);
          answer.style.height = 'auto';      // 動畫完改回自適應
          d.classList.remove('is-opening');
          d.classList.add('is-open');
        };
        answer.addEventListener('transitionend', done);

      } else {
        // 關閉：把 auto 鎖成像素，再往 0 收
        const start = answer.offsetHeight;
        answer.style.height = start + 'px';
        // 讓瀏覽器先套用當前高度，再觸發到 0 的過渡
        requestAnimationFrame(() => { answer.style.height = '0px'; });

        const done = (ev) => {
          if (ev.propertyName !== 'height') return;
          answer.removeEventListener('transitionend', done);
          d.classList.remove('is-open');
          d.removeAttribute('open');         // 真正關閉 details
        };
        answer.addEventListener('transitionend', done);
      }
    });
  });

  // ——（可選）手風琴效果：一次只開一題——
  // 若要啟用，把下段解除註解即可
  /*
  document.getElementById('faq')?.addEventListener('toggle', e=>{
    if (e.target.tagName !== 'DETAILS' || !e.target.open) return;
    document.querySelectorAll('#faq details.faq-item.is-open').forEach(d=>{
      if (d !== e.target) {
        const a = d.querySelector('.answer');
        d.classList.remove('is-open');
        d.removeAttribute('open');
        if (a) a.style.height = '0px';
      }
    });
  });
  */
})();
// Smooth scroll for nav links
document.querySelectorAll('.nav a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const targetId = link.getAttribute('href');
    const targetEl = document.querySelector(targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ---------- Responsive nav toggle ----------
(function(){
  const nav    = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  const menu   = document.getElementById('site-menu');
  const backdrop = document.querySelector('.menu-backdrop');
  if (!nav || !toggle || !menu || !backdrop) return;

  function openMenu(){
    nav.classList.add('is-open');
    document.body.classList.add('menu-open');
    toggle.setAttribute('aria-expanded','true');
    backdrop.hidden = false;
  }
  function closeMenu(){
    nav.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded','false');
    backdrop.hidden = true;
  }
  function isOpen(){ return nav.classList.contains('is-open'); }

  // click hamburger
  toggle.addEventListener('click', ()=>{
    isOpen() ? closeMenu() : openMenu();
  });

  // click backdrop closes
  backdrop.addEventListener('click', closeMenu);

  // ESC closes
  window.addEventListener('keydown', e=>{
    if (e.key === 'Escape' && isOpen()) closeMenu();
  });

  // clicking a menu link: smooth scroll (if you added it) + close
  menu.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', ()=>{
      closeMenu();
    });
  });

  // if viewport grows to desktop, ensure menu is closed
  let resizeT;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeT);
    resizeT = setTimeout(()=>{
      if (window.innerWidth > 900) closeMenu();
    }, 100);
  });

  // integrate with your hide-on-scroll: don't auto-hide when menu open
  window.addEventListener('scroll', ()=>{
    if (isOpen()) nav.classList.remove('nav--hidden');
  }, {passive:true});
})();
