let players=[];
let records=[];
let editingPlayerId=null;

const $=id=>document.getElementById(id);

function esc(s){
 return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function note(id,text,type='info'){
 const e=$(id); if(!e)return;
 e.className='message show '+type;
 e.textContent=text;
}

function showView(v){
 document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
 const view=$(v); if(view)view.classList.add('active');
 document.querySelectorAll('.nav button[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===v));
 if(v==='dashboard')loadDashboard();
 if(v==='records'){loadPlayers();loadExistingRecords();loadHistory();}
 if(v==='players')renderPlayers();
 if(v==='stats'||v==='leaderboard')loadStats();
 if(v==='staff')loadStaff();
}

document.querySelectorAll('.nav button[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));

async function loadPlayers(){
 try{
  const r=await api('/rest/v1/Players?select=id,Name,"Nick Name",Phone,Photo_url&order=Name.asc');
  players=Array.isArray(r)?r:[];
  renderPlayers();
  populateRecordPlayerSelect();
  renderRecordPlayers(records);
 }catch(e){console.error(e);note('playerMsg',e.message,'error')}
}

function renderPlayers(){
 const body=$('playersBody');if(!body)return;
 const q=($('playerSearch')?.value||'').toLowerCase();
 const list=players.filter(p=>(p.Name||'').toLowerCase().includes(q)||(p['Nick Name']||'').toLowerCase().includes(q));
 body.innerHTML=list.length?list.map(p=>`
 <tr><td>${esc(p.Name)}</td><td>${esc(p['Nick Name'])}</td><td>${esc(p.Phone)}</td><td>
 <button class="btn secondary" onclick="editPlayer(${p.id})">✏️ Edit</button>
 <button class="btn danger" onclick="deletePlayer(${p.id})">🗑️ Delete</button>
 </td></tr>`).join(''):'<tr><td colspan="4" class="empty">No players found.</td></tr>';
}

function editPlayer(id){
 const p=players.find(x=>x.id==id);if(!p)return;
 editingPlayerId=id;
 $('pName').value=p.Name||'';
 $('pNick').value=p['Nick Name']||'';
 $('pPhone').value=p.Phone||'';
 $('pPhoto').value=p.Photo_url||'';
 showView('players');
 scrollTo(0,0);
}

async function savePlayer(){
 const body={Name:$('pName').value.trim(),'Nick Name':$('pNick').value.trim(),Phone:$('pPhone').value.trim(),Photo_url:$('pPhoto').value.trim()||null};
 if(!body.Name){note('playerMsg','Enter player name.','error');return}
 try{
  if(editingPlayerId)await api('/rest/v1/Players?id=eq.'+editingPlayerId,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(body)});
  else await api('/rest/v1/Players',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(body)});
  note('playerMsg',editingPlayerId?'Player updated.':'Player added.','success');
  clearPlayerForm();await loadPlayers();await loadDashboard();
 }catch(e){note('playerMsg',e.message,'error')}
}

async function deletePlayer(id){
 if(!confirm('Delete this player and their records?'))return;
 try{await api('/rest/v1/Players?id=eq.'+id,{method:'DELETE',headers:{'Prefer':'return=minimal'}});await loadPlayers();await loadDashboard();await loadStats();}
 catch(e){note('playerMsg',e.message,'error')}
}

function clearPlayerForm(){editingPlayerId=null;['pName','pNick','pPhone','pPhoto'].forEach(x=>{if($(x))$(x).value=''})}

/* ===== DAILY RECORDS: select players individually ===== */

function getResult(r){
 return r?.match_result||r?.result||'';
}

function populateRecordPlayerSelect(){
 const sel=$('recordPlayer');if(!sel)return;
 const current=sel.value;
 sel.innerHTML='<option value="">Select player</option>'+players.map(p=>`<option value="${p.id}">${esc(p.Name||'Unknown')}${p['Nick Name']?' ('+esc(p['Nick Name'])+')':''}</option>`).join('');
 if(players.some(p=>String(p.id)===String(current)))sel.value=current;
}

function renderRecordPlayers(existing=[]){
 const list=$('playersList');if(!list)return;
 if(!existing.length){list.innerHTML='<div class="empty">No players selected for this date yet.</div>';return}
 list.innerHTML=existing.map(r=>{
  const p=players.find(x=>Number(x.id)===Number(r.player_id));
  return `<div class="selected-player-row">
   <div><div class="record-player-name">${esc(p?.Name||'Unknown')}</div><span class="small muted">${esc(getResult(r))}${r.player_score!=null?' • '+r.player_score+' - '+r.opposition_score:''}</span></div>
   <div class="actions">
    <button class="btn secondary" onclick="editSelectedPlayer(${r.id})">✏️ Edit</button>
    <button class="btn danger" onclick="deleteHistoryRecord(${r.id})">🗑️ Remove</button>
   </div>
  </div>`;
 }).join('');
 updateScoreBoxes();
}

async function loadExistingRecords(){
 const date=$('matchDate')?.value;if(!date)return;
 try{
  const r=await api('/rest/v1/player_match_records?match_date=eq.'+encodeURIComponent(date)+'&select=*&order=id.asc');
  records=Array.isArray(r)?r:[];
  renderRecordPlayers(records);
  restoreScores(records);
 }catch(e){console.error(e);note('message',e.message,'error')}
}

function restoreScores(rs){
 const scored=rs.find(r=>r.player_score!==null&&r.opposition_score!==null);
 if(!scored)return;
 const a=Number(scored.player_score),b=Number(scored.opposition_score);
 if(a===b){$('drawScore').value=a}
 else{$('winningScore').value=Math.max(a,b);$('losingScore').value=Math.min(a,b)}
}

function updateScoreBoxes(){
 const result=$('recordResult')?.value||'';
 $('winLossBox').style.display=(result==='Win'||result==='Loss')?'block':'none';
 $('drawBox').style.display=result==='Draw'?'block':'none';
 $('scoreSection').style.display=result?'block':'none';
}

async function saveDailyRecord(){
 const date=$('matchDate').value;
 const pid=$('recordPlayer').value;
 const result=$('recordResult').value;
 if(!date){note('message','Please select a date.','error');return}
 if(!pid){note('message','Please select a player.','error');return}
 if(!result){note('message','Please select Win, Draw or Loss.','error');return}
 try{
  const existing=records.find(r=>Number(r.player_id)===Number(pid));
  const body={match_date:date,player_id:Number(pid),match_result:result};
  if(existing){
   await api('/rest/v1/player_match_records?id=eq.'+existing.id,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(body)});
  }else{
   await api('/rest/v1/player_match_records',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(body)});
  }
  note('message', 'Player result saved. Select another player to add another result.','success');
  $('recordPlayer').value='';
  $('recordResult').value='';
  await loadExistingRecords();
  await loadHistory();
 }catch(e){console.error(e);note('message',e.message,'error')}
}

