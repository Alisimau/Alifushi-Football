/* HAVEERU KULHUN ADMIN - ONE APP.JS */
let players = [];
let records = [];
let editingPlayerId = null;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function msg(id, text, type='info') {
  const e = $(id); if (!e) return;
  e.textContent = text; e.className = 'message show ' + type;
}

function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const e = $(view); if (e) e.classList.add('active');
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'dashboard') loadDashboard();
  if (view === 'records') { loadPlayers(); loadDailyRecords(); loadHistory(); }
  if (view === 'players') renderPlayers();
  if (view === 'stats' || view === 'leaderboard') loadStats();
  if (view === 'staff') loadStaff();
}

document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => showView(b.dataset.view));

/* ---------- DAILY RECORDS: SIMPLE VERSION ---------- */
function buildDailyRecordsUI() {
  const section = $('records');
  if (!section) return;
  section.innerHTML = `
    <div class="hero"><h1>Daily Records</h1><p>Select players one by one, save their result, then enter the match score.</p></div>
    <div class="card">
      <label>Date</label>
      <input type="date" id="matchDate" onchange="loadDailyRecords()">
    </div>
    <div class="card">
      <h2>Player Result</h2>
      <div class="info">Select a player, choose Win, Draw or Loss, then save. Repeat for every player you need.</div>
      <div class="form-grid">
        <div class="field"><label>Select Player</label><select id="recordPlayer"><option value="">Select player</option></select></div>
        <div class="field"><label>Result</label><select id="recordResult"><option value="Win">🟢 Win</option><option value="Draw">🟡 Draw</option><option value="Loss">🔴 Loss</option></select></div>
      </div>
      <button class="btn" style="width:100%;margin-top:16px" onclick="savePlayerResult()">💾 Save Player Result</button>
      <div id="recordMessage" class="message"></div>
    </div>
    <div class="card">
      <h2>Players Recorded For This Date</h2>
      <div class="table-wrap"><table><thead><tr><th>Player</th><th>Result</th><th>Score</th><th>Points</th><th>Action</th></tr></thead><tbody id="dailyPlayersBody"><tr><td colspan="5" class="empty">No players recorded yet.</td></tr></tbody></table></div>
    </div>
    <div class="card" id="scoreCard" style="display:none">
      <h2>Enter Daily Score</h2>
      <div class="info">Enter the match score once. It will be applied to all players recorded for this date.</div>
      <div class="form-grid">
        <div class="field"><label>Winning Score</label><input type="number" id="winningScore" min="0" placeholder="Example: 5"></div>
        <div class="field"><label>Losing Score</label><input type="number" id="losingScore" min="0" placeholder="Example: 2"></div>
        <div class="field"><label>Draw Score</label><input type="number" id="drawScore" min="0" placeholder="Only for Draw"></div>
      </div>
      <button class="btn" style="width:100%;margin-top:16px;background:#16a34a" onclick="applyDailyScore()">📊 Apply Score To All Players</button>
      <div id="scoreMessage" class="message"></div>
    </div>
    <div class="card">
      <div class="actions" style="justify-content:space-between"><h2 style="margin:0">Record History</h2><button class="btn secondary" onclick="loadHistory()">🔄 Refresh</button></div>
      <br><div class="table-wrap"><table><thead><tr><th>Date</th><th>Player</th><th>Result</th><th>Score</th><th>Clean Sheet</th><th>Points</th><th>Actions</th></tr></thead><tbody id="recordsBody"></tbody></table></div>
    </div>`;
}

function resultOf(r) { return r?.match_result || r?.result || ''; }
function playerName(id) { return players.find(p => Number(p.id) === Number(id))?.Name || ('Player #' + id); }

async function loadDailyRecords() {
  const date = $('matchDate')?.value;
  if (!date) return;
  try {
    const data = await api('/rest/v1/player_match_records?match_date=eq.' + encodeURIComponent(date) + '&select=*&order=id.asc');
    records = Array.isArray(data) ? data : [];
    renderDailyPlayers();
    showScoreCard();
  } catch (e) { msg('recordMessage', e.message, 'error'); }
}

async function loadPlayers() {
  try {
    const data = await api('/rest/v1/Players?select=id,Name,"Nick Name",Phone,Photo_url&order=Name.asc');
    players = Array.isArray(data) ? data : [];
    renderPlayers();
    fillRecordPlayer();
    renderDailyPlayers();
  } catch (e) { console.error(e); }
}

