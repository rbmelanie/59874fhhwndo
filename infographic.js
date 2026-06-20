/* ============================================================
   infographic.js — metric cards + charts.
   Chart selection adapts to activeUsecase so each scenario
   shows the cross-domain comparison that actually answers it,
   rather than one fixed dashboard regardless of question.
   ============================================================ */

function mkChart(id, type, data, opts) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const gridColor = 'rgba(15,27,45,0.07)';
  charts[id] = new Chart(ctx, {
    type, data,
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: type === 'doughnut' ? {} : {
        y: { grid: { color: gridColor }, ticks: { font: { size: 10.5 } } },
        x: { grid: { display: false }, ticks: { font: { size: 10.5 } } }
      },
      ...opts
    }
  });
}

function renderMetricCards() {
  const el = document.getElementById('metric-cards');
  const C = [...activeCountries];
  if (!C.length) { el.innerHTML = '<div class="empty">Select at least one country.</div>'; return; }

  const idps = getRecentIDPs(), food35 = getFoodInsecure35(), refs = getRefugees(),
        funding = getFunding(), pin = getPIN(), conflictByC = getConflictByCountry(2026);

  let cards = [];

  if (activeUsecase === 'funding-gap') {
    const totalReq = C.reduce((s, c) => s + (funding[c]?.req || 0), 0);
    const totalRec = C.reduce((s, c) => s + (funding[c]?.rec || 0), 0);
    const totalGap = totalReq - totalRec;
    const totalPin = C.reduce((s, c) => s + (pin[c] || 0), 0);
    const avgPct = totalReq ? (totalRec / totalReq * 100) : null;
    cards = [
      { l: 'Total requirements', v: fmtUSD(totalReq), s: 'FTS — 2026 appeals' },
      { l: 'Total received', v: fmtUSD(totalRec), s: fmtPct(avgPct) + ' of requirements' },
      { l: 'Combined funding gap', v: fmtUSD(totalGap), s: 'unmet across selected countries', cls: 'alert' },
      { l: 'People in need (PIN)', v: fmt(totalPin), s: 'OCHA HPC — intersectoral' }
    ];
  } else if (activeUsecase === 'displacement') {
    const totalIDP = C.reduce((s, c) => s + (idps[c] || 0), 0);
    const totalFood35 = C.reduce((s, c) => s + (food35[c] || 0), 0);
    const totalRef = C.reduce((s, c) => s + (refs[c] || 0), 0);
    const idp12 = get12MoAgoIDPs();
    const totalIDP12 = C.reduce((s, c) => s + (idp12[c] || 0), 0);
    const idpChange = totalIDP12 ? Math.round((totalIDP - totalIDP12) / totalIDP12 * 100) : null;
    cards = [
      { l: 'Total IDPs', v: fmt(totalIDP), s: 'IOM / DTM — latest round' },
      { l: 'IDP change, 12mo', v: (idpChange >= 0 ? '+' : '') + idpChange + '%', s: 'vs. same period last year', cls: idpChange > 10 ? 'alert' : '' },
      { l: 'Food insecure (IPC 3+)', v: fmt(totalFood35), s: 'FEWS NET / IPC — current' },
      { l: 'Refugees (origin)', v: fmt(totalRef), s: 'UNHCR — cross-border outflow' }
    ];
  } else if (activeUsecase === 'emergency-response') {
    const l3countries = C.filter(c => store.country_meta[c]?.emergency_level === 'L3');
    const totalPin = C.reduce((s, c) => s + (pin[c] || 0), 0);
    const avgPct = C.length ? C.reduce((s, c) => s + (funding[c]?.pct || 0), 0) / C.length : null;
    const totalTargeted = C.reduce((s, c) => s + (store.country_meta[c]?.hrp_people_targeted || 0), 0);
    cards = [
      { l: 'L3 emergencies', v: l3countries.length, s: l3countries.map(c => CNAMES[c]).join(', ') || 'none active' },
      { l: 'People targeted (HRP)', v: fmt(totalTargeted), s: 'across response plans' },
      { l: 'People in need', v: fmt(totalPin), s: 'OCHA HPC — intersectoral', cls: totalPin > totalTargeted * 1.5 ? 'warn' : '' },
      { l: 'Avg. funding coverage', v: fmtPct(avgPct), s: 'FTS — latest appeal', cls: avgPct < 40 ? 'alert' : '' }
    ];
  } else {
    // explorer: show whichever indicators are active
    if (activeIndicators.has('idp')) cards.push({ l: 'Total IDPs', v: fmt(C.reduce((s, c) => s + (idps[c] || 0), 0)), s: 'IOM / DTM' });
    if (activeIndicators.has('food')) cards.push({ l: 'Food insecure (IPC 3+)', v: fmt(C.reduce((s, c) => s + (food35[c] || 0), 0)), s: 'FEWS NET / IPC' });
    if (activeIndicators.has('refugee')) cards.push({ l: 'Refugees (origin)', v: fmt(C.reduce((s, c) => s + (refs[c] || 0), 0)), s: 'UNHCR' });
    if (activeIndicators.has('needs')) cards.push({ l: 'People in need', v: fmt(C.reduce((s, c) => s + (pin[c] || 0), 0)), s: 'OCHA HPC' });
    if (activeIndicators.has('conflict')) cards.push({ l: 'Conflict events (2026)', v: fmt(C.reduce((s, c) => s + (conflictByC[c] || 0), 0)), s: 'ACLED' });
    if (activeIndicators.has('funding')) {
      const totalReq = C.reduce((s, c) => s + (funding[c]?.req || 0), 0);
      const totalRec = C.reduce((s, c) => s + (funding[c]?.rec || 0), 0);
      cards.push({ l: 'Funding coverage', v: fmtPct(totalReq ? totalRec / totalReq * 100 : null), s: fmtUSD(totalRec) + ' / ' + fmtUSD(totalReq) });
    }
  }

  el.innerHTML = cards.map(c => `
    <div class="mcard ${c.cls || ''}">
      <div class="mlabel">${c.l}</div>
      <div class="mval ${c.cls === 'alert' ? 'alert-text' : ''}">${c.v}</div>
      <div class="msub">${c.s}</div>
    </div>`).join('');
}