async function editSelectedPlayer(id){
 const r=records.find(x=>Number(x.id)===Number(id));if(!r)return;
 $('recordPlayer').value=String(r.player_id);
 $('recordResult').value=getResult(r);
 updateScoreBoxes();
 document.querySelector('#records .card')?.scrollIntoView({behavior:'smooth',block:'start'});
}

async function applyDailyScore(){
 const date=$('matchDate').value;if(!date){note('scoreMessage','Please select a date.','error');return}
 const rs=await api('/rest/v1/player_match_records?match_date=eq.'+encodeURIComponent(date)+'&select=*');
 if(!Array.isArray(rs)||!rs.length){note('scoreMessage','No player records found for this date. Add players first.','error');return}
 const results=[...new Set(rs.map(getResult).filter(Boolean))];
 const hasWin=results.includes('Win'),hasLoss=results.includes('Loss'),hasDraw=results.includes('Draw');
 const win=$('winningScore').value,loss=$('losingScore').value,draw=$('drawScore').value;
 if((hasWin||hasLoss)&&(win===''||loss==='')){note('scoreMessage','Please enter the winning and losing scores.','error');return}
 if((hasWin||hasLoss)&&Number(win)<=Number(loss)){note('scoreMessage','Winning score must be greater than losing score.','error');return}
 if(hasDraw&&draw===''){note('scoreMessage','Please enter the draw score.','error');return}
 try{
  for(const r of rs){
   const result=getResult(r);let ps=null,os=null;
   if(result==='Win'){ps=Number(win);os=Number(loss)}
   else if(result==='Loss'){ps=Number(loss);os=Number(win)}
   else if(result==='Draw'){ps=Number(draw);os=Number(draw)}
   else continue;
   const clean=os===0&&ps>=os;
   await api('/rest/v1/player_match_records?id=eq.'+r.id,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({player_score:ps,opposition_score:os,clean_sheet:clean,match_result:result})});
  }
  note('scoreMessage','Daily score applied successfully.','success');
  await loadExistingRecords();await loadHistory();await loadDashboard();await loadStats();
 }catch(e){console.error(e);note('scoreMessage',e.message,'error')}
}

