/* FieldDesk: client-side GitHub Pages application. Database security is enforced in Supabase RLS. */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const datestr = s => s ? new Date(s+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'No due date';
const stamp = s => s ? new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—';
const locations = ['Yorktown','Central Building','Jamestown'];
const state = {client:null,user:null,profile:null,profiles:[],orders:[],tasks:[],comments:[],time:[],photos:[],reportUser:'all',analyticsUser:'all',analyticsLocation:'all',analyticsPeriod:'all',analyticsFrom:'',analyticsTo:'',analyticsView:{},page:'dashboard',filter:'',status:'all',location:'all',detail:null,signup:false};
let toastTimer;
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
function config(){const shared=window.FIELDDESK_CONFIG;if(shared && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(shared.url||'') && shared.key && !shared.key.includes('PASTE_'))return shared;try{return JSON.parse(localStorage.getItem('fielddesk_config')||'null')}catch{return null}}
function initClient(){const c=config();if(!c || !c.url || !c.key)return false;if(!window.supabase){console.error('Supabase library failed to load');return 'library-missing'}try{state.client=window.supabase.createClient(c.url,c.key);return true}catch(e){console.error('Supabase client initialization failed',e);return 'library-missing'}}
function show(view){['setupView','authView','appView'].forEach(x=>$(x).classList.toggle('hidden',x!==view))}
async function start(){const shared=window.FIELDDESK_CONFIG;const ready=shared && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(shared.url||'') && shared.key && !shared.key.includes('PASTE_');$('resetConfig').classList.toggle('hidden',!!ready);const initialized=initClient();if(initialized!==true){if(initialized==='library-missing'){show('authView');toast('Unable to load Supabase. Check internet connection and refresh.');}else{show('setupView')}return}try{const {data,error}=await state.client.auth.getUser();if(error)throw error;if(!data.user){show('authView');return}state.user=data.user;await loadData();show('appView');render()}catch(e){console.error(e);show('authView');toast('Connection issue: '+e.message)}}
$('saveConfig').onclick=()=>{const url=$('projectUrl').value.trim().replace(/\/$/,'');const key=$('publicKey').value.trim();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!key){toast('Enter a valid Supabase URL and publishable / anon key.');return}localStorage.setItem('fielddesk_config',JSON.stringify({url,key}));location.reload()};
$('resetConfig').onclick=()=>{localStorage.removeItem('fielddesk_config');location.reload()};
$('toggleAuth').onclick=()=>{state.signup=!state.signup;$('nameLabel').classList.toggle('hidden',!state.signup);$('authSubmit').textContent=state.signup?'Create account':'Sign in';$('toggleAuth').textContent=state.signup?'Have an account? Sign in':'New technician? Create an account';$('password').autocomplete=state.signup?'new-password':'current-password'};
$('authForm').onsubmit=async e=>{e.preventDefault();if(!state.client){toast('Connection unavailable. Check internet and refresh the page.');return;}const email=$('email').value.trim(),password=$('password').value,button=$('authSubmit');button.disabled=true;try{if(state.signup){const {data,error}=await state.client.auth.signUp({email,password,options:{data:{full_name:$('fullName').value.trim()}}});if(error)throw error;if(!data.session){toast('Account created. Check your email to confirm, then sign in.');$('toggleAuth').click();return}}else{const {error}=await state.client.auth.signInWithPassword({email,password});if(error)throw error}await start()}catch(err){toast(err.message)}finally{button.disabled=false}};
$('logout').onclick=async()=>{await state.client.auth.signOut();state.user=null;state.profile=null;state.orders=[];show('authView')};
$('refreshBtn').onclick=async()=>{await refresh()};
$('mobileMenu').onclick=() => document.querySelector('.sidebar').classList.toggle('open');
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;state.detail=null;document.querySelector('.sidebar').classList.remove('open');render()});
$('closeBackdrop').onclick=closeModal;
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
function fail(res){if(res.error)throw res.error;return res.data}
const isAdmin=()=>state.profile?.role==='admin';
const canWork=o=>isAdmin() || o.assigned_to===state.user?.id;
const profileName=id=>state.profiles.find(p=>p.id===id)?.full_name || (id?'Unknown technician':'Unassigned');
function statusPill(s){return `<span class="pill status-${esc(s)}">${s==='in_progress'?'In progress':s==='completed'?'Completed':'Open'}</span>`}
function priorityPill(s){return `<span class="pill priority-${esc(s)}">${esc(s)}</span>`}
async function loadData(){
 const c=state.client,u=state.user;
 const profile=fail(await c.from('profiles').select('*').eq('id',u.id).single());state.profile=profile;
 const results=await Promise.all([
 c.from('profiles').select('id,full_name,role').order('full_name'),
 c.from('work_orders').select('*').order('created_at',{ascending:false}),
 c.from('order_tasks').select('*').order('position',{ascending:true}),
 c.from('order_comments').select('*').order('created_at',{ascending:true}),
 c.from('time_entries').select('*').order('created_at',{ascending:false}),
  c.from('work_order_photos').select('*').order('created_at',{ascending:false})]);
 [state.profiles,state.orders,state.tasks,state.comments,state.time,state.photos]=results.map(fail);
}
async function refresh(){try{await loadData();render();toast('Workspace updated')}catch(e){toast('Unable to refresh: '+e.message)}}
function header(title,subtitle,action=''){return `<div class="page-header"><div><div class="eyebrow">Field service workspace</div><h1>${title}</h1><p class="muted">${subtitle}</p></div>${action}</div>`}
function render(){if(!state.profile)return;$('userName').textContent=state.profile.full_name||state.user.email;$('avatar').textContent=(state.profile.full_name||state.user.email||'T').charAt(0).toUpperCase();$('userRole').textContent=isAdmin()?'Administrator':'Technician';$('teamNav').classList.toggle('hidden',!isAdmin());$('reportNav').classList.toggle('hidden',!isAdmin());$('analyticsNav').classList.toggle('hidden',!isAdmin());$('adminNavGroup').classList.toggle('hidden',!isAdmin());if(['team','reports','analytics'].includes(state.page)&&!isAdmin())state.page='dashboard';document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page));$('breadcrumbs').textContent='Workspace / '+({dashboard:'Overview',orders:'Work orders',mine:'My daily tasks',team:'Team',reports:'Completed work',analytics:'Analytics & Reports'}[state.page]);const pages={dashboard:dashboard,orders:ordersPage,mine:minePage,team:teamPage,reports:reportPage,analytics:analyticsPage};$('main').innerHTML=pages[state.page]();wirePage()}
function dashboard(){const os=state.orders, open=os.filter(o=>o.status==='open'),progress=os.filter(o=>o.status==='in_progress'),done=os.filter(o=>o.status==='completed');const active=os.filter(o=>o.status!=='completed').slice(0,6);
return header('Good to see you, '+esc((state.profile.full_name||'there').split(' ')[0])+'.','Here’s what’s happening across your work orders.',isAdmin()?'<button class="primary" data-action="new">+ New work order</button>':'')+`<div class="stats">${[['Total requests',os.length],['Open requests',open.length],['In progress',progress.length],['Completed',done.length]].map(x=>`<div class="stat"><span class="stat-label">${x[0]}</span><strong>${x[1]}</strong><div class="accent"></div></div>`).join('')}</div><div class="grid-2"><div class="panel"><div class="panel-head"><h2>Active work orders</h2><button class="secondary small-btn" data-go="orders">View all →</button></div>${table(active)}</div><div><div class="panel"><div class="panel-head"><h2>Requests by location</h2></div><div class="panel-body"><div class="location-grid">${locations.map(l=>`<div class="location-box"><strong>${os.filter(o=>o.location===l && o.status!=='completed').length}</strong><span>${esc(l)}</span></div>`).join('')}</div></div></div><div class="panel"><div class="panel-head"><h2>My open tasks</h2><button class="secondary small-btn" data-go="mine">Open list →</button></div>${taskList(state.tasks.filter(t=>!t.completed&&os.some(o=>o.id===t.order_id&&canWork(o)&&o.status!=='completed')).slice(0,5))}</div></div></div>`}
function table(rows){if(!rows.length)return '<div class="empty">No work orders found.</div>';return `<div class="table-wrap"><table><thead><tr><th>Work order</th><th>Location</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Due</th></tr></thead><tbody>${rows.map(o=>`<tr data-order="${o.id}"><td><div class="strong">${esc(o.title)}</div><div class="subtext">#${esc(o.id.slice(0,8).toUpperCase())}</div></td><td>${esc(o.location)}</td><td>${priorityPill(o.priority)}</td><td>${statusPill(o.status)}</td><td>${esc(profileName(o.assigned_to))}</td><td>${datestr(o.due_date)}</td></tr>`).join('')}</tbody></table></div>`}
function ordersPage(){const text=state.filter.toLowerCase();let rows=state.orders.filter(o=>(o.title+' '+o.description+' '+o.location).toLowerCase().includes(text)&&(state.status==='all'||o.status===state.status)&&(state.location==='all'||o.location===state.location));return header('Work orders','Track, update and close requests across all locations.',isAdmin()?'<button class="primary" data-action="new">+ New work order</button>':'')+`<div class="panel"><div class="filterbar"><input id="searchFilter" placeholder="Search work orders..." value="${esc(state.filter)}"><select id="statusFilter"><option value="all">All statuses</option>${['open','in_progress','completed'].map(s=>`<option value="${s}" ${state.status===s?'selected':''}>${s.replace('_',' ')}</option>`).join('')}</select><select id="locationFilter"><option value="all">All locations</option>${locations.map(l=>`<option ${state.location===l?'selected':''}>${l}</option>`).join('')}</select></div><div id="tableResults">${table(rows)}</div></div>`}
function filteredOrders(){return state.orders.filter(o=>(o.title+' '+o.description+' '+o.location).toLowerCase().includes(state.filter.toLowerCase())&&(state.status==='all'||o.status===state.status)&&(state.location==='all'||o.location===state.location))}
function taskList(tasks){return tasks.length?tasks.map(t=>{const o=state.orders.find(o=>o.id===t.order_id);return `<div class="task-item"><input type="checkbox" data-task="${t.id}" ${t.completed?'checked':''} ${!o||!canWork(o)||o.status==='completed'?'disabled':''}><div class="task-text"><div class="${t.completed?'done':''}">${esc(t.title)}</div><small>${o?esc(o.title)+' · '+esc(o.location):''}</small></div></div>`}).join(''):'<div class="empty">No tasks here yet.</div>'}
function minePage(){const today=new Date().toISOString().slice(0,10);const assigned=state.orders.filter(o=>canWork(o)&&o.status!=='completed');const ts=state.tasks.filter(t=>assigned.some(o=>o.id===t.order_id));const due=assigned.filter(o=>o.due_date===today);return header('My daily tasks','Check off tasks, record time, and open assigned work orders.')+`<div class="stats"><div class="stat"><span class="stat-label">Assigned active orders</span><strong>${assigned.length}</strong><div class="accent"></div></div><div class="stat"><span class="stat-label">Tasks remaining</span><strong>${ts.filter(t=>!t.completed).length}</strong><div class="accent"></div></div><div class="stat"><span class="stat-label">Tasks finished</span><strong>${ts.filter(t=>t.completed).length}</strong><div class="accent"></div></div><div class="stat"><span class="stat-label">Due today</span><strong>${due.length}</strong><div class="accent"></div></div></div><div class="panel"><div class="panel-head"><h2>My checklist</h2></div>${taskList(ts)}</div><div class="panel"><div class="panel-head"><h2>Assigned work orders</h2></div>${table(assigned)}</div>`}
function teamPage(){return header('Team','Technicians are assigned to work orders by administrators.')+`<div class="panel"><div class="panel-head"><h2>Workspace members</h2></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Active assignments</th></tr></thead><tbody>${state.profiles.map(p=>`<tr><td class="strong">${esc(p.full_name||'Unnamed account')}</td><td>${esc(p.role)}</td><td>${state.orders.filter(o=>o.assigned_to===p.id&&o.status!=='completed').length}</td></tr>`).join('')}</tbody></table></div></div><p class="footer-help">For security, administrator privileges must be granted in Supabase using the instructions in SETUP.md.</p>`}
function reportPage(){
 const users=state.profiles.filter(p=>p.role==='technician'||state.orders.some(o=>o.assigned_to===p.id));
 const who=state.reportUser;
 const summary=users.filter(p=>who==='all'||p.id===who).map(p=>{
   const completedTasks=state.tasks.filter(t=>t.completed&&t.completed_by===p.id);
   const closed=state.orders.filter(o=>o.status==='completed'&&o.assigned_to===p.id);
   const entries=state.time.filter(t=>t.user_id===p.id);
   const photos=state.photos.filter(x=>x.user_id===p.id);
   return {p,completedTasks,closed,hours:entries.reduce((v,e)=>v+Number(e.hours||0),0),photos};
 });
 const filter=`<div class="filterbar"><label>Technician<select id="reportUser"><option value="all">All technicians</option>${users.map(p=>`<option value="${esc(p.id)}" ${who===p.id?'selected':''}>${esc(p.full_name||'Unnamed technician')}</option>`).join('')}</select></label></div>`;
 const panels=summary.map(({p,completedTasks,closed,hours,photos})=>`<div class="panel"><div class="panel-head"><h2>${esc(p.full_name||'Unnamed technician')}</h2><span class="pill status-completed">${completedTasks.length} tasks completed</span></div><div class="report-stats"><span><b>${closed.length}</b> closed work orders</span><span><b>${hours.toFixed(2)}</b> logged hours (all statuses)</span><span><b>${photos.length}</b> photos</span></div><div class="panel-body"><h3>Completed checklist items</h3>${completedTasks.length?completedTasks.map(t=>{const o=state.orders.find(x=>x.id===t.order_id);return `<div class="report-line"><div><strong>${esc(t.title)}</strong><small>${esc(o?.title||'Work order')} · ${esc(o?.location||'')} · ${stamp(t.completed_at)}</small></div><button class="secondary small-btn" data-order="${esc(t.order_id)}">View order</button></div>`}).join(''):'<p class="note">No completed checklist items.</p>'}<h3 style="margin-top:20px">Closed work orders</h3>${closed.length?closed.map(o=>`<div class="report-line"><div><strong>${esc(o.title)}</strong><small>${esc(o.location)} · ${stamp(o.completed_at)}</small></div><button class="secondary small-btn" data-order="${esc(o.id)}">View order</button></div>`).join(''):'<p class="note">No assigned closed orders.</p>'}<h3 style="margin-top:20px">Photos uploaded by this technician</h3>${photos.length?`<div class="photo-grid">${photos.map(x=>photoTile(x)).join('')}</div>`:'<p class="note">No photos submitted yet.</p>'}</div></div>`).join('');
 return header('Completed work by technician','Review completed checklist items, closed jobs, photos and total logged time.')+filter+(panels||'<div class="panel"><div class="empty">No matching technicians.</div></div>');
}
function photoTile(photo){return `<div class="photo-tile"><a class="photo-link" href="#" data-photo="${esc(photo.id)}" target="_blank" rel="noopener noreferrer"><img data-photo-image="${esc(photo.id)}" alt="Completed-work photo" loading="lazy"><span>Open full photo</span></a><small>${esc(profileName(photo.user_id))} · ${stamp(photo.created_at)}</small>${photo.caption?`<p>${esc(photo.caption)}</p>`:''}<button class="secondary small-btn" data-order="${esc(photo.order_id)}">Work order</button></div>`}
async function loadPhotoUrls(){
 const elems=[...document.querySelectorAll('[data-photo-image]')];
 await Promise.all(elems.map(async el=>{
  const photo=state.photos.find(p=>p.id===el.dataset.photoImage);if(!photo)return;
  const {data,error}=await state.client.storage.from('work-order-photos').createSignedUrl(photo.storage_path,3600);
  if(error){el.alt='Unable to load image';return}
  if(el.isConnected){el.src=data.signedUrl;const link=el.closest('a');if(link)link.href=data.signedUrl;}
 }));
}
async function uploadOrderPhoto(orderId,form){
 const input=form.querySelector('[name="photo"]'),file=input?.files?.[0],submit=form.querySelector('button[type="submit"]');
 if(!file){toast('Choose a photo first');return}
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('Use JPG, PNG, or WebP photos');return}
 if(file.size>5*1024*1024){toast('Photo must be 5 MB or smaller');return}
 submit.disabled=true;
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
 const path=`${orderId}/${state.user.id}/${crypto.randomUUID()}.${ext}`;
 try{
  const uploaded=await state.client.storage.from('work-order-photos').upload(path,file,{contentType:file.type,upsert:false});fail(uploaded);
  const caption=form.querySelector('[name="caption"]').value.trim().slice(0,500);
  const record=await state.client.from('work_order_photos').insert({order_id:orderId,user_id:state.user.id,storage_path:path,caption});
  if(record.error){await state.client.storage.from('work-order-photos').remove([path]);throw record.error}
  await loadData();openOrder(orderId);toast('Work photo uploaded');
 }catch(e){toast('Photo upload failed: '+e.message)}finally{submit.disabled=false}
}
function wirePage(){if(state.page==='analytics')wireAnalytics();if($('reportUser'))$('reportUser').onchange=e=>{state.reportUser=e.target.value;render()};loadPhotoUrls();document.querySelectorAll('[data-action="new"]').forEach(b=>b.onclick=newOrder);document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{state.page=b.dataset.go;render()});document.querySelectorAll('[data-order]').forEach(x=>x.onclick=()=>openOrder(x.dataset.order));document.querySelectorAll('[data-task]').forEach(x=>x.onchange=()=>toggleTask(x.dataset.task,x.checked));if($('searchFilter'))$('searchFilter').oninput=e=>{state.filter=e.target.value;$('tableResults').innerHTML=table(filteredOrders());document.querySelectorAll('[data-order]').forEach(x=>x.onclick=()=>openOrder(x.dataset.order))};if($('statusFilter'))$('statusFilter').onchange=e=>{state.status=e.target.value;render()};if($('locationFilter'))$('locationFilter').onchange=e=>{state.location=e.target.value;render()}}
function modal(content){$('modalDialog').innerHTML=content;$('modalLayer').classList.remove('hidden');$('modalLayer').setAttribute('aria-hidden','false');$('modalDialog').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal)}
function closeModal(){$('modalLayer').classList.add('hidden');$('modalLayer').setAttribute('aria-hidden','true');state.detail=null}
function newOrder(){if(!isAdmin())return;modal(`<div class="modal-heading"><h2>Create work order</h2><button class="close-btn" data-close>×</button></div><form id="newOrderForm"><label>Work order title<input name="title" placeholder="e.g. Repair exhibit lighting" maxlength="160" required></label><label>Description / issue details<textarea name="description" placeholder="Describe the work needed..."></textarea></label><div class="form-grid"><label>Location<select name="location" required>${locations.map(l=>`<option>${l}</option>`).join('')}</select></label><label>Priority<select name="priority"><option>medium</option><option>high</option><option>low</option></select></label><label>Assign technician<select name="assigned_to"><option value="">Unassigned</option>${state.profiles.map(p=>`<option value="${p.id}">${esc(p.full_name||'Unnamed user')} (${esc(p.role)})</option>`).join('')}</select></label><label>Due date<input name="due_date" type="date"></label></div><label>Checklist tasks (one per line)<textarea name="tasks" placeholder="Inspect equipment\nRepair wiring\nTest and document"></textarea></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary">Create work order</button></div></form>`);$('newOrderForm').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('.primary');b.disabled=true;const v=Object.fromEntries(new FormData(e.target));try{const order=fail(await state.client.from('work_orders').insert({title:v.title.trim(),description:v.description.trim(),location:v.location,priority:v.priority,assigned_to:v.assigned_to||null,due_date:v.due_date||null,created_by:state.user.id}).select().single());const tasks=v.tasks.split('\n').map(x=>x.trim()).filter(Boolean);if(tasks.length)fail(await state.client.from('order_tasks').insert(tasks.map((title,position)=>({order_id:order.id,title,position}))));await loadData();closeModal();render();toast('Work order created')}catch(err){toast(err.message);b.disabled=false}}}
function openOrder(id){const o=state.orders.find(o=>o.id===id);if(!o)return;state.detail=id;const own=canWork(o),tasks=state.tasks.filter(t=>t.order_id===id),comments=state.comments.filter(c=>c.order_id===id),time=state.time.filter(t=>t.order_id===id),hours=time.reduce((a,t)=>a+Number(t.hours||0),0);modal(`<div class="modal-heading"><div><div class="eyebrow">Work order #${esc(o.id.slice(0,8).toUpperCase())}</div><h2>${esc(o.title)}</h2></div><button class="close-btn" data-close>×</button></div><div class="detail-head"><span>${statusPill(o.status)} &nbsp; ${priorityPill(o.priority)}</span>${isAdmin()?'<button class="secondary small-btn" id="editOrder">Edit request</button>':''}</div><div class="meta-grid"><div><small>Location</small><strong>${esc(o.location)}</strong></div><div><small>Assigned technician</small><strong>${esc(profileName(o.assigned_to))}</strong></div><div><small>Due date</small><strong>${datestr(o.due_date)}</strong></div><div><small>Time logged</small><strong>${hours.toFixed(2)} hours</strong></div></div><div class="section-title">Description</div><p class="description">${esc(o.description||'No description provided.')}</p><div class="section-title">Task checklist (${tasks.filter(t=>t.completed).length}/${tasks.length})</div><div class="panel">${taskList(tasks)}${isAdmin()?'<div class="panel-body"><div class="task-entry"><input id="taskTitle" placeholder="Add a new checklist task"><button class="secondary small-btn" id="addTask">+ Add task</button></div></div>':''}</div><div class="section-title">Record project time</div>${own?`<form id="timeForm"><div class="time-row"><input name="hours" type="number" step="0.25" min="0.01" max="24" placeholder="Hours" required><select name="work_status"><option value="not_completed">Not completed</option><option value="completed">Completed</option></select><button class="secondary small-btn">Log time</button></div><label style="margin-top:10px">Work performed / issues<textarea name="notes" placeholder="What was done? Any blockers or issues?" required></textarea></label></form>`:'<p class="note">Only the assigned technician or an administrator can log time.</p>'}<div>${time.length?time.map(t=>`<div class="time-entry"><strong>${Number(t.hours).toFixed(2)} hr</strong> · ${esc(profileName(t.user_id))} · ${t.work_status==='completed'?'Completed':'Not completed'} · ${stamp(t.created_at)}<p class="no-margin">${esc(t.notes||'')}</p></div>`).join(''):'<p class="note">No time recorded yet.</p>'}</div><div class="section-title">Completed-work photos (${state.photos.filter(p=>p.order_id===id).length})</div><div class="photo-grid">${state.photos.filter(p=>p.order_id===id).map(p=>photoTile(p)).join('')||'<p class="note">No photos uploaded yet.</p>'}</div>${own?`<form id="photoForm" class="photo-form"><label>Attach photo (JPG, PNG or WebP, maximum 5 MB)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required></label><label>Photo caption / work description<input name="caption" maxlength="500" placeholder="What does this picture show?"></label><button type="submit" class="secondary small-btn">Upload work photo</button></form>`:''}<div class="section-title">Comments and issues</div>${comments.map(c=>`<div class="comment"><strong>${esc(profileName(c.user_id))}</strong> <small>${stamp(c.created_at)}</small><p>${esc(c.body)}</p></div>`).join('')||'<p class="note">No comments yet.</p>'}${own?`<form id="commentForm"><label><textarea name="body" placeholder="Add a comment or report an issue..." required maxlength="4000"></textarea></label><button class="secondary small-btn">Post comment</button></form>`:''}${own?`<div class="modal-actions">${o.status!=='open'&&o.status!=='completed'?'<button class="secondary" id="markOpen">Reopen</button>':''}${o.status==='open'?'<button class="secondary" id="startWork">Start work</button>':''}${o.status!=='completed'?'<button class="primary" id="closeWork">✓ Mark job completed</button>':'<button class="secondary" id="reopenWork">Reopen job</button>'}</div>`:''}`);
$('modalDialog').querySelectorAll('[data-task]').forEach(x=>x.onchange=()=>toggleTask(x.dataset.task,x.checked,true));
if($('photoForm'))$('photoForm').onsubmit=e=>{e.preventDefault();uploadOrderPhoto(id,e.target)};loadPhotoUrls();document.querySelectorAll('[data-order]').forEach(x=>x.onclick=()=>openOrder(x.dataset.order));
 if($('addTask'))$('addTask').onclick=async()=>{const title=$('taskTitle').value.trim();if(!title)return;try{fail(await state.client.from('order_tasks').insert({order_id:id,title,position:tasks.length}));await loadData();openOrder(id)}catch(e){toast(e.message)}};
if($('commentForm'))$('commentForm').onsubmit=async e=>{e.preventDefault();const body=new FormData(e.target).get('body').trim();if(!body)return;try{fail(await state.client.from('order_comments').insert({order_id:id,user_id:state.user.id,body}));await loadData();openOrder(id);toast('Comment posted')}catch(e){toast(e.message)}};
if($('timeForm'))$('timeForm').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));try{fail(await state.client.from('time_entries').insert({order_id:id,user_id:state.user.id,hours:Number(v.hours),work_status:v.work_status,notes:v.notes}));await loadData();openOrder(id);toast('Time logged')}catch(err){toast(err.message)}};
if($('editOrder'))$('editOrder').onclick=()=>editOrder(o);
[['startWork','in_progress'],['closeWork','completed'],['reopenWork','open'],['markOpen','open']].forEach(([btn,status])=>{if($(btn))$(btn).onclick=()=>setStatus(id,status)});
}
async function toggleTask(id,checked,inDetail=false){try{fail(await state.client.from('order_tasks').update({completed:checked,completed_by:checked?state.user.id:null,completed_at:checked?new Date().toISOString():null}).eq('id',id));await loadData();if(inDetail&&state.detail)openOrder(state.detail);else render()}catch(e){toast(e.message);if(inDetail&&state.detail)openOrder(state.detail);else render()}}
async function setStatus(id,status){if(status==='completed'&&!confirm('Mark this job completed and close the work order?'))return;try{fail(await state.client.rpc('set_work_order_status',{p_order_id:id,p_status:status}));await loadData();openOrder(id);toast(status==='completed'?'Job closed':'Job updated')}catch(e){toast(e.message)}}
function editOrder(o){modal(`<div class="modal-heading"><h2>Edit work order</h2><button class="close-btn" data-close>×</button></div><form id="editOrderForm"><label>Title<input name="title" value="${esc(o.title)}" required maxlength="160"></label><label>Description<textarea name="description">${esc(o.description||'')}</textarea></label><div class="form-grid"><label>Location<select name="location">${locations.map(l=>`<option ${o.location===l?'selected':''}>${l}</option>`).join('')}</select></label><label>Priority<select name="priority">${['low','medium','high'].map(s=>`<option ${o.priority===s?'selected':''}>${s}</option>`).join('')}</select></label><label>Technician<select name="assigned_to"><option value="">Unassigned</option>${state.profiles.map(p=>`<option value="${p.id}" ${o.assigned_to===p.id?'selected':''}>${esc(p.full_name||'Unnamed user')}</option>`).join('')}</select></label><label>Due date<input type="date" name="due_date" value="${esc(o.due_date||'')}"></label></div><div class="modal-actions"><button class="secondary" type="button" data-close>Cancel</button><button class="primary">Save changes</button></div></form>`);$('editOrderForm').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));try{fail(await state.client.from('work_orders').update({title:v.title.trim(),description:v.description,location:v.location,priority:v.priority,assigned_to:v.assigned_to||null,due_date:v.due_date||null}).eq('id',o.id));await loadData();openOrder(o.id);toast('Work order saved')}catch(e){toast(e.message)}}}
start();


