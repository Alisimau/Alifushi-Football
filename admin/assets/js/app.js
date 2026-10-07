let players = [];
let records = [];
let editingRecordId = null;
let editingPlayerId = null;

const $ = id => document.getElementById(id);

const esc = s =>
  String(s ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));

function showView(v) {
  document.querySelectorAll('.view').forEach(x =>
    x.classList.remove('active')
  );

  const view = $(v);
  if (view) view.classList.add('active');

  document.querySelectorAll('.nav button[data-view]').forEach(x =>
    x.classList.toggle('active', x.dataset.view === v)
  );

  if (v === 'dashboard') loadDashboard();
  if (v === 'records') loadRecords();
  if (v === 'players') renderPlayers();
  if (v === 'stats' || v === 'leaderboard') loadStats();
  if (v === 'staff') loadStaff();
}

document.querySelectorAll('.nav button[data-view]').forEach(b => {
  b.onclick = () => showView(b.dataset.view);
});

function note(id, text, type = 'info') {
  const e = $(id);
  if (!e) return;

  e.className = 'message show ' + type;
  e.textContent = text;
}

/* =========================
   PLAYERS
========================= */

async function loadPlayers() {
  try {
    players = await api(
      '/rest/v1/Players?select=id,Name,"Nick Name",Phone,Photo_url&order=Name.asc'
    );

    if (!Array.isArray(players)) players = [];

    const sel = $('recordPlayer');

    if (sel) {
      sel.innerHTML =
        '<option value="">Select player</option>' +
        players.map(p =>
          `<option value="${p.id}">${esc(p.Name)}</option>`
        ).join('');
    }

    renderPlayers();

  } catch (e) {
    console.error(e);
    note('playerMsg', e.message, 'error');
  }
}

