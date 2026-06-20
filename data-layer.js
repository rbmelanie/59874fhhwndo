/* ============================================================
   HDX HAPI Cross-Domain Explorer — app.js (data layer + state)
   Reads HAPI_BUNDLE (from data/bundle.js). Swap loadData() for a
   live HAPI fetch when ready -- the rest of the app is agnostic
   to where rows come from, as long as the shape matches.
   ============================================================ */

const CNAMES = { SDN: 'Sudan', SSD: 'South Sudan', SOM: 'Somalia' };
const CODE_LC = { SDN: 'sdn', SSD: 'ssd', SOM: 'som' };
const COLORS = { SDN: 'var(--sdn)', SSD: 'var(--ssd)', SOM: 'var(--som)' };
const COLORS_HEX = { SDN: '#c1542c', SSD: '#1d7a5f', SOM: '#b08a2e' };
const COUNTRIES = ['SDN', 'SSD', 'SOM'];

let store = { idps: [], food: [], refugees: [], asylum: [], conflict: [], funding: [], needs: [], country_meta: {}, admin1_ref: {}, outlines: {} };
let activeCountries = new Set(['SDN', 'SSD', 'SOM']);
let activeIndicators = new Set(['idp', 'food', 'refugee', 'conflict', 'funding', 'needs']);
let adminLevel = 0; // 0 = national, 1 = admin-1. Mutually exclusive — never both.
let activeTab = 'usecase';
let activeUsecase = 'funding-gap';
let charts = {};
let tableRows = [];

function loadData() {
  // MOCK DATA MODE -- generated to plausible real-world order of magnitude.
  // Swap this block for live fetchHAPI() calls once the API token / CORS path is confirmed.
  store.idps = HAPI_BUNDLE.idps;
  store.food = HAPI_BUNDLE.food;
  store.refugees = HAPI_BUNDLE.refugees;
  store.asylum = HAPI_BUNDLE.asylum;
  store.conflict = HAPI_BUNDLE.conflict;
  store.funding = HAPI_BUNDLE.funding;
  store.needs = HAPI_BUNDLE.needs;
  store.country_meta = HAPI_BUNDLE.country_meta;
  store.admin1_ref = HAPI_BUNDLE.admin1_ref;
  store.outlines = HAPI_BUNDLE.outlines;
}

// ── Formatting ────────────────────────────────────────────────────────────
function fmt(n) {
  if (n === null || n === undefined || n === '') return '—';
  n = Number(n);
  if (isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e9) return sign + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return sign + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return sign + Math.round(n / 1e3) + 'K';
  return sign + Math.round(n).toLocaleString();
}
function fmtUSD(n) { if (n === null || n === undefined) return '—'; return '$' + fmt(n); }
function fmtPct(n) { if (n === null || n === undefined) return '—'; return Math.round(n) + '%'; }

// ── Derived metric getters (operate on activeCountries) ────────────────────

function getRecentIDPs() {
  const byC = {};
  for (const c of activeCountries) {
    const rows = store.idps.filter(r => r.location_code === c && r.admin_level === 0);
    byC[c] = rows.length ? rows[0].population : null;
  }
  return byC;
}

function getIDPsByAdmin1(iso) {
  return store.idps.filter(r => r.location_code === iso && r.admin_level === 1)
    .sort((a, b) => b.population - a.population);
}

function get12MoAgoIDPs() {
  const byC = {};
  for (const c of activeCountries) {
    const current = getRecentIDPs()[c];
    const mult = store.country_meta[c]?.idp_12mo_ago_mult ?? 1;
    byC[c] = current !== null ? Math.round(current * mult) : null;
  }
  return byC;
}

function getRecentFoodByPhase() {
  // returns { country: {1:.. 2:.. 3:.. 4:.. 5:.. total: ..} }
  const byC = {};
  for (const c of activeCountries) {
    const rows = store.food.filter(r => r.location_code === c && r.admin_level === 0);
    if (!rows.length) { byC[c] = null; continue; }
    const obj = { total: rows[0].population };
    rows.forEach(r => obj[r.ipc_phase] = r.population_in_phase);
    byC[c] = obj;
  }
  return byC;
}

function getFoodInsecure35() {
  const byPhase = getRecentFoodByPhase();
  const byC = {};
  for (const c of activeCountries) {
    const p = byPhase[c];
    byC[c] = p ? (p[3] || 0) + (p[4] || 0) + (p[5] || 0) : null;
  }
  return byC;
}

