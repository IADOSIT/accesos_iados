/* Acceso Digital — iaDoS | main.js v4 */
(function () {
  'use strict';

  // ── Nav scroll ──
  const nav = document.getElementById('navbar');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Mobile menu ──
  const burger = document.getElementById('burger');
  const navLinks = document.getElementById('navLinks');
  burger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    const s = burger.querySelectorAll('span');
    if (open) {
      s[0].style.transform = 'rotate(45deg) translate(5px,5px)';
      s[1].style.opacity = '0';
      s[2].style.transform = 'rotate(-45deg) translate(5px,-5px)';
    } else {
      s.forEach(x => { x.style.transform = ''; x.style.opacity = ''; });
    }
  });
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    burger.querySelectorAll('span').forEach(x => { x.style.transform = ''; x.style.opacity = ''; });
  }));

  // ── Scroll reveal ──
  const revealEls = document.querySelectorAll('.reveal, .reveal-right, .reveal-left');
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); revealIO.unobserve(e.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => revealIO.observe(el));

  // ── Counters ──
  const counters = document.querySelectorAll('[data-count]');
  const counterIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { animateNumber(e.target); counterIO.unobserve(e.target); }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => counterIO.observe(c));
  function animateNumber(el) {
    const target = parseInt(el.dataset.count, 10);
    const dur = 1500, start = performance.now();
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick); else el.textContent = target;
    };
    requestAnimationFrame(tick);
  }

  // ── Admin tabs ──
  const atabs = document.querySelectorAll('.atab');
  const ascreens = document.querySelectorAll('.admin-screen');
  atabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const idx = tab.dataset.tab;
      atabs.forEach(t => t.classList.remove('active'));
      ascreens.forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.admin-screen[data-screen="${idx}"]`)?.classList.add('active');
    });
  });

  // ── App photo carousel (auto + sync with feat items) ──
  const slides = document.querySelectorAll('.asc-slide');
  const dots   = document.querySelectorAll('.cdot');
  const featItems = document.querySelectorAll('.app-feat-item');
  let current = 0, autoTimer;

  function goTo(idx) {
    slides[current]?.classList.remove('active');
    dots[current]?.classList.remove('active');
    featItems[current]?.classList.remove('active');
    current = (idx + slides.length) % slides.length;
    slides[current]?.classList.add('active');
    dots[current]?.classList.add('active');
    featItems[current]?.classList.add('active');
  }

  function startAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(current + 1), 3200);
  }

  dots.forEach((d, i) => d.addEventListener('click', () => { goTo(i); startAuto(); }));
  featItems.forEach((f, i) => f.addEventListener('click', () => { goTo(i); startAuto(); }));

  if (slides.length > 0) startAuto();

  // Pause carousel when out of viewport
  const carouselEl = document.getElementById('appCarousel');
  if (carouselEl) {
    new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) startAuto(); else clearInterval(autoTimer);
      });
    }, { threshold: 0.3 }).observe(carouselEl);
  }

})();