function fillRecordPlayer() {
  const s = $('recordPlayer'); if (!s) return;
  const current = s.value;
  const used = new Set(records.map(r => String(r.player_id)));
  s.innerHTML = '<option value="">Select player</option>' + players.map(p => `<option value="${p.id}" ${used.has(String(p.id)) ? 'disabled' : ''}>${esc(p.Name)}</option>`).join('');
  if (current && !used.has(current)) s.value = current;
}

function renderDailyPlayers() {
  const body = $('dailyPlayersBody'); if (!body) return;
  if (!records.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No players recorded yet.</td></tr>';
    $('scoreCard').style.display = 'none';
    fillRecordPlayer();
    return;
  }
  body.innerHTML = records.map(r => `<tr>
    <td>${esc(playerName(r.player_id))}</td>
    <td>${esc(resultOf(r))}</td>
    <td>${r.player_score == null ? '-' : r.player_score + ' - ' + r.opposition_score}</td>
    <td><b>${r.points ?? 0}</b></td>
    <td><button class="btn secondary" onclick="editDailyRecord(${r.id})">✏️ Edit</button> <button class="btn danger" onclick="deleteDailyRecord(${r.id})">🗑️ Delete</button></td>
  </tr>`).join('');
  fillRecordPlayer();
  showScoreCard();
}

function showScoreCard() {
  const card = $('scoreCard'); if (!card) return;
  card.style.display = records.length ? 'block' : 'none';
  const win = records.some(r => resultOf(r) === 'Win');
  const loss = records.some(r => resultOf(r) === 'Loss');
  const draw = records.some(r => resultOf(r) === 'Draw');
  if (!records.some(r => r.player_score != null)) return;
  const scored = records.find(r => r.player_score != null);
  if (scored) {
    if (Number(scored.player_score) === Number(scored.opposition_score)) $('drawScore').value = scored.player_score;
    else { $('winningScore').value = Math.max(scored.player_score, scored.opposition_score); $('losingScore').value = Math.min(scored.player_score, scored.opposition_score); }
  }
}

async function savePlayerResult() {
  const date = $('matchDate').value, pid = $('recordPlayer').value, result = $('recordResult').value;
  if (!date) return msg('recordMessage', 'Please select a date.', 'error');
  if (!pid) return msg('recordMessage', 'Please select a player.', 'error');
  try {
    const existing = records.find(r => Number(r.player_id) === Number(pid));
    const body = { match_date: date, player_id: Number(pid), match_result: result, player_score: null, opposition_score: null, clean_sheet: false };
    if (existing) await api('/rest/v1/player_match_records?id=eq.' + existing.id, { method:'PATCH', headers:{'Content-Type':'application/json','Prefer':'return=minimal'}, body:JSON.stringify(body) });
    else await api('/rest/v1/player_match_records', { method:'POST', headers:{'Content-Type':'application/json','Prefer':'return=minimal'}, body:JSON.stringify(body) });
    msg('recordMessage', playerName(pid) + ' — ' + result + ' saved. Select the next player.', 'success');
    await loadDailyRecords(); await loadHistory();
  } catch (e) { msg('recordMessage', e.message, 'error'); }
}

async function applyDailyScore() {
  if (!records.length) return msg('scoreMessage', 'Save at least one player result first.', 'error');
  const hasWL = records.some(r => resultOf(r) === 'Win' || resultOf(r) === 'Loss');
  const hasDraw = records.some(r => resultOf(r) === 'Draw');
  const ws = $('winningScore').value, ls = $('losingScore').value, ds = $('drawScore').value;
  if (hasWL && (ws === '' || ls === '')) return msg('scoreMessage', 'Enter the winning score and losing score.', 'error');
  if (hasWL && Number(ws) <= Number(ls)) return msg('scoreMessage', 'Winning score must be greater than losing score.', 'error');
  if (hasDraw && ds === '') return msg('scoreMessage', 'Enter the draw score.', 'error');
  try {
    for (const r of records) {
      const res = resultOf(r); let ps, os;
      if (res === 'Win') { ps = Number(ws); os = Number(ls); }
      else if (res === 'Loss') { ps = Number(ls); os = Number(ws); }
      else if (res === 'Draw') { ps = Number(ds); os = Number(ds); }
      else continue;
      await api('/rest/v1/player_match_records?id=eq.' + r.id, { method:'PATCH', headers:{'Content-Type':'application/json','Prefer':'return=minimal'}, body:JSON.stringify({player_score:ps,opposition_score:os,clean_sheet:os===0&&ps>=os,match_result:res}) });
    }
    msg('scoreMessage', 'Score applied successfully to all recorded players.', 'success');
    await loadDailyRecords(); await loadHistory(); await loadStats(); await loadDashboard();
  } catch (e) { msg('scoreMessage', e.message, 'error'); }
}

