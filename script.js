const seedRecords = [
  {school_year:'2021-2022', total_enrollment:1966, kinder:218, grade1:297, grade2:206, grade3:362, grade4:292, grade5:212, grade6:283, sped:35, teachers:62, classrooms:42, dropouts:2, repeaters:5, attendance_rate:100, performance_rate:82, notes:'Baseline year with highest enrollment'},
  {school_year:'2022-2023', total_enrollment:1812, kinder:205, grade1:250, grade2:215, grade3:315, grade4:270, grade5:225, grade6:250, sped:44, teachers:58, classrooms:42, dropouts:4, repeaters:8, attendance_rate:100, performance_rate:83, notes:'Decline started after baseline'},
  {school_year:'2023-2024', total_enrollment:1914, kinder:300, grade1:270, grade2:230, grade3:290, grade4:281, grade5:235, grade6:240, sped:55, teachers:60, classrooms:42, dropouts:3, repeaters:12, attendance_rate:100, performance_rate:84, notes:'Temporary recovery / spike'},
  {school_year:'2024-2025', total_enrollment:1799, kinder:210, grade1:260, grade2:235, grade3:260, grade4:275, grade5:240, grade6:220, sped:62, teachers:57, classrooms:42, dropouts:7, repeaters:6, attendance_rate:100, performance_rate:84.5, notes:'Decline returned; highest dropout recorded'},
  {school_year:'2025-2026', total_enrollment:1748, kinder:197, grade1:277, grade2:241, grade3:233, grade4:276, grade5:243, grade6:189, sped:69, teachers:55, classrooms:42, dropouts:1, repeaters:3, attendance_rate:100, performance_rate:86, notes:'Lowest enrollment in five-year range'}
];

const gradeFields = [
  ['kinder','Kinder'], ['grade1','Grade 1'], ['grade2','Grade 2'], ['grade3','Grade 3'],
  ['grade4','Grade 4'], ['grade5','Grade 5'], ['grade6','Grade 6'], ['sped','SPED']
];

const matrixRules = [
  {area:'Enrollment Decline', strategy:'Enrollment recovery and parent/community outreach', impact:'High', feasibility:'Medium'},
  {area:'Grade 3 and 6 Retention', strategy:'Cohort tracking, exit surveys, and intervention logs', impact:'High', feasibility:'High'},
  {area:'Dropout Monitoring', strategy:'At-risk student tracking, parent follow-up, and adviser intervention logs', impact:'High', feasibility:'High'},
  {area:'SPED Growth', strategy:'Resource expansion and classroom reallocation', impact:'High', feasibility:'Medium'},
  {area:'Class Size Imbalance', strategy:'Section redistribution and room planning', impact:'Medium', feasibility:'High'},
  {area:'Attendance Reliability', strategy:'Monthly validation and adviser reporting', impact:'Medium', feasibility:'High'}
];

Chart.defaults.font.family = 'Poppins';
Chart.defaults.color = '#6f5d5d';
const gridColor = 'rgba(138,102,85,.12)';
const pink = '#c49ca0';
const brown = '#8a6655';
const green = '#87936c';
let charts = {};
let records = [];
let db = null;
let isAdmin = false;
let authModal = null;

function hasSupabaseConfig(){
  return window.SCES_SUPABASE_URL && window.SCES_SUPABASE_ANON_KEY && !window.SCES_SUPABASE_URL.includes('PASTE_') && !window.SCES_SUPABASE_ANON_KEY.includes('PASTE_') && window.supabase;
}

function initDb(){
  if(hasSupabaseConfig()){
    db = window.supabase.createClient(window.SCES_SUPABASE_URL, window.SCES_SUPABASE_ANON_KEY);
    return true;
  }
  return false;
}

function makeGradient(ctx){
  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, 'rgba(196,156,160,.45)');
  gradient.addColorStop(1, 'rgba(196,156,160,.03)');
  return gradient;
}
function num(v){return Number(v || 0)}
function pct(n){return (n>0?'+':'')+n.toFixed(1)+'%'}
function fmt(n){return Number(n || 0).toLocaleString()}
function latest(){return records[records.length-1] || seedRecords[seedRecords.length-1]}
function previous(){return records[records.length-2] || seedRecords[seedRecords.length-2]}
function first(){return records[0] || seedRecords[0]}
function years(){return records.map(r=>r.school_year)}
function totals(){return records.map(r=>num(r.total_enrollment))}

async function loadRecords(){
  const dbConfigured = initDb();
  setStatus(dbConfigured ? 'Database connected • Supabase persistent storage' : 'Database not configured • demo fallback only', dbConfigured ? 'Public viewer mode • read-only unless admin is logged in' : 'Edit config.js and run setup_database.sql for school deployment');
  if(dbConfigured){
    const {data, error} = await db.from('school_year_data').select('*').order('school_year', {ascending:true});
    if(error){
      console.error(error);
      showMessage('Database load failed. Showing local demo data. Check Supabase table and RLS policies.', 'warning');
      records = loadLocalRecords();
    }else{
      records = data && data.length ? data : seedRecords;
    }
    await refreshAuthState();
  }else{
    records = loadLocalRecords();
  }
  updateYearOptions();
  renderAll();
}

function loadLocalRecords(){
  try{return JSON.parse(localStorage.getItem('sces_school_year_data')) || seedRecords}catch(e){return seedRecords}
}
function saveLocalRecords(){localStorage.setItem('sces_school_year_data', JSON.stringify(records))}
function setStatus(dbText, authText){
  const dbEl = document.getElementById('databaseStatus');
  const authEl = document.getElementById('authStatus');
  if(dbEl) dbEl.textContent = dbText;
  if(authEl) authEl.textContent = authText;
}
function showMessage(msg, type='success', id='formMessage'){
  const el = document.getElementById(id);
  if(!el) return;
  el.className = `alert alert-${type} mt-3`;
  el.textContent = msg;
  setTimeout(()=>el.classList.add('d-none'), 5000);
}