function renderPlayers() {
  const body = $('playersBody');
  if (!body) return;

  const q = ($('playerSearch')?.value || '').toLowerCase();

  const list = players.filter(p =>
    (p.Name || '').toLowerCase().includes(q) ||
    (p['Nick Name'] || '').toLowerCase().includes(q)
  );

  body.innerHTML = list.length
    ? list.map(p => `
      <tr>
        <td>${esc(p.Name)}</td>
        <td>${esc(p['Nick Name'])}</td>
        <td>${esc(p.Phone)}</td>
        <td>
          <button class="btn secondary"
            onclick="editPlayer(${p.id})">✏️ Edit</button>

          <button class="btn danger"
            onclick="deletePlayer(${p.id})">🗑️ Delete</button>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="empty">No players found.</td></tr>';
}

function editPlayer(id) {
  const p = players.find(x => x.id == id);
  if (!p) return;

  editingPlayerId = id;

  $('pName').value = p.Name || '';
  $('pNick').value = p['Nick Name'] || '';
  $('pPhone').value = p.Phone || '';
  $('pPhoto').value = p.Photo_url || '';

  showView('players');
  scrollTo(0, 0);
}

async function savePlayer() {
  const body = {
    Name: $('pName').value.trim(),
    'Nick Name': $('pNick').value.trim(),
    Phone: $('pPhone').value.trim(),
    Photo_url: $('pPhoto').value.trim() || null
  };

  if (!body.Name) {
    note('playerMsg', 'Enter player name.', 'error');
    return;
  }

  try {
    if (editingPlayerId) {
      await api(
        '/rest/v1/Players?id=eq.' + editingPlayerId,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(body)
        }
      );
    } else {
      await api(
        '/rest/v1/Players',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(body)
        }
      );
    }

    note(
      'playerMsg',
      editingPlayerId ? 'Player updated.' : 'Player added.',
      'success'
    );

    clearPlayerForm();
    await loadPlayers();

  } catch (e) {
    console.error(e);
    note('playerMsg', e.message, 'error');
  }
}

async function deletePlayer(id) {
  if (!confirm('Delete this player and their records?')) return;

  try {
    await api(
      '/rest/v1/Players?id=eq.' + id,
      {
        method: 'DELETE',
        headers: {
          'Prefer': 'return=minimal'
        }
      }
    );

    await loadPlayers();
    await loadDashboard();

  } catch (e) {
    console.error(e);
    note('playerMsg', e.message, 'error');
  }
}

function clearPlayerForm() {
  editingPlayerId = null;

  ['pName', 'pNick', 'pPhone', 'pPhoto'].forEach(x => {
    if ($(x)) $(x).value = '';
  });
}

/* =========================
   DAILY RECORDS
========================= */

async function loadRecords() {
  const date = $('recordDate')?.value;

  let path =
    '/rest/v1/player_match_records?select=*&order=match_date.desc,id.desc';

  if (date) {
    path += '&match_date=eq.' + encodeURIComponent(date);
  }

  try {
    records = await api(path);

    if (!Array.isArray(records)) records = [];

    renderRecords();

  } catch (e) {
    console.error(e);
    note('recordMsg', e.message, 'error');
  }
}

async function loadAllRecords() {
  try {
    records = await api(
      '/rest/v1/player_match_records?select=*&order=match_date.desc,id.desc'
    );

    if (!Array.isArray(records)) records = [];

    renderRecords();

  } catch (e) {
    console.error(e);
    note('recordMsg', e.message, 'error');
  }
}

function pname(id) {
  return players.find(p => p.id == id)?.Name ||
    ('Player #' + id);
}

function renderRecords() {
  const body = $('recordsBody');
  if (!body) return;

  body.innerHTML = records.length
    ? records.map(r => `
      <tr>
        <td>${esc(r.match_date)}</td>

        <td>${esc(pname(r.player_id))}</td>

        <td>
          <span class="pill ${(r.match_result || r.result || '').toLowerCase()}">
            ${esc(r.match_result || r.result || '-')}
          </span>
        </td>

        <td>
          ${
            r.player_score == null
              ? '-'
              : r.player_score + ' - ' + r.opposition_score
          }
        </td>

        <td>${r.clean_sheet ? 'Yes' : 'No'}</td>

        <td><b>${r.points ?? 0}</b></td>

        <td>
          <button class="btn secondary"
            onclick="editRecord(${r.id})">
            ✏️ Edit
          </button>

          <button class="btn danger"
            onclick="deleteRecord(${r.id})">
            🗑️ Delete
          </button>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="7" class="empty">No records found.</td></tr>';
}

/* =========================
   SAVE RECORD
========================= */

async function saveRecord() {

  const date = $('recordDate').value;
  const pid = $('recordPlayer').value;
  const result = $('recordResult').value;

  let ps = $('playerScore').value;
  let os = $('opponentScore').value;

  if (!date || !pid || !result) {
    note(
      'recordMsg',
      'Date, player and result are required.',
      'error'
    );
    return;
  }

  ps = ps === '' ? null : Number(ps);
  os = os === '' ? null : Number(os);

  if (
    ps !== null &&
    (!Number.isInteger(ps) || ps < 0)
  ) {
    note(
      'recordMsg',
      'Player score must be a valid whole number.',
      'error'
    );
    return;
  }

  if (
    os !== null &&
    (!Number.isInteger(os) || os < 0)
  ) {
    note(
      'recordMsg',
      'Opponent score must be a valid whole number.',
      'error'
    );
    return;
  }

  /*
    If scores are entered, make sure they agree
    with the selected result.
  */

  if (ps !== null && os !== null) {

    if (result === 'Win' && ps <= os) {
      note(
        'recordMsg',
        'For a Win, the player score must be greater than the opponent score.',
        'error'
      );
      return;
    }

    if (result === 'Loss' && ps >= os) {
      note(
        'recordMsg',
        'For a Loss, the player score must be lower than the opponent score.',
        'error'
      );
      return;
    }

    if (result === 'Draw' && ps !== os) {
      note(
        'recordMsg',
        'For a Draw, both scores must be equal.',
        'error'
      );
      return;
    }
  }

  const clean =
    ps !== null &&
    os !== null &&
    os === 0 &&
    ps >= os;

  const body = {
    match_date: date,
    player_id: Number(pid),
    player_score: ps,
    opposition_score: os,
    clean_sheet: clean,
    match_result: result
  };

  try {

    if (editingRecordId) {

      await api(
        '/rest/v1/player_match_records?id=eq.' +
        editingRecordId,
        {
          method: 'PATCH',

          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },

          body: JSON.stringify(body)
        }
      );

    } else {

      await api(
        '/rest/v1/player_match_records',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },

          body: JSON.stringify(body)
        }
      );
    }

    note(
      'recordMsg',
      editingRecordId
        ? 'Record updated successfully.'
        : 'Record saved successfully.',
      'success'
    );

    clearRecordForm();

    await loadRecords();
    await loadDashboard();
    await loadStats();

  } catch (e) {

    console.error('SAVE RECORD ERROR:', e);

    note(
      'recordMsg',
      e.message || 'Unable to save record.',
      'error'
    );
  }
}

