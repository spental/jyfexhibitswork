/* Field Desk Gallery Inspections v1: companion module for existing app.js */
(() => {
  'use strict';
  const CATS = [
    ['lighting','Gallery lighting','Fixtures, exhibit illumination, dark areas'],
    ['av','Audio / video','Screens, speakers, playback and controls'],
    ['interactives','Interactive components','Buttons, touchscreens and visitor-operated features'],
    ['mechanical','Mechanical exhibits','Motion, moving pieces and physical operation'],
    ['graphics','Graphics and labels','Signs, labels and display condition'],
    ['cleanliness','Appearance and cleanliness','Debris, display finishes and presentation'],
    ['safety','Visitor safety','Trip hazards, exposed wiring and accessible routes']
  ];
  const G = {galleries:[], inspections:[], links:[], location:'Jamestown', gallery:'', historyLocation:'all', busy:false, submissionId:null};
  const h = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const admin = () => state.profile?.role === 'admin';
  const nameOf = id => state.profiles?.find(p=>p.id===id)?.full_name || 'Technician';
  const say = msg => typeof toast==='function'?toast(msg):alert(msg);
  const api = () => state.client;
  const node = () => document.getElementById('main');
  const formattedDate = s => s ? new Date(s).toLocaleString() : '—';
  function locations(){return ['Jamestown','Yorktown','Central Building'];}
  function galleryName(id){return G.galleries.find(g=>g.id===id)?.name || 'Unknown gallery';}
  async function load(){
    if(!state.user)return;
    const responses=await Promise.all([
      api().from('fd_galleries').select('*').order('location').order('name'),
      api().from('fd_gallery_inspections').select('*').order('created_at',{ascending:false}).limit(500),
      api().from('fd_inspection_work_orders').select('*')
    ]);
    for(const r of responses)if(r.error)throw r.error;
    [G.galleries,G.inspections,G.links]=responses.map(r=>r.data||[]);
  }
  const nav=document.querySelector('#nav .nav-contents') || document.getElementById('nav');
  if(!nav) return console.error('Daily Inspections: nav not found');
  const b=document.createElement('button');b.className='nav-link';b.dataset.page='inspections';b.innerHTML='☷ <span>Daily gallery inspections</span>';nav.append(b);
  const oldRender=render;
  render=function(){if(state.page==='inspections'&&state.profile){draw();return;}oldRender();};
  b.onclick=async()=>{state.page='inspections';document.querySelector('.sidebar')?.classList.remove('open');try{await load();draw();}catch(e){draw();say('Run daily-inspections.sql in Supabase: '+e.message)}};
  const summary = () => {
    const today = new Date().toLocaleDateString('en-CA');
    const todayRows=G.inspections.filter(i=>i.inspection_date===today);
    const failed=todayRows.filter(i=>i.overall_status==='needs_attention').length;
    return `<div class="stats"><div class="stat"><span class="stat-label">Today's walkthroughs</span><strong>${todayRows.length}</strong></div><div class="stat"><span class="stat-label">Need attention today</span><strong>${failed}</strong></div><div class="stat"><span class="stat-label">Active galleries</span><strong>${G.galleries.filter(x=>x.active).length}</strong></div></div>`;
  };
  function draw(){
    document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page==='inspections'));
    document.getElementById('breadcrumbs').textContent='Workspace / Daily gallery inspections';
    const current = G.galleries.filter(g=>g.active&&g.location===G.location);
    if(!current.some(g=>g.id===G.gallery))G.gallery=current[0]?.id||'';
    const records=G.inspections.filter(i=>G.historyLocation==='all'||G.galleries.find(g=>g.id===i.gallery_id)?.location===G.historyLocation).slice(0,80);
    node().innerHTML=`<div class="page-header"><div><div class="eyebrow">Field Desk / Exhibit operations</div><h1>Daily gallery inspections</h1><p class="muted">Inspect entire galleries and automatically generate internal work orders for failed AV or lighting checks. No emails are sent.</p></div>${admin()?'<button class="secondary" id="fdManageGalleries">Manage galleries</button>':''}</div>
      ${summary()}
      <section class="panel fd-inspect-panel"><h2>New gallery walkthrough</h2><div class="fd-inspect-row"><label>Museum / location<select id="fdInspectLocation">${locations().map(v=>`<option value="${h(v)}" ${v===G.location?'selected':''}>${h(v)}</option>`).join('')}</select></label><label>Gallery<select id="fdInspectGallery">${current.map(g=>`<option value="${h(g.id)}" ${g.id===G.gallery?'selected':''}>${h(g.name)}</option>`).join('')}</select></label></div>
      ${current.length?`<form id="fdInspectForm"><div class="fd-inspect-checks">${CATS.map(([key,title,desc])=>`<div class="fd-inspect-check"><div><strong>${h(title)}</strong><div class="muted">${h(desc)}</div></div><div class="fd-status-buttons" role="group" aria-label="${h(title)} status"><label><input type="radio" name="fd_${key}" value="pass" required checked>Pass</label><label><input type="radio" name="fd_${key}" value="fail">Fail</label><label><input type="radio" name="fd_${key}" value="na">N/A</label></div><label class="fd-note">Notes (required if failed)<textarea id="fd_note_${key}" maxlength="1500" rows="2" placeholder="Describe the fault, location, and observable symptoms"></textarea></label></div>`).join('')}</div><label>General inspection notes<textarea id="fdInspectNotes" rows="3" maxlength="4000" placeholder="Overall gallery condition and follow-up notes"></textarea></label><button class="primary" type="submit" id="fdInspectSubmit">Submit gallery inspection</button><small class="muted">AV and lighting failures automatically create a work order in the existing Work orders tab.</small></form>`:'<div class="empty">No active galleries at this location. Ask an administrator to add one.</div>'}</section>
      <section class="panel fd-inspect-panel"><div class="fd-history-head"><h2>Inspection history</h2><select id="fdHistoryLocation"><option value="all">All locations</option>${locations().map(x=>`<option value="${h(x)}" ${x===G.historyLocation?'selected':''}>${h(x)}</option>`).join('')}</select></div><div class="table-wrap"><table><thead><tr><th>Date / time</th><th>Gallery</th><th>Technician</th><th>Result</th><th>Work orders</th></tr></thead><tbody>${records.map(r=>`<tr><td>${h(formattedDate(r.created_at))}</td><td>${h(G.galleries.find(g=>g.id===r.gallery_id)?.location||'')} / ${h(galleryName(r.gallery_id))}</td><td>${h(nameOf(r.inspector_id))}</td><td>${r.overall_status==='pass'?'Passed':'Needs attention'}</td><td>${G.links.filter(l=>l.inspection_id===r.id).length}</td></tr>`).join('')}</tbody></table>${!records.length?'<div class="empty">No inspections submitted yet.</div>':''}</div></section>`;
    document.getElementById('fdInspectLocation').onchange=e=>{G.location=e.target.value;G.submissionId=null;draw();};
    document.getElementById('fdInspectGallery').onchange=e=>{G.gallery=e.target.value;G.submissionId=null;};
    document.getElementById('fdHistoryLocation').onchange=e=>{G.historyLocation=e.target.value;draw();};
    if(admin())document.getElementById('fdManageGalleries').onclick=manageGalleries;
    const form=document.getElementById('fdInspectForm');if(form)form.onsubmit=submit;
  }
  async function submit(e){
    e.preventDefault();if(G.busy)return;
    const checks={};
    for(const [key,title] of CATS){
      const status=document.querySelector(`input[name="fd_${key}"]:checked`)?.value;
      const note=document.getElementById(`fd_note_${key}`).value.trim();
      if(status==='fail'&&note.length<3){say('Describe the problem with '+title);document.getElementById(`fd_note_${key}`).focus();return;}
      checks[key]={status,note};
    }
    const galleryId=document.getElementById('fdInspectGallery').value;
    if(!galleryId)return say('Select a gallery');
    G.busy=true;
    const submitBtn=document.getElementById('fdInspectSubmit');submitBtn.disabled=true;submitBtn.textContent='Submitting...';
    if(!G.submissionId)G.submissionId=crypto.randomUUID();
    try{
      const {data,error}=await api().rpc('fd_submit_gallery_inspection',{
        p_gallery_id:galleryId,p_checks:checks,p_notes:document.getElementById('fdInspectNotes').value.trim(),p_inspection_id:G.submissionId
      });
      if(error)throw error;
      const count=data?.work_orders?.length||0;
      say(`Inspection saved. ${count} internal AV / lighting work order(s) created.`);
      G.submissionId=null;
      await load();
      // Refresh core Field Desk records, so new orders appear in the existing Work orders tab.
      if(typeof loadData==='function')await loadData();
      draw();
    }catch(err){say('Inspection not saved: '+err.message);submitBtn.disabled=false;submitBtn.textContent='Retry submission';}
    finally{G.busy=false;}
  }
  function manageGalleries(){
    if(!admin())return;
    const content=`<div class="modal-heading"><h2>Manage galleries</h2><button data-close class="close-btn">×</button></div><p class="muted">Add real gallery names for each site. Existing inspections retain their gallery reference.</p><form id="fdAddGallery"><label>Location<select name="location">${locations().map(x=>`<option>${h(x)}</option>`).join('')}</select></label><label>Gallery name<input name="name" maxlength="120" required placeholder="Official gallery name"></label><button class="primary" type="submit">Add gallery</button></form><h3>Current galleries</h3><div class="fd-gallery-list">${G.galleries.map(g=>`<div><span>${h(g.location)} / ${h(g.name)} ${g.active?'':'(inactive)'}</span><button class="secondary" data-toggle-gallery="${h(g.id)}">${g.active?'Deactivate':'Activate'}</button></div>`).join('')}</div>`;
    document.getElementById('modalDialog').innerHTML=content;
    document.getElementById('modalLayer').classList.remove('hidden');
    document.getElementById('modalLayer').setAttribute('aria-hidden','false');
    document.querySelector('#modalDialog [data-close]').onclick=()=>closeModal();
    document.getElementById('fdAddGallery').onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(e.target);
      const {error}=await api().from('fd_galleries').insert({location:fd.get('location'),name:String(fd.get('name')).trim()});
      if(error)return say(error.message);
      await load();closeModal();draw();say('Gallery added');
    };
    document.querySelectorAll('[data-toggle-gallery]').forEach(btn=>btn.onclick=async()=>{
      const g=G.galleries.find(g=>g.id===btn.dataset.toggleGallery);if(!g)return;
      const {error}=await api().from('fd_galleries').update({active:!g.active}).eq('id',g.id);
      if(error)return say(error.message);
      await load();closeModal();draw();say('Gallery updated');
    });
  }
})();