async function refreshAuthState(){
  if(!db) return;
  const {data:{session}} = await db.auth.getSession();
  isAdmin = false;
  if(session?.user){
    const {data} = await db.from('admins').select('user_id,email').eq('user_id', session.user.id).maybeSingle();
    isAdmin = !!data;
    setStatus('Database connected • Supabase persistent storage', isAdmin ? `Admin mode • ${session.user.email}` : 'Logged in but not listed as admin');
  }
  updateAdminUi();
}

function updateAdminUi(){
  document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('d-none', !isAdmin));
  document.getElementById('adminLoginBtn')?.classList.toggle('d-none', isAdmin);
  document.getElementById('adminLogoutBtn')?.classList.toggle('d-none', !isAdmin);
}

function updateYearOptions(){
  const select = document.getElementById('yearFilter');
  if(!select) return;
  select.innerHTML = '<option value="all">All Years</option>' + records.map(r=>`<option value="${r.school_year}">${r.school_year}</option>`).join('');
}

function destroyChart(key){if(charts[key]){charts[key].destroy(); delete charts[key];}}
function renderAll(){
  renderKpis();
  renderCharts();
  renderTables();
  renderDynamicAnalysis();
  renderAdminTable();
  revealInit();
}

function renderKpis(){
  const l = latest(), p = previous(), f = first();
  const latestEnrollment = num(l.total_enrollment);
  const prevEnrollment = num(p.total_enrollment);
  const baseline = num(f.total_enrollment);
  const totalChange = baseline ? ((latestEnrollment-baseline)/baseline)*100 : 0;
  const yoy = prevEnrollment ? ((latestEnrollment-prevEnrollment)/prevEnrollment)*100 : 0;
  const ratio = l.teachers ? Math.round(latestEnrollment / num(l.teachers)) : 0;
  const highestDropout = Math.max(...records.map(r=>num(r.dropouts)));
  const spedGrowth = f.sped ? ((num(l.sped)-num(f.sped))/num(f.sped))*100 : 0;
  const classPeak = l.classrooms ? Math.round(latestEnrollment / num(l.classrooms)) : 0;
  const heroEnrollment = document.getElementById('heroEnrollment');
  if(heroEnrollment) heroEnrollment.textContent = fmt(latestEnrollment);
  document.getElementById('kpiEnrollment') && (document.getElementById('kpiEnrollment').textContent = fmt(latestEnrollment));
  const heroStat = document.querySelector('.hero-stat span');
  if(heroStat) heroStat.innerHTML = `<i class="bi ${yoy>=0?'bi-arrow-up-right':'bi-arrow-down-right'}"></i> ${pct(yoy)} vs ${p.school_year}`;
  const kpis = document.querySelectorAll('.overview-kpis .kpi-card');
  if(kpis[1]){ kpis[1].querySelector('small').textContent = totalChange < 0 ? 'Enrollment Decline' : 'Enrollment Growth'; kpis[1].querySelector('h4').textContent = pct(totalChange); kpis[1].querySelector('p').textContent = `${Math.abs(latestEnrollment-baseline)} student ${totalChange<0?'decrease':'increase'} vs ${f.school_year}`; }
  if(kpis[2]){ kpis[2].querySelector('h4').textContent = ratio; kpis[2].querySelector('p').textContent = `Students per teacher • ${l.teachers || 0} teachers`; }
  if(kpis[3]){ kpis[3].querySelector('h4').textContent = highestDropout; kpis[3].querySelector('p').textContent = `Highest recorded dropout count`; }
  if(kpis[4]){ kpis[4].querySelector('h4').textContent = pct(spedGrowth); kpis[4].querySelector('p').textContent = `${f.sped || 0} to ${l.sped || 0} students`; }
  if(kpis[5]){ kpis[5].querySelector('h4').textContent = classPeak; kpis[5].querySelector('p').textContent = `Estimated students per classroom`; }
}

