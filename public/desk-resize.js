(() => {
  'use strict';

  const STORAGE_KEY = 'imperium.desk.operation-controls-width';
  const DIVIDER_WIDTH = 16;
  const MIN_CONTROLS = 336;
  const MIN_RESULTS = 384;
  const TEXT = {
    ko: ['작업 목록 폭 조절', '드래그 또는 ← →로 폭을 조절합니다. 더블클릭 또는 Enter로 기본 폭을 복원합니다.'],
    en: ['Resize task pane', 'Drag or use ← → to resize. Double-click or press Enter to reset.'],
    ja: ['タスク欄の幅を調整', 'ドラッグまたは ← → で調整。ダブルクリックまたは Enter で元の幅に戻します。'],
  };

  function readWidth() {
    try {
      const width = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isInteger(width) && width > 0 && width <= 20000 ? width : null;
    } catch {
      return null;
    }
  }

  function mount() {
    const shell = document.querySelector('.app-shell');
    const grid = shell?.querySelector('.workspace-grid');
    const controls = grid?.querySelector('#operation-controls-column');
    const results = grid?.querySelector('#inspector-section');
    if (!controls || !results || grid.querySelector('.desk-pane-divider')) return;

    const divider = document.createElement('div');
    divider.className = 'desk-pane-divider';
    divider.hidden = true;
    divider.tabIndex = 0;
    divider.setAttribute('role', 'separator');
    divider.setAttribute('aria-controls', controls.id);
    divider.setAttribute('aria-orientation', 'vertical');
    controls.after(divider);

    let preferredWidth = readWidth();
    let currentWidth = 0;
    let limits;
    let drag;

    function translate() {
      const [label, hint] = TEXT[document.documentElement.lang] || TEXT.ko;
      divider.setAttribute('aria-label', label);
      divider.title = hint;
    }

    function applyWidth(value) {
      currentWidth = Math.round(Math.min(limits.max, Math.max(limits.min, value)));
      grid.style.setProperty('--desk-task-pane-width', `${currentWidth}px`);
      divider.setAttribute('aria-valuenow', String(currentWidth));
    }

    function rememberWidth(width) {
      preferredWidth = width;
      try {
        if (width === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, String(width));
      } catch {
        // Live resizing still works when storage is unavailable.
      }
    }

    function endDrag(commit = false) {
      if (!drag) return;
      const { id, startWidth } = drag;
      drag = null;
      delete grid.dataset.deskResizing;
      if (divider.hasPointerCapture?.(id)) divider.releasePointerCapture(id);
      if (commit && currentWidth !== startWidth) rememberWidth(currentWidth);
      else if (limits) applyWidth(preferredWidth ?? limits.fallback);
    }

    function refresh() {
      const available = grid.clientWidth - DIVIDER_WIDTH;
      const active = shell.dataset.view === 'operations' && window.innerWidth > 1000
        && !controls.hidden && available >= MIN_CONTROLS + MIN_RESULTS;
      if (!active) {
        endDrag();
        limits = null;
        divider.hidden = true;
        delete grid.dataset.deskSplit;
        grid.style.removeProperty('--desk-task-pane-width');
        return;
      }
      limits = { min: MIN_CONTROLS, max: available - MIN_RESULTS, fallback: Math.max(390, available / 2.8) };
      divider.hidden = false;
      divider.setAttribute('aria-valuemin', String(limits.min));
      divider.setAttribute('aria-valuemax', String(limits.max));
      grid.dataset.deskSplit = 'active';
      applyWidth(drag ? currentWidth : preferredWidth ?? limits.fallback);
    }

    function reset() {
      if (!limits || drag) return;
      rememberWidth(null);
      applyWidth(limits.fallback);
    }

    divider.addEventListener('pointerdown', event => {
      if (!limits || drag || event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      divider.focus({ preventScroll: true });
      drag = { id: event.pointerId, startX: event.clientX, startWidth: currentWidth };
      grid.dataset.deskResizing = 'true';
      try { divider.setPointerCapture?.(event.pointerId); } catch { /* Window listeners still receive this pointer. */ }
    });
    window.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId || !limits) return;
      event.preventDefault();
      applyWidth(drag.startWidth + event.clientX - drag.startX);
    }, { passive: false });
    window.addEventListener('pointerup', event => {
      if (drag?.id === event.pointerId) endDrag(true);
    });
    window.addEventListener('pointercancel', event => {
      if (drag?.id === event.pointerId) endDrag();
    });
    divider.addEventListener('lostpointercapture', event => {
      if (drag?.id === event.pointerId) endDrag();
    });
    window.addEventListener('blur', () => endDrag());
    divider.addEventListener('dblclick', reset);
    divider.addEventListener('keydown', event => {
      if (!limits) return;
      if (event.key === 'Escape' && drag) {
        event.preventDefault();
        event.stopPropagation();
        endDrag();
        return;
      }
      if (drag || event.altKey || event.ctrlKey || event.metaKey) return;
      const step = event.shiftKey ? 64 : 16;
      switch (event.key) {
        case 'Enter': reset(); break;
        case 'ArrowLeft': applyWidth(currentWidth - step); break;
        case 'ArrowRight': applyWidth(currentWidth + step); break;
        case 'Home': applyWidth(limits.min); break;
        case 'End': applyWidth(limits.max); break;
        default: return;
      }
      event.preventDefault();
      if (event.key !== 'Enter') rememberWidth(currentWidth);
    });

    const viewObserver = new MutationObserver(refresh);
    viewObserver.observe(shell, { attributes: true, attributeFilter: ['data-view'] });
    viewObserver.observe(controls, { attributes: true, attributeFilter: ['hidden'] });
    new MutationObserver(translate).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    if (typeof ResizeObserver === 'function') new ResizeObserver(refresh).observe(grid);
    window.addEventListener('resize', refresh);
    translate();
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