function getRefugees() {
  const byC = {};
  for (const c of activeCountries) {
    const r = store.refugees.find(x => x.origin_location_code === c);
    byC[c] = r ? r.population : null;
  }
  return byC;
}

function getAsylum() {
  const byC = {};
  for (const c of activeCountries) {
    const r = store.asylum.find(x => x.asylum_location_code === c);
    byC[c] = r ? r.population : null;
  }
  return byC;
}

function getConflictByCountry(yearFilter = null) {
  const byC = {};
  for (const c of activeCountries) {
    let rows = store.conflict.filter(r => r.location_code === c);
    if (yearFilter) rows = rows.filter(r => r.year === yearFilter);
    byC[c] = rows.reduce((s, r) => s + r.events, 0);
  }
  return byC;
}

function getConflictByYear() {
  // { country: { year: events } }
  const byC = {};
  for (const c of activeCountries) {
    byC[c] = {};
    for (let y = 2021; y <= 2026; y++) {
      byC[c][y] = store.conflict.filter(r => r.location_code === c && r.year === y).reduce((s, r) => s + r.events, 0);
    }
  }
  return byC;
}

function getConflictByType() {
  const byT = {};
  store.conflict.filter(r => activeCountries.has(r.location_code)).forEach(r => {
    byT[r.event_type] = (byT[r.event_type] || 0) + r.events;
  });
  return byT;
}

function getFatalitiesByCountry() {
  const byC = {};
  for (const c of activeCountries) {
    byC[c] = store.conflict.filter(r => r.location_code === c).reduce((s, r) => s + (r.fatalities || 0), 0);
  }
  return byC;
}

function getFunding() {
  const byC = {};
  for (const c of activeCountries) {
    const r = store.funding.find(x => x.location_code === c);
    if (!r) { byC[c] = { req: null, rec: null, pct: null, gap: null, appeal: null }; continue; }
    const pct = r.funding_usd && r.requirements_usd ? (r.funding_usd / r.requirements_usd * 100) : null;
    byC[c] = { req: r.requirements_usd, rec: r.funding_usd, pct, gap: r.requirements_usd - r.funding_usd, appeal: r.appeal_name };
  }
  return byC;
}

function getPIN() {
  const byC = {};
  for (const c of activeCountries) {
    const r = store.needs.find(x => x.location_code === c && x.admin_level === 0 && x.sector_code === 'Intersectoral');
    byC[c] = r ? r.population : null;
  }
  return byC;
}

function getPINbyAdmin1(iso) {
  return store.needs.filter(r => r.location_code === iso && r.admin_level === 1 && r.sector_code === 'Intersectoral')
    .sort((a, b) => b.population - a.population);
}

function getPINbySector() {
  const byS = {};
  store.needs.filter(r => activeCountries.has(r.location_code) && r.admin_level === 0 && r.sector_code !== 'Intersectoral')
    .forEach(r => { byS[r.sector_name] = (byS[r.sector_name] || 0) + r.population; });
  return byS;
}

function getCostPerPersonTargeted() {
  // Funding required / HRP people targeted -- a standard "ask per person" metric
  const byC = {};
  const fd = getFunding();
  for (const c of activeCountries) {
    const meta = store.country_meta[c];
    const req = fd[c]?.req;
    if (meta && req) byC[c] = req / meta.hrp_people_targeted;
    else byC[c] = null;
  }
  return byC;
}

// ── Admin1 joined rows (the cross-domain "join" demonstration) ─────────────
function getAdmin1JoinedRows(iso) {
  const ref = store.admin1_ref[iso] || [];
  return ref.map(a => {
    const idpRow = store.idps.find(r => r.location_code === iso && r.admin1_code === a.code && r.admin_level === 1);
    const foodRows = store.food.filter(r => r.location_code === iso && r.admin1_code === a.code && r.admin_level === 1);
    const pinRow = store.needs.find(r => r.location_code === iso && r.admin1_code === a.code && r.admin_level === 1 && r.sector_code === 'Intersectoral');
    const conflictRows = store.conflict.filter(r => r.location_code === iso && r.admin1_code === a.code && r.year === 2026);
    const food35 = foodRows.filter(r => [3, 4, 5].includes(r.ipc_phase)).reduce((s, r) => s + r.population_in_phase, 0);
    const conflictEvents = conflictRows.reduce((s, r) => s + r.events, 0);
    return {
      code: a.code, name: a.name, lon: a.lon, lat: a.lat, pop_base: a.pop_base,
      idp: idpRow ? idpRow.population : null,
      food35,
      pin: pinRow ? pinRow.population : null,
      conflict: conflictEvents
    };
  });
}