function renderCharts(){
  const enrollmentCtx = document.getElementById('enrollmentChart');
  if(enrollmentCtx){
    destroyChart('enrollment');
    const ctx = enrollmentCtx.getContext('2d');
    charts.enrollment = new Chart(ctx,{type:'line',data:{labels:years(),datasets:[{label:'Total Enrollment',data:totals(),borderColor:brown,backgroundColor:makeGradient(ctx),fill:true,tension:.42,pointBackgroundColor:pink,pointBorderColor:'#fff',pointBorderWidth:3,pointRadius:6}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{grid:{color:gridColor},beginAtZero:false}}}});
  }
  const varianceCtx = document.getElementById('varianceChart');
  if(varianceCtx){
    destroyChart('variance');
    const f=first(), l=latest();
    const variance = gradeFields.map(([k,label])=>({label,diff:num(l[k])-num(f[k])}));
    charts.variance = new Chart(varianceCtx,{type:'bar',data:{labels:variance.map(v=>v.label),datasets:[{label:'Net Variance',data:variance.map(v=>v.diff),backgroundColor:variance.map(v=>v.diff>=0?green:pink),borderRadius:10}]},options:{plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{grid:{color:gridColor}}}}});
  }
  const priorityCtx = document.getElementById('diagnosticPriorityChart');
  if(priorityCtx){
    destroyChart('priority');
    const l=latest(), p=previous();
    const enrollRisk = Math.min(100, Math.abs(((num(l.total_enrollment)-num(p.total_enrollment))/num(p.total_enrollment))*900));
    const dropoutRisk = Math.min(100, num(l.dropouts)*15);
    const classRisk = l.classrooms ? Math.min(100, (num(l.total_enrollment)/num(l.classrooms))*2) : 50;
    const spedRisk = first().sped ? Math.min(100, ((num(l.sped)-num(first().sped))/num(first().sped))*80) : 50;
    const dataRisk = num(l.attendance_rate) >= 99.9 ? 85 : 35;
    charts.priority = new Chart(priorityCtx,{type:'radar',data:{labels:['Enrollment','Dropout','Class Size','SPED','Data Quality'],datasets:[{label:'Priority',data:[enrollRisk,dropoutRisk,classRisk,spedRisk,dataRisk],borderColor:brown,backgroundColor:'rgba(196,156,160,.28)',pointBackgroundColor:pink}]},options:{plugins:{legend:{display:false}},scales:{r:{angleLines:{color:gridColor},grid:{color:gridColor},pointLabels:{font:{weight:'700'}},suggestedMin:0,suggestedMax:100}}}});
  }
  const forecastCtx = document.getElementById('forecastChart');
  if(forecastCtx){
    destroyChart('forecast');
    const fs = buildForecast();
    charts.forecast = new Chart(forecastCtx,{type:'line',data:{labels:[...years(),...fs.labels],datasets:[{label:'Actual',data:[...totals(),...fs.labels.map(()=>null)],borderColor:brown,backgroundColor:'transparent',tension:.38,pointRadius:5},{label:'Forecast',data:[...records.slice(0,-1).map(()=>null),num(latest().total_enrollment),...fs.values],borderColor:pink,borderDash:[7,6],backgroundColor:'transparent',tension:.38,pointRadius:5}]},options:{plugins:{legend:{position:'bottom',labels:{usePointStyle:true}}},scales:{x:{grid:{display:false}},y:{grid:{color:gridColor}}}}});
  }
}

function buildForecast(){
  const vals = totals();
  if(vals.length < 2) return {labels:['Next SY'], values:[vals[0] || 0]};
  const changes = vals.slice(1).map((v,i)=>v-vals[i]);
  const avg = changes.reduce((a,b)=>a+b,0)/changes.length;
  const lastYear = latest().school_year;
  const start = Number(lastYear.split('-')[0]) || 2026;
  let current = num(latest().total_enrollment);
  const labels=[], values=[];
  for(let i=1;i<=2;i++){
    labels.push(`${start+i}-${start+i+1}`);
    current = Math.max(0, Math.round(current + avg));
    values.push(current);
  }
  return {labels, values};
}

function renderTables(){
  const varianceBody = document.querySelector('#varianceTable tbody');
  if(varianceBody){
    varianceBody.innerHTML = '';
    const f=first(), l=latest();
    gradeFields.forEach(([k,label])=>{
      const diff = num(l[k])-num(f[k]);
      const change = f[k] ? diff/num(f[k])*100 : 0;
      const status = diff>20?'Growth':diff<-50?'High Decline':diff<0?'Decline':'Stable';
      const cls = diff>0?'status-up':diff<-50?'status-down':'status-watch';
      varianceBody.insertAdjacentHTML('beforeend',`<tr><td><strong>${label}</strong></td><td>${num(f[k])}</td><td>${num(l[k])}</td><td>${diff>0?'+':''}${diff}</td><td>${pct(change)}</td><td><span class="status-badge ${cls}">${status}</span></td></tr>`);
    });
  }
  const summaryBody = document.querySelector('#summaryTable tbody');
  if(summaryBody){
    summaryBody.innerHTML = '';
    records.forEach((r,i)=>{
      const pattern = i===0?'Baseline':num(r.total_enrollment)>num(records[i-1].total_enrollment)?'Increase':'Decrease';
      const cls = pattern==='Increase'?'status-up':pattern==='Baseline'?'status-watch':'status-down';
      summaryBody.insertAdjacentHTML('beforeend',`<tr><td><strong>${r.school_year}</strong></td><td>${fmt(r.total_enrollment)}</td><td><span class="status-badge ${cls}">${pattern}</span></td><td>${r.notes || makeYearNote(r, records[i-1])}</td></tr>`);
    });
  }
  const matrixBody = document.querySelector('#decisionMatrixTable tbody');
  if(matrixBody){
    matrixBody.innerHTML = '';
    buildMatrix().forEach(row=>matrixBody.insertAdjacentHTML('beforeend',`<tr><td>${row.area}</td><td>${row.strategy}</td><td>${row.impact}</td><td>${row.feasibility}</td><td><span class="status-badge ${row.priority==='High'?'status-down':'status-watch'}">${row.priority}</span></td></tr>`));
  }
}

function makeYearNote(r,p){
  if(!p) return 'Baseline record';
  const diff = num(r.total_enrollment)-num(p.total_enrollment);
  if(diff < 0) return `Enrollment decreased by ${Math.abs(diff)} learners`;
  if(diff > 0) return `Enrollment increased by ${diff} learners`;
  return 'Enrollment remained stable';
}

function renderDynamicAnalysis(){
  const el = document.getElementById('dynamicAnalysisList');
  const insights = buildInsights();
  if(el){
    el.innerHTML = insights.map(i=>`<div><i class="bi ${i.icon} ${i.color}"></i><strong>${i.title}:</strong> ${i.text} <span class="insight-tag">${i.type}</span></div>`).join('');
  }
  renderQuickSnapshot();
  renderRoomStatus();
  renderEarlyWarnings();
  renderDiagnosticBoard();
  renderPredictiveBoard();
  renderPrescriptiveBoard();
}

