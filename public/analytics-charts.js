(function () {
  'use strict';
  const COLORS = Object.freeze({ black: '#000000', amber: '#FF9F00', cyan: '#00B7EB', green: '#00D77A', red: '#FF4D4F', white: '#F2F2F2', muted: '#A0A0A0', grid: '#252525' });

  // Chart.js is bundled locally. No analytics, provider or CDN requests are made here.
  function createManager({ container, Chart: injectedChart } = {}) {
    const instances = new Set();
    let closed = false, visible = false, width = null;
    const isVisible = () => {
      if (!container?.isConnected) return false;
      for (let node = container; node instanceof Element; node = node.parentElement) {
        if (node.hidden || getComputedStyle(node).display === 'none') return false;
      }
      return true;
    };
    function resizeVisible(force = false) {
      if (closed) return;
      const nextVisible = isVisible(), nextWidth = container?.getBoundingClientRect().width;
      if (nextVisible && (force || !visible || width !== nextWidth)) {
        for (const instance of instances) instance.resize();
      }
      visible = nextVisible; width = nextWidth;
    }
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(() => resizeVisible()) : null;
    for (let node = container; observer && node instanceof Element; node = node.parentElement) {
      observer.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    }
    function draw(canvas, specification, unavailable) {
      if (closed) return null;
      const ChartConstructor = injectedChart || window.Chart;
      let instance;
      try {
        if (typeof ChartConstructor !== 'function') throw new Error('Chart.js is unavailable');
        const custom = specification.options || {};
        const axis = { border: { display: false }, grid: { color: COLORS.grid }, ticks: { color: COLORS.muted, font: { family: 'Consolas, monospace', size: 10 }, maxTicksLimit: 6 } };
        const scales = specification.type === 'doughnut' ? {} : {
          x: { ...axis, ...custom.scales?.x, grid: { ...axis.grid, ...custom.scales?.x?.grid }, ticks: { ...axis.ticks, ...custom.scales?.x?.ticks } },
          y: { ...axis, beginAtZero: true, ...custom.scales?.y, grid: { ...axis.grid, ...custom.scales?.y?.grid }, ticks: { ...axis.ticks, ...custom.scales?.y?.ticks } },
        };
        instance = new ChartConstructor(canvas, {
          type: specification.type,
          data: specification.data,
          options: {
            color: COLORS.white, responsive: true, maintainAspectRatio: false, animation: false,
            locale: specification.locale || 'ko-KR', resizeDelay: 80,
            font: { family: 'Consolas, monospace', size: 11 },
            interaction: { intersect: false, mode: specification.type === 'doughnut' ? 'nearest' : 'index' },
            ...custom, scales,
            plugins: {
              legend: { position: 'bottom', labels: { color: COLORS.white, boxWidth: 9, boxHeight: 9, padding: 14, font: { size: 10 } }, ...custom.plugins?.legend },
              tooltip: { backgroundColor: COLORS.black, titleColor: COLORS.amber, bodyColor: COLORS.white, borderColor: COLORS.amber, borderWidth: 1, cornerRadius: 0, padding: 9, displayColors: true, ...custom.plugins?.tooltip },
            },
          },
        });
        if (!instance || instance.ctx === null) throw new Error('Chart canvas is unavailable');
        instances.add(instance);
        return instance;
      } catch {
        instance?.destroy?.();
        canvas.hidden = true;
        unavailable?.();
        return null;
      }
    }
    function destroyCharts() {
      for (const instance of instances) instance.destroy();
      instances.clear();
    }
    return { draw, resize: resizeVisible, destroyCharts, destroy() { closed = true; observer?.disconnect(); destroyCharts(); } };
  }
  window.ImperiumAnalyticsCharts = Object.freeze({ createManager, colors: COLORS });
}());
