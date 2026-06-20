/* ============================================================
   usecases.js — v2.3
   Back to the v2 structure (separate strip + framing box +
   insight), which users found clearer than the v2.2 accordion.
   Order change: explorer/select-your-own is now FIRST and
   visually separated from the three preset example queries.
   New: insight box is labelled as "Query result" with domain
   attribution so it's clear what produced the answer.
   New: natural-language query input lives directly below the
   auto-generated answer rather than in a hidden separate tab.
   ============================================================ */

const USECASES = {
  'explorer': {
    label: 'Select your own query',
    eyebrow: null,
    domains: 'All domains — your selection',
    domainsShort: 'Your selection',
    title: 'Build your own cross-domain view',
    description: 'Pick any combination of countries and indicators — the table, infographic, and map all update together.'
  },
  'funding-gap': {
    label: 'Funding gap analysis',
    eyebrow: '01',
    domains: 'Funding (FTS) × Needs (OCHA HPC)',
    domainsShort: 'Funding × Needs',
    title: 'Where is the humanitarian response most underfunded relative to need?',
    description: 'Joins FTS appeal funding against OCHA HPC people-in-need figures to surface the cost-per-person-targeted and the absolute funding gap, by country.'
  },
  'displacement': {
    label: 'Displacement monitoring',
    eyebrow: '02',
    domains: 'IDPs (IOM/DTM) × Geography (Admin 1) × Food security (IPC)',
    domainsShort: 'IDPs × Geography × Food security',
    title: 'Where is displacement concentrated, and does it coincide with acute food insecurity?',
    description: 'Joins IDP stock at admin-1 level against IPC phase classification for the same geography, to identify districts where displacement and food insecurity compound each other.'
  },
  'emergency-response': {
    label: 'Sudden-onset emergency response',
    eyebrow: '03',
    domains: 'Emergency classification × Funding (FTS) × Needs (OCHA HPC)',
    domainsShort: 'Emergency level × Funding × Needs',
    title: 'For active high-severity emergencies, how does the response measure up against scale of need?',
    description: 'Joins the country emergency classification (L2/L3) against funding coverage and people-in-need, to assess whether response scale is proportionate to declared severity.'
  }
};

function renderUsecaseStrip() {
  const el = document.getElementById('usecase-strip');

  el.innerHTML = `
    <div class="uc-strip-inner">
      <div class="uc-explorer-btn ${activeUsecase === 'explorer' ? 'active' : ''}" data-usecase="explorer">
        <span class="uc-explorer-icon">⊕</span> Select your own query
      </div>
      <div class="uc-strip-divider"></div>
      <div class="uc-strip-label">Example queries</div>
      <div class="uc-presets">
        ${['funding-gap','displacement','emergency-response'].map(key => {
          const u = USECASES[key];
          return `<div class="uc-preset ${activeUsecase === key ? 'active' : ''}" data-usecase="${key}">
            <span class="uc-num">${u.eyebrow}</span>
            <span class="uc-preset-label">${u.label}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  el.querySelectorAll('[data-usecase]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeUsecase = btn.dataset.usecase;
      if (activeUsecase === 'funding-gap') activeIndicators = new Set(['funding', 'needs']);
      if (activeUsecase === 'displacement') activeIndicators = new Set(['idp', 'food']);
      if (activeUsecase === 'emergency-response') activeIndicators = new Set(['funding', 'needs', 'idp']);
      if (activeUsecase === 'explorer') activeIndicators = new Set(['idp', 'food', 'refugee', 'conflict', 'funding', 'needs']);
      syncIndicatorTags();
      renderUsecaseStrip();
      renderAll();
    });
  });
}

function renderUsecaseFraming() {
  const u = USECASES[activeUsecase];
  document.getElementById('usecase-framing').innerHTML = `
    <div class="uc-framing-domains">${u.domains}</div>
    <div class="uc-framing-title">${u.title}</div>
    <div class="uc-framing-desc">${u.description}</div>
  `;
}

function syncIndicatorTags() {
  const isExplorer = activeUsecase === 'explorer';
  document.querySelectorAll('#indicator-tags .tag').forEach(t => {
    t.classList.toggle('on', isExplorer && activeIndicators.has(t.dataset.v));
    t.classList.toggle('locked', !isExplorer);
  });
  const hint = document.getElementById('indicator-hint');
  if (hint) hint.style.display = isExplorer ? 'none' : 'block';
}