function buildInsights(){
  const l=latest(), p=previous(), f=first();
  const yoy = num(l.total_enrollment)-num(p.total_enrollment);
  const totalChange = num(l.total_enrollment)-num(f.total_enrollment);
  const dropoutChange = num(l.dropouts)-num(p.dropouts);
  const perfChange = num(l.performance_rate)-num(p.performance_rate);
  const spedChange = num(l.sped)-num(f.sped);
  const forecast = buildForecast().values;
  const insights=[];
  insights.push(yoy < 0 ? {type:'Descriptive',icon:'bi-caret-down-fill',color:'text-danger',title:'Enrollment Warning',text:`Enrollment decreased by ${Math.abs(yoy)} learners from ${p.school_year} to ${l.school_year}.`} : {type:'Descriptive',icon:'bi-caret-up-fill',color:'text-success',title:'Enrollment Growth',text:`Enrollment increased by ${yoy} learners from ${p.school_year} to ${l.school_year}.`});
  insights.push(totalChange < 0 ? {type:'Diagnostic',icon:'bi-search-heart-fill',color:'text-warning',title:'Possible Retention Concern',text:`Overall enrollment is lower by ${Math.abs(totalChange)} learners versus ${f.school_year}, so intake and cohort movement should be reviewed.`} : {type:'Diagnostic',icon:'bi-check-circle-fill',color:'text-success',title:'Improving Enrollment Base',text:`Overall enrollment is higher than the baseline by ${totalChange} learners.`});
  insights.push(dropoutChange > 0 ? {type:'Prescriptive',icon:'bi-person-fill-exclamation',color:'text-danger',title:'Dropout Intervention Needed',text:`Dropouts increased by ${dropoutChange}; assign adviser follow-up, parent contact, and at-risk learner monitoring.`} : {type:'Prescriptive',icon:'bi-shield-check',color:'text-success',title:'Dropout Monitoring Positive',text:`Dropouts did not increase compared with the previous school year; continue early-warning monitoring.`});
  insights.push(perfChange >= 0 ? {type:'Diagnostic',icon:'bi-graph-up-arrow',color:'text-success',title:'Performance Improvement',text:`Performance rate improved by ${perfChange.toFixed(2)} percentage point(s); maintain academic interventions.`} : {type:'Diagnostic',icon:'bi-exclamation-triangle-fill',color:'text-warning',title:'Performance Review',text:`Performance rate decreased by ${Math.abs(perfChange).toFixed(2)} percentage point(s); review grade-level support.`});
  insights.push(spedChange > 0 ? {type:'Prescriptive',icon:'bi-universal-access',color:'text-primary',title:'SPED Resource Planning',text:`SPED increased by ${spedChange} learners from baseline; prepare teacher training, learning materials, and room allocation.`} : {type:'Prescriptive',icon:'bi-universal-access',color:'text-primary',title:'SPED Monitoring',text:`SPED count is stable; continue resource monitoring.`});
  insights.push({type:'Predictive',icon:'bi-magic',color:'text-warning',title:'Forecast',text:`Based on the recent average trend, projected enrollment may reach around ${fmt(forecast[0])} then ${fmt(forecast[1])} in the next two school years if no major intervention happens.`});
  if(num(l.attendance_rate) >= 99.9){insights.push({type:'Data Quality',icon:'bi-clipboard2-x-fill',color:'text-warning',title:'Attendance Validation',text:'Attendance is reported near 100%, so monthly validation is recommended to avoid inaccurate decision-making.'});}
  return insights;
}

function buildMatrix(){
  const ins = buildInsights();
  return matrixRules.map(row=>{
    let priority = 'Medium';
    if(row.area.includes('Enrollment') && ins.some(i=>i.title.includes('Enrollment Warning'))) priority='High';
    if(row.area.includes('Dropout') && ins.some(i=>i.title.includes('Dropout Intervention'))) priority='High';
    if(row.area.includes('SPED') && num(latest().sped) > num(first().sped)) priority='High';
    if(row.area.includes('Attendance') && num(latest().attendance_rate) >= 99.9) priority='Medium';
    if(row.impact==='High' && row.feasibility==='High') priority='High';
    return {...row, priority};
  });
}


function getMetrics(){
  const l=latest(), p=previous(), f=first();
  const latestEnrollment=num(l.total_enrollment), prevEnrollment=num(p.total_enrollment), baseline=num(f.total_enrollment);
  const yoyCount = latestEnrollment - prevEnrollment;
  const yoyPct = prevEnrollment ? (yoyCount / prevEnrollment) * 100 : 0;
  const totalChangeCount = latestEnrollment - baseline;
  const totalChangePct = baseline ? (totalChangeCount / baseline) * 100 : 0;
  const dropoutChange = num(l.dropouts) - num(p.dropouts);
  const repeaterChange = num(l.repeaters) - num(p.repeaters);
  const perfChange = num(l.performance_rate) - num(p.performance_rate);
  const spedChange = num(l.sped) - num(f.sped);
  const classAvg = l.classrooms ? latestEnrollment / num(l.classrooms) : 0;
  const ratio = l.teachers ? latestEnrollment / num(l.teachers) : 0;
  const forecast = buildForecast();
  return {l,p,f,latestEnrollment,prevEnrollment,baseline,yoyCount,yoyPct,totalChangeCount,totalChangePct,dropoutChange,repeaterChange,perfChange,spedChange,classAvg,ratio,forecast};
}