async function editDailyRecord(id) {
  const r = records.find(x => Number(x.id) === Number(id)); if (!r) return;
  $('recordPlayer').value = String(r.player_id);
  $('recordPlayer').disabled = true;
  $('recordResult').value = resultOf(r);
  const btn = document.querySelector('#records button[onclick="savePlayerResult()"]');
  if (btn) { btn.textContent = '💾 Update Player Result'; btn.onclick = () => updateEditedRecord(id); }
  msg('recordMessage', 'Editing ' + playerName(r.player_id) + '. Change the result and save.', 'info');
}

async function updateEditedRecord(id) {
  const result = $('recordResult').value;
  try {
    await api('/rest/v1/player_match_records?id=eq.' + id, {method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({match_result:result,player_score:null,opposition_score:null,clean_sheet:false})});
    $('recordPlayer').disabled = false;
    const btn = document.querySelector('#records button[onclick="updateEditedRecord(' + id + ')"]');
    if (btn) { btn.textContent='💾 Save Player Result'; btn.onclick=savePlayerResult; }
    await loadDailyRecords(); await loadHistory(); msg('recordMessage','Updated successfully.','success');
  } catch(e) { msg('recordMessage',e.message,'error'); }
}

async function deleteDailyRecord(id) {
  if (!confirm('Delete this player record?')) return;
  try {
    await api('/rest/v1/player_match_records?id=eq.' + id, {method:'DELETE',headers:{'Prefer':'return=minimal'}});
    await loadDailyRecords(); await loadHistory(); await loadStats(); await loadDashboard();
  } catch(e) { msg('recordMessage',e.message,'error'); }
}

async function loadHistory() {
  const body = $('recordsBody'); if (!body) return;
  try {
    const date = $('matchDate')?.value;
    let path = '/rest/v1/player_match_records?select=*&order=match_date.desc,id.desc';
    if (date) path = '/rest/v1/player_match_records?match_date=eq.' + encodeURIComponent(date) + '&select=*&order=id.desc';
    const data = await api(path); const rs = Array.isArray(data) ? data : [];
    body.innerHTML = rs.length ? rs.map(r => `<tr><td>${esc(r.match_date)}</td><td>${esc(playerName(r.player_id))}</td><td>${esc(resultOf(r))}</td><td>${r.player_score==null?'-':r.player_score+' - '+r.opposition_score}</td><td>${r.clean_sheet?'Yes':'No'}</td><td><b>${r.points??0}</b></td><td><button class="btn secondary" onclick="editDailyRecord(${r.id})">✏️ Edit</button> <button class="btn danger" onclick="deleteDailyRecord(${r.id})">🗑️ Delete</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty">No records found.</td></tr>';
  } catch(e) { body.innerHTML='<tr><td colspan="7" class="empty">'+esc(e.message)+'</td></tr>'; }
}

/* ---------- PLAYERS ---------- */
function renderPlayers() {
  const body=$('playersBody'); if(!body)return;
  const q=($('playerSearch')?.value||'').toLowerCase();
  const list=players.filter(p=>(p.Name||'').toLowerCase().includes(q)||(p['Nick Name']||'').toLowerCase().includes(q));
  body.innerHTML=list.length?list.map(p=>`<tr><td>${esc(p.Name)}</td><td>${esc(p['Nick Name'])}</td><td>${esc(p.Phone)}</td><td><button class="btn secondary" onclick="editPlayer(${p.id})">✏️ Edit</button> <button class="btn danger" onclick="deletePlayer(${p.id})">🗑️ Delete</button></td></tr>`).join(''):'<tr><td colspan="4" class="empty">No players found.</td></tr>';
}
function editPlayer(id){const p=players.find(x=>x.id==id);if(!p)return;editingPlayerId=id;$('pName').value=p.Name||'';$('pNick').value=p['Nick Name']||'';$('pPhone').value=p.Phone||'';$('pPhoto').value=p.Photo_url||'';showView('players');}
async function savePlayer(){const body={Name:$('pName').value.trim(),'Nick Name':$('pNick').value.trim(),Phone:$('pPhone').value.trim(),Photo_url:$('pPhoto').value.trim()||null};if(!body.Name)return msg('playerMsg','Enter player name.','error');try{if(editingPlayerId)await api('/rest/v1/Players?id=eq.'+editingPlayerId,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(body)});else await api('/rest/v1/Players',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(body)});clearPlayerForm();await loadPlayers();msg('playerMsg','Player saved.','success');}catch(e){msg('playerMsg',e.message,'error')}}
function clearPlayerForm(){editingPlayerId=null;['pName','pNick','pPhone','pPhoto'].forEach(id=>{if($(id))$(id).value=''})}
async function deletePlayer(id){if(!confirm('Delete this player and their records?'))return;try{await api('/rest/v1/Players?id=eq.'+id,{method:'DELETE',headers:{'Prefer':'return=minimal'}});await loadPlayers();await loadStats();await loadDashboard();}catch(e){msg('playerMsg',e.message,'error')}}

/* ---------- STATS ---------- */
async function aggregate(){const rs=await api('/rest/v1/player_match_records?select=*')||[];const map=new Map(players.map(p=>[p.id,{player:p,played:0,wins:0,draws:0,losses:0,points:0,clean:0,gd:0}]));for(const r of rs){const x=map.get(r.player_id);if(!x)continue;x.played++;const z=resultOf(r);if(z==='Win')x.wins++;else if(z==='Draw')x.draws++;else if(z==='Loss')x.losses++;x.points+=Number(r.points||0);x.clean+=r.clean_sheet?1:0;x.gd+=Number(r.goal_difference||0)}return [...map.values()]}
async function loadStats(){try{const a=await aggregate();a.sort((x,y)=>y.points-x.points||y.gd-x.gd||y.wins-x.wins||x.player.Name.localeCompare(y.player.Name));if($('statsBody'))$('statsBody').innerHTML=a.map(x=>`<tr><td>${esc(x.player.Name)}</td><td>${x.played}</td><td>${x.wins}</td><td>${x.draws}</td><td>${x.losses}</td><td><b>${x.points}</b></td><td>${x.clean}</td><td>${x.gd}</td></tr>`).join('');if($('leaderBody'))$('leaderBody').innerHTML=a.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.player.Name)}</td><td><b>${x.points}</b></td><td>${x.played}</td><td>${x.wins}</td><td>${x.draws}</td><td>${x.losses}</td><td>${x.gd}</td><td>${x.clean}</td></tr>`).join('')}catch(e){console.error(e)}}
async function loadDashboard(){try{const a=await aggregate();$('dPlayers').textContent=players.length;$('dRecords').textContent=a.reduce((s,x)=>s+x.played,0);$('dPoints').textContent=a.reduce((s,x)=>s+x.points,0);$('dClean').textContent=a.reduce((s,x)=>s+x.clean,0)}catch(e){console.error(e)}}

