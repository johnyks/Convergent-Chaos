(() => {
  const frame = document.getElementById('codex-visualization');
  if (!frame || window.parent === window) return;
  let previous = 0;
  const report = () => {
    const height = Math.ceil(frame.getBoundingClientRect().height + 32);
    if (height === previous || height < 250 || height > 2500) return;
    previous = height;
    window.parent.postMessage({type:'sir-cubes-height',height}, '*');
  };
  new ResizeObserver(report).observe(frame);
  window.addEventListener('load', report);
})();