function renderQuickSnapshot(){
  const el=document.getElementById('quickSnapshotList');
  if(!el) return;
  const m=getMetrics();
  const trendText = m.yoyCount < 0 ? `Enrollment decreased by ${fmt(Math.abs(m.yoyCount))} learners from ${m.p.school_year} to ${m.l.school_year}.` : `Enrollment increased by ${fmt(m.yoyCount)} learners from ${m.p.school_year} to ${m.l.school_year}.`;
  const baselineText = m.totalChangeCount < 0 ? `Overall enrollment is ${fmt(Math.abs(m.totalChangeCount))} learners lower than ${m.f.school_year}.` : `Overall enrollment is ${fmt(m.totalChangeCount)} learners higher than ${m.f.school_year}.`;
  const dropoutText = m.dropoutChange > 0 ? `Dropouts increased by ${m.dropoutChange}, so intervention monitoring is needed.` : `Dropouts did not increase versus previous school year.`;
  const performanceText = m.perfChange >= 0 ? `Performance improved by ${m.perfChange.toFixed(2)} percentage point(s).` : `Performance decreased by ${Math.abs(m.perfChange).toFixed(2)} percentage point(s).`;
  el.innerHTML = `
    <li><strong>Latest year:</strong> ${m.l.school_year} has ${fmt(m.latestEnrollment)} enrolled learners.</li>
    <li><strong>Trend:</strong> ${trendText}</li>
    <li><strong>Baseline comparison:</strong> ${baselineText}</li>
    <li><strong>Dropout status:</strong> ${dropoutText}</li>
    <li><strong>Performance:</strong> ${performanceText}</li>`;
}

function renderRoomStatus(){
  const el=document.querySelector('.room-status');
  if(!el) return;
  const m=getMetrics();
  const classStatus = m.classAvg >= 45 ? ['danger','Overcrowding Risk',`Estimated ${Math.round(m.classAvg)} learners per classroom. Review sections and room allocation.`]
    : m.classAvg >= 35 ? ['warn','Needs Monitoring',`Estimated ${Math.round(m.classAvg)} learners per classroom. Keep checking section distribution.`]
    : ['good','Manageable Range',`Estimated ${Math.round(m.classAvg)} learners per classroom. Maintain balanced room use.`];
  const ratioStatus = m.ratio >= 35 ? ['warn','Teacher Load Review',`Teacher-student ratio is around ${Math.round(m.ratio)}:1.`]
    : ['good','Teacher Ratio Stable',`Teacher-student ratio is around ${Math.round(m.ratio)}:1.`];
  el.innerHTML = `
    <div><span class="dot ${classStatus[0]}"></span><strong>${classStatus[1]}</strong><p>${classStatus[2]}</p></div>
    <div><span class="dot ${ratioStatus[0]}"></span><strong>${ratioStatus[1]}</strong><p>${ratioStatus[2]}</p></div>
    <div><span class="dot ${num(m.l.attendance_rate)>=99.9?'warn':'good'}"></span><strong>Attendance Data</strong><p>${num(m.l.attendance_rate)>=99.9?'Reported near 100%; validate monthly records.':'Attendance rate has usable variation for monitoring.'}</p></div>`;
}

function actionCard(no, pill, title, body, step, cats='all', high=false){
  return `<article class="action-card" data-category="${cats}">
    <span class="badge-pill ${high?'high':''}">${no}. ${pill}</span>
    <h5>${title}</h5>
    <p>${body}</p>
    <div class="next-step"><i class="bi ${high?'bi-exclamation-triangle-fill':'bi-check-circle-fill'}"></i> ${step}</div>
  </article>`;
}

function renderDiagnosticBoard(){
  const el=document.querySelector('.diagnostic-actions');
  if(!el) return;
  const m=getMetrics();
  const cards=[];
  cards.push(actionCard(1,'Root Cause Analysis', m.yoyCount < 0 ? 'Enrollment decreased from previous year' : 'Enrollment improved from previous year',
    `<strong>Evidence:</strong> ${m.l.school_year} changed by ${fmt(m.yoyCount)} learners versus ${m.p.school_year}. <strong>Likely cause:</strong> intake, transfers, cohort progression, and community factors should be checked.`,
    m.yoyCount < 0 ? 'Review Kinder/Grade 1 intake, transfer records, and parent feedback.' : 'Document what helped enrollment improve and continue the same activities.', 'intake retention', m.yoyCount < 0));
  cards.push(actionCard(2,'Dropout Diagnosis', m.dropoutChange > 0 ? 'Dropout count increased' : 'Dropout count is controlled',
    `<strong>Evidence:</strong> Dropouts changed from ${num(m.p.dropouts)} to ${num(m.l.dropouts)}.`,
    m.dropoutChange > 0 ? 'Activate adviser follow-up, parent contact, and at-risk learner logs.' : 'Continue weekly monitoring and early-warning tagging.', 'retention', m.dropoutChange > 0));
  cards.push(actionCard(3,'Performance Diagnosis', m.perfChange >= 0 ? 'Performance is improving' : 'Performance needs review',
    `<strong>Evidence:</strong> Performance rate changed by ${m.perfChange.toFixed(2)} percentage point(s).`,
    m.perfChange >= 0 ? 'Maintain remedial classes and replicate effective practices.' : 'Review assessment results and provide grade-level academic support.', 'student data', m.perfChange < 0));
  cards.push(actionCard(4,'Resource Diagnosis', m.classAvg >= 45 ? 'Classroom load is high' : 'Classroom load is manageable',
    `<strong>Evidence:</strong> Current estimated class load is ${Math.round(m.classAvg)} learners per classroom, with ${num(m.l.teachers)} teachers and ${num(m.l.classrooms)} classrooms.`,
    m.classAvg >= 45 ? 'Redistribute sections and consider additional classroom scheduling.' : 'Maintain balanced section planning and monitor yearly changes.', 'resource', m.classAvg >= 45));
  cards.push(actionCard(5,'SPED Demand Diagnosis', m.spedChange > 0 ? 'SPED demand increased' : 'SPED demand is stable',
    `<strong>Evidence:</strong> SPED changed from ${num(m.f.sped)} to ${num(m.l.sped)} learners since baseline.`,
    m.spedChange > 0 ? 'Prepare SPED materials, teacher training, and room allocation.' : 'Continue SPED monitoring and support planning.', 'resource intake', m.spedChange > 20));
  cards.push(actionCard(6,'Data Quality Check', num(m.l.attendance_rate) >= 99.9 ? 'Attendance needs validation' : 'Attendance data is trackable',
    `<strong>Evidence:</strong> Latest attendance rate is ${num(m.l.attendance_rate)}%.`,
    num(m.l.attendance_rate) >= 99.9 ? 'Validate class attendance logs monthly because perfect attendance may hide issues.' : 'Use attendance variation to identify students needing support.', 'data', num(m.l.attendance_rate) >= 99.9));
  el.innerHTML=cards.join('');
}