/* ---------- STAFF ---------- */
async function staffCall(body){const r=await fetch(APP_CONFIG.SUPABASE_URL+'/functions/v1/'+APP_CONFIG.STAFF_FUNCTION,{method:'POST',headers:{apikey:APP_CONFIG.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:JSON.stringify(body)});const t=await r.text();let d={};if(t.trim()){try{d=JSON.parse(t)}catch{d={message:t}}}if(!r.ok)throw new Error(d.error||d.message||'Staff request failed');return d}
async function loadStaff(){try{const d=await staffCall({action:'list'});const users=d.users||d.staff||d||[];$('staffBody').innerHTML=users.length?users.map(u=>`<tr><td>${esc(u.email)}</td><td>${esc(u.role||'staff')}</td><td>${esc(u.created_at||'-')}</td><td>${u.role==='admin'?'Protected':`<button class="btn danger" onclick="removeStaff('${u.id}')">Remove</button>`}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No staff accounts.</td></tr>'}catch(e){console.log(e)}}
async function createStaff(){try{const email=$('sEmail').value.trim(),password=$('sPassword').value;if(!email||password.length<6)return msg('staffMsg','Enter email and a password of at least 6 characters.','error');await staffCall({action:'create',email,password});$('sEmail').value='';$('sPassword').value='';msg('staffMsg','Staff account created.','success');loadStaff()}catch(e){msg('staffMsg',e.message,'error')}}
async function removeStaff(id){if(!confirm('Remove this staff account?'))return;try{await staffCall({action:'delete',user_id:id});loadStaff()}catch(e){msg('staffMsg',e.message,'error')}}

/* ---------- START ---------- */
(async()=>{
  try {
    if (typeof requireLogin === 'function' && !(await requireLogin())) return;
    buildDailyRecordsUI();
    const today=new Date().toISOString().slice(0,10);
    if($('matchDate'))$('matchDate').value=today;
    await loadPlayers();
    await loadDailyRecords();
    await loadHistory();
    await loadDashboard();
    await loadStats();
    await loadStaff();
    showView(location.hash.slice(1)||'dashboard');
  } catch(e) { console.error(e); }
})();
