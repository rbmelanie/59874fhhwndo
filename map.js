/* ============================================================
   map.js — proportional symbol map.
   No reachable source for true admin-1 polygons in this build
   (network sandbox constraints), so this renders simplified,
   recognizable country silhouettes with bubbles sized/colored
   by the active indicator, positioned at real admin-1 centroids.
   Projection bounds are computed from the actual data, not a
   fixed guess, so nothing clips or runs off-canvas.
   ============================================================ */

let mapIndicator = 'idp'; // which metric drives bubble size/color

function buildProjection(viewW, viewH, pad, activeIsos) {
  // Compute lon/lat bounds across only the active countries' outlines,
  // so the map re-centers and fills the frame regardless of selection.
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  activeIsos.forEach(iso => {
    const coords = store.outlines[iso];
    if (!coords) return;
    coords.forEach(([lon, lat]) => {
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    });
  });
  const lonRange = maxLon - minLon;
  const latRange = maxLat - minLat;
  const innerW = viewW - pad * 2;
  const innerH = viewH - pad * 2;
  const midLat = (minLat + maxLat) / 2;
  const latCorrection = Math.cos(midLat * Math.PI / 180);
  const scaleX = innerW / (lonRange * latCorrection);
  const scaleY = innerH / latRange;
  const scale = Math.min(scaleX, scaleY);
  const usedW = lonRange * latCorrection * scale;
  const usedH = latRange * scale;
  const offsetX = pad + (innerW - usedW) / 2;
  const offsetY = pad + (innerH - usedH) / 2;

  return function project(lon, lat) {
    const x = offsetX + (lon - minLon) * latCorrection * scale;
    const y = offsetY + (maxLat - lat) * scale;
    return [x, y];
  };
}

function pathFromOutline(coords, project) {
  return coords.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ') + ' Z';
}

function getMapValue(row, indicator) {
  if (indicator === 'idp') return row.idp;
  if (indicator === 'food35') return row.food35;
  if (indicator === 'pin') return row.pin;
  if (indicator === 'conflict') return row.conflict;
  return row.idp;
}

const MAP_INDICATOR_LABELS = {
  idp: 'IDPs', food35: 'Food insecure (IPC 3+)', pin: 'People in need', conflict: 'Conflict events (2026)'
};

