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

/* =========================
   NAVIGATION
========================= */

function showView(v) {

    document.querySelectorAll('.view')
        .forEach(x => x.classList.remove('active'));

    const view = $(v);

    if (view) {
        view.classList.add('active');
    }

    document
        .querySelectorAll('.nav button[data-view]')
        .forEach(x =>
            x.classList.toggle(
                'active',
                x.dataset.view === v
            )
        );

    if (v === 'dashboard') loadDashboard();
    if (v === 'records') loadRecords();
    if (v === 'players') renderPlayers();
    if (v === 'stats' || v === 'leaderboard') loadStats();
    if (v === 'staff') loadStaff();
}

document
    .querySelectorAll('.nav button[data-view]')
    .forEach(b => {
        b.onclick = () => showView(b.dataset.view);
    });


/* =========================
   MESSAGE
========================= */

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

        const sel = $('recordPlayer');

        if (sel) {

            sel.innerHTML =
                '<option value="">Select player</option>' +
                players.map(p =>
                    `<option value="${p.id}">
                        ${esc(p.Name)}
                    </option>`
                ).join('');
        }

        renderPlayers();

    } catch (e) {

        console.error(e);

        if ($('playerMsg')) {
            note(
                'playerMsg',
                e.message,
                'error'
            );
        }
    }
}


/* =========================
   RENDER PLAYERS
========================= */

function renderPlayers() {

    const body = $('playersBody');

    if (!body) return;

    const q =
        ($('playerSearch')?.value || '')
            .toLowerCase()
            .trim();

    const list = players.filter(p =>
        (p.Name || '')
            .toLowerCase()
            .includes(q) ||

        (p['Nick Name'] || '')
            .toLowerCase()
            .includes(q)
    );

    body.innerHTML = list.length

        ? list.map(p => `

            <tr>

                <td>
                    ${esc(p.Name)}
                </td>

                <td>
                    ${esc(p['Nick Name'])}
                </td>

                <td>
                    ${esc(p.Phone)}
                </td>

                <td>

                    <button
                        class="btn secondary"
                        onclick="editPlayer(${p.id})">
                        ✏️ Edit
                    </button>

                    <button
                        class="btn danger"
                        onclick="deletePlayer(${p.id})">
                        🗑️ Delete
                    </button>

                </td>

            </tr>

        `).join('')

        : `
            <tr>
                <td
                    colspan="4"
                    class="empty">
                    No players found.
                </td>
            </tr>
        `;
}


/* =========================
   EDIT PLAYER
========================= */

function editPlayer(id) {

    const p =
        players.find(x => x.id == id);

    if (!p) return;

    editingPlayerId = id;

    if ($('pName'))
        $('pName').value = p.Name || '';

    if ($('pNick'))
        $('pNick').value =
            p['Nick Name'] || '';

    if ($('pPhone'))
        $('pPhone').value =
            p.Phone || '';

    if ($('pPhoto'))
        $('pPhoto').value =
            p.Photo_url || '';

    showView('players');

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}


/* =========================
   SAVE PLAYER
========================= */

async function savePlayer() {

    const name =
        $('pName')?.value.trim() || '';

    const nickname =
        $('pNick')?.value.trim() || '';

    const phone =
        $('pPhone')?.value.trim() || '';

    const photo =
        $('pPhoto')?.value.trim() || '';

    if (!name) {

        note(
            'playerMsg',
            'Enter player name.',
            'error'
        );

        return;
    }

    const body = {

        Name: name,

        'Nick Name': nickname,

        Phone: phone,

        Photo_url: photo || null
    };

    try {

        if (editingPlayerId) {

            await api(
                '/rest/v1/Players?id=eq.' +
                editingPlayerId,
                {
                    method: 'PATCH',

                    headers: {
                        'Content-Type':
                            'application/json',

                        'Prefer':
                            'return=minimal'
                    },

                    body:
                        JSON.stringify(body)
                }
            );

        } else {

            await api(
                '/rest/v1/Players',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json',

                        'Prefer':
                            'return=minimal'
                    },

                    body:
                        JSON.stringify(body)
                }
            );
        }

        note(
            'playerMsg',
            editingPlayerId
                ? 'Player updated successfully.'
                : 'Player added successfully.',
            'success'
        );

        clearPlayerForm();

        await loadPlayers();

        await loadDashboard();

    } catch (e) {

        console.error(e);

        note(
            'playerMsg',
            e.message,
            'error'
        );
    }
}


/* =========================
   DELETE PLAYER
========================= */