function editRecord(id) {

  const r = records.find(x => x.id == id);

  if (!r) return;

  editingRecordId = id;

  $('recordDate').value = r.match_date || '';
  $('recordPlayer').value = r.player_id;
  $('recordResult').value =
    r.match_result || r.result || '';

  $('playerScore').value =
    r.player_score ?? '';

  $('opponentScore').value =
    r.opposition_score ?? '';

  showView('records');
  scrollTo(0, 0);
}

async function deleteRecord(id) {

  if (!confirm('Delete this record?')) return;

  try {

    await api(
      '/rest/v1/player_match_records?id=eq.' + id,
      {
        method: 'DELETE',
        headers: {
          'Prefer': 'return=minimal'
        }
      }
    );

    await loadRecords();
    await loadDashboard();
    await loadStats();

    note(
      'recordMsg',
      'Record deleted successfully.',
      'success'
    );

  } catch (e) {

    console.error(e);

    note(
      'recordMsg',
      e.message,
      'error'
    );
  }
}

function clearRecordForm() {

  editingRecordId = null;

  $('recordPlayer').value = '';
  $('recordResult').value = '';
  $('playerScore').value = '';
  $('opponentScore').value = '';
}

/* =========================
   STATISTICS
========================= */

async function aggregate() {

  const rows = await api(
    '/rest/v1/player_match_records?select=*'
  );

  const map = new Map(
    players.map(p => [
      p.id,
      {
        player: p,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        clean: 0,
        gd: 0
      }
    ])
  );

  for (const r of rows) {

    const x = map.get(r.player_id);

    if (!x) continue;

    x.played++;

    const res =
      r.match_result ||
      r.result;

    if (res === 'Win') x.wins++;
    else if (res === 'Draw') x.draws++;
    else if (res === 'Loss') x.losses++;

    x.points += Number(r.points || 0);

    if (r.clean_sheet) x.clean++;

    if (r.goal_difference != null) {
      x.gd += Number(r.goal_difference);
    }
  }

  return [...map.values()];
}

async function loadStats() {

  try {

    const a = await aggregate();

    a.sort(
      (x, y) =>
        y.points - x.points ||
        y.gd - x.gd ||
        y.wins - x.wins ||
        x.player.Name.localeCompare(y.player.Name)
    );

    const statsBody = $('statsBody');

    if (statsBody) {
      statsBody.innerHTML = a.map(x => `
        <tr>
          <td>${esc(x.player.Name)}</td>
          <td>${x.played}</td>
          <td>${x.wins}</td>
          <td>${x.draws}</td>
          <td>${x.losses}</td>
          <td><b>${x.points}</b></td>
          <td>${x.clean}</td>
          <td>${x.gd}</td>
        </tr>
      `).join('');
    }

    const leaderBody = $('leaderBody');

    if (leaderBody) {
      leaderBody.innerHTML = a.map((x, i) => `
        <tr>
          <td class="rank">${i + 1}</td>
          <td>${esc(x.player.Name)}</td>
          <td><b>${x.points}</b></td>
          <td>${x.played}</td>
          <td>${x.wins}</td>
          <td>${x.draws}</td>
          <td>${x.losses}</td>
          <td>${x.gd}</td>
          <td>${x.clean}</td>
        </tr>
      `).join('');
    }

  } catch (e) {

    console.error(e);
  }
}