function renderMap() {
  const stage = document.getElementById('map-stage');
  const C = [...activeCountries];
  if (!C.length) { stage.innerHTML = '<div class="empty">Select at least one country.</div>'; return; }

  const viewW = 760, viewH = 460, pad = 36;
  const project = buildProjection(viewW, viewH, pad, C);

  // Gather admin1 joined rows for all active countries
  let allRows = [];
  for (const c of C) {
    allRows = allRows.concat(getAdmin1JoinedRows(c).map(r => ({ ...r, iso: c })));
  }

  const values = allRows.map(r => getMapValue(r, mapIndicator)).filter(v => v !== null && v !== undefined);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);

  // Bubble radius scale (sqrt for area-proportional encoding)
  const minR = 3, maxR = 26;
  function radiusFor(v) {
    if (v === null || v === undefined) return 0;
    const t = Math.sqrt(v / maxVal);
    return minR + t * (maxR - minR);
  }

  // Color intensity scale per-country (so each country's own gradient shows internal variation)
  function colorFor(v, iso) {
    if (v === null || v === undefined) return '#d8d4ca';
    const t = Math.min(1, v / maxVal);
    const base = COLORS_HEX[iso];
    // blend from light tint to full saturation
    return blend('#f1f0eb', base, 0.25 + t * 0.75);
  }
  function blend(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bch = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${bch})`;
  }
  function hexToRgb(hex) {
    const v = hex.replace('#', '');
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }

  // Build SVG
  let svg = `<svg viewBox="0 0 ${viewW} ${viewH}" width="100%" height="100%" style="display:block">`;

  // Country outlines (faint fill, clear stroke, labeled)
  for (const c of C) {
    const outline = store.outlines[c];
    if (!outline) continue;
    const d = pathFromOutline(outline, project);
    svg += `<path d="${d}" fill="${COLORS_HEX[c]}11" stroke="${COLORS_HEX[c]}" stroke-width="1.4" stroke-opacity="0.55" />`;
  }

  // Country name labels (placed at outline centroid, simple average)
  for (const c of C) {
    const outline = store.outlines[c];
    if (!outline) continue;
    const avgLon = outline.reduce((s, p) => s + p[0], 0) / outline.length;
    const avgLat = outline.reduce((s, p) => s + p[1], 0) / outline.length;
    const [x, y] = project(avgLon, avgLat);
    svg += `<text x="${x}" y="${y - 18}" text-anchor="middle" font-size="12" font-weight="700" fill="${COLORS_HEX[c]}" font-family="IBM Plex Mono, monospace" opacity="0.75">${c}</text>`;
  }

  // Bubbles per admin1
  for (const row of allRows) {
    const v = getMapValue(row, mapIndicator);
    const [x, y] = project(row.lon, row.lat);
    const r = radiusFor(v);
    const fill = colorFor(v, row.iso);
    if (r <= 0) continue;
    svg += `<circle class="map-bubble" cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${COLORS_HEX[row.iso]}" stroke-width="1" stroke-opacity="0.6" data-name="${row.name}" data-iso="${row.iso}" data-val="${v ?? ''}" data-idp="${row.idp ?? ''}" data-food="${row.food35 ?? ''}" data-pin="${row.pin ?? ''}" data-conflict="${row.conflict ?? ''}" style="cursor:pointer" />`;
  }

  svg += '</svg>';
  stage.innerHTML = svg + '<div class="map-tooltip" id="map-tooltip"></div>';

  // Wire tooltips
  const tooltip = document.getElementById('map-tooltip');
  stage.querySelectorAll('.map-bubble').forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const name = el.dataset.name, iso = el.dataset.iso;
      tooltip.innerHTML = `<b>${CNAMES[iso]} — ${name}</b>
        IDPs: ${fmt(el.dataset.idp)}<br>
        Food insecure (IPC 3+): ${fmt(el.dataset.food)}<br>
        People in need: ${fmt(el.dataset.pin)}<br>
        Conflict events (2026): ${fmt(el.dataset.conflict)}`;
      tooltip.style.left = Math.min(x + 12, stage.clientWidth - 230) + 'px';
      tooltip.style.top = Math.max(8, Math.min(y - 10, stage.clientHeight - 130)) + 'px';
      tooltip.style.opacity = '1';
    });
    el.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
  });

  renderMapLegend(maxVal);
}

function renderMapLegend(maxVal) {
  const el = document.getElementById('map-legend');
  const C = [...activeCountries];
  const label = MAP_INDICATOR_LABELS[mapIndicator];
  el.innerHTML = `
    <div class="leg-item"><div class="leg-swatch" style="width:8px;height:8px;background:#9aa7b8"></div>Low ${label.toLowerCase()}</div>
    <div class="leg-item"><div class="leg-swatch" style="width:18px;height:18px;background:#5b6b82"></div>High (up to ${fmt(maxVal)})</div>
    <div class="leg-item" style="margin-left:6px">${C.map(c => `<span style="color:${COLORS_HEX[c]};font-weight:600">●</span> ${CNAMES[c]}`).join('&nbsp;&nbsp;')}</div>
    <div class="leg-item" style="margin-left:auto;color:var(--ink-300);font-family:var(--font-mono);font-size:10.5px">Bubble area ∝ value · positioned at admin-1 centroid</div>
  `;
}

function renderMapControls() {
  const el = document.getElementById('map-indicator-tags');
  const options = [
    { v: 'idp', l: 'IDPs' },
    { v: 'food35', l: 'Food insecure (IPC 3+)' },
    { v: 'pin', l: 'People in need' },
    { v: 'conflict', l: 'Conflict events' }
  ];
  el.innerHTML = options.map(o => `<span class="tag ${mapIndicator === o.v ? 'on' : ''}" data-mapind="${o.v}">${o.l}</span>`).join('');
  el.querySelectorAll('.tag').forEach(t => {
    t.addEventListener('click', () => {
      mapIndicator = t.dataset.mapind;
      renderMapControls();
      renderMap();
    });
  });
}