async function deletePlayer(id) {

    if (
        !confirm(
            'Delete this player and their records?'
        )
    ) {
        return;
    }

    try {

        await api(
            '/rest/v1/Players?id=eq.' + id,
            {
                method: 'DELETE'
            }
        );

        editingPlayerId = null;

        await loadPlayers();

        await loadDashboard();

        note(
            'playerMsg',
            'Player deleted successfully.',
            'success'
        );

    } catch (e) {

        console.error(e);

        note(
            'playerMsg',
            e.message,
            'error'
        );
    }
}


/* =========================
   CLEAR PLAYER FORM
========================= */

function clearPlayerForm() {

    editingPlayerId = null;

    [
        'pName',
        'pNick',
        'pPhone',
        'pPhoto'
    ].forEach(id => {

        if ($(id)) {
            $(id).value = '';
        }

    });
}


/* =========================
   RECORDS
========================= */

async function loadRecords() {

    try {

        const date =
            $('recordDate')?.value || '';

        let path =
            '/rest/v1/player_match_records' +
            '?select=*' +
            '&order=match_date.desc,id.desc';

        if (date) {
            path +=
                '&match_date=eq.' +
                date;
        }

        records = await api(path);

        renderRecords();

    } catch (e) {

        console.error(e);

        if ($('recordMsg')) {
            note(
                'recordMsg',
                e.message,
                'error'
            );
        }
    }
}


async function loadAllRecords() {

    records =
        await api(
            '/rest/v1/player_match_records' +
            '?select=*' +
            '&order=match_date.desc,id.desc'
        );

    renderRecords();
}


function pname(id) {

    return (
        players.find(p => p.id == id)?.Name ||
        'Player #' + id
    );
}


/* =========================
   RENDER RECORDS
========================= */

function renderRecords() {

    const body =
        $('recordsBody');

    if (!body) return;

    body.innerHTML = records.length

        ? records.map(r => {

            const result =
                r.match_result ||
                r.result ||
                '-';

            const score =
                r.player_score == null ||
                r.opposition_score == null

                    ? '-'

                    : r.player_score +
                      ' - ' +
                      r.opposition_score;

            return `

                <tr>

                    <td>
                        ${esc(r.match_date)}
                    </td>

                    <td>
                        ${esc(
                            pname(r.player_id)
                        )}
                    </td>

                    <td>

                        <span
                            class="pill ${result.toLowerCase()}">

                            ${esc(result)}

                        </span>

                    </td>

                    <td>
                        ${score}
                    </td>

                    <td>
                        ${r.clean_sheet
                            ? 'Yes'
                            : 'No'}
                    </td>

                    <td>
                        <b>
                            ${r.points ?? 0}
                        </b>
                    </td>

                    <td>

                        <button
                            class="btn secondary"
                            onclick="editRecord(${r.id})">
                            ✏️ Edit
                        </button>

                        <button
                            class="btn danger"
                            onclick="deleteRecord(${r.id})">
                            🗑️ Delete
                        </button>

                    </td>

                </tr>
            `;

        }).join('')

        : `

            <tr>

                <td
                    colspan="7"
                    class="empty">

                    No records found.

                </td>

            </tr>
        `;
}


/* =========================
   SAVE RECORD
========================= */

async function saveRecord() {

    const date =
        $('recordDate')?.value || '';

    const pid =
        $('recordPlayer')?.value || '';

    const result =
        $('recordResult')?.value || '';

    let ps =
        $('playerScore')?.value ?? '';

    let os =
        $('opponentScore')?.value ?? '';

    if (!date || !pid || !result) {

        note(
            'recordMsg',
            'Date, player and result are required.',
            'error'
        );

        return;
    }

    ps =
        ps === ''
            ? null
            : Number(ps);

    os =
        os === ''
            ? null
            : Number(os);

    if (
        ps !== null &&
        (!Number.isInteger(ps) || ps < 0)
    ) {

        note(
            'recordMsg',
            'Player score must be a valid number.',
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
            'Opponent score must be a valid number.',
            'error'
        );

        return;
    }

    /*
       Automatic clean sheet:

       Opponent score = 0
       AND player score is available
    */

    const clean =
        ps !== null &&
        os !== null &&
        os === 0;

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
                        'Content-Type':
                            'application/json',

                        'Prefer':
                            'return=minimal'
                    },

                    body:
                        JSON.stringify(body)
                }
            );

        } else {

            await api(
                '/rest/v1/player_match_records',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json',

                        'Prefer':
                            'return=minimal'
                    },

                    body:
                        JSON.stringify(body)
                }
            );
        }

        note(
            'recordMsg',
            editingRecordId
                ? 'Record updated.'
                : 'Record saved.',
            'success'
        );

        clearRecordForm();

        await loadRecords();

        await loadDashboard();

        await loadStats();

    } catch (e) {

        console.error(e);

        note(
            'recordMsg',
            e.message,
            'error'
        );
    }
}