function renderCharts() {
  const C = [...activeCountries];
  const cl = C.map(c => CNAMES[c]);
  const cc = C.map(c => COLORS_HEX[c]);
  const chartArea = document.getElementById('chart-area');
  if (!C.length) { chartArea.innerHTML = ''; return; }

  if (activeUsecase === 'funding-gap') {
    chartArea.innerHTML = `
      <div class="chart-row">
        <div class="panel-card panel-pad">
          <div class="panel-title">Requirements vs. received <span class="hint">USD, 2026 appeal</span></div>
          <div style="position:relative;height:230px"><canvas id="c-1"></canvas></div>
        </div>
        <div class="panel-card panel-pad">
          <div class="panel-title">Funding coverage <span class="hint">% of requirement met</span></div>
          <div style="position:relative;height:230px"><canvas id="c-2"></canvas></div>
        </div>
      </div>
      <div class="chart-row">
        <div class="panel-card panel-pad">
          <div class="panel-title">Cost per person targeted <span class="hint">requirements ÷ HRP target</span></div>
          <div style="position:relative;height:210px"><canvas id="c-3"></canvas></div>
        </div>
        <div class="panel-card panel-pad">
          <div class="panel-title">People in need by sector <span class="hint">selected countries combined</span></div>
          <div style="position:relative;height:210px"><canvas id="c-4"></canvas></div>
        </div>
      </div>`;
    const fd = getFunding();
    mkChart('c-1', 'bar', {
      labels: cl,
      datasets: [
        { label: 'Required', data: C.map(c => (fd[c]?.req || 0) / 1e6), backgroundColor: 'rgba(15,27,45,0.12)', borderRadius: 3 },
        { label: 'Received', data: C.map(c => (fd[c]?.rec || 0) / 1e6), backgroundColor: cc, borderRadius: 3 }
      ]
    }, { scales: { y: { ticks: { callback: v => '$' + fmt(v * 1e6) } } }, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10.5 } } } } });

    mkChart('c-2', 'bar', {
      labels: cl,
      datasets: [{ label: '% funded', data: C.map(c => fd[c]?.pct ?? 0), backgroundColor: C.map(c => (fd[c]?.pct ?? 0) < 40 ? '#b1462e' : cc[C.indexOf(c)]), borderRadius: 3 }]
    }, { scales: { y: { max: 100, ticks: { callback: v => v + '%' } } } });

    const costPP = getCostPerPersonTargeted();
    mkChart('c-3', 'bar', {
      labels: cl,
      datasets: [{ label: '$ per person', data: C.map(c => costPP[c] || 0), backgroundColor: cc, borderRadius: 3 }]
    }, { scales: { y: { ticks: { callback: v => '$' + v.toFixed(0) } } } });

    const ps = getPINbySector();
    const sl = Object.entries(ps).sort((a, b) => b[1] - a[1]).slice(0, 8);
    mkChart('c-4', 'bar', {
      labels: sl.map(([k]) => k),
      datasets: [{ label: 'PIN', data: sl.map(([, v]) => v), backgroundColor: '#1d4f91', borderRadius: 3 }]
    }, { indexAxis: 'y', scales: { x: { ticks: { callback: fmt } }, y: { ticks: { font: { size: 10.5 } } } } });

  } else if (activeUsecase === 'displacement') {
    chartArea.innerHTML = `
      <div class="chart-row">
        <div class="panel-card panel-pad">
          <div class="panel-title">IDP stock by country <span class="hint">latest DTM round</span></div>
          <div style="position:relative;height:230px"><canvas id="c-1"></canvas></div>
        </div>
        <div class="panel-card panel-pad">
          <div class="panel-title">IDP trend, 12 months <span class="hint">same period last year → now</span></div>
          <div style="position:relative;height:230px"><canvas id="c-2"></canvas></div>
        </div>
      </div>
      <div class="chart-row">
        <div class="panel-card panel-pad">
          <div class="panel-title">Food insecurity by IPC phase <span class="hint">analyzed population, stacked</span></div>
          <div style="position:relative;height:230px"><canvas id="c-3"></canvas></div>
        </div>
        <div class="panel-card panel-pad">
          <div class="panel-title">Cross-border outflow <span class="hint">refugees originating from country</span></div>
          <div style="position:relative;height:230px"><canvas id="c-4"></canvas></div>
        </div>
      </div>`;
    const idps = getRecentIDPs();
    mkChart('c-1', 'bar', { labels: cl, datasets: [{ label: 'IDPs', data: C.map(c => idps[c] || 0), backgroundColor: cc, borderRadius: 3 }] },
      { scales: { y: { ticks: { callback: fmt } } } });

    const idp12 = get12MoAgoIDPs();
    mkChart('c-2', 'bar', {
      labels: cl,
      datasets: [
        { label: '12mo ago', data: C.map(c => idp12[c] || 0), backgroundColor: 'rgba(15,27,45,0.12)', borderRadius: 3 },
        { label: 'Now', data: C.map(c => idps[c] || 0), backgroundColor: cc, borderRadius: 3 }
      ]
    }, { scales: { y: { ticks: { callback: fmt } } }, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10.5 } } } } });

    const byPhase = getRecentFoodByPhase();
    const phaseColors = ['#cfe3d6', '#f3e3b5', '#eebf86', '#de8a5c', '#b1462e'];
    mkChart('c-3', 'bar', {
      labels: cl,
      datasets: [1, 2, 3, 4, 5].map((p, i) => ({
        label: 'Phase ' + p,
        data: C.map(c => byPhase[c] ? byPhase[c][p] || 0 : 0),
        backgroundColor: phaseColors[i]
      })).filter(d => typeof d.label === 'string')
    }, { scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: fmt } } }, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } });

    const refs = getRefugees();
    mkChart('c-4', 'bar', { labels: cl, datasets: [{ label: 'Refugees', data: C.map(c => refs[c] || 0), backgroundColor: cc, borderRadius: 3 }] },
      { scales: { y: { ticks: { callback: fmt } } } });

  } else if (activeUsecase === 'emergency-response') {
    chartArea.innerHTML = `
      <div class="chart-row">
        <div class="panel-card panel-pad">
          <div class="panel-title">Funding coverage by emergency level <span class="hint">L3 vs L2</span></div>
          <div style="position:relative;height:230px"><canvas id="c-1"></canvas></div>
        </div>
        <div class="panel-card panel-pad">
          <div class="panel-title">People in need vs. people targeted <span class="hint">scale-of-response check</span></div>
          <div style="position:relative;height:230px"><canvas id="c-2"></canvas></div>
        </div>
      </div>
      <div class="chart-row">
        <div class="panel-card panel-pad">
          <div class="panel-title">Conflict events trend <span class="hint">2021–2026, by country</span></div>
          <div style="position:relative;height:230px"><canvas id="c-3"></canvas></div>
        </div>
        <div class="panel-card panel-pad">
          <div class="panel-title">Conflict events by type <span class="hint">2026, selected countries</span></div>
          <div style="position:relative;height:230px"><canvas id="c-4"></canvas></div>
        </div>
      </div>`;
    const fd = getFunding();
    mkChart('c-1', 'bar', {
      labels: cl.map(n => n + ' (' + store.country_meta[C[cl.indexOf(n)]]?.emergency_level + ')'),
      datasets: [{ label: '% funded', data: C.map(c => fd[c]?.pct ?? 0), backgroundColor: C.map(c => store.country_meta[c]?.emergency_level === 'L3' ? '#b1462e' : '#b08a2e'), borderRadius: 3 }]
    }, { scales: { y: { max: 100, ticks: { callback: v => v + '%' } } } });

    const pin = getPIN();
    mkChart('c-2', 'bar', {
      labels: cl,
      datasets: [
        { label: 'People in need', data: C.map(c => pin[c] || 0), backgroundColor: 'rgba(177,70,46,0.55)', borderRadius: 3 },
        { label: 'People targeted', data: C.map(c => store.country_meta[c]?.hrp_people_targeted || 0), backgroundColor: cc, borderRadius: 3 }
      ]
    }, { scales: { y: { ticks: { callback: fmt } } }, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10.5 } } } } });

    const byYear = getConflictByYear();
    const years = [2021, 2022, 2023, 2024, 2025, 2026];
    mkChart('c-3', 'line', {
      labels: years,
      datasets: C.map(c => ({
        label: CNAMES[c], data: years.map(y => byYear[c][y]),
        borderColor: COLORS_HEX[c], backgroundColor: COLORS_HEX[c], tension: 0.3, pointRadius: 2
      }))
    }, { scales: { y: { ticks: { callback: fmt } } }, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10.5 } } } } });

    const bt = getConflictByType();
    const tl = Object.keys(bt);
    mkChart('c-4', 'doughnut', {
      labels: tl,
      datasets: [{ data: tl.map(t => bt[t]), backgroundColor: ['#1d4f91', '#1d7a5f', '#c1542c', '#b08a2e', '#5b6b82'], borderWidth: 0 }]
    }, { plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } });

  } else {
    // explorer mode: show whichever charts match active indicators
    // IMPORTANT: build the complete HTML string and assign it ONCE.
    // Using `innerHTML +=` here previously destroyed already-rendered
    // canvases (re-parsing wipes any attached Chart.js instance), which
    // is why the bubble chart silently failed to draw.
    let bubbleHtml = '';
    const quantOptions = [
      { v: 'idp', l: 'IDPs' }, { v: 'food', l: 'Food insecure (IPC 3+)' },
      { v: 'needs', l: 'People in need' }, { v: 'conflict', l: 'Conflict events' },
      { v: 'funding_req', l: 'Funding required' }, { v: 'funding_pct', l: 'Funding coverage %' }
    ].filter(o => activeIndicators.has(o.v.replace('funding_req', 'funding').replace('funding_pct', 'funding')));

    bubbleHtml += `<div class="panel-card panel-pad" style="margin-bottom:10px">
      <div class="panel-title">Multi-indicator comparison <span class="hint">bubble chart — X, Y, and size each map to a different indicator; color = country</span></div>`;

    let canRenderBubble = false;
    if (quantOptions.length < 2) {
      bubbleHtml += `<div class="empty" style="padding:1.5rem">Select at least <b>2</b> indicators above to build a multi-indicator comparison (one for the X-axis, one for the Y-axis; a third becomes bubble size).</div></div>`;
    } else {
      canRenderBubble = true;
      if (!quantOptions.find(o => o.v === bubbleX)) bubbleX = quantOptions[0].v;
      if (!quantOptions.find(o => o.v === bubbleY) || bubbleY === bubbleX) bubbleY = (quantOptions.find(o => o.v !== bubbleX) || quantOptions[0]).v;
      const sizeOptions = quantOptions.filter(o => o.v !== bubbleX && o.v !== bubbleY);
      if (sizeOptions.length && !sizeOptions.find(o => o.v === bubbleSize)) bubbleSize = sizeOptions[0].v;
      if (!sizeOptions.length) bubbleSize = null;

      bubbleHtml += `
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;font-size:11.5px">
          <label style="color:var(--ink-500)">X-axis: <select id="bubble-x" class="bubble-select">${quantOptions.map(o => `<option value="${o.v}" ${o.v === bubbleX ? 'selected' : ''}>${o.l}</option>`).join('')}</select></label>
          <label style="color:var(--ink-500)">Y-axis: <select id="bubble-y" class="bubble-select">${quantOptions.map(o => `<option value="${o.v}" ${o.v === bubbleY ? 'selected' : ''}>${o.l}</option>`).join('')}</select></label>
          ${sizeOptions.length ? `<label style="color:var(--ink-500)">Size: <select id="bubble-size" class="bubble-select">${sizeOptions.map(o => `<option value="${o.v}" ${o.v === bubbleSize ? 'selected' : ''}>${o.l}</option>`).join('')}</select></label>` : ''}
        </div>
        <div style="position:relative;height:320px"><canvas id="c-bubble"></canvas></div>
      </div>`;
    }

    const slots = [];
    if (activeIndicators.has('idp')) slots.push({ id: 'c-1', title: 'IDPs by country' });
    if (activeIndicators.has('food')) slots.push({ id: 'c-2', title: 'Food insecure (IPC 3+) by country' });
    if (activeIndicators.has('conflict')) slots.push({ id: 'c-3', title: 'Conflict events by type' });
    if (activeIndicators.has('funding')) slots.push({ id: 'c-4', title: 'Funding: required vs received' });
    if (activeIndicators.has('needs')) slots.push({ id: 'c-5', title: 'People in need by country' });
    if (activeIndicators.has('refugee')) slots.push({ id: 'c-6', title: 'Cross-border displacement: outflow vs. inflow' });

    let slotsHtml = '<div class="chart-row">';
    slots.forEach((s, i) => {
      if (i % 2 === 0 && i > 0) slotsHtml += '</div><div class="chart-row">';
      slotsHtml += `<div class="panel-card panel-pad"><div class="panel-title">${s.title}</div><div style="position:relative;height:220px"><canvas id="${s.id}"></canvas></div></div>`;
    });
    slotsHtml += '</div>';

    // Single assignment — this is the fix.
    chartArea.innerHTML = bubbleHtml + slotsHtml;

    if (canRenderBubble) {
      renderBubbleChart();
      ['bubble-x', 'bubble-y', 'bubble-size'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.addEventListener('change', (e) => {
          if (id === 'bubble-x') bubbleX = e.target.value;
          if (id === 'bubble-y') bubbleY = e.target.value;
          if (id === 'bubble-size') bubbleSize = e.target.value;
          renderCharts();
        });
      });
    }

    const idps = getRecentIDPs(), food35 = getFoodInsecure35(), funding = getFunding(), pin = getPIN(), refs = getRefugees();
    if (activeIndicators.has('idp')) mkChart('c-1', 'bar', { labels: cl, datasets: [{ data: C.map(c => idps[c] || 0), backgroundColor: cc, borderRadius: 3 }] }, { scales: { y: { ticks: { callback: fmt } } } });
    if (activeIndicators.has('food')) mkChart('c-2', 'bar', { labels: cl, datasets: [{ data: C.map(c => food35[c] || 0), backgroundColor: cc, borderRadius: 3 }] }, { scales: { y: { ticks: { callback: fmt } } } });
    if (activeIndicators.has('conflict')) {
      const bt = getConflictByType();
      const tl = Object.keys(bt);
      mkChart('c-3', 'doughnut', { labels: tl, datasets: [{ data: tl.map(t => bt[t]), backgroundColor: ['#1d4f91', '#1d7a5f', '#c1542c', '#b08a2e', '#5b6b82'], borderWidth: 0 }] }, { plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } });
    }
    if (activeIndicators.has('funding')) {
      mkChart('c-4', 'bar', {
        labels: cl,
        datasets: [
          { label: 'Required', data: C.map(c => (funding[c]?.req || 0) / 1e6), backgroundColor: 'rgba(15,27,45,0.12)', borderRadius: 3 },
          { label: 'Received', data: C.map(c => (funding[c]?.rec || 0) / 1e6), backgroundColor: cc, borderRadius: 3 }
        ]
      }, { scales: { y: { ticks: { callback: v => '$' + fmt(v * 1e6) } } }, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10.5 } } } } });
    }
    if (activeIndicators.has('needs')) mkChart('c-5', 'bar', { labels: cl, datasets: [{ data: C.map(c => pin[c] || 0), backgroundColor: cc, borderRadius: 3 }] }, { scales: { y: { ticks: { callback: fmt } } } });
    if (activeIndicators.has('refugee')) {
      const asylum = getAsylum();
      mkChart('c-6', 'bar', {
        labels: cl,
        datasets: [
          { label: 'Refugees from (origin)', data: C.map(c => refs[c] || 0), backgroundColor: cc, borderRadius: 3 },
          { label: 'Refugees hosted (asylum)', data: C.map(c => asylum[c] || 0), backgroundColor: 'rgba(15,27,45,0.18)', borderRadius: 3 }
        ]
      }, { scales: { y: { ticks: { callback: fmt } } }, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10.5 } } } } });
    }
  }
}