// ── Insight / query result ────────────────────────────────────────────────
// Labelled as "Query result" so the user understands what they're reading.
// Attribution shows which domains were joined to produce the answer.
function renderInsight() {
  const box = document.getElementById('insight-box');
  if (!box) return;
  const C = [...activeCountries];
  const u = USECASES[activeUsecase];

  let answer = '';
  if (!C.length) {
    answer = 'Select at least one country to see a result.';
  } else if (activeUsecase === 'funding-gap') {
    const fd = getFunding(), pin = getPIN(), costPP = getCostPerPersonTargeted();
    const ranked = C.map(c => ({ c, gap: fd[c]?.gap ?? 0, pct: fd[c]?.pct ?? 0, pin: pin[c] ?? 0, cost: costPP[c] })).sort((a, b) => b.gap - a.gap);
    const worst = ranked[0];
    const totalGap = ranked.reduce((s, r) => s + r.gap, 0);
    const totalPin = ranked.reduce((s, r) => s + r.pin, 0);
    const cheapest = [...ranked].filter(r => r.cost).sort((a, b) => a.cost - b.cost)[0];
    answer = `<b>${CNAMES[worst.c]}</b> carries the largest absolute funding gap at <b>${fmtUSD(worst.gap)}</b> against <b>${fmt(worst.pin)}</b> people in need (only <span class="flag-bad">${fmtPct(worst.pct)} funded</span>). Across ${C.length} countries: <b>${fmt(totalPin)}</b> people in need combined, <b>${fmtUSD(totalGap)}</b> in unmet requirements${cheapest ? ` — cost per person targeted lowest in <b>${CNAMES[cheapest.c]}</b> at ~<b>$${cheapest.cost.toFixed(0)}</b>` : ''}.`;
  } else if (activeUsecase === 'displacement') {
    const idps = getRecentIDPs(), food35 = getFoodInsecure35();
    const top = C.map(c => ({ c, idp: idps[c] ?? 0 })).sort((a, b) => b.idp - a.idp)[0];
    const topAdmin1 = getAdmin1JoinedRows(top.c).sort((a, b) => (b.idp || 0) - (a.idp || 0))[0];
    answer = `<b>${CNAMES[top.c]}</b> has the largest IDP stock at <b>${fmt(top.idp)}</b>, alongside <b>${fmt(food35[top.c])}</b> food-insecure people (IPC 3+). At admin-1 level, <b>${topAdmin1?.name}</b> shows the clearest overlap: <b>${fmt(topAdmin1?.idp)}</b> IDPs and <b>${fmt(topAdmin1?.food35)}</b> food-insecure — see the joint table for the full breakdown.`;
  } else if (activeUsecase === 'emergency-response') {
    const fd = getFunding(), pin = getPIN(), meta = store.country_meta;
    const l3 = C.filter(c => meta[c]?.emergency_level === 'L3');
    if (l3.length) {
      const c = l3[0];
      answer = `<b>${CNAMES[c]}</b> is the only <b>L3</b> emergency among selected countries (declared ${meta[c].l3_declared}), with <b>${fmt(pin[c])}</b> people in need against <b>${fmtPct(fd[c]?.pct)}</b> funding coverage — a <span class="flag-bad">scale-to-response mismatch</span> typical of protracted L3 settings competing for global funding.`;
    } else {
      answer = `No L3 emergencies among the selected countries. All are <b>L2</b>, with funding coverage from ${fmtPct(Math.min(...C.map(c => fd[c]?.pct || 0)))} to ${fmtPct(Math.max(...C.map(c => fd[c]?.pct || 0)))}.`;
    }
  } else {
    answer = `Showing <b>${C.map(c => CNAMES[c]).join(', ')}</b> across <b>${activeIndicators.size}</b> indicator domain${activeIndicators.size !== 1 ? 's' : ''}. Use the tabs below to explore the table, infographic, and map.`;
  }

  box.innerHTML = `
    <div class="insight-label">
      <span class="insight-label-text">Query result</span>
      <span class="insight-domains-tag">${u.domains}</span>
    </div>
    <div class="insight-answer">${answer}</div>
  `;
}