/* =========================
   EDIT RECORD
========================= */

function editRecord(id) {

    const r =
        records.find(x => x.id == id);

    if (!r) return;

    editingRecordId = id;

    if ($('recordDate'))
        $('recordDate').value =
            r.match_date || '';

    if ($('recordPlayer'))
        $('recordPlayer').value =
            r.player_id;

    if ($('recordResult'))
        $('recordResult').value =
            r.match_result ||
            r.result ||
            '';

    if ($('playerScore'))
        $('playerScore').value =
            r.player_score ?? '';

    if ($('opponentScore'))
        $('opponentScore').value =
            r.opposition_score ?? '';

    showView('records');

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}


/* =========================
   DELETE RECORD
========================= */

async function deleteRecord(id) {

    if (
        !confirm(
            'Delete this record?'
        )
    ) {
        return;
    }

    try {

        await api(
            '/rest/v1/player_match_records?id=eq.' +
            id,
            {
                method: 'DELETE'
            }
        );

        await loadRecords();

        await loadDashboard();

        await loadStats();

        note(
            'recordMsg',
            'Record deleted.',
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


/* =========================
   CLEAR RECORD FORM
========================= */

function clearRecordForm() {

    editingRecordId = null;

    if ($('recordPlayer'))
        $('recordPlayer').value = '';

    if ($('recordResult'))
        $('recordResult').value = '';

    if ($('playerScore'))
        $('playerScore').value = '';

    if ($('opponentScore'))
        $('opponentScore').value = '';
}


/* =========================
   AGGREGATE PLAYER STATS
========================= */

async function aggregate() {

    const rows =
        await api(
            '/rest/v1/player_match_records?select=*'
        );

    const map =
        new Map(
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

        const x =
            map.get(r.player_id);

        if (!x) continue;

        x.played++;

        let result =
            r.match_result ||
            r.result;

        /*
           If no manual result exists,
           calculate it from score.
        */

        if (
            !result &&
            r.player_score != null &&
            r.opposition_score != null
        ) {

            const ps =
                Number(r.player_score);

            const os =
                Number(r.opposition_score);

            if (ps > os)
                result = 'Win';

            else if (ps < os)
                result = 'Loss';

            else
                result = 'Draw';
        }

        if (result === 'Win')
            x.wins++;

        else if (result === 'Draw')
            x.draws++;

        else if (result === 'Loss')
            x.losses++;

        /*
           Use database-generated points.
        */

        x.points +=
            Number(r.points || 0);

        if (r.clean_sheet)
            x.clean++;

        if (r.goal_difference != null)
            x.gd +=
                Number(r.goal_difference);
    }

    return [...map.values()];
}


/* =========================
   STATS + LEADERBOARD
========================= */

async function loadStats() {

    try {

        const a =
            await aggregate();

        a.sort(
            (x, y) =>
                y.points - x.points ||
                y.gd - x.gd ||
                y.wins - x.wins ||
                x.player.Name.localeCompare(
                    y.player.Name
                )
        );

        const statsBody =
            $('statsBody');

        if (statsBody) {

            statsBody.innerHTML =
                a.map(x => `

                    <tr>

                        <td>
                            ${esc(x.player.Name)}
                        </td>

                        <td>
                            ${x.played}
                        </td>

                        <td>
                            ${x.wins}
                        </td>

                        <td>
                            ${x.draws}
                        </td>

                        <td>
                            ${x.losses}
                        </td>

                        <td>
                            <b>
                                ${x.points}
                            </b>
                        </td>

                        <td>
                            ${x.clean}
                        </td>

                        <td>
                            ${x.gd}
                        </td>

                    </tr>

                `).join('');
        }


        const leaderBody =
            $('leaderBody');

        if (leaderBody) {

            leaderBody.innerHTML =
                a.map((x, i) => `

                    <tr>

                        <td class="rank">
                            ${i + 1}
                        </td>

                        <td>
                            ${esc(
                                x.player.Name
                            )}
                        </td>

                        <td>
                            <b>
                                ${x.points}
                            </b>
                        </td>

                        <td>
                            ${x.played}
                        </td>

                        <td>
                            ${x.wins}
                        </td>

                        <td>
                            ${x.draws}
                        </td>

                        <td>
                            ${x.losses}
                        </td>

                        <td>
                            ${x.gd}
                        </td>

                        <td>
                            ${x.clean}
                        </td>

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

        const a =
            await aggregate();

        if ($('dPlayers'))
            $('dPlayers').textContent =
                players.length;

        const rs =
            await api(
                '/rest/v1/player_match_records?select=id'
            );

        if ($('dRecords'))
            $('dRecords').textContent =
                rs.length;

        if ($('dPoints'))
            $('dPoints').textContent =
                a.reduce(
                    (s, x) =>
                        s + x.points,
                    0
                );

        if ($('dClean'))
            $('dClean').textContent =
                a.reduce(
                    (s, x) =>
                        s + x.clean,
                    0
                );

    } catch (e) {

        console.error(e);
    }
}


/* =========================
   STAFF
========================= */

async function staffCall(body) {

    const r =
        await fetch(
            APP_CONFIG.SUPABASE_URL +
            '/functions/v1/' +
            APP_CONFIG.STAFF_FUNCTION,
            {
                method: 'POST',

                headers: {

                    apikey:
                        APP_CONFIG.SUPABASE_PUBLISHABLE_KEY,

                    Authorization:
                        'Bearer ' + token(),

                    'Content-Type':
                        'application/json'
                },

                body:
                    JSON.stringify(body)
            }
        );

    const d =
        await r.json()
            .catch(() => ({}));

    if (!r.ok) {

        throw new Error(
            d.error ||
            d.message ||
            'Staff request failed'
        );
    }

    return d;
}


/* =========================
   LOAD STAFF
========================= */

async function loadStaff() {

    try {

        const d =
            await staffCall({
                action: 'list'
            });

        if ($('staffNav'))
            $('staffNav')
                .classList
                .remove('hidden');

        if ($('role'))
            $('role').textContent =
                '• Admin';

        const users =
            d.users ||
            d.staff ||
            d ||
            [];

        if (!$('staffBody'))
            return;

        $('staffBody').innerHTML =
            users.length

                ? users.map(u => `

                    <tr>

                        <td>
                            ${esc(u.email)}
                        </td>

                        <td>
                            ${esc(
                                u.role ||
                                'staff'
                            )}
                        </td>

                        <td>
                            ${esc(
                                u.created_at ||
                                '-'
                            )}
                        </td>

                        <td>

                            ${
                                u.role === 'admin'

                                    ? 'Protected'

                                    : `
                                        <button
                                            class="btn danger"
                                            onclick="removeStaff(
                                                '${u.id}',
                                                '${esc(u.email)}'
                                            )">
                                            Remove
                                        </button>
                                    `
                            }

                        </td>

                    </tr>

                `).join('')

                : `

                    <tr>

                        <td
                            colspan="4"
                            class="empty">

                            No staff accounts.

                        </td>

                    </tr>
                `;

    } catch (e) {

        console.error(e);

        if ($('staffNav'))
            $('staffNav')
                .classList
                .add('hidden');

        if ($('role'))
            $('role').textContent =
                '• Staff';
    }
}


/* =========================
   CREATE STAFF
========================= */

async function createStaff() {

    try {

        const email =
            $('sEmail')?.value.trim() ||
            '';

        const password =
            $('sPassword')?.value ||
            '';

        if (
            !email ||
            password.length < 6
        ) {

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

        await loadStaff();

    } catch (e) {

        note(
            'staffMsg',
            e.message,
            'error'
        );
    }
}


/* =========================
   REMOVE STAFF
========================= */

async function removeStaff(
    id,
    email
) {

    if (
        !confirm(
            'Remove ' +
            email +
            '?'
        )
    ) {
        return;
    }

    try {

        await staffCall({
            action: 'delete',
            user_id: id
        });

        await loadStaff();

    } catch (e) {

        note(
            'staffMsg',
            e.message,
            'error'
        );
    }
}


/* =========================
   START APPLICATION
========================= */

(async function () {

    if (!(await requireLogin()))
        return;

    try {

        await loadPlayers();

        await loadDashboard();

        const today =
            new Date()
                .toISOString()
                .slice(0, 10);

        if ($('recordDate'))
            $('recordDate').value =
                today;

        await loadRecords();

        await loadStats();

        await loadStaff();

        showView(
            location.hash.slice(1) ||
            'dashboard'
        );

    } catch (e) {

        console.error(e);

        alert(
            'Error loading admin panel: ' +
            e.message
        );
    }

})();