// ── Multi-indicator bubble chart ────────────────────────────────────────
let bubbleX = 'idp', bubbleY = 'needs', bubbleSize = 'conflict';

function getBubbleValue(indicator, country) {
  if (indicator === 'idp') return getRecentIDPs()[country];
  if (indicator === 'food') return getFoodInsecure35()[country];
  if (indicator === 'needs') return getPIN()[country];
  if (indicator === 'conflict') return getConflictByCountry(2026)[country];
  if (indicator === 'funding_req') return getFunding()[country]?.req;
  if (indicator === 'funding_pct') return getFunding()[country]?.pct;
  return null;
}

function bubbleLabel(v) {
  const map = { idp: 'IDPs', food: 'Food insecure (IPC 3+)', needs: 'People in need', conflict: 'Conflict events', funding_req: 'Funding required', funding_pct: 'Funding coverage %' };
  return map[v] || v;
}

function renderBubbleChart() {
  const C = [...activeCountries];
  if (!C.length) return;
  const sizeVals = bubbleSize ? C.map(c => getBubbleValue(bubbleSize, c) || 0) : [1];
  const maxSize = Math.max(...sizeVals, 1);
  const data = C.map(c => ({
    x: getBubbleValue(bubbleX, c) || 0,
    y: getBubbleValue(bubbleY, c) || 0,
    r: bubbleSize ? 8 + Math.sqrt((getBubbleValue(bubbleSize, c) || 0) / maxSize) * 32 : 16,
    country: CNAMES[c]
  }));

  mkChart('c-bubble', 'bubble', {
    datasets: C.map((c, i) => ({
      label: CNAMES[c],
      data: [data[i]],
      backgroundColor: COLORS_HEX[c] + 'aa',
      borderColor: COLORS_HEX[c],
      borderWidth: 1.5
    }))
  }, {
    scales: {
      x: { min: 0, title: { display: true, text: bubbleLabel(bubbleX), font: { size: 11 } }, ticks: { callback: v => bubbleX === 'funding_pct' ? v + '%' : fmt(v) } },
      y: { min: 0, title: { display: true, text: bubbleLabel(bubbleY), font: { size: 11 } }, ticks: { callback: v => bubbleY === 'funding_pct' ? v + '%' : fmt(v) } }
    },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10.5 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const d = ctx.raw;
            let lines = [`${d.country}`, `${bubbleLabel(bubbleX)}: ${fmt(d.x)}`, `${bubbleLabel(bubbleY)}: ${fmt(d.y)}`];
            if (bubbleSize) lines.push(`${bubbleLabel(bubbleSize)} (size): ${fmt(getBubbleValue(bubbleSize, [...activeCountries][ctx.datasetIndex]))}`);
            return lines;
          }
        }
      }
    }
  });
}