function renderEarlyWarnings(){
  const el=document.getElementById('earlyWarningList');
  if(!el) return;
  const m=getMetrics();
  const items=[];
  items.push(m.forecast.values[0] < m.latestEnrollment ? `Enrollment may decrease to around ${fmt(m.forecast.values[0])} next school year if no intervention happens.` : `Enrollment may increase to around ${fmt(m.forecast.values[0])} next school year if the current trend continues.`);
  if(m.dropoutChange > 0) items.push('Dropout risk increased; at-risk learner monitoring should start immediately.');
  if(m.perfChange < 0) items.push('Performance declined; academic intervention and grade-level support are recommended.');
  if(m.classAvg >= 45) items.push('Class size imbalance may continue unless sections and classrooms are redistributed.');
  if(m.spedChange > 0) items.push('SPED growth requires stronger resource and teacher training plans.');
  if(num(m.l.attendance_rate) >= 99.9) items.push('Attendance data must be validated because perfect attendance records can be inaccurate.');
  el.innerHTML = items.map(i=>`<li>${i}</li>`).join('');
}

function renderPredictiveBoard(){
  const el=document.querySelector('.predictive-actions');
  if(!el) return;
  const m=getMetrics();
  const next1=m.forecast.labels[0], next2=m.forecast.labels[1];
  const cards=[];
  cards.push(actionCard(1,'Enrollment Forecast', m.forecast.values[0] < m.latestEnrollment ? 'Possible enrollment decrease' : 'Possible enrollment increase',
    `<strong>Forecast:</strong> ${next1}: around ${fmt(m.forecast.values[0])}; ${next2}: around ${fmt(m.forecast.values[1])}.`,
    m.forecast.values[0] < m.latestEnrollment ? 'Start enrollment recovery, early registration, and community outreach.' : 'Prepare capacity planning for continued learner growth.', 'enrollment', m.forecast.values[0] < m.latestEnrollment));
  cards.push(actionCard(2,'Teacher-Student Ratio', m.ratio >= 35 ? 'Teacher workload may increase' : 'Ratio may remain manageable',
    `<strong>Finding:</strong> Latest ratio is around ${Math.round(m.ratio)} learners per teacher.`,
    m.ratio >= 35 ? 'Review staffing before finalizing sections.' : 'Keep staffing stable while monitoring actual section sizes.', 'staffing', m.ratio >= 35));
  cards.push(actionCard(3,'Classroom Forecast', m.classAvg >= 45 ? 'Overcrowding risk may continue' : 'Classroom load is manageable',
    `<strong>Finding:</strong> Estimated class load is ${Math.round(m.classAvg)} learners per classroom.`,
    m.classAvg >= 45 ? 'Plan room redistribution and possible additional sections.' : 'Maintain annual section planning.', 'classroom', m.classAvg >= 45));
  cards.push(actionCard(4,'Dropout Forecast', m.dropoutChange > 0 ? 'Dropout risk may rise' : 'Dropout risk can stay low',
    `<strong>Finding:</strong> Dropouts changed by ${m.dropoutChange} from previous year.`,
    m.dropoutChange > 0 ? 'Use weekly adviser monitoring and parent follow-up.' : 'Continue at-risk tracking to prevent future increases.', 'student', m.dropoutChange > 0));
  cards.push(actionCard(5,'Academic Performance Forecast', m.perfChange >= 0 ? 'Performance can continue improving' : 'Performance may decline',
    `<strong>Finding:</strong> Latest performance rate is ${num(m.l.performance_rate)}%.`,
    m.perfChange >= 0 ? 'Sustain successful academic interventions.' : 'Prepare remedial support and assessment review.', 'student', m.perfChange < 0));
  cards.push(actionCard(6,'Data Reliability Forecast', num(m.l.attendance_rate) >= 99.9 ? 'Attendance records may remain unreliable' : 'Attendance can support monitoring',
    `<strong>Finding:</strong> Latest attendance rate is ${num(m.l.attendance_rate)}%.`,
    num(m.l.attendance_rate) >= 99.9 ? 'Use verified attendance logs and monthly checking.' : 'Use attendance trends to identify learners needing support.', 'data', num(m.l.attendance_rate) >= 99.9));
  el.innerHTML=cards.join('');
}

