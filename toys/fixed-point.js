(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const svg = $('graph');
  const NS = 'http://www.w3.org/2000/svg';
  const tolerance = 1e-6;
  const fixedPoint = 0.7390851332151607;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const samples = Array.from({ length: 241 }, (_, i) => ({ x: i / 240, y: Math.cos(i / 240) }));
  const domain = [-0.07, 1.07];
  const embedded = new URLSearchParams(location.search).get('embed') === '1';
  if (embedded) document.documentElement.classList.add('embedded');

  let geometry;
  let trail, traveler, startMarker, startLabel, aimGroup, aimDot, aimText;
  let animation = 0;
  let duration = Number($('speed').value);
  let hovered = null;
  let state = null;
  let plotWidth = 0;
  let lastPostedHeight = 0;
  let heightQueued = false;

  const format = value => value.toFixed(8);
  const residual = value => Math.abs(Math.cos(value) - value);
  const residualText = value => value === 0 ? '0' : value.toExponential(2).replace('e-', 'e−');

  function element(tag, attrs = {}, text = '', parent = svg) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function postHeight() {
    if (!embedded || window.parent === window || heightQueued) return;
    heightQueued = true;
    // Offscreen iframes can throttle animation frames; sizing must still reach the parent.
    queueMicrotask(() => {
      heightQueued = false;
      // The intrinsic main height can shrink, unlike document.scrollHeight in an iframe.
      const height = Math.max(350, Math.min(2200, Math.ceil($('toy').getBoundingClientRect().height) + 2));
      if (Math.abs(height - lastPostedHeight) < 2) return;
      lastPostedHeight = height;
      const origin = location.protocol === 'file:' || location.origin === 'null' ? '*' : location.origin;
      window.parent.postMessage({ type: 'convergent-chaos:toy-height', height }, origin);
    });
  }

  function pointString(point) {
    return `${geometry.x(point.x)},${geometry.y(point.y)}`;
  }

  function updateMetrics() {
    if (!state) return;
    $('initial').textContent = state.initial.toFixed(6);
    $('iteration').textContent = state.n;
    $('current').textContent = format(state.x);
    $('residual').textContent = residualText(residual(state.x));
    $('history-title').textContent = `Iteration history · ${state.n} completed`;
    if ($('chart-desc')) $('chart-desc').textContent =
      `Starting from ${state.initial.toFixed(6)}, iteration ${state.n} gives ${format(state.x)} with residual ${residualText(residual(state.x))}. Orange lines travel vertically to cosine and horizontally to the diagonal.`;
  }

  function appendHistory() {
    $('history').querySelector('.latest')?.classList.remove('latest');
    const row = document.createElement('tr');
    row.className = 'latest';
    [String(state.n), format(state.x), residualText(residual(state.x))].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    $('history').appendChild(row);
  }

  function drawMotion() {
    if (!state || !geometry || !trail) return;
    let d = state.points.map((point, i) => `${i ? 'L' : 'M'}${pointString(point)}`).join(' ');
    if (state.position) d += ` L${pointString(state.position)}`;
    trail.setAttribute('d', d);
    const point = state.position || state.points[state.points.length - 1];
    traveler.setAttribute('cx', geometry.x(point.x));
    traveler.setAttribute('cy', geometry.y(point.y));
    traveler.setAttribute('visibility', 'visible');
    startMarker.setAttribute('cx', geometry.x(state.initial));
    startMarker.setAttribute('cy', geometry.y(0));
    startMarker.setAttribute('visibility', 'visible');
    startLabel.textContent = `x₀ = ${state.initial.toFixed(3)}`;
    startLabel.setAttribute('x', Math.max(65, Math.min(geometry.width - 58, geometry.x(state.initial))));
    startLabel.setAttribute('y', geometry.y(0) + 43);
  }

  function drawAim() {
    if (!aimGroup) return;
    if (!geometry || hovered === null) {
      aimGroup.setAttribute('visibility', 'hidden');
      return;
    }
    aimGroup.setAttribute('visibility', 'visible');
    aimDot.setAttribute('cx', geometry.x(hovered));
    aimDot.setAttribute('cy', geometry.y(0));
    aimText.textContent = `Start at ${hovered.toFixed(3)}`;
    aimText.setAttribute('x', Math.max(85, Math.min(geometry.width - 67, geometry.x(hovered))));
    aimText.setAttribute('y', geometry.y(0) - 24);
  }

  function drawGraph(force = false) {
    const width = $('plot').getBoundingClientRect().width;
    if (!width || (!force && Math.abs(width - plotWidth) < 0.5)) return;
    plotWidth = width;
    const left = width < 370 ? 31 : 36;
    const right = 14, top = 16;
    const innerWidth = width - left - right;
    const innerHeight = Math.min(310, innerWidth * .72);
    const height = top + innerHeight + 64;
    const x = value => left + (value - domain[0]) / (domain[1] - domain[0]) * innerWidth;
    const y = value => top + innerHeight - (value - domain[0]) / (domain[1] - domain[0]) * innerHeight;
    geometry = { width, height, x, y };
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('height', height);
    svg.replaceChildren();
    element('title', { id: 'chart-title' }, 'Catch the fixed point: cosine cobweb plot');
    element('desc', { id: 'chart-desc' }, 'The cosine curve and diagonal meet at approximately 0.739085. Click the highlighted x-axis or use the starting-guess field to begin.');

    const ticks = width < 420 ? [0, .5, 1] : [0, .25, .5, .75, 1];
    ticks.forEach(value => {
      element('line', { x1: x(value), x2: x(value), y1: top, y2: top + innerHeight, class: 'grid' });
      element('line', { x1: left, x2: left + innerWidth, y1: y(value), y2: y(value), class: 'grid' });
      element('text', { x: x(value), y: y(0) + 25, 'text-anchor': 'middle' }, String(value));
      element('text', { x: left - 8, y: y(value) + 3, 'text-anchor': 'end' }, String(value));
    });

    element('rect', { x: x(0), y: y(0) - 15, width: x(1) - x(0), height: 30, rx: 3, class: 'selection-band' });
    element('line', { x1: x(0), x2: x(1), y1: y(0), y2: y(0), class: 'axis' });
    element('line', { x1: x(0), x2: x(0), y1: y(0), y2: y(1), class: 'axis' });
    element('path', { d: `M${x(0)},${y(0)} L${x(1)},${y(1)}`, class: 'diagonal' });
    element('path', { d: samples.map((point, i) => `${i ? 'L' : 'M'}${x(point.x)},${y(point.y)}`).join(' '), class: 'curve' });
    element('text', { x: x(.09), y: y(.995) - 9, class: 'curve-label' }, 'cos(x)');
    element('text', { x: x(.95), y: y(.95) - 9, 'text-anchor': 'end' }, 'y = x');
    trail = element('path', { class: 'trail' });
    element('circle', { cx: x(fixedPoint), cy: y(fixedPoint), r: 5.5, class: 'target' });
    element('text', { x: x(fixedPoint) - 10, y: y(fixedPoint) - 13, 'text-anchor': 'end', class: 'curve-label' }, 'x*');
    traveler = element('circle', { r: 4.5, class: 'traveler', visibility: 'hidden' });
    startMarker = element('circle', { r: 4, class: 'aim', visibility: 'hidden' });
    startLabel = element('text', { 'text-anchor': 'middle', class: 'start-label' });
    aimGroup = element('g', { 'pointer-events': 'none', visibility: 'hidden' });
    aimDot = element('circle', { r: 5, class: 'aim' }, '', aimGroup);
    aimText = element('text', { 'text-anchor': 'middle', class: 'start-label' }, '', aimGroup);

    const hit = element('rect', { x: x(0), y: y(0) - 22, width: x(1) - x(0), height: 44, class: 'axis-hit', 'aria-hidden': 'true' });
    hit.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      hovered = valueFromPointer(event);
      drawAim();
    });
    hit.addEventListener('pointerleave', () => { hovered = null; drawAim(); });
    hit.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      hovered = null;
      drawAim();
      initialize(valueFromPointer(event), true);
    });
    drawMotion();
    drawAim();
    updateMetrics();
    postHeight();
  }

  function valueFromPointer(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return .5;
    const local = point.matrixTransform(matrix.inverse());
    return Math.max(0, Math.min(1, (local.x - geometry.x(0)) / (geometry.x(1) - geometry.x(0))));
  }

  function setPlayback() {
    $('run-label').textContent = state.done ? 'Fixed point caught' : state.running ? 'Pause the chase' : state.n || state.elapsed ? 'Resume the orbit' : 'Run the orbit';
    $('run-icon').textContent = state.done ? '✓' : state.running ? 'Ⅱ' : '▶';
    $('run').disabled = state.done;
    $('step').disabled = state.done;
    $('status').className = `status${state.done ? ' converged' : state.running ? ' running' : ''}`;
  }

  function updateOperation() {
    if (!state || state.done) return;
    const next = Math.cos(state.x);
    $('operation').textContent = state.phase === 'vertical'
      ? `↑ Evaluate cos(${state.x.toFixed(5)}) = ${next.toFixed(5)}`
      : `→ Transfer to the diagonal: next x = ${next.toFixed(5)}`;
  }

  function finish() {
    state.running = false;
    state.done = true;
    cancelAnimationFrame(animation);
    setPlayback();
    $('message').textContent = `Caught it. ${state.n} iterations.`;
    $('operation').textContent = `x ≈ ${format(state.x)}. The residual is within 10⁻⁶.`;
    $('announcement').textContent = `Converged in ${state.n} iterations. Final value ${format(state.x)}. Residual ${residualText(residual(state.x))}.`;
    updateMetrics();
    drawMotion();
  }

  function initialize(initial, autoplay = false) {
    cancelAnimationFrame(animation);
    state = {
      initial, x: initial, n: 0, phase: 'vertical',
      points: [{ x: initial, y: 0 }], position: { x: initial, y: 0 },
      from: { x: initial, y: 0 }, to: { x: initial, y: Math.cos(initial) },
      started: performance.now(), elapsed: 0, running: false, done: false
    };
    $('history').replaceChildren();
    $('guess').value = String(initial);
    $('message').textContent = 'Ready when you are.';
    $('operation').textContent = 'Up to the curve. Across to the diagonal. Repeat.';
    appendHistory();
    updateMetrics();
    setPlayback();
    drawMotion();
    if (residual(state.x) <= tolerance) finish();
    else if (autoplay) resume();
  }

  function pause(announce = true) {
    if (!state.running) return;
    state.elapsed = Math.min(duration, state.elapsed + performance.now() - state.started);
    state.running = false;
    cancelAnimationFrame(animation);
    setPlayback();
    $('message').textContent = `Paused at iteration ${state.n}.`;
    if (announce) $('announcement').textContent = `Paused at iteration ${state.n}.`;
  }

  function resume() {
    if (state.done || state.running) return;
    state.started = performance.now();
    state.running = true;
    setPlayback();
    $('message').textContent = 'Closing in on the fixed point…';
    $('announcement').textContent = `Running from ${state.x.toFixed(6)}.`;
    updateOperation();
    animation = requestAnimationFrame(tick);
  }

  function completeSegment() {
    state.position = { ...state.to };
    state.points.push({ ...state.to });
    state.from = { ...state.to };
    state.elapsed = 0;
    if (state.phase === 'vertical') {
      state.phase = 'horizontal';
      state.to = { x: state.from.y, y: state.from.y };
      return false;
    }
    state.x = state.from.x;
    state.n++;
    appendHistory();
    updateMetrics();
    if (residual(state.x) <= tolerance) {
      finish();
      return true;
    }
    state.phase = 'vertical';
    state.to = { x: state.x, y: Math.cos(state.x) };
    return true;
  }

  function tick(now) {
    if (!state?.running) return;
    const progress = Math.min(1, Math.max(0, (state.elapsed + now - state.started) / duration));
    const eased = reducedMotion.matches ? (progress >= 1 ? 1 : 0) : progress * progress * (3 - 2 * progress);
    state.position = {
      x: state.from.x + (state.to.x - state.from.x) * eased,
      y: state.from.y + (state.to.y - state.from.y) * eased
    };
    drawMotion();
    if (progress >= 1) {
      completeSegment();
      state.started = now;
      if (state.done) return;
      updateOperation();
    }
    animation = requestAnimationFrame(tick);
  }

  $('run').addEventListener('click', () => state.running ? pause() : resume());
  $('step').addEventListener('click', () => {
    if (state.done) return;
    pause(false);
    // One press completes one mathematical iteration, including any partial segment.
    if (state.phase === 'vertical') completeSegment();
    completeSegment();
    drawMotion();
    if (state.done) return;
    setPlayback();
    updateOperation();
    $('message').textContent = `One step closer. Iteration ${state.n}.`;
    $('announcement').textContent = `Iteration ${state.n}. Current value ${format(state.x)}. Residual ${residualText(residual(state.x))}.`;
  });
  $('reset').addEventListener('click', () => {
    initialize(state.initial);
    $('announcement').textContent = `Reset to ${state.initial.toFixed(6)}. Ready.`;
  });
  $('speed').addEventListener('change', () => {
    const now = performance.now();
    const elapsed = state.elapsed + (state.running ? now - state.started : 0);
    const fraction = Math.min(1, elapsed / duration);
    duration = Number($('speed').value);
    state.elapsed = fraction * duration;
    state.started = now;
  });
  $('exact-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!$('guess').reportValidity()) return;
    const initial = Number($('guess').value);
    if (!Number.isFinite(initial) || initial < 0 || initial > 1) return;
    hovered = null;
    drawAim();
    initialize(initial, true);
  });
  document.querySelectorAll('details').forEach(details => details.addEventListener('toggle', postHeight));
  new ResizeObserver(() => drawGraph()).observe($('plot'));
  new ResizeObserver(postHeight).observe($('toy'));
  window.addEventListener('resize', () => {
    drawGraph();
    postHeight();
  });
  window.addEventListener('load', postHeight);
  drawGraph(true);
  initialize(.2);
  postHeight();
})();