/* ===== HISTORY ===== */

async function loadHistory(){const date=$('matchDate')?.value;if(!date)return;try{const r=await api('/rest/v1/player_match_records?match_date=eq.'+encodeURIComponent(date)+'&select=*&order=id.desc');records=Array.isArray(r)?r:[];renderHistory(records)}catch(e){note('message',e.message,'error')}}
async function loadAllHistory(){try{const r=await api('/rest/v1/player_match_records?select=*&order=match_date.desc,id.desc');records=Array.isArray(r)?r:[];renderHistory(records)}catch(e){note('message',e.message,'error')}}

function pname(id){return players.find(p=>Number(p.id)===Number(id))?.Name||('Player #'+id)}

function renderHistory(rs){
 const body=$('recordsBody');if(!body)return;
 body.innerHTML=rs.length?rs.map(r=>`
 <tr><td>${esc(r.match_date)}</td><td>${esc(pname(r.player_id))}</td>
 <td>${esc(getResult(r)||'-')}</td>
 <td>${r.player_score==null?'-':r.player_score+' - '+r.opposition_score}</td>
 <td>${r.clean_sheet?'Yes':'No'}</td><td><b>${r.points??0}</b></td>
 <td><button class="btn secondary" onclick="editHistoryRecord(${r.id})">✏️ Edit</button>
 <button class="btn danger" onclick="deleteHistoryRecord(${r.id})">🗑️ Delete</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty">No records found.</td></tr>';
}

async function editHistoryRecord(id){
 const r=records.find(x=>Number(x.id)===Number(id));if(!r)return;
 const newResult=prompt('Result (Win, Draw or Loss):',getResult(r));if(!newResult)return;
 const result=newResult.trim().replace(/^./,c=>c.toUpperCase());
 if(!['Win','Draw','Loss'].includes(result)){alert('Use Win, Draw or Loss.');return}
 const currentPS=r.player_score==null?'':r.player_score,currentOS=r.opposition_score==null?'':r.opposition_score;
 const ps=prompt('Player score (leave blank to keep score empty):',currentPS);
 if(ps===null)return;
 const os=prompt('Opponent score (leave blank to keep score empty):',currentOS);
 if(os===null)return;
 const p=ps===''?null:Number(ps),o=os===''?null:Number(os);
 if(p!==null&&(!Number.isInteger(p)||p<0)||o!==null&&(!Number.isInteger(o)||o<0)){alert('Scores must be whole numbers.');return}
 if(p!==null&&o!==null){
  if(result==='Win'&&p<=o){alert('For Win, player score must be greater.');return}
  if(result==='Loss'&&p>=o){alert('For Loss, player score must be lower.');return}
  if(result==='Draw'&&p!==o){alert('For Draw, scores must be equal.');return}
 }
 const clean=p!==null&&o===0&&p>=o;
 try{await api('/rest/v1/player_match_records?id=eq.'+id,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({match_result:result,player_score:p,opposition_score:o,clean_sheet:clean})});await loadHistory();await loadExistingRecords();await loadDashboard();await loadStats();note('message','Record updated successfully.','success')}catch(e){note('message',e.message,'error')}
}

async function deleteHistoryRecord(id){
 if(!confirm('Delete this record?'))return;
 try{await api('/rest/v1/player_match_records?id=eq.'+id,{method:'DELETE',headers:{'Prefer':'return=minimal'}});await loadHistory();await loadExistingRecords();await loadDashboard();await loadStats();note('message','Record deleted successfully.','success')}catch(e){note('message',e.message,'error')}
}

/* ===== STATS ===== */

async function aggregate(){
 const rs=await api('/rest/v1/player_match_records?select=*');
 const map=new Map(players.map(p=>[p.id,{player:p,played:0,wins:0,draws:0,losses:0,points:0,clean:0,gd:0}]));
 for(const r of rs){
  const x=map.get(r.player_id);if(!x)continue;
  x.played++;
  const res=getResult(r);
  if(res==='Win')x.wins++;else if(res==='Draw')x.draws++;else if(res==='Loss')x.losses++;
  x.points+=Number(r.points||0);if(r.clean_sheet)x.clean++;x.gd+=Number(r.goal_difference||0);
 }
 return [...map.values()];
}

async function loadStats(){
 try{
  const a=await aggregate();
  a.sort((x,y)=>y.points-x.points||y.gd-x.gd||y.wins-x.wins||x.player.Name.localeCompare(y.player.Name));
  if($('statsBody'))$('statsBody').innerHTML=a.map(x=>`<tr><td>${esc(x.player.Name)}</td><td>${x.played}</td><td>${x.wins}</td><td>${x.draws}</td><td>${x.losses}</td><td><b>${x.points}</b></td><td>${x.clean}</td><td>${x.gd}</td></tr>`).join('');
  if($('leaderBody'))$('leaderBody').innerHTML=a.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.player.Name)}</td><td><b>${x.points}</b></td><td>${x.played}</td><td>${x.wins}</td><td>${x.draws}</td><td>${x.losses}</td><td>${x.gd}</td><td>${x.clean}</td></tr>`).join('');
 }catch(e){console.error(e)}
}