function renderPrescriptiveBoard(){
  const el=document.querySelector('.prescriptive-actions');
  if(!el) return;
  const m=getMetrics();
  const recs=[];
  recs.push(actionCard(1,'Quick Win • Dynamic', m.yoyCount < 0 ? 'Enrollment Recovery Program' : 'Enrollment Growth Maintenance',
    m.yoyCount < 0 ? `<strong>Action:</strong> Conduct early registration campaigns, parent feedback, and community outreach because enrollment decreased by ${fmt(Math.abs(m.yoyCount))}.` : `<strong>Action:</strong> Continue successful enrollment practices because enrollment increased by ${fmt(m.yoyCount)}.`,
    m.yoyCount < 0 ? 'Prioritize this before the next school year.' : 'Document the strategy and repeat it in the next enrollment cycle.', 'quick high', m.yoyCount < 0));
  recs.push(actionCard(2,'Quick Win • Dynamic', m.dropoutChange > 0 ? 'At-Risk Learner Intervention' : 'Continue Dropout Prevention',
    m.dropoutChange > 0 ? `<strong>Action:</strong> Create weekly monitoring logs and parent contact plans because dropouts increased by ${m.dropoutChange}.` : `<strong>Action:</strong> Maintain adviser monitoring because dropout count did not increase.`,
    m.dropoutChange > 0 ? 'Assign advisers and guidance support to affected learners.' : 'Keep intervention logs updated monthly.', 'quick high', m.dropoutChange > 0));
  recs.push(actionCard(3,'Quick Win • Dynamic', m.perfChange < 0 ? 'Academic Support Review' : 'Sustain Performance Improvement',
    m.perfChange < 0 ? `<strong>Action:</strong> Add remedial sessions and review grade-level assessment results because performance decreased.` : `<strong>Action:</strong> Continue existing academic support because performance improved by ${m.perfChange.toFixed(2)} percentage point(s).`,
    m.perfChange < 0 ? 'Start with grades showing low assessment performance.' : 'Replicate successful practices across sections.', 'quick', m.perfChange < 0));
  recs.push(actionCard(4,'Medium-Term • Dynamic', m.spedChange > 0 ? 'SPED Resource Expansion' : 'SPED Resource Monitoring',
    m.spedChange > 0 ? `<strong>Action:</strong> Allocate materials, rooms, and training because SPED increased by ${m.spedChange} learners since baseline.` : `<strong>Action:</strong> Continue SPED monitoring and annual resource planning.`,
    m.spedChange > 0 ? 'Coordinate with school leadership for budget and teacher training.' : 'Review needs every school year.', 'medium high', m.spedChange > 20));
  recs.push(actionCard(5,'Medium-Term • Dynamic', m.classAvg >= 45 ? 'Class Size Optimization' : 'Balanced Section Planning',
    m.classAvg >= 45 ? `<strong>Action:</strong> Redistribute classrooms and sections because estimated class load is ${Math.round(m.classAvg)} learners per classroom.` : `<strong>Action:</strong> Keep annual section planning to maintain manageable class sizes.`,
    m.classAvg >= 45 ? 'Prioritize overcrowded grade levels and available rooms.' : 'Review load before final section assignments.', 'medium', m.classAvg >= 45));
  recs.push(actionCard(6,'Quick Win • Dynamic', num(m.l.attendance_rate) >= 99.9 ? 'Attendance Validation System' : 'Attendance-Based Monitoring',
    num(m.l.attendance_rate) >= 99.9 ? `<strong>Action:</strong> Validate attendance logs because the latest attendance rate is ${num(m.l.attendance_rate)}%.` : `<strong>Action:</strong> Use attendance patterns to identify students needing support.`,
    num(m.l.attendance_rate) >= 99.9 ? 'Require monthly adviser checking and consolidated reports.' : 'Flag students below the attendance threshold.', 'quick', num(m.l.attendance_rate) >= 99.9));
  el.innerHTML=recs.join('');
}

function renderAdminTable(){
  const body = document.querySelector('#adminDataTable tbody');
  if(!body) return;
  body.innerHTML = records.map((r,i)=>`<tr><td><strong>${r.school_year}</strong></td><td>${fmt(r.total_enrollment)}</td><td>${num(r.dropouts)}</td><td>${num(r.repeaters)}</td><td>${num(r.attendance_rate)}%</td><td>${num(r.performance_rate)}%</td><td><div class="action-mini"><button class="btn btn-light btn-sm" onclick="editRecord(${i})"><i class="bi bi-pencil"></i></button><button class="btn btn-outline-danger btn-sm" onclick="deleteRecord(${i})"><i class="bi bi-trash"></i></button></div></td></tr>`).join('');
}

