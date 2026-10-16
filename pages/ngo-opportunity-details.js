/* IMPACTRA — NGO Opportunity Details
   Additive, isolated screen. No global workflow mutations.
   Live data only comes from existing API.js methods; demo data is explicitly labeled.
*/
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const text = (id, value, fallback = '—') => { const el = $(id); if (el) el.textContent = value === null || value === undefined || value === '' ? fallback : String(value); };
  const params = new URLSearchParams(location.search);
  const opportunityId = params.get('id');
  const demoMode = params.get('demo') === '1' || !opportunityId;
  const ASSETS = 'ngo-opportunity-assets/';
  const DEMO = Object.freeze({
    id:'NG-SUR-2023-44',title:'Food Relief Distribution',category:'Community Support',
    description:'Help us pack and distribute essential food items, grains, and nutrition packs to over 250 vulnerable families in Surulere. Volunteers work in collaborative shifts to organise inventory, verify recipient vouchers, and distribute care packages.',
    status:'active',volunteerCapacity:10,assignedCount:8,applicationsCount:14,activityCount:0,
    location:{type:'in_person',hubRegion:'Surulere, Lagos',venueName:'Surulere Community Hall',venueAddress:'14 Bishop Street, Lagos'},
    shifts:[{date:'2026-10-14',startTime:'09:00',endTime:'13:00'}],
    requirements:{minimumAge:'16_plus',experienceLevel:'none_needed',physicalDemands:'Moderate',ageNote:'Minors require guardian consent acknowledgment.',experienceNote:'Full safety walkthrough provided on-site at 9:00 AM.',physicalNote:'Able to stand for 2+ hours and lift parcels up to 25 lbs.'},
    coordinator:{name:'Mary (Administrator)',phone:'+2348012345678'},
    tags:['#FoodSecurity','#SurulereOutreach','#NutritionAccess'],
    photos:[{src:ASSETS+'sorting.jpg',caption:'Box Sorting Station'},{src:ASSETS+'supplies.jpg',caption:'Food Inventory'},{src:ASSETS+'handover.jpg',caption:'Community Handover'}],
    tasks:[]
  });
  let opportunity = null, applications = [], appLoaded = false, appError = null, displayedTab = 'overview';
  const unwrap = (response) => {
    if (!response || typeof response !== 'object') return null;
    const maybe = response.data?.opportunity || response.data?.item || response.opportunity || response.data || response;
    return maybe && typeof maybe === 'object' && !Array.isArray(maybe) ? maybe : null;
  };
  const first = (...values) => values.find(v => v !== null && v !== undefined && v !== '');
  const nameOf = (p) => first(p?.name, p?.fullName, [p?.firstName,p?.lastName].filter(Boolean).join(' '), p?.user?.name, p?.volunteer?.name, 'Volunteer');
  const idOf = (p) => first(p?._id,p?.id,p?.opportunityId,p?.serverId);
  const number = (x) => Number.isFinite(Number(x)) && x !== '' && x !== null && x !== undefined ? Number(x) : null;
  const dateLabel = (str) => {
    if (!str) return 'Date not specified';
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(str) ? `${str}T12:00:00` : str);
    return Number.isNaN(d.getTime()) ? String(str) : d.toLocaleDateString('en-GB', {weekday:'short',month:'short',day:'numeric'});
  };
  const timeLabel = (str) => {
    if (!str) return '';
    const m = String(str).match(/^(\d{1,2}):(\d\d)/);
    if (!m) return String(str);
    const hh = Number(m[1]), mm = m[2];
    return `${hh % 12 || 12}:${mm} ${hh < 12 ? 'AM' : 'PM'}`;
  };
  const timeRange = (shift) => {
    if (!shift?.startTime || !shift?.endTime) return 'Time not specified';
    const start = shift.startTime.split(':').map(Number), end = shift.endTime.split(':').map(Number);
    const duration = (end[0]*60+end[1]) - (start[0]*60+start[1]);
    const hours = duration > 0 ? ` (${Number((duration/60).toFixed(1))} hrs)` : '';
    return `${timeLabel(shift.startTime)} – ${timeLabel(shift.endTime)}${hours}`;
  };
  const locationOf = (o) => {
    const loc = o.location;
    if (typeof loc === 'string') return loc;
    return first(loc?.hubRegion,loc?.venueAddress,loc?.city,o.region,'Location not specified');
  };
  const locAddress = (o) => typeof o.location === 'object' ? first(o.location?.venueAddress,o.location?.address,o.location?.hubRegion,'') : String(o.location || '');
  const initials = (name) => String(name || 'NG').split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase();
  const notice = (message, error = false) => { const el = $('dataMessage'); el.hidden = !message; el.textContent = message || ''; el.style.background = error ? '#fff5f5' : ''; el.style.color = error ? '#a52d36' : ''; };
  const toast = (message) => {
    const el = $('toast'); el.textContent = message; el.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 3300);
  };
  function asArray(response) {
    if (Array.isArray(response)) return response;
    for (const value of [response?.data?.applications,response?.data?.items,response?.data?.results,response?.applications,response?.items,response?.data]) {
      if (Array.isArray(value)) return value;
    }
    return [];
  }
  const approved = (a) => ['approved','accepted','assigned','confirmed'].includes(String(a.status || a.applicationStatus || '').toLowerCase());
  const imageUrl = (candidate) => typeof candidate === 'string' && /^(https?:\/\/|data:image\/(png|jpe?g|webp);base64,|ngo-opportunity-assets\/)/i.test(candidate) ? candidate : null;
  const make = (tag, className, contents) => { const el = document.createElement(tag); if (className) el.className = className; if (contents !== undefined) el.textContent = String(contents); return el; };
  const DEMO_APP = [
    {volunteer:{name:'Tola Bello'},status:'approved'},
    {volunteer:{name:'Emeka Chukwu'},status:'approved'},
    {volunteer:{name:'Amara James'},status:'pending'},
    {volunteer:{name:'Femi Adeyemi'},status:'pending'}
  ];

  function renderPhotos(o) {
    const photos = demoMode ? DEMO.photos : (Array.isArray(o.photos) ? o.photos : Array.isArray(o.images) ? o.images : (o.coverImage ? [o.coverImage] : []));
    const usable = photos.map((p,i) => ({src:imageUrl(typeof p === 'string' ? p : first(p?.url,p?.src,p?.secure_url)),caption:first(p?.caption,p?.name,i === 0 ? 'Opportunity photo' : `Photo ${i+1}`)})).filter(p => p.src);
    const gallery = $('gallery'); gallery.replaceChildren(); gallery.hidden = usable.length === 0;
    for (const photo of usable.slice(0,3)) {
      const figure = make('figure'); const img = make('img'); img.src = photo.src; img.alt = photo.caption; img.loading = 'lazy';
      const cap = make('figcaption','',photo.caption);figure.append(img,cap);gallery.appendChild(figure);
    }
  }
  function renderAvatarStack(assigned) {
    const el = $('avatarStack');el.replaceChildren();
    if (assigned === null || assigned === 0) return;
    for (const label of (demoMode ? ['MJ','TB','EC','+5'] : ['V','V','V',assigned > 3 ? `+${assigned-3}` : '']).slice(0,Math.min(assigned,4))) {
      if (!label) continue;
      el.appendChild(make('span','bubble',label));
    }
  }
  function renderRequirement(o) {
    const req = o.requirements || {};
    const ages = { '16_plus':'16+ Years','18_plus':'18+ Years',all_ages:'All Ages' };
    const experience = {none_needed:'None Needed',intermediate:'Intermediate',prior_experience:'Prior Experience'};
    text('minAge', first(ages[req.minimumAge], req.minimumAge, req.minAge, 'Not specified'));
    text('ageNote', first(req.ageNote,req.minimumAge === '16_plus' ? 'Guardian consent may be required for minors.' : null, 'Check with the coordinator for eligibility.'));
    text('experience', first(experience[req.experienceLevel],req.experienceLevel,'Not specified'));
    text('experienceNote',first(req.experienceNote,'See opportunity details for experience requirements.'));
    text('physical',first(req.physicalDemands,'Not specified'));
    text('physicalNote',first(req.physicalNote,'Ask the coordinator about accessibility and tasks.'));
  }
  function renderStaffing(o) {
    const capacity = number(first(o.volunteerCapacity,o.staffingTarget,o.capacity));
    const assigned = demoMode ? 8 : number(first(o.assignedCount,o.confirmedCount,o.approvedCount,o.volunteersAssigned));
    const filled = capacity !== null && capacity > 0 && assigned !== null ? Math.round(100*assigned/capacity) : null;
    const slots = capacity !== null && assigned !== null ? Math.max(0,capacity-assigned) : null;
    text('assignedLabel',assigned === null ? 'Assigned: —' : `${assigned} Assigned`);
    text('rosterLabel',filled === null ? 'Roster count not available' : `Roster is ${filled}% filled`);
    text('slotsBadge',slots === null ? 'Slots unavailable' : `${slots} Slots Open`);
    text('staffingRatio',`${assigned ?? '—'} / ${capacity ?? '—'} Needed`);
    text('filledPercent',filled === null ? 'Staffing unavailable' : `${filled}% Filled`);
    $('staffingTrack').setAttribute('aria-valuenow',String(Math.max(0,Math.min(100,filled ?? 0))));
    const track = $('staffingTrack');track.replaceChildren();
    for (let i=0;i<10;i++) { const mark = make('i'); if (filled !== null && i < Math.round(Math.min(100,filled)/10)) mark.className = 'filled'; track.appendChild(mark); }
    text('volCount',assigned ?? '—');renderAvatarStack(assigned);
  }
  function render(o) {
    opportunity = o;
    const title = first(o.title,o.name,'Untitled opportunity');
    document.title = `${title} · IMPACTRA Management`;
    text('oppTitle',title);text('oppCategory',first(o.category,'Uncategorized'));
    text('oppLocation',locationOf(o));
    const shift = Array.isArray(o.shifts) ? o.shifts[0] : null;
    text('oppDate',shift ? dateLabel(shift.date) : first(o.date,'Date not specified'));
    text('oppTime',shift ? timeRange(shift) : first(o.time,'Time not specified'));
    const state = String(first(o.status,'draft')).toLowerCase();
    const badge = $('statusBadge');badge.textContent = state;badge.className = `status-pill ${['active','published','draft','completed'].includes(state) ? state : ''}`;
    text('description',first(o.description,'No description has been added yet.'));
    text('referenceBadge',`REF: ${first(o.reference,o.referenceNumber,o.code,idOf(o),'Not assigned')}`);
    const tags = $('tags');tags.replaceChildren();
    const labels = Array.isArray(o.tags) ? o.tags : Array.isArray(o.hashtags) ? o.hashtags : [];
    labels.slice(0,6).forEach(tag => tags.appendChild(make('span','',String(tag).startsWith('#') ? tag : '#'+tag)));
    renderPhotos(o);renderRequirement(o);renderStaffing(o);
    text('appCount',first(o.applicationsCount,o.applicationCount,'—'));
    text('activityCount',first(o.activityCount,Array.isArray(o.tasks)?o.tasks.length:null,'—'));
    const contact = first(o.coordinator?.name,o.leadCoordinator?.name,o.coordinatorName,o.organization?.name);
    text('coordinator',contact || 'Coordinator not specified');text('coordinatorAvatar',initials(contact || 'NG'));
    const phone = first(o.coordinator?.phone,o.emergencyPhone,o.contactPhone);
    text('emergencyPhone',phone || 'Not provided');
    $('emergencyPhone').href = phone ? `tel:${String(phone).replace(/[^+\d]/g,'')}` : '#';
    if(!phone) $('emergencyPhone').removeAttribute('href');
    text('locationName',first(o.location?.venueName,o.venueName,o.location?.hubRegion,'Location not specified'));
    text('locationAddress',first(locAddress(o),'Address not specified'));
    const addr = [first(o.location?.venueName,o.venueName,''),locAddress(o)].filter(Boolean).join(', ');
    $('directionsLink').href = addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` : '#';
    $('directionsLink').setAttribute('aria-disabled',String(!addr));
    $('mapFrame').replaceChildren();
    if (demoMode) { const img = make('img');img.src=ASSETS+'location-map.jpg';img.alt='Reference map for Surulere Community Hall';$('mapFrame').appendChild(img); }
    else $('mapFrame').appendChild(make('span','',addr ? 'Open directions to view this location on a map.' : 'Location map available once an address is added.'));
    const actualId = idOf(o);$('copyIdButton').disabled = !actualId;
    $('completeButton').disabled = demoMode || !actualId || state === 'completed';
    $('editButton').disabled = !actualId;
    renderActivityList();
  }
  function renderList(target, records, mode) {
    const root = $(target);root.replaceChildren();
    if (!records.length) { root.appendChild(make('div','empty-list',mode === 'volunteers' ? 'No confirmed volunteers are available yet.' : 'No applications to display.')); return; }
    for (const a of records) {
      const row = make('div','list-item'), content = make('div');
      const person = first(a.volunteer,a.user,a.applicant,{});
      content.appendChild(make('strong','',nameOf(person)));
      content.appendChild(make('p','',first(person.email,a.email,'Volunteer application')));
      row.appendChild(content);row.appendChild(make('span','small-pill',first(a.status,a.applicationStatus,'pending')));root.appendChild(row);
    }
  }
  function renderActivityList() {
    if (!opportunity) return;
    const root = $('activitiesList');root.replaceChildren();
    const tasks = Array.isArray(opportunity.tasks) ? opportunity.tasks : [];
    if (!tasks.length) { root.appendChild(make('div','empty-list','No scheduled tasks are available in this opportunity record. Activity submissions are managed in the Activities screen.'));return; }
    tasks.forEach((task,i) => { const row = make('div','list-item'), content = make('div');content.appendChild(make('strong','',first(task.title,`Task ${i+1}`)));content.appendChild(make('p','',first(task.description,'No description provided.')));row.appendChild(content);if(task.startTime)row.appendChild(make('span','small-pill',timeLabel(task.startTime)));root.appendChild(row); });
  }
  async function getApplications() {
    if (appLoaded || demoMode || !opportunityId) return;
    appLoaded = true;appError = null;
    try {
      if (!window.API?.organization?.applications?.listForOpportunity) throw new Error('Applications service is not available.');
      const response = await API.organization.applications.listForOpportunity(encodeURIComponent(opportunityId),{limit:100});
      applications = asArray(response);
      text('appCount',first(response?.data?.pagination?.total,response?.pagination?.total,response?.total,applications.length));
      const approvedCount = applications.filter(approved).length;
      if (approvedCount || applications.length) {
        const val = number(first(opportunity.assignedCount,opportunity.confirmedCount,opportunity.approvedCount));
        if (val === null) { opportunity.assignedCount = approvedCount;renderStaffing(opportunity); }
      }
      text('reviewQueueBtn',`Review ${applications.filter(a => String(a.status || '').toLowerCase() === 'pending').length} in Queue →`);
    } catch (error) {
      appError = error.message || 'Unable to load applications.';
      applications = [];
    }
  }
  function showTab(name, moveFocus=false) {
    if (!['overview','applications','volunteers','activities'].includes(name)) return;
    displayedTab = name;
    document.querySelectorAll('[data-tab]').forEach(btn => {
      const selected = btn.dataset.tab === name;btn.setAttribute('aria-selected',String(selected));btn.tabIndex=selected?0:-1;if(selected && moveFocus)btn.focus();
    });
    document.querySelectorAll('.tab-panel').forEach(panel => panel.hidden = panel.id !== `panel-${name}`);
    if (name === 'applications' || name === 'volunteers') {
      const target = name === 'applications' ? 'applicationList' : 'volunteerList';
      if (demoMode) {
        renderList(target,name === 'applications' ? DEMO_APP : DEMO_APP.filter(approved),name);
      } else if (!opportunityId) {
        $(target).replaceChildren(make('div','empty-list','No opportunity ID was supplied.'));
      } else {
        $(target).replaceChildren(make('div','empty-list','Loading…'));
        getApplications().then(() => {
          if (appError) $(target).replaceChildren(make('div','empty-list',appError));
          else renderList(target,name === 'applications' ? applications : applications.filter(approved),name);
        });
      }
    }
  }
  function setupTabs() {
    const tabs = [...document.querySelectorAll('[data-tab]')];
    for (const btn of tabs) {
      btn.addEventListener('click',()=>showTab(btn.dataset.tab));
      btn.addEventListener('keydown',event=>{ if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=tabs.indexOf(btn);const next=event.key === 'Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;showTab(tabs[next].dataset.tab,true); });
    }
    $('reviewQueueBtn').addEventListener('click',()=>showTab('applications',true));
  }
  function setupSidebar() {
    const sidebar=$('sidebar'),backdrop=$('mobileBackdrop'),toggle=$('menuToggle');
    const setOpen = (yes) => {sidebar.classList.toggle('open',yes);backdrop.hidden=!yes;toggle.setAttribute('aria-expanded',String(yes));};
    toggle.addEventListener('click',()=>setOpen(!sidebar.classList.contains('open')));
    backdrop.addEventListener('click',()=>setOpen(false));
    document.addEventListener('keydown', e => {if(e.key==='Escape') {setOpen(false);$('moreMenu').hidden=true;$('moreButton').setAttribute('aria-expanded','false');}});
    document.querySelectorAll('[data-unavailable]').forEach(btn=>btn.addEventListener('click',()=>toast(`${btn.dataset.unavailable} is not connected on this screen yet.`)));
    $('logoutButton').addEventListener('click', async () => {
      if(!confirm('Log out of IMPACTRA?'))return;
      try { if(window.API?.auth?.logout) await API.auth.logout(); } catch(error) { console.warn('Logout request failed:',error); }
      try {window.API?.tokens?.clear();sessionStorage.removeItem('impactra_user');}catch(_){}
      location.href='login.html';
    });
    const search=$('searchInput');$('topSearch').addEventListener('submit',event=>{event.preventDefault();location.href=`opportunities-list.html?q=${encodeURIComponent(search.value.trim())}`;});
    document.addEventListener('keydown',event=>{ if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();search.focus();}});
    try {const user=JSON.parse(sessionStorage.getItem('impactra_user')||'{}');const name=first(user.name,user.fullName,user.organizationName,user.organization?.name,'My account');text('accountName',name);text('accountAvatar',initials(name));const role=first(user.role,user.accountType,'NGO');text('accountRole',String(role).toUpperCase());}catch(_){}
    if(demoMode){text('accountName','Toyin');text('accountAvatar','');$('accountAvatar').style.backgroundImage=`url('${ASSETS}avatar.jpg')`;text('accountRole','NGO');}
  }
  function setupButtons() {
    $('shareButton').addEventListener('click',async()=>{
      const url=new URL(location.href);url.searchParams.delete('demo');if(demoMode)url.searchParams.set('demo','1');
      const data={title:opportunity?.title||'IMPACTRA opportunity',url:url.href,text:'View this opportunity on IMPACTRA'};
      try{if(navigator.share)await navigator.share(data);else if(navigator.clipboard && isSecureContext){await navigator.clipboard.writeText(url.href);toast('Opportunity link copied.');}else prompt('Copy this link:',url.href);}catch(e){if(e.name!=='AbortError')toast('Unable to share. Please copy the address from your browser.');}
    });
    $('notificationsBtn').addEventListener('click',async()=>{
      if(!window.API?.notifications?.unreadCount){toast('Notifications are not available.');return;}
      try{const r=await API.notifications.unreadCount();const count=first(r?.data?.count,r?.count,r?.data?.unreadCount,r?.unreadCount,'unknown');toast(`Unread notifications: ${count}.`);}catch(e){toast('Could not load notifications.');}
    });
    $('messageCoordinator').addEventListener('click',()=>{
      const phone=first(opportunity?.coordinator?.phone,opportunity?.contactPhone);
      if(phone)location.href=`tel:${String(phone).replace(/[^+\d]/g,'')}`;
      else toast('No coordinator phone number is available.');
    });
    $('moreButton').addEventListener('click',()=>{const menu=$('moreMenu');menu.hidden=!menu.hidden;$('moreButton').setAttribute('aria-expanded',String(!menu.hidden));});
    document.addEventListener('click',e=>{if(!e.target.closest('.more-wrap')){$('moreMenu').hidden=true;$('moreButton').setAttribute('aria-expanded','false');}});
    $('copyIdButton').addEventListener('click',async()=>{
      const id=idOf(opportunity);if(!id){toast('Opportunity ID not available.');return;}
      try{await navigator.clipboard.writeText(id);toast('Opportunity ID copied.');}catch(e){prompt('Copy opportunity ID:',id);}
    });
    $('completeButton').addEventListener('click',async()=>{
      if(demoMode){toast('Changes are disabled in demo mode.');return;}
      const id=idOf(opportunity);if(!id||!confirm('Mark this opportunity as completed?'))return;
      const button=$('completeButton');button.disabled=true;
      try{if(!window.API?.organization?.opportunities?.complete)throw Error('Service unavailable.');await API.organization.opportunities.complete(id);
        const response=await API.organization.opportunities.get(id);const remote=unwrap(response);if(remote && String(remote.status).toLowerCase()==='completed'){render(remote);toast('Opportunity marked completed.');}else throw Error('The server has not confirmed completion.');
      }catch(e){toast(e.message||'Could not mark opportunity complete.');}finally{button.disabled=false;$('moreMenu').hidden=true;}
    });
    $('directionsLink').addEventListener('click',e=>{if($('directionsLink').getAttribute('aria-disabled')==='true'){e.preventDefault();toast('An address is required for directions.');}});
    const dialog=$('editDialog');
    $('editButton').addEventListener('click',()=>{
      if(demoMode){toast('Editing is disabled in demo mode.');return;}
      text('editError','');$('editError').hidden=true;
      $('editTitle').value=first(opportunity.title,'');$('editCategory').value=first(opportunity.category,'');
      $('editDescription').value=first(opportunity.description,'');$('editCapacity').value=first(opportunity.volunteerCapacity,'');dialog.showModal();
    });
    $('closeDialog').addEventListener('click',()=>dialog.close());$('cancelEdit').addEventListener('click',()=>dialog.close());
    $('editForm').addEventListener('submit',async(event)=>{
      event.preventDefault();if(!opportunity||demoMode)return;
      const id=idOf(opportunity);const button=$('saveEdit');button.disabled=true;button.textContent='Saving…';$('editError').hidden=true;
      try{
        if(!window.API?.organization?.opportunities?.update)throw Error('Update service is not available.');
        const payload=new FormData();payload.append('title',$('editTitle').value.trim());payload.append('category',$('editCategory').value.trim());payload.append('description',$('editDescription').value.trim());payload.append('volunteerCapacity',String(Number($('editCapacity').value)));
        await API.organization.opportunities.update(id,payload);
        const refreshed=unwrap(await API.organization.opportunities.get(id));
        if(!refreshed)throw Error('Update submitted, but the updated record could not be verified.');
        const verified=refreshed.title===$('editTitle').value.trim() && Number(refreshed.volunteerCapacity)===Number($('editCapacity').value);
        if(!verified)throw Error('The server did not confirm the expected changes. Reload before editing again.');
        render(refreshed);dialog.close();toast('Opportunity updated.');
      }catch(error){text('editError',error.message||'Unable to update the opportunity.');$('editError').hidden=false;}
      finally{button.disabled=false;button.textContent='Save changes';}
    });
  }
  async function init() {
    setupSidebar();setupTabs();setupButtons();
    if(demoMode) {
      $('demoBadge').hidden=false;notice('Design preview using the screenshot’s example details. This is not live opportunity data. Open this page with ?id=YOUR_OPPORTUNITY_ID to load your real record.');
      appLoaded=true;applications=DEMO_APP;render(DEMO);return;
    }
    if(!window.API?.organization?.opportunities?.get){notice('The IMPACTRA API client is unavailable. Check that ../API.js loads correctly.',true);text('oppTitle','Unable to load opportunity');return;}
    try{
      const result=await API.organization.opportunities.get(encodeURIComponent(opportunityId));
      const remote=unwrap(result);
      if(!remote || (!remote.title && !remote.name))throw Error('The server returned no opportunity details.');
      render(remote);notice('');
      // Application counts are best-effort. Do not invent them when backend access fails.
      await getApplications();
      if(appError) {text('appCount','—');text('reviewQueueBtn','Review applications →');}
    }catch(e){console.warn('[ngo-opportunity-details] load failed:',e);notice(e.message||'Unable to load the opportunity. Please check your access and try again.',true);text('oppTitle','Opportunity unavailable');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
