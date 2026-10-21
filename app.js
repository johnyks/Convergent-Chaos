(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      }
    }, { threshold: 0.07 });
    revealElements.forEach(element => revealObserver.observe(element));
    document.documentElement.classList.add('js-ready');
    const navigation = [...document.querySelectorAll('.site-header nav a')];
    const sectionObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        navigation.forEach(link => {
          if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }
    }, { rootMargin: '-20% 0px -60% 0px' });
    navigation.forEach(link => {
      const section = document.querySelector(link.hash);
      if (section) sectionObserver.observe(section);
    });
  }

  document.getElementById('copyright-year').textContent = new Date().getFullYear();
  const toyFrame = document.getElementById('fixed-point-toy');
  window.addEventListener('message', event => {
    if (event.source !== toyFrame.contentWindow) return;
    if (location.protocol !== 'file:' && event.origin !== location.origin) return;
    const data = event.data;
    if (data?.type !== 'convergent-chaos:toy-height' || !Number.isFinite(data.height)) return;
    if (data.height < 250 || data.height > 4000) return;
    const height = Math.ceil(data.height);
    if (toyFrame.height !== String(height)) toyFrame.height = String(height);
  });

  // Analytic potential flow around a cylinder. This is an illustration,
  // not a discretized CFD solve. Tracers follow the velocity field below.
  const canvas = document.getElementById('flow-canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  const container = canvas.parentElement;
  let width = 0;
  let height = 0;
  let radius = 1;
  let centerX = 0;
  let centerY = 0;
  let paths = [];
  let frame = 0;
  let isVisible = true;
  let lastTime = 0;
  let elapsed = 0;
  let userPaused = false;
  const motionButton = document.getElementById('flow-motion');
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function velocity(x, y) {
    const squared = x * x + y * y;
    if (squared <= 1) return { x: 0, y: 0 };
    const inverse = 1 / (squared * squared);
    return { x: 1 - (x * x - y * y) * inverse, y: -2 * x * y * inverse };
  }

  function generatePaths() {
    paths = [];
    for (let row = -20; row <= 20; row++) {
      if (row === 0) continue;
      let x = -4.5;
      let y = row * .123;
      const points = [];
      for (let step = 0; step < 750 && x < 5.5; step++) {
        points.push({ x, y });
        const first = velocity(x, y);
        const midpoint = velocity(x + first.x * .01, y + first.y * .01);
        x += midpoint.x * .02;
        y += midpoint.y * .02;
      }
      paths.push({ points, seed: (row + 20) * .137 });
    }
  }

  function size() {
    const bounds = container.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    radius = Math.min(width * .235, height * .29);
    centerX = width * .53;
    centerY = height * .48;
    if (!paths.length) generatePaths();
    draw();
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    const offsetX = reducedMotion.matches ? 0 : pointer.x;
    const offsetY = reducedMotion.matches ? 0 : pointer.y;
    context.save();
    context.translate(centerX + offsetX, centerY + offsetY);
    const screen = p => ({ x: p.x * radius, y: -p.y * radius });

    // Faint construction grid, kept behind the streamlines.
    context.strokeStyle = 'rgba(83,111,78,.075)';
    context.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      context.beginPath();
      context.moveTo(i * radius * .5, -height);
      context.lineTo(i * radius * .5, height);
      context.stroke();
      context.beginPath();
      context.moveTo(-width, i * radius * .5);
      context.lineTo(width, i * radius * .5);
      context.stroke();
    }

    paths.forEach((path, index) => {
      context.beginPath();
      path.points.forEach((point, pointIndex) => {
        const p = screen(point);
        if (pointIndex === 0) context.moveTo(p.x, p.y);
        else context.lineTo(p.x, p.y);
      });
      context.strokeStyle = index % 4 === 0 ? 'rgba(55,91,50,.52)' : 'rgba(72,104,61,.23)';
      context.lineWidth = index % 4 === 0 ? 1.1 : .7;
      context.stroke();

      // Animated tracers are evenly spaced in integration time.
      for (let tracer = 0; tracer < 3; tracer++) {
        const fraction = ((elapsed * .052 + path.seed + tracer / 3) % 1 + 1) % 1;
        const start = Math.floor(fraction * Math.max(1, path.points.length - 14));
        context.beginPath();
        for (let j = start; j < Math.min(start + 12, path.points.length); j++) {
          const p = screen(path.points[j]);
          if (j === start) context.moveTo(p.x, p.y);
          else context.lineTo(p.x, p.y);
        }
        context.strokeStyle = index % 3 === 0 ? 'rgba(83,119,48,.85)' : 'rgba(83,119,48,.35)';
        context.lineWidth = 1.65;
        context.stroke();
      }
    });

    // The obstacle is a deliberate visual anchor, with a drafting-style rim.
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fillStyle = '#d6ee85';
    context.fill();
    context.strokeStyle = '#3c5940';
    context.lineWidth = 1.2;
    context.stroke();
    context.beginPath();
    context.arc(0, 0, radius - 8, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(60,89,64,.26)';
    context.lineWidth = .6;
    context.stroke();
    context.strokeStyle = 'rgba(33,58,48,.35)';
    context.setLineDash([3, 5]);
    context.beginPath();
    context.moveTo(-radius * 1.17, 0);
    context.lineTo(radius * 1.17, 0);
    context.moveTo(0, -radius * 1.17);
    context.lineTo(0, radius * 1.17);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = '#213a30';
    context.font = `${Math.max(19, radius * .29)}px Georgia`;
    context.textAlign = 'center';
    context.fillText('what if?', 0, 8);
    context.font = '8px "Courier New", monospace';
    context.fillStyle = 'rgba(33,58,48,.65)';
    context.fillText('EVERY GOOD MODEL STARTS HERE.', 0, Math.max(26, radius * .30));
    context.beginPath();
    context.arc(-radius, 0, 4, 0, Math.PI * 2);
    context.fillStyle = '#213a30';
    context.fill();
    context.beginPath();
    context.arc(radius, 0, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // Fade the outer field into the paper instead of framing the visual.
    const fade = context.createLinearGradient(0, 0, width, 0);
    fade.addColorStop(0, '#f6f5ef');
    fade.addColorStop(.16, 'rgba(246,245,239,0)');
    fade.addColorStop(.83, 'rgba(246,245,239,0)');
    fade.addColorStop(1, '#f6f5ef');
    context.fillStyle = fade;
    context.fillRect(0, 0, width, height);
  }

  function animate(time) {
    if (!isVisible || document.hidden || reducedMotion.matches || userPaused) { frame = 0; return; }
    elapsed += lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
    lastTime = time;
    pointer.x += (pointer.targetX - pointer.x) * .04;
    pointer.y += (pointer.targetY - pointer.y) * .04;
    draw();
    frame = window.requestAnimationFrame(animate);
  }

  function updateMotion() {
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (isVisible && !document.hidden && !reducedMotion.matches && !userPaused) frame = requestAnimationFrame(animate);
    else draw();
  }

  document.querySelector('.hero').addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const box = container.getBoundingClientRect();
    pointer.targetX = Math.max(-10, Math.min(10, (event.clientX - box.left - box.width / 2) * .025));
    pointer.targetY = Math.max(-8, Math.min(8, (event.clientY - box.top - box.height / 2) * .025));
  });
  document.querySelector('.hero').addEventListener('pointerleave', () => { pointer.targetX = 0; pointer.targetY = 0; });
  if ('ResizeObserver' in window) new ResizeObserver(size).observe(container);
  else window.addEventListener('resize', size);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      isVisible = entries[0].isIntersecting;
      updateMotion();
    }).observe(container);
  }
  document.addEventListener('visibilitychange', updateMotion);
  motionButton.hidden = false;
  motionButton.addEventListener('click', () => {
    userPaused = !userPaused;
    motionButton.textContent = userPaused ? 'Resume flow ▶' : 'Pause flow Ⅱ';
    updateMotion();
  });
  reducedMotion.addEventListener('change', updateMotion);
  size();
  updateMotion();
})();