function getFormRecord(){
  const id = document.getElementById('recordId').value;
  return {
    id: id || undefined,
    school_year: document.getElementById('schoolYear').value.trim(),
    total_enrollment: num(document.getElementById('totalEnrollment').value),
    kinder:num(document.getElementById('kinder').value), grade1:num(document.getElementById('grade1').value), grade2:num(document.getElementById('grade2').value), grade3:num(document.getElementById('grade3').value),
    grade4:num(document.getElementById('grade4').value), grade5:num(document.getElementById('grade5').value), grade6:num(document.getElementById('grade6').value), sped:num(document.getElementById('sped').value),
    teachers:num(document.getElementById('teachers').value), classrooms:num(document.getElementById('classrooms').value), dropouts:num(document.getElementById('dropouts').value), repeaters:num(document.getElementById('repeaters').value),
    attendance_rate:num(document.getElementById('attendanceRate').value), performance_rate:num(document.getElementById('performanceRate').value), notes:document.getElementById('notes').value.trim()
  };
}
function fillForm(r){
  document.getElementById('recordId').value = r.id || '';
  document.getElementById('schoolYear').value = r.school_year || '';
  document.getElementById('totalEnrollment').value = r.total_enrollment || 0;
  ['kinder','grade1','grade2','grade3','grade4','grade5','grade6','sped','teachers','classrooms','dropouts','repeaters'].forEach(id=>document.getElementById(id).value = r[id] || 0);
  document.getElementById('attendanceRate').value = r.attendance_rate ?? 100;
  document.getElementById('performanceRate').value = r.performance_rate ?? 85;
  document.getElementById('notes').value = r.notes || '';
  document.getElementById('dataFormTitle').textContent = r.id ? 'Edit School Year Data' : 'Add New School Year Data';
}
function clearForm(){document.getElementById('schoolYearForm')?.reset(); document.getElementById('recordId').value=''; document.getElementById('dataFormTitle').textContent='Add New School Year Data';}
window.editRecord = function(index){ if(!isAdmin && db) return; fillForm(records[index]); document.getElementById('adminPanel').scrollIntoView({behavior:'smooth'}); }
window.deleteRecord = async function(index){
  if(!isAdmin && db){showMessage('Only admins can delete data.', 'danger'); return;}
  const r = records[index];
  if(!confirm(`Delete ${r.school_year} data?`)) return;
  if(db && r.id){
    const {error}=await db.from('school_year_data').delete().eq('id', r.id);
    if(error){showMessage(error.message, 'danger'); return;}
    await loadRecords();
  }else{
    records.splice(index,1); saveLocalRecords(); renderAll();
  }
  showMessage('Record deleted successfully.');
}

function bindEvents(){
  document.getElementById('schoolYearForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    if(!isAdmin && db){showMessage('Only authorized admins can save data.', 'danger'); return;}
    const record = getFormRecord();
    if(!record.school_year){showMessage('School year is required.', 'danger'); return;}
    if(db){
      const payload = {...record};
      let response;
      if(payload.id){
        response = await db.from('school_year_data').update(payload).eq('id', payload.id);
      }else{
        // Save new data, or automatically update the same school year if it already exists.
        // This prevents the duplicate school_year error during admin use.
        response = await db.from('school_year_data').upsert(payload, {onConflict:'school_year'});
      }
      if(response.error){
        const friendly = response.error.message.includes('schema cache')
          ? 'Database table is not ready yet. Run setup_database.sql in Supabase, then refresh after 10-30 seconds.'
          : response.error.message;
        showMessage(friendly, 'danger');
        return;
      }
      clearForm(); await loadRecords();
    }else{
      const index = records.findIndex(r=>r.school_year === record.school_year);
      if(index>=0) records[index] = {...records[index], ...record}; else records.push({...record, id: crypto.randomUUID()});
      records.sort((a,b)=>a.school_year.localeCompare(b.school_year));
      saveLocalRecords(); clearForm(); renderAll();
    }
    showMessage('School year data saved. Dashboard analytics updated automatically.');
  });
  document.getElementById('resetFormBtn')?.addEventListener('click', clearForm);
  document.getElementById('loginForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    if(!db){showMessage('Supabase is not configured yet. Edit config.js first.', 'warning', 'loginMessage'); return;}
    const email=document.getElementById('adminEmail').value;
    const password=document.getElementById('adminPassword').value;
    const {error}=await db.auth.signInWithPassword({email,password});
    if(error){showMessage(error.message, 'danger', 'loginMessage'); return;}
    await refreshAuthState();
    if(isAdmin){authModal?.hide(); showMessage('Admin login successful.');}
    else showMessage('Login successful, but this account is not listed in admins table.', 'warning', 'loginMessage');
  });
  document.getElementById('adminLogoutBtn')?.addEventListener('click', async()=>{if(db) await db.auth.signOut(); isAdmin=false; updateAdminUi(); setStatus('Database connected • Supabase persistent storage','Public viewer mode • read-only');});
  document.getElementById('yearFilter')?.addEventListener('change',()=>{
    const val=document.getElementById('yearFilter').value;
    const r = val==='all'?latest():records.find(x=>x.school_year===val) || latest();
    document.getElementById('heroEnrollment').textContent=fmt(r.total_enrollment);
    document.getElementById('kpiEnrollment').textContent=fmt(r.total_enrollment);
    document.getElementById('sideFilterText').textContent=val==='all'?'All Years':val;
  });
  document.querySelectorAll('.filter-group').forEach(group=>{
    group.addEventListener('click',e=>{
      const btn = e.target.closest('.filter-btn'); if(!btn) return;
      group.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      const board = group.dataset.filterGroup;
      document.querySelectorAll(`.${board}-actions .action-card`).forEach(card=>{
        const cats = card.dataset.category || '';
        card.style.display = filter==='all' || cats.includes(filter) ? '' : 'none';
      });
    });
  });
  const menuBtn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  if(menuBtn && sidebar){menuBtn.addEventListener('click',()=>sidebar.classList.toggle('open'));}
}

function revealInit(){
  document.querySelectorAll('.panel,.kpi-card,.action-card,.toolbar-card,.section-title,.hero-card,.system-strip').forEach(el=>el.classList.add('reveal'));
  const observer = new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('show');observer.unobserve(entry.target);}})},{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
}

document.addEventListener('DOMContentLoaded',()=>{
  authModal = document.getElementById('authModal') ? new bootstrap.Modal(document.getElementById('authModal')) : null;
  bindEvents();
  loadRecords();
});