// Analytics are admin-only in the UI. The underlying Supabase tables follow
// the project's existing RLS policies; they must be tightened separately if
// technician-level access to raw work-order records should also be limited.
const ANALYTICS_SECTIONS=[
 ['technicians','Work orders by technician'],
 ['hours','Hours logged by technician'],
 ['locations','Work orders by location'],
 ['averages','Average repair time'],
 ['trends','Maintenance trends'],
 ['priority','Work by priority'],
 ['performance','Individual technician performance'],
 ['photos','Photo documentation']
];
function analyticsWindow(){
 const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const period=state.analyticsPeriod;
 let start=null,end=null;
 if(period==='today')start=today;
 if(period==='week'){start=new Date(today);start.setDate(start.getDate()-((start.getDay()+6)%7));}
 if(period==='month')start=new Date(today.getFullYear(),today.getMonth(),1);
 if(period==='year')start=new Date(today.getFullYear(),0,1);
 if(period==='custom'){
   if(state.analyticsFrom)start=new Date(state.analyticsFrom+'T00:00:00');
   if(state.analyticsTo)end=new Date(state.analyticsTo+'T23:59:59.999');
 }
 return stampValue=>{if(!stampValue)return false;const d=new Date(stampValue);return !isNaN(d)&&(!start||d>=start)&&(!end||d<=end)};
}
function analyticsData(){
 const inPeriod=analyticsWindow(),uid=state.analyticsUser,loc=state.analyticsLocation;
 const allowed=o=>(loc==='all'||o.location===loc)&&(uid==='all'||o.assigned_to===uid);
 const orders=state.orders.filter(allowed);
 const ids=new Set(orders.map(o=>o.id));
 const completed=orders.filter(o=>o.status==='completed'&&inPeriod(o.completed_at));
 const active=orders.filter(o=>o.status!=='completed'&&inPeriod(o.created_at));
 const time=state.time.filter(t=>ids.has(t.order_id)&&inPeriod(t.created_at)&&(uid==='all'||t.user_id===uid));
 const tasks=state.tasks.filter(t=>ids.has(t.order_id)&&t.completed&&inPeriod(t.completed_at)&&(uid==='all'||t.completed_by===uid));
 const photos=state.photos.filter(p=>ids.has(p.order_id)&&inPeriod(p.created_at)&&(uid==='all'||p.user_id===uid));
 const people=state.profiles.filter(p=>uid==='all'||p.id===uid);
 return {orders,completed,active,time,tasks,photos,people};
}
function aBar(items,unit=''){const top=Math.max(1,...items.map(x=>Number(x[1])||0));return `<div class="analytics-bars">${items.map(([label,value])=>`<div class="analytics-bar-row"><span>${esc(label)}</span><div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${Math.min(100,Math.max(0,Number(value)||0)/top*100).toFixed(2)}%"></div></div><strong>${Number(value).toLocaleString(undefined,{maximumFractionDigits:2})}${unit}</strong></div>`).join('')||'<p class="note">No data in this period.</p>'}</div>`}
function aTable(head,rows){return `<div class="table-wrap"><table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${head.length}">No matching records</td></tr>`}</tbody></table></div>`}
function aSection(id,title,body){const isOpen=state.analyticsView[id]!==false;return `<details class="analytics-section panel" data-section="${id}" ${isOpen?'open':''}><summary><strong>${esc(title)}</strong><span class="section-hint">Show / Hide</span></summary><div class="analytics-section-body">${body}</div></details>`}
function analyticsReports(){
 const d=analyticsData();const names=id=>profileName(id);
 const groups=d.people.map(p=>{const os=d.orders.filter(o=>o.assigned_to===p.id),done=d.completed.filter(o=>o.assigned_to===p.id),entries=d.time.filter(t=>t.user_id===p.id),hours=entries.reduce((n,t)=>n+Number(t.hours||0),0);return {id:p.id,name:p.full_name||'Unnamed technician',assigned:os.length,open:d.active.filter(o=>o.assigned_to===p.id&&o.status==='open').length,progress:d.active.filter(o=>o.assigned_to===p.id&&o.status==='in_progress').length,done:done.length,hours,checks:d.tasks.filter(t=>t.completed_by===p.id).length,pics:d.photos.filter(x=>x.user_id===p.id).length};});
 const totalHours=d.time.reduce((n,t)=>n+Number(t.hours||0),0);
 const totalDone=d.completed.length;
 const locationRows=locations.map(l=>[l,d.completed.filter(o=>o.location===l).length,d.active.filter(o=>o.location===l).length,d.time.filter(t=>d.orders.find(o=>o.id===t.order_id&&o.location===l)).reduce((n,t)=>n+Number(t.hours||0),0)]);
 const priorityRows=['high','medium','low'].map(p=>[p,d.completed.filter(o=>o.priority===p).length,d.active.filter(o=>o.priority===p).length]);
 const trendMap=new Map();d.completed.forEach(o=>{const day=o.completed_at?.slice(0,10);if(day)trendMap.set(day,(trendMap.get(day)||0)+1)});
 const trendRows=[...trendMap].sort((a,b)=>a[0].localeCompare(b[0]));
 const html={
 technicians:aBar(groups.map(g=>[g.name,g.done]))+aTable(['Technician','Assigned (all dates)','Open (created in period)','In progress (created in period)','Completed in period'],groups.map(g=>[g.name,g.assigned,g.open,g.progress,g.done])),
 hours:aBar(groups.map(g=>[g.name,g.hours]),' h')+aTable(['Technician','Hours logged in period'],groups.map(g=>[g.name,g.hours.toFixed(2)])),
 locations:aBar(locationRows.map(x=>[x[0],x[1]]))+aTable(['Location','Completed in period','Active created in period','Hours logged'],locationRows.map(r=>[r[0],r[1],r[2],r[3].toFixed(2)])),
 averages:`<p class="analytics-large">${totalDone?(totalHours/totalDone).toFixed(2):'—'} <small>hours per completed work order</small></p><p class="note">Total hours logged in the selected period divided by orders completed in that period. This is a period-level workload ratio, not necessarily hours spent exclusively on those completed orders.</p>`,
 trends:aBar(trendRows.slice(-32).map(x=>x))+aTable(['Date completed','Orders completed'],trendRows),
 priority:aBar(priorityRows.map(r=>[r[0],r[1]]))+aTable(['Priority','Completed in period','Active created in period'],priorityRows),
 performance:aTable(['Technician','Completed orders','Completed checklists','Logged hours','Photos uploaded'],groups.map(g=>[g.name,g.done,g.checks,g.hours.toFixed(2),g.pics])),
 photos:`<p class="note">${d.photos.length} photos uploaded in the chosen period.</p>${d.photos.length?`<div class="photo-grid">${d.photos.map(photoTile).join('')}</div>`:'<p class="note">No photos match these filters.</p>'}`
 };
 return {d,groups,totalHours,totalDone,locationRows,priorityRows,trendRows,html};
}
function analyticsPage(){
 if(!isAdmin())return '<div class="empty">Administrator access required.</div>';
 const r=analyticsReports();
 const techs=state.profiles.filter(p=>p.role==='technician'||state.orders.some(o=>o.assigned_to===p.id));
 const option=(val,label,sel)=>`<option value="${esc(val)}" ${val===sel?'selected':''}>${esc(label)}</option>`;
 const filters=`<div class="panel analytics-filters"><div class="panel-head"><h2>Report filters</h2><button class="secondary small-btn" id="analyticsRefresh">↻ Refresh data</button></div><div class="analytics-filter-grid">
 <label>Technician<select id="analyticsUser">${option('all','All technicians',state.analyticsUser)}${techs.map(p=>option(p.id,p.full_name||'Unnamed technician',state.analyticsUser)).join('')}</select></label>
 <label>Location<select id="analyticsLocation">${option('all','All locations',state.analyticsLocation)}${locations.map(l=>option(l,l,state.analyticsLocation)).join('')}</select></label>
 <label>Date range<select id="analyticsPeriod">${[['all','All dates'],['today','Today'],['week','This week'],['month','This month'],['year','This year'],['custom','Custom range']].map(x=>option(x[0],x[1],state.analyticsPeriod)).join('')}</select></label>
 <label>From<input type="date" id="analyticsFrom" value="${esc(state.analyticsFrom)}" ${state.analyticsPeriod==='custom'?'':'disabled'}></label>
 <label>To<input type="date" id="analyticsTo" value="${esc(state.analyticsTo)}" ${state.analyticsPeriod==='custom'?'':'disabled'}></label></div>
 <div class="analytics-toolbar"><button class="secondary small-btn" id="analyticsAllOpen">Expand all</button><button class="secondary small-btn" id="analyticsAllClosed">Collapse all</button><button class="primary small-btn" id="analyticsExport">Export all reports (CSV)</button></div></div>`;
 const cards=`<div class="stats"><div class="stat"><span class="stat-label">Completed in period</span><strong>${r.totalDone}</strong></div><div class="stat"><span class="stat-label">Labor hours logged</span><strong>${r.totalHours.toFixed(2)}</strong></div><div class="stat"><span class="stat-label">Completed tasks</span><strong>${r.d.tasks.length}</strong></div><div class="stat"><span class="stat-label">Work photos uploaded</span><strong>${r.d.photos.length}</strong></div></div>`;
 return header('Analytics & Reports','Administrator-only reporting from your existing work order and technician records.')+filters+cards+ANALYTICS_SECTIONS.map(([id,title])=>aSection(id,title,r.html[id])).join('')+'<p class="note">Reports refresh when you open this page, change filters, or press Refresh data. An order counts as completed for its currently assigned technician; reassignments are not historical attribution. Counts may reflect current status after a job is reopened. Photo and checklist history use the account that performed the action.</p>';
}
function csvEscape(v){let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function downloadCsv(name,rows){const csv='\ufeff'+rows.map(row=>row.map(csvEscape).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function exportAnalytics(){if(!isAdmin())return;const r=analyticsReports(),d=r.d;
 const rows=[['Report','Technician','Location','Work order','Date','Metric','Value','Notes']];
 const add=(report,tech,loc,order,date,metric,value,notes='')=>rows.push([report,tech,loc,order,date,metric,value,notes]);
 d.completed.forEach(o=>add('Completed work orders',profileName(o.assigned_to),o.location,o.title,o.completed_at,'Completed',1,o.id));
 d.active.forEach(o=>add('Active work orders',profileName(o.assigned_to),o.location,o.title,o.created_at,o.status,1,o.id));
 d.time.forEach(t=>{const o=d.orders.find(o=>o.id===t.order_id);add('Time entries',profileName(t.user_id),o?.location,o?.title,t.created_at,'Hours',t.hours,t.notes)});
 d.tasks.forEach(t=>{const o=d.orders.find(o=>o.id===t.order_id);add('Completed checklists',profileName(t.completed_by),o?.location,o?.title,t.completed_at,'Task completed',1,t.title)});
 d.photos.forEach(p=>{const o=d.orders.find(o=>o.id===p.order_id);add('Photo documentation',profileName(p.user_id),o?.location,o?.title,p.created_at,'Photo uploaded',1,p.caption)});
 r.groups.forEach(g=>{add('Technician summary',g.name,'','','','Completed orders',g.done);add('Technician summary',g.name,'','','','Hours logged',g.hours.toFixed(2));add('Technician summary',g.name,'','','','Checklist items completed',g.checks)});
 r.locationRows.forEach(x=>add('Location summary','',x[0],'','','Completed orders',x[1]));
 r.priorityRows.forEach(x=>add('Priority summary','','','','',x[0]+' completed',x[1]));
 r.trendRows.forEach(x=>add('Daily trend','','','',x[0],'Completed orders',x[1]));
 add('Average hours per completed order','','','','','Period ratio',r.totalDone?(r.totalHours/r.totalDone).toFixed(2):'N/A');
 downloadCsv('FieldDesk-Analytics-'+new Date().toISOString().slice(0,10)+'.csv',rows);
}
function wireAnalytics(){
 ['User','Location','Period','From','To'].forEach(k=>{const el=$('analytics'+k);if(!el)return;el.onchange=e=>{state['analytics'+k]=e.target.value;render()}});
 if($('analyticsRefresh'))$('analyticsRefresh').onclick=refresh;
 if($('analyticsExport'))$('analyticsExport').onclick=exportAnalytics;
 document.querySelectorAll('details[data-section]').forEach(el=>el.addEventListener('toggle',()=>{state.analyticsView[el.dataset.section]=el.open}));
 if($('analyticsAllOpen'))$('analyticsAllOpen').onclick=()=>document.querySelectorAll('details[data-section]').forEach(el=>el.open=true);
 if($('analyticsAllClosed'))$('analyticsAllClosed').onclick=()=>document.querySelectorAll('details[data-section]').forEach(el=>el.open=false);
}
