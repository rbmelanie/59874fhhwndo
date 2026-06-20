/* ============================================================
   table.js — the joint table.
   Shows EITHER national OR admin-1 rows, never both (controlled
   by adminLevel in data-layer.js) — avoids any appearance of
   double-counting between geography levels.
   Country groups can be collapsed when admin-1 is selected.
   ============================================================ */

let collapsedCountries = new Set();

function renderTable() {
  const C = [...activeCountries];
  const wrap = document.getElementById('tbl-wrap');
  if (!C.length) { wrap.innerHTML = '<div class="empty">Select at least one country.</div>'; return; }

  const idps = getRecentIDPs(), food35 = getFoodInsecure35(), refs = getRefugees(),
        funding = getFunding(), pin = getPIN(), conflictByC = getConflictByCountry(2026);

  // Column set depends on use case (keeps the table focused on the question being asked)
  let cols;
  if (activeUsecase === 'funding-gap') {
    cols = [
      { k: 'country', l: 'Country / Admin 1' },
      { k: 'pin', l: 'People in need' },
      { k: 'req', l: 'Required (USD)' },
      { k: 'rec', l: 'Received (USD)' },
      { k: 'pct', l: 'Coverage' },
      { k: 'gap', l: 'Gap (USD)' }
    ];
  } else if (activeUsecase === 'displacement') {
    cols = [
      { k: 'country', l: 'Country / Admin 1' },
      { k: 'idp', l: 'IDPs' },
      { k: 'food35', l: 'Food insecure (IPC 3+)' },
      { k: 'ref', l: 'Refugees (origin)' },
      { k: 'conflict', l: 'Conflict events (2026)' }
    ];
  } else if (activeUsecase === 'emergency-response') {
    cols = [
      { k: 'country', l: 'Country / Admin 1' },
      { k: 'level', l: 'Emergency level' },
      { k: 'pin', l: 'People in need' },
      { k: 'targeted', l: 'People targeted' },
      { k: 'pct', l: 'Funding coverage' },
      { k: 'idp', l: 'IDPs' }
    ];
  } else {
    cols = [{ k: 'country', l: 'Country / Admin 1' }];
    if (activeIndicators.has('idp')) cols.push({ k: 'idp', l: 'IDPs' });
    if (activeIndicators.has('food')) cols.push({ k: 'food35', l: 'Food insecure (IPC 3+)' });
    if (activeIndicators.has('refugee')) cols.push({ k: 'ref', l: 'Refugees (origin)' });
    if (activeIndicators.has('needs')) cols.push({ k: 'pin', l: 'People in need' });
    if (activeIndicators.has('conflict')) cols.push({ k: 'conflict', l: 'Conflict events (2026)' });
    if (activeIndicators.has('funding')) cols.push({ k: 'pct', l: 'Funding coverage' }, { k: 'req', l: 'Required (USD)' }, { k: 'rec', l: 'Received (USD)' });
  }

  // Refugee/funding columns don't exist at admin-1 (not tracked at that resolution in source data) — drop them when showing admin-1
  if (adminLevel === 1) {
    cols = cols.filter(c => !['ref', 'req', 'rec', 'pct', 'gap', 'targeted', 'level'].includes(c.k));
  }

  const rows = [];
  for (const c of C) {
    if (adminLevel === 0) {
      const meta = store.country_meta[c];
      rows.push({
        _group: true, country: CNAMES[c], idp: idps[c], food35: food35[c], ref: refs[c], pin: pin[c],
        conflict: conflictByC[c], req: funding[c]?.req, rec: funding[c]?.rec, pct: funding[c]?.pct,
        gap: funding[c]?.gap, level: meta?.emergency_level, targeted: meta?.hrp_people_targeted
      });
    } else {
      // Admin-1 mode: a collapsible country header row + its admin-1 children
      const isCollapsed = collapsedCountries.has(c);
      rows.push({ _group: true, _iso: c, _collapsible: true, _collapsed: isCollapsed, country: CNAMES[c], idp: idps[c], food35: food35[c], pin: pin[c], conflict: conflictByC[c] });
      if (!isCollapsed) {
        const a1 = getAdmin1JoinedRows(c).sort((a, b) => (b.idp || 0) - (a.idp || 0));
        for (const a of a1) {
          rows.push({ _group: false, country: a.name, idp: a.idp, food35: a.food35, pin: a.pin, conflict: a.conflict });
        }
      }
    }
  }
  tableRows = rows;

  const theadHTML = `<tr>${cols.map(c => `<th>${c.l}</th>`).join('')}</tr>`;
  const tbodyHTML = rows.map(r => {
    const rowClass = r._group ? 'national-row' : '';
    const toggle = r._collapsible ? `<span class="row-toggle" data-toggle-country="${r._iso}">${r._collapsed ? '▸' : '▾'}</span> ` : '';
    const indent = r._group ? '' : '↳ ';
    return `<tr class="${rowClass}">${cols.map(col => {
      if (col.k === 'country') return `<td>${toggle}${indent}${r.country}</td>`;
      if (col.k === 'level') return r.level ? `<td><span class="badge ${r.level === 'L3' ? 'b-bad' : 'b-warn'}">${r.level}</span></td>` : '<td>—</td>';
      if (col.k === 'pct') {
        const p = r.pct;
        if (p === null || p === undefined) return '<td>—</td>';
        const cls = p >= 70 ? 'b-good' : p >= 40 ? 'b-warn' : 'b-bad';
        return `<td><span class="badge ${cls}">${Math.round(p)}%</span></td>`;
      }
      if (['req', 'rec', 'gap'].includes(col.k)) return `<td>${fmtUSD(r[col.k])}</td>`;
      return `<td>${fmt(r[col.k])}</td>`;
    }).join('')}</tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="table-note">This table dynamically adjusts to the filters selected above.</div>
    <div class="export-bar">
      <button class="btn secondary" onclick="exportCSV()">Export CSV</button>
    </div>
    <div class="tbl-wrap">
      <table><thead>${theadHTML}</thead><tbody>${tbodyHTML}</tbody></table>
    </div>
  `;

  wrap.querySelectorAll('[data-toggle-country]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const iso = el.dataset.toggleCountry;
      if (collapsedCountries.has(iso)) collapsedCountries.delete(iso);
      else collapsedCountries.add(iso);
      renderTable();
    });
  });
}

function exportCSV() {
  if (!tableRows.length) { alert('No data loaded.'); return; }
  const internalKeys = ['_group', '_iso', '_collapsible', '_collapsed'];
  const keys = Object.keys(tableRows[0]).filter(k => !internalKeys.includes(k));
  const lines = [keys.join(',')];
  for (const r of tableRows) {
    lines.push(keys.map(k => {
      const v = r[k];
      if (v === null || v === undefined) return '';
      return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'humanitarian_data_' + activeUsecase + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}
