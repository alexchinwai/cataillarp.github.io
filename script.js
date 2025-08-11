(function () {
  const belt = document.getElementById('belt');
  if (!belt) return;

  // clone existing frames once
  const clone = belt.cloneNode(true);
  while (clone.firstElementChild) belt.appendChild(clone.firstElementChild);

  let setW = 0;
  function recalc() {
    const frames = belt.querySelectorAll('.frame');
    const half = frames.length / 2;
    if (half === 0) return;
    // distance from start of first frame to start of the frame after first set
    const aRect = frames[0].getBoundingClientRect();
    const bRect = frames[half].getBoundingClientRect();
    setW = Math.round(bRect.left - aRect.left);
  }

  function onAllImages(cb) {
    const imgs = belt.querySelectorAll('img');
    let loaded = 0;
    if (!imgs.length) return cb();
    imgs.forEach(img => {
      if (img.complete) { if (++loaded === imgs.length) cb(); }
      else img.addEventListener('load', () => { if (++loaded === imgs.length) cb(); }, { once: true });
    });
  }

  const speed = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pxps')) || 80;
  let x = 0, last = performance.now();

  function tick(now) {
    const dt = (now - last) / 1000;
    last = now;
    x -= speed * dt;

    if (setW > 0) {
      if (x <= -setW) x += setW; // wrap exactly at the measured distance
    }

    belt.style.transform = `translate3d(${x}px,0,0)`;
    requestAnimationFrame(tick);
  }

  onAllImages(() => {
    recalc();
    requestAnimationFrame(tick);
  });

  addEventListener('resize', () => {
    clearTimeout(window.__beltResizeT);
    window.__beltResizeT = setTimeout(recalc, 100);
  });
})();