async function loadDashboard(){
 try{
  const a=await aggregate();
  $('dPlayers').textContent=players.length;
  $('dRecords').textContent=a.reduce((s,x)=>s+x.played,0);
  $('dPoints').textContent=a.reduce((s,x)=>s+x.points,0);
  $('dClean').textContent=a.reduce((s,x)=>s+x.clean,0);
 }catch(e){console.error(e)}
}

/* ===== STAFF ===== */

async function staffCall(body){
 const r=await fetch(APP_CONFIG.SUPABASE_URL+'/functions/v1/'+APP_CONFIG.STAFF_FUNCTION,{method:'POST',headers:{apikey:APP_CONFIG.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:JSON.stringify(body)});
 const text=await r.text();let d={};if(text.trim()){try{d=JSON.parse(text)}catch{d={message:text}}}
 if(!r.ok)throw new Error(d.error||d.message||'Staff request failed');return d;
}
async function loadStaff(){
 try{
  const d=await staffCall({action:'list'});$('staffNav').classList.remove('hidden');$('role').textContent='• Admin';
  const users=d.users||d.staff||d||[];
  $('staffBody').innerHTML=users.length?users.map(u=>`<tr><td>${esc(u.email)}</td><td>${esc(u.role||'staff')}</td><td>${esc(u.created_at||'-')}</td><td>${u.role==='admin'?'Protected':`<button class="btn danger" onclick="removeStaff('${u.id}')">Remove</button>`}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No staff accounts.</td></tr>';
 }catch(e){$('staffNav').classList.add('hidden');$('role').textContent='• Staff'}
}
async function createStaff(){try{const email=$('sEmail').value.trim(),password=$('sPassword').value;if(!email||password.length<6){note('staffMsg','Enter email and a password of at least 6 characters.','error');return}await staffCall({action:'create',email,password});$('sEmail').value='';$('sPassword').value='';note('staffMsg','Staff account created.','success');loadStaff()}catch(e){note('staffMsg',e.message,'error')}}
async function removeStaff(id){if(!confirm('Remove this staff account?'))return;try{await staffCall({action:'delete',user_id:id});loadStaff()}catch(e){note('staffMsg',e.message,'error')}}

/* ===== START ===== */

(async()=>{
 if(!(await requireLogin()))return;
 try{
  await loadPlayers();
  const today=new Date().toISOString().slice(0,10);
  $('matchDate').value=today;
  await loadExistingRecords();
  await loadHistory();
  await loadDashboard();
  await loadStats();
  await loadStaff();
  showView(location.hash.slice(1)||'dashboard');
 }catch(e){console.error(e)}
})();
