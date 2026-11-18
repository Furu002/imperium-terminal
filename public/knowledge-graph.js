/* IMPERIUM's local Cytoscape.js adapter. The MIT library is served from /vendor. */
(function () {
  'use strict';
  const NODE_LIMIT = 150, EDGE_LIMIT = 1200;
  const nodeKey = id => `node:${String(id)}`;
  const provenance = edge => edge.provenance === 'keyword' ? 'keyword' : edge.provenance === 'wikilink' ? 'wiki' : 'manual';
  const source = node => node.confidence === 'user' ? 'user' : node.source === 'agent' || node.confidence === 'unverified' ? 'agent' : 'unknown';
  const STYLES = [
    { selector: 'node', style: { 'background-color': '#B0B0B0', width: 12, height: 12, label: 'data(label)', color: '#FFFFFF', 'font-family': '"Pretendard", "Pretendard JP", "JetBrains Mono", sans-serif', 'font-size': 16, 'text-valign': 'bottom', 'text-margin-y': 8, 'text-background-color': '#000000', 'text-background-opacity': .85, 'text-background-padding': 2, 'min-zoomed-font-size': 5, 'border-width': 0, 'overlay-opacity': 0 } },
    { selector: 'node.user', style: { 'background-color': '#00B7EB' } },
    { selector: 'node.agent', style: { 'background-color': '#00D77A' } },
    { selector: 'node.pinned', style: { 'border-width': 3, 'border-color': '#FF9F00', 'border-opacity': .9, 'border-style': 'double' } },
    { selector: 'node.chosen', style: { 'background-color': '#FF9F00', color: '#FF9F00', width: 19, height: 19, 'font-size': 18, 'min-zoomed-font-size': 0, 'z-index': 5 } },
    { selector: 'edge', style: { width: .8, 'line-color': '#B0B0B0', opacity: .22, 'curve-style': 'bezier', 'overlay-opacity': 0 } },
    { selector: 'edge.wiki', style: { 'line-color': '#00B7EB', opacity: .65 } },
    { selector: 'edge.manual', style: { 'line-color': '#FFFFFF', opacity: .65 } },
    { selector: '.muted', style: { opacity: .1, 'text-opacity': .2 } },
    { selector: 'edge.neighbor', style: { 'line-color': '#FF9F00', width: 2, opacity: 1, 'z-index': 4 } },
  ];

  function create(host, options = {}) {
    const factory = options.cytoscapeFactory || window.cytoscape;
    if (typeof factory !== 'function') throw new Error('Cytoscape.js is unavailable');
    let disposed = false, topology = '', currentLayout, observer, pendingFit = false;
    const cy = factory({ container: host, elements: [], style: STYLES, layout: { name: 'preset' }, minZoom: .025, maxZoom: 4, boxSelectionEnabled: false, autounselectify: true, hideEdgesOnViewport: false, textureOnViewport: false, pixelRatio: 'auto' });
    const alive = () => !disposed && !cy.destroyed();
    const fitPadding = () => Math.max(10, Math.min(32, Math.round(Math.min(host.clientWidth || cy.width(), host.clientHeight || cy.height()) * .07)));
    function cancelLayout() { currentLayout?.stop(); currentLayout = null; if (alive()) cy.nodes().stop(true, false); }
    function arrange() {
      if (!alive() || !cy.nodes().length) return false;
      if (typeof window.cytoscape?.('layout', 'fcose') !== 'function') throw new Error('fCoSE is unavailable');
      cancelLayout();
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      currentLayout = cy.layout({ name: 'fcose', quality: 'proof', randomize: false, animate: !reduced,
        animationDuration: 600, animationEasing: 'ease-in-out-cubic', fit: true, padding: fitPadding(),
        nodeDimensionsIncludeLabels: true, nodeSeparation: 90, idealEdgeLength: () => 100,
        nodeRepulsion: () => 6500, numIter: 1200, tile: true, packComponents: false });
      currentLayout.run(); return true;
    }
    const onTap = event => { if (alive() && host.isConnected) options.onSelect?.(event.target.data('memoryId')); };
    const highlight = id => {
      if (!alive()) return;
      cy.batch(() => {
        cy.elements().removeClass('muted neighbor');
        if (id === null || id === undefined) return;
        const node = cy.getElementById(nodeKey(id));
        if (node.empty()) return;
        const neighborhood = node.closedNeighborhood();
        cy.elements().difference(neighborhood).addClass('muted');
        node.connectedEdges().addClass('neighbor');
      });
    };
    const onOver = event => highlight(event.target.data('memoryId'));
    const onOut = () => highlight(null);
    cy.on('tap', 'node', onTap); cy.on('mouseover', 'node', onOver); cy.on('mouseout', 'node', onOut);
    cy.on('tapstart scrollzoom', cancelLayout);
    function fit() {
      if (!alive() || !cy.nodes().length) return;
      if (!host.clientWidth || !host.clientHeight) { pendingFit = true; return; }
      pendingFit = false; cy.resize(); cy.fit(cy.elements(), fitPadding());
      if (cy.zoom() > 1.6) cy.zoom({ level: 1.6, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    }
    function zoomBy(factor) {
      if (!alive() || !Number.isFinite(factor) || factor <= 0) return;
      cy.zoom({ level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * factor)), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    }
    function panBy(delta) { if (alive()) cy.panBy(delta); }
    const onKey = event => {
      if (event.target !== host) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0'].includes(event.key)) cancelLayout();
      const moves = { ArrowLeft: { x: 35, y: 0 }, ArrowRight: { x: -35, y: 0 }, ArrowUp: { x: 0, y: 35 }, ArrowDown: { x: 0, y: -35 } };
      if (moves[event.key]) { event.preventDefault(); panBy(moves[event.key]); }
      else if (['+', '='].includes(event.key)) { event.preventDefault(); zoomBy(1.2); }
      else if (event.key === '-') { event.preventDefault(); zoomBy(.8); }
      else if (event.key === '0') { event.preventDefault(); fit(); }
    };
    host.addEventListener('keydown', onKey);
    const resize = () => {
      if (!alive()) return;
      // Fit the first graph once its hidden tab becomes visible. Established views only resize.
      if (host.clientWidth && host.clientHeight) { cy.resize(); if (pendingFit) fit(); }
    };
    if (typeof window.ResizeObserver === 'function') { observer = new window.ResizeObserver(resize); observer.observe(host); }
    else window.addEventListener('resize', resize);

    function update({ nodes = [], edges = [], selectedId = null, fit: forceFit = false } = {}) {
      if (!alive()) return;
      // Independently cap and validate adapter input. No note bodies or remote URLs enter the renderer.
      const seen = new Set(), shown = nodes.filter(node => node?.id !== undefined && !seen.has(String(node.id)) && seen.add(String(node.id))).slice(0, NODE_LIMIT);
      const ids = new Set(shown.map(node => String(node.id))), occurrences = new Map();
      const definitions = shown.map(node => ({ group: 'nodes', data: { id: nodeKey(node.id), memoryId: node.id, label: [...String(node.title || '')].slice(0, 30).join('') + ([...String(node.title || '')].length > 30 ? '…' : '') }, classes: `${source(node)}${node.pinned ? ' pinned' : ''}${node.id === selectedId ? ' chosen' : ''}` }));
      for (const edge of edges.filter(edge => ids.has(String(edge.source)) && ids.has(String(edge.target))).slice(0, EDGE_LIMIT)) {
        const key = JSON.stringify([edge.id ?? null, edge.source, edge.target, edge.type ?? '', edge.provenance ?? 'user']), occurrence = occurrences.get(key) || 0; occurrences.set(key, occurrence + 1);
        definitions.push({ group: 'edges', data: { id: `edge:${key}:${occurrence}`, memoryId: edge.id, source: nodeKey(edge.source), target: nodeKey(edge.target), provenance: edge.provenance || 'user' }, classes: provenance(edge) });
      }
      const nextTopology = JSON.stringify(definitions.map(element => [element.data.id, element.data.source, element.data.target]).sort((a, b) => a[0].localeCompare(b[0]))), changed = topology !== nextTopology;
      const initial = cy.nodes().length === 0, viewport = { zoom: cy.zoom(), pan: { ...cy.pan() } };
      const newNodeCount = shown.filter(node => cy.getElementById(nodeKey(node.id)).empty()).length;
      if (changed) cancelLayout();
      const wanted = new Set(definitions.map(element => element.data.id));
      cy.batch(() => {
        cy.elements().filter(element => !wanted.has(element.id())).remove();
        for (const definition of definitions) {
          const existing = cy.getElementById(definition.data.id);
          if (existing.empty()) {
            const index = cy.nodes().length, angle = index * 2.399963229728653, center = cy.extent();
            const position = { x: (center.x1 + center.x2) / 2 + Math.cos(angle) * (80 + index * 3), y: (center.y1 + center.y2) / 2 + Math.sin(angle) * (80 + index * 3) };
            cy.add({ ...definition, ...(definition.group === 'nodes' ? { position } : {}) });
          } else { existing.data(definition.data); existing.classes(definition.classes); }
        }
      });
      if (changed && shown.length && (initial || newNodeCount === shown.length)) {
        // A new local neighborhood can replace almost every node. Give CoSE a fresh seed
        // instead of starting all incoming nodes at the same default (0, 0) position.
        currentLayout = cy.layout(shown.length <= 5 ? { name: 'circle', animate: false, fit: false, padding: fitPadding(), spacingFactor: 2, radius: shown.length === 1 ? 0 : 150 } : { name: 'cose', animate: false, fit: false, padding: fitPadding(), randomize: initial || newNodeCount > shown.length / 2, nodeRepulsion: () => 180000, idealEdgeLength: () => 110, edgeElasticity: () => 100, nodeOverlap: 16, componentSpacing: 90, numIter: 300, initialTemp: 150, coolingFactor: .95, minTemp: 1 });
        currentLayout.run();
      }
      topology = nextTopology;
      if (initial || forceFit) fit(); else if (changed) cy.viewport(viewport);
    }
    function destroy() {
      if (disposed) return;
      cancelLayout(); disposed = true; observer?.disconnect(); window.removeEventListener('resize', resize); host.removeEventListener('keydown', onKey);
      cy.off('tap', 'node', onTap); cy.off('mouseover', 'node', onOver); cy.off('mouseout', 'node', onOut); cy.destroy();
    }
    return { update, highlight, zoomBy, panBy, fit, arrange, cancelLayout, destroy };
  }
  window.ImperiumKnowledgeGraph = Object.freeze({ create });
})();