/* =========================
   DASHBOARD
========================= */

async function loadDashboard() {

  try {

    const a = await aggregate();

    $('dPlayers').textContent =
      players.length;

    const rs = await api(
      '/rest/v1/player_match_records?select=id'
    );

    $('dRecords').textContent =
      Array.isArray(rs) ? rs.length : 0;

    $('dPoints').textContent =
      a.reduce((s, x) => s + x.points, 0);

    $('dClean').textContent =
      a.reduce((s, x) => s + x.clean, 0);

  } catch (e) {

    console.error(e);
  }
}

/* =========================
   STAFF
========================= */

async function staffCall(body) {

  const r = await fetch(
    APP_CONFIG.SUPABASE_URL +
    '/functions/v1/' +
    APP_CONFIG.STAFF_FUNCTION,
    {
      method: 'POST',

      headers: {
        apikey: APP_CONFIG.SUPABASE_PUBLISHABLE_KEY,
        Authorization: 'Bearer ' + token(),
        'Content-Type': 'application/json'
      },

      body: JSON.stringify(body)
    }
  );

  const text = await r.text();

  let d = {};

  if (text.trim()) {
    try {
      d = JSON.parse(text);
    } catch {
      d = { message: text };
    }
  }

  if (!r.ok) {
    throw new Error(
      d.error ||
      d.message ||
      'Staff request failed'
    );
  }

  return d;
}

async function loadStaff() {

  try {

    const d = await staffCall({
      action: 'list'
    });

    $('staffNav').classList.remove('hidden');
    $('role').textContent = '• Admin';

    const users =
      d.users ||
      d.staff ||
      d ||
      [];

    $('staffBody').innerHTML =
      users.length
        ? users.map(u => `
          <tr>
            <td>${esc(u.email)}</td>
            <td>${esc(u.role || 'staff')}</td>
            <td>${esc(u.created_at || '-')}</td>
            <td>
              ${
                u.role === 'admin'
                  ? 'Protected'
                  : `
                    <button class="btn danger"
                      onclick="removeStaff('${u.id}','${esc(u.email)}')">
                      Remove
                    </button>
                  `
              }
            </td>
          </tr>
        `).join('')
        : '<tr><td colspan="4" class="empty">No staff accounts.</td></tr>';

  } catch (e) {

    $('staffNav').classList.add('hidden');
    $('role').textContent = '• Staff';

  }
}

async function createStaff() {

  try {

    const email = $('sEmail').value.trim();
    const password = $('sPassword').value;

    if (!email || password.length < 6) {
      note(
        'staffMsg',
        'Enter email and a password of at least 6 characters.',
        'error'
      );
      return;
    }

    await staffCall({
      action: 'create',
      email,
      password
    });

    $('sEmail').value = '';
    $('sPassword').value = '';

    note(
      'staffMsg',
      'Staff account created.',
      'success'
    );

    loadStaff();

  } catch (e) {

    note(
      'staffMsg',
      e.message,
      'error'
    );
  }
}

async function removeStaff(id, email) {

  if (!confirm('Remove ' + email + '?')) return;

  try {

    await staffCall({
      action: 'delete',
      user_id: id
    });

    loadStaff();

  } catch (e) {

    note(
      'staffMsg',
      e.message,
      'error'
    );
  }
}

/* =========================
   START
========================= */

(async () => {

  if (!(await requireLogin())) return;

  try {

    await loadPlayers();
    await loadDashboard();

    const today =
      new Date().toISOString().slice(0, 10);

    $('recordDate').value = today;

    await loadRecords();
    await loadStats();
    await loadStaff();

    showView(
      location.hash.slice(1) ||
      'dashboard'
    );

  } catch (e) {

    console.error(e);
  }

})();
