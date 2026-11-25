const app = document.querySelector('#app');
const toast = document.querySelector('#notice');
const labels={reading:'阅读理解',math:'数学读题',attention:'注意力',logic:'逻辑推理',calm:'自我调节'};
const colors={attention:'mint',reading:'lavender',math:'peach',logic:'blue',calm:'sand'};
const glyph={attention:'◎',reading:'≡',math:'∑',logic:'◇',calm:'≈'};
const observationLabels={improved:'有改善',same:'差不多',harder:'更困难',unseen:'未观察'};
const stageLabels={train:'练习',check:'独立复测',baseline:'起点任务'};
let bootstrap, detail, selected, section='today', month, report, calendar, session, drafts=[];
let epoch=0, timer, toastTimer, startTime=0, busy=false, resetActivity, hinted=false, cut=false;
let panel='', authMode='', invalid=null, awaitingInput=false, calmRemaining=120;
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const nonce=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
const formData=form=>Object.fromEntries(new FormData(form));
const dateText=date=>date?date.slice(5).replace('-',' 月 ')+' 日':'';
const selectedAttr=(value,expected)=>String(value)===String(expected)?' selected':'';
const saveButton=label=>'<button class="primary" type="submit">'+label+'</button>';
const moduleFor=id=>bootstrap.modules[id];
const nextDate=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const dateFormatter=new Intl.DateTimeFormat('zh-CN',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'});
const isParent=()=>bootstrap?.role==='parent';
function notice(text){
  toast.textContent=text;
  toast.hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{ toast.hidden=true; },5000);
}
async function api(path,body){
  const response=await fetch('/api'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok) throw Error(result.error||'请求失败，请稍后重试。');
  return result;
}
const childPath=(suffix='')=>'/child/'+selected+suffix;
function logo(){
  return '<span class="brand-icon"><i></i><i></i><i></i><i></i></span><span class="wordmark">CogGrow<small>认知成长</small></span>';
}
function icon(id) {
  const focus=moduleFor(id).focus;
  return '<span class="module-mark '+colors[focus]+'" aria-hidden="true">'+glyph[focus]+'</span>';
}
function button(action,title,extra='',cls='secondary'){
  return '<button type="button" class="'+cls+'" data-action="'+action+'" '+extra+'>'+title+'</button>';
}
function inputsProfile(p={}){
  const opts=['一年级','二年级','三年级','四年级','五年级','六年级','初一','初二','初三','高一','高二','高三'];
  return '<label>昵称<input name="name" required maxlength="24" value="'+esc(p.name)+'" placeholder="例如 小岚"></label>'+
    '<div class="field-row"><label>生日<input type="date" name="birth" required max="'+bootstrap.today+'" value="'+esc(p.birth)+'"></label>'+
    '<label>当前年级<select name="grade">'+opts.map((opt,i)=>'<option value="'+(i+1)+'"'+selectedAttr(i+1,p.grade??4)+'>'+opt+'</option>').join('')+'</select></label></div>'+
    '<label>练习主题<select name="theme"><option value="general">日常探索</option><option value="rail"'+selectedAttr('rail',p.theme)+'>铁路与列车</option></select></label>'+
    '<label>已学数学范围<select name="scope"><option value="comparison">加减比较</option><option value="multi-step"'+selectedAttr('multi-step',p.scope)+'>已学多步加减关系</option></select></label>';
}
function heroArt(){
  return '<div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="art-tile tile-one">◎</div><div class="art-tile tile-two">◇</div><div class="art-tile tile-three">≡</div><i class="art-dot dot-one"></i><i class="art-dot dot-two"></i><i class="art-dot dot-three"></i></div>';
}
function authScreen(){
  const setup=bootstrap.setup;
  const child=authMode==='child'&&!setup;
  app.innerHTML='<div class="sign-in"><section class="auth-story"><div class="brand">'+logo()+'</div>'+
    '<div class="story-title"><h1>今天，<br>想明白一点。</h1><p>注意力、阅读理解和数学读题，每天一点。</p></div>'+heroArt()+
    '<p class="story-foot">适合 8～12 岁儿童的家庭练习</p></section>'+
    '<section class="auth-side"><div class="auth-card"><span class="badge mint">'+(setup?'首次设置':child?'儿童入口':'家长入口')+'</span>'+
    '<h2>'+(setup?'创建家长账号':child?'开始我的练习':'登录家长账号')+'</h2><form id="auth" data-kind="'+(setup?'setup':child?'child-login':'login')+'">'+
    (child?'<label>识别码<input name="code" required autocomplete="username" spellcheck="false"></label><label>儿童口令<input name="pin" required type="password" inputmode="numeric" autocomplete="current-password"></label>':
    '<label>家长账号<input name="username" required maxlength="32" autocomplete="username" placeholder="输入账号"></label>'+
    '<label>密码<input name="password" required type="password" '+(setup?'minlength="10"':'')+' autocomplete="'+(setup?'new-password':'current-password')+'" placeholder="'+(setup?'至少 10 位':'输入密码')+'"></label>'+
    (setup?'<label>部署口令<input name="setupCode" type="password" placeholder="本机首次启动可留空"></label>':''))+
    saveButton(setup?'创建账号':child?'进入训练':'登录')+'</form>'+
    (setup?'':button('auth-mode',child?'切换到家长登录':'切换到儿童登录','','plain'))+
    '</div></section></div>';
}
const nav = [
 ['today','⌂','今日训练'],['modules','◈','训练馆'],['calendar','▦','训练日历'],['report','◒','成长记录'],['settings','⚙','家长设置']
];
function shell(content){
  const profile=detail?.profile;
  const switcher=isParent()&&bootstrap.profiles.length?'<label class="profile-select"><span class="avatar">'+esc(profile?.name?.[0]||'家')+'</span><select aria-label="切换儿童" id="child-select">'+bootstrap.profiles.map(p=>'<option value="'+p.id+'"'+selectedAttr(p.id,selected)+'>'+esc(p.name)+'</option>').join('')+'</select></label>':'';
  return '<div class="layout"><aside class="sidebar"><button class="brand brand-btn" data-nav="today">'+logo()+'</button><nav aria-label="主导航">'+
    nav.filter(item=>isParent()||item[0]!=='settings').map(([id,symbol,title])=>'<button data-nav="'+id+'" class="'+(section===id?'current':'')+'"'+(section===id?' aria-current="page"':'')+'><span aria-hidden="true">'+symbol+'</span>'+title+'</button>').join('')+
    '</nav><div class="sidebar-bottom"><span class="status-dot"></span>家庭训练空间</div></aside>'+
    '<div class="workspace"><header class="topbar"><div><strong>'+nav.find(item=>item[0]===section)?.[2]+'</strong></div><div class="account">'+switcher+
    '<span class="role">'+(isParent()?'家长':'儿童')+'</span>'+button('logout','退出','','plain')+'</div></header><main id="main">'+content+'</main></div></div>';
}
function emptyProfile(){
  return '<section class="card narrow"><h1>添加儿童档案</h1><p>按孩子的年级、兴趣和实际表现安排训练。</p><form id="profile">'+inputsProfile()+saveButton('创建档案')+'</form></section>';
}
function taskRow(task,i){
  const m=moduleFor(task.id);
  const status=task.session?.status;
  const done=status&&status!=='active';
  const title=done?(status==='complete'?'已完成':'已结束'):status==='active'?'继续':'开始';
  return '<li class="task-row">'+icon(task.id)+'<div class="task-text"><strong>'+m.name+'</strong><span>'+m.desc+'</span></div><span class="task-time">'+task.minutes+' 分钟</span>'+
    (done?'<span class="done">'+title+'</span>':button('start',title,'data-id="'+task.id+'" data-scheduled="true"','task-button'))+'</li>';
}
function todayScreen(){
  const {today,profile,config,checkDue,active}=detail;
  const count=today.tasks.filter(t=>t.session?.status==='complete').length;
  const handled=today.tasks.filter(t=>t.session?.status&&t.session.status!=='active').length;
  const total=today.tasks.length;
  const next=today.rest?today.tasks.find(t=>t.session?.status==='active'):today.tasks.find(t=>!t.session||t.session.status==='active');
  const minutes=today.tasks.reduce((sum,t)=>sum+t.minutes,0);
  const headline=today.rest?'今天休息一下':handled===total?'今天的练习结束了':'你好，'+esc(profile.name)+'！';
  const date=dateFormatter.format(new Date(today.date+'T00:00:00Z'));
  return '<section class="hero">'+heroArt()+'<div class="hero-copy"><div class="hero-date">'+date+'<span></span>'+(today.cycle<0?'等待周期开启':'本轮第 '+(today.cycle+1)+' 天')+'</div>'+
    '<h1>'+headline+'</h1><p>'+(today.rest?'可以活动一下，也可以回顾之前练习。':handled===total?'做得好，给自己一点休息时间。':'今天 '+total+' 项练习，预计 '+minutes+' 分钟。')+'</p>'+
    (next?button('start',next.session?'继续今日训练 <b>→</b>':'开始今日训练 <b>→</b>','data-id="'+next.id+'" data-scheduled="true"','hero-button'):
      button('open-calendar','查看训练日历 <b>→</b>','','hero-button'))+'</div></section>'+
    '<div class="dashboard"><section class="card tasks"><div class="card-head"><div><h2>今日安排</h2><p>'+(today.rest?'休息日':count+' / '+total+' 项完成')+'</p></div>'+
    '<div class="progress-ring" style="--fill:'+(total?count/total*100:0)+'%"><span>'+count+'/'+total+'</span></div></div>'+
    (total?'<ul>'+today.tasks.map(taskRow).join('')+'</ul>':'<div class="empty">今天没有必做任务。</div>')+
    (active.some(s=>s.date!==today.date||!s.scheduled)?'<div class="carry"><strong>可继续的练习</strong>'+active.filter(s=>s.date!==today.date||!s.scheduled).map(s=>button('resume',moduleFor(s.module).name,'data-id="'+s.id+'"','plain')).join('')+'</div>':'')+
    '</section><div class="side-stack"><section class="card focus-card"><div class="eyebrow">本阶段重点</div><h2>'+labels[config.focus]+'</h2><p>'+focusCopy(config.focus)+'</p>'+
    '<div class="cycle-summary"><span><strong>'+(config.cycle.split('1').length-1)+'</strong>练习日</span><span><strong>'+(config.cycle.split('0').length-1)+'</strong>休息日</span></div>'+
    (isParent()?button('open-settings','调整计划 →','','plain'):'')+'</section>'+
    '<section class="card check-card"><h3>独立检查</h3><p>'+(checkDue<=bootstrap.today?'可以安排一次起点任务或复测。':dateText(checkDue)+'可安排下一次复测。')+'</p>'+
    button('open-modules','查看训练项目 →','','plain')+'</section></div></div>';
}
function focusCopy(focus){
  return {reading:'找出原文线索，再用自己的话说清楚。',math:'先圈出条件和问题，再想怎么列式。',attention:'练习持续关注目标，根据规则做出反应。',logic:'先试着说明规律，再制定解题步骤。'}[focus];
}
function modulesScreen(){
  return '<div class="section-head"><h1>训练馆</h1><p>选择一种练习。完成后，系统会记录这一组的实际表现。</p></div>'+
    Object.entries(labels).map(([group,title])=>'<section class="module-group"><h2>'+title+'</h2><div class="catalog">'+
    Object.values(bootstrap.modules).filter(m=>m.focus===group).map(m=>'<article class="card module-card"><header>'+icon(m.id)+'<span>'+m.minutes+' 分钟</span></header><h3>'+m.name+'</h3><p>'+m.desc+'</p>'+
    '<div class="module-actions">'+button('start','开始','data-id="'+m.id+'"','secondary')+
    (group!=='calm'&&isParent()?button('start','独立检查','data-id="'+m.id+'" data-mode="check"','plain'):'')+'</div></article>').join('')+'</div></section>').join('');
}
function calendarScreen(){
  const lead=calendar.length?(new Date(calendar[0].date+'T00:00:00Z').getUTCDay()+6)%7:0;
  return '<div class="section-head"><h1>训练日历</h1><p>按 '+detail.config.cycle.length+' 天循环安排练习和休息。</p></div><section class="card calendar-card">'+
    '<div class="calendar-head">'+button('month-prev','‹','aria-label="上个月"')+'<h2>'+month.slice(0,4)+' 年 '+Number(month.slice(5))+' 月</h2>'+button('month-next','›','aria-label="下个月"')+'</div>'+
    '<div class="calendar-grid">'+['一','二','三','四','五','六','日'].map(day=>'<span class="calendar-week">周'+day+'</span>').join('')+
    '<div class="calendar-pad"></div>'.repeat(lead)+calendar.map(day=>'<button class="calendar-day '+(day.date===bootstrap.today?'is-today':'')+'" data-action="date" data-date="'+day.date+'"><strong>'+
      Number(day.date.slice(-2))+'</strong><small class="'+(day.rest?'off':'on')+'">'+(day.rest?'休息':day.tasks.filter(t=>t.session?.status==='complete').length+'/'+day.tasks.length+' 完成')+'</small></button>').join('')+'</div>'+
    (panel.startsWith('date:')?calendarDetail(calendar.find(d=>d.date===panel.slice(5))):'')+'</section>';
}
function calendarDetail(day){
  if(!day)return '';
  return '<div class="calendar-detail"><h3>'+dateText(day.date)+(day.rest?' · 休息':' · 练习')+'</h3><p>'+
    (day.tasks.length?day.tasks.map(t=>moduleFor(t.id).name+' '+t.minutes+' 分钟').join(' · '):'当天无必做任务。')+'</p>'+
    (isParent()&&day.date>=bootstrap.today?button('rest',day.override?'取消临时休息':'设为临时休息','data-date="'+day.date+'" data-value="'+(!day.override)+'"'):'')+'</div>';
}
function reportScreen(){
  if(!isParent()){
    return '<div class="section-head"><h1>我的成长</h1><p>完成一组练习后，系统会参考你的表现调整任务。</p></div><section class="card"><h2>我的练习级别</h2>'+
      (Object.entries(detail.states).map(([id,s])=>'<p>'+moduleFor(id).name+' · 第 '+s.level+' 级'+(s.support?' · 有提示':'')+'</p>').join('')||'<p>多完成几组练习后，这里会显示调整。</p>')+'</section>'+
      '<section class="card"><h2>最近完成</h2>'+((detail.recent||[]).map(s=>'<p>'+moduleFor(s.module).name+' · '+dateText(s.date)+' · '+s.independent+'/'+s.n+' 次独立完成</p>').join('')||'<p>完成一组后，这里会显示进度。</p>')+'</section>';
  }
  const trains=report.sessions.filter(s=>s.mode==='train'&&moduleFor(s.module).focus!=='calm');
  const checks=report.sessions.filter(s=>s.mode!=='train');
  const sessions=(items)=>items.length?'<div class="record-list">'+items.map(s=>'<details><summary><strong>'+moduleFor(s.module).name+'</strong><span>'+dateText(s.date)+' · '+s.independent+'/'+s.n+' 独立完成</span></summary><div>第 '+s.level+' 级 · '+(s.status==='complete'?'完成':'提前结束')+' · '+s.hints+' 次提示'+
    (s.medianMs?' · 正确反应中位数 '+s.medianMs+' 毫秒':'')+(s.errors.length?'<br>常见记录：'+esc([...new Set(s.errors)].join('、')):'')+'</div></details>').join('')+'</div>':'<p>目前没有记录。</p>';
  return '<div class="section-head"><h1>成长记录</h1><p>查看逐组表现、独立任务和作业观察。</p></div>'+
    '<div class="report-grid"><section class="card"><h2>训练表现</h2>'+sessions(trains)+'</section>'+
    '<section class="card"><h2>起点与独立复测</h2>'+sessions(checks)+button('open-modules','选择独立检查 →','','plain')+
    '<div class="module-actions">'+button('start','注意力起点','data-id="schulte" data-mode="baseline"')+button('start','数学读题起点','data-id="math" data-mode="baseline"')+'</div></section>'+
    '<section class="card"><h2>作业与生活观察</h2><form id="observation"><div class="field-row"><label>观察项目<select name="focus">'+Object.entries(labels).filter(([id])=>id!=='calm').map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select></label>'+
    '<label>结果<select name="value">'+Object.entries(observationLabels).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select></label></div>'+
    '<label>备注<input name="note" maxlength="500" placeholder="例如：4 道应用题中有 1 道漏读条件"></label>'+saveButton('保存观察')+'</form>'+
    (report.observations.length?'<ul class="observation-list">'+report.observations.map(o=>'<li><strong>'+esc(labels[o.focus])+'</strong> · '+observationLabels[o.value]+' <small>'+dateText(o.date)+'</small><p>'+esc(o.note)+'</p></li>').join('')+'</ul>':'')+'</section>'+
    '<section class="card"><h2>调整记录</h2>'+(report.events.map(e=>'<p><strong>'+moduleFor(e.module).name+'</strong> · '+esc(e.detail.reason)+'<br><small>有效组 '+e.detail.evidence.map(g=>g.independent+'/'+g.n).join('、')+'</small></p>').join('')||'<p>积累足够的同级训练后，调整依据会显示在这里。</p>')+
    '<details><summary>历次计划</summary>'+report.versions.map(v=>'<p>版本 '+v.version+' · '+dateText(v.effective)+' 生效<br><small>'+esc(v.reason)+'</small></p>').join('')+'</details>'+
    '<div class="module-actions"><a class="secondary" href="/api'+childPath('/export.json')+'">导出 JSON</a><a class="secondary" href="/api'+childPath('/export.csv')+'">导出 CSV</a></div></section></div>';
}
function settingsScreen(){
  const {profile,config}=detail;
  return '<div class="section-head"><h1>家长设置</h1><p>设置练习重点、每轮安排和儿童入口。</p></div><div class="report-grid">'+
    '<section class="card"><h2>训练计划</h2><form id="plan"><label>阶段重点<select name="focus">'+Object.entries(labels).filter(([id])=>id!=='calm').map(([id,label])=>'<option value="'+id+'"'+selectedAttr(id,config.focus)+'>'+label+'</option>').join('')+'</select></label>'+
    '<div class="field-row"><label>每天上限（分钟）<input type="number" min="3" max="25" required name="minutes" value="'+config.minutes+'"></label>'+
    '<label>周期起始日<input type="date" required name="anchor" value="'+config.anchor+'"></label></div>'+
    '<label>长期目标<input name="longGoal" maxlength="150" value="'+esc(config.longGoal)+'" placeholder="例如 能独立读懂多条件应用题"></label>'+
    '<label>每轮安排<input name="cycle" id="cycle" value="'+config.cycle+'" maxlength="31" pattern="[01]{1,31}" required inputmode="numeric"><small>1 是练习，0 是休息。点击下方日期可切换。</small></label>'+
    '<div id="cycle-chips" class="cycle-chips">'+cycleChips(config.cycle)+'</div><label class="check-label"><input type="checkbox" name="paused"'+(config.paused?' checked':'')+'>暂停后续训练</label>'+
    saveButton('保存计划')+'</form><p class="subtle">阶段开始于 '+dateText(config.stageStart||config.anchor)+'，每四周可安排一次复测。</p></section>'+
    '<section class="card"><h2>成长档案</h2><p>'+Math.floor(profile.ageMonths/12)+' 岁 '+profile.ageMonths%12+' 个月 · 年级由家长确认</p><form id="profile">'+inputsProfile(profile)+
    saveButton('更新档案')+'</form>'+button('new-profile','添加另一位儿童','','plain')+'</section>'+
    '<section class="card"><h2>儿童口令</h2><p>设置口令后，孩子可用识别码和口令登录。</p><form id="access"><label>设置 6～10 位数字<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6,10}" required autocomplete="new-password"></label>'+saveButton('生成儿童入口')+'</form>'+
    (panel.startsWith('code:')?'<div class="code">儿童识别码 <strong>'+esc(panel.slice(5))+'</strong></div>':'')+'</section>'+
    aiScreen()+'<section class="card"><h2>档案管理</h2><p>删除档案会同时删除这个孩子的训练、计划和观察记录。</p><details><summary>删除档案</summary><form id="delete"><label>输入家长密码确认<input type="password" name="password" required autocomplete="current-password"></label>'+
    '<button class="danger" type="submit">永久删除该档案</button></form></details></section></div>';
}
function aiScreen(){
  const pending=drafts.filter(d=>d.status==='pending');
  return '<section class="card"><h2>阅读材料</h2><p>'+(bootstrap.ai?'生成后先核对答案和原文依据，通过后可加入练习。':'内置材料可直接使用。接入模型后可以生成新素材。')+'</p>'+
    (bootstrap.ai?'<form id="draft"><label>训练类型<select name="module"><option value="reading">段落理解</option><option value="sentence">句子理解</option><option value="cause">因果推理</option></select></label>'+saveButton('生成待审材料')+'</form>':'')+
    pending.map(d=>'<details><summary>'+moduleFor(d.module).name+' · 待审核</summary><p>'+esc(d.body.passage)+'</p><p><strong>'+esc(d.body.prompt)+'</strong></p>'+
      '<p>选项：'+esc(d.body.options.join(' / '))+'</p><p>答案：'+esc(d.body.correct)+'</p><p>'+esc(d.body.evidence)+'</p><p>提示：'+esc(d.body.hint)+'</p>'+
      '<div class="module-actions">'+button('review','审核通过','data-id="'+d.id+'" data-approve="true"','primary')+
      button('review','弃用','data-id="'+d.id+'" data-approve="false"')+'</div></details>').join('')+'</section>';
}
function cycleChips(cycle){
  return [...cycle].map((day,i)=>button('cycle',i+1+' '+(day==='1'?'练':'休'),'data-index="'+i+'"','chip '+(day==='1'?'mint':'sand'))).join('');
}
function paint(){
  if(!bootstrap.role){authScreen();return;}
  if(session){app.innerHTML=shell(trainingScreen());wireTraining();return;}
  if(!detail||panel==='new') {app.innerHTML=shell(emptyProfile());return;}
  const page=section==='today'?todayScreen():section==='modules'?modulesScreen():section==='calendar'?calendarScreen():
    section==='report'?reportScreen():settingsScreen();
  app.innerHTML=shell(page);
}
async function load(target=section){
  bootstrap=await api('/bootstrap');
  selected=bootstrap.profiles.some(p=>p.id===selected)?selected:(bootstrap.profiles.find(p=>p.id===sessionStorage.getItem('cg.selected'))?.id||bootstrap.profiles[0]?.id);
  if(!selected){detail=null;section='today';paint();return;}
  sessionStorage.setItem('cg.selected',selected);
  section=target==='settings'&&!isParent()?'today':target;
  detail=await api(childPath());
  if(section==='calendar'){
    month=month||bootstrap.today.slice(0,7);
    calendar=(await api(childPath('/calendar?month='+month))).days;
  }
  if(section==='report'&&isParent()) report=await api(childPath('/report'));
  if(section==='settings'&&isParent()) drafts=(await api(childPath('/drafts'))).drafts;
  paint();
}

function trainingScreen(){
  const m=moduleFor(session.module);
  const title='<div class="section-head training-title"><div>'+icon(m.id)+'<span>'+stageLabels[session.mode]+'</span></div><h1>'+m.name+'</h1><p>'+m.desc+'</p></div>';
  if(session.status!=='active'){
    const {summary,status}=session;
    const follow=detail.today.tasks.find(t=>t.session?.id!==session.id&&(!t.session||t.session.status==='active'));
    return title+'<section class="card exercise result"><span class="result-icon">'+(status==='complete'?'✓':'≈')+'</span><h2>'+
      (status==='complete'?'这一组完成了':status==='fatigue'?'好好休息一下':'已结束这组练习')+'</h2>'+
      (m.focus==='calm'?'':summary.valid?'<p>'+summary.independent+' / '+summary.valid+' 次独立完成 · '+summary.correct+' 次答对</p>':'<p>本组还没有有效作答。</p>')+
      (session.mode==='train'&&session.last?.evidence?'<p>'+esc(session.last.evidence)+'</p>':'')+
      '<div class="module-actions">'+(follow&&status!=='fatigue'&&!detail.today.rest?button('start','开始下一项 →','data-id="'+follow.id+'" data-scheduled="true"','primary'):'')+
      button('back-home','回到今日训练')+'</div></section>';
  }
  const q=session.question;
  const bar='<div class="exercise-progress"><span>第 '+(session.index+1)+' / '+session.total+' 项</span><progress max="'+session.total+'" value="'+session.index+'"></progress></div>';
  const passage=q.passage?'<div class="passage">'+esc(q.passage)+'</div>':'';
  let controls='';
  if(awaitingInput){
    const hint=m.kind==='signal'?'图形出现后按规则行动。要等待时，什么也不用点。':m.kind==='memory'?'观察亮起的方格。全部亮完后，再按原来的顺序点。':m.desc+'。';
    controls='<div class="task-entry"><h2>先看规则</h2><p>'+hint+'</p>'+button('begin','我准备好了','','primary')+'</div>';
  }else{
    const last=session.last;
    let play='';
    if(m.kind==='grid'){
      play='<div class="play-grid" style="--cols:'+q.size+'">'+q.grid.map(value=>button('answer',value,'data-number="'+value+'"','cell')).join('')+'</div>';
    }else if(m.kind==='signal'){
      play='<button class="signal-button" id="signal" data-action="hit" aria-label="看到目标，立即点击">'+esc(q.symbol)+'</button>';
    }else if(m.kind==='memory'){
      play='<div class="play-grid memory-grid" style="--cols:3">'+Array.from({length:9},(_,i)=>button('memory-cell','<span class="sr-only">方格 '+(i+1)+'</span>','data-index="'+i+'" disabled','cell')).join('')+
      '</div><div class="exercise-foot"><span id="activity-label" role="status">先看高亮的位置</span>'+button('memory-reset','重选','','plain')+'</div>';
    }else if(m.kind==='path'){
      play='<div class="play-grid track-grid" style="--cols:'+q.size+'">'+Array.from({length:q.size**2},(_,i)=>button('track-cell',q.walls.includes(i)?'×':i===0?'起':i===q.end?'到':'·',
        'data-index="'+i+'" aria-label="'+(q.walls.includes(i)?'障碍':i===0?'起点':i===q.end?'终点':'格 '+(i+1))+'"'+(q.walls.includes(i)?' disabled':''),'cell'+(q.walls.includes(i)?' wall':i===0?' travelled':''))).join('')+
        '</div><div class="exercise-foot"><span id="activity-label">剩余 '+q.limit+' 步</span>'+button('track-reset','重来','','plain')+'</div>';
    }else if(m.kind==='tower'){
      play='<div class="tower-board">'+[0,1,2].map(i=>button('peg','<span class="sr-only">柱子 '+(i+1)+'</span>','data-index="'+i+'"','peg')).join('')+
        '</div><div class="exercise-foot"><span id="activity-label">先选有圆盘的柱子</span>'+button('tower-reset','重来','','plain')+'</div>';
    }else if(m.kind==='calm'){
      play=(session.module==='calm'?'<div class="breathing"><div></div></div><p class="center">慢慢呼吸，留意脚踩在地上的感觉。</p>':
        '<div class="breathing standing"><div>↑</div></div><p class="center">站起来伸伸手，放松肩膀，看看远处。</p>')+
        '<div class="exercise-foot"><span id="activity-label" role="timer"></span>'+button('calm-toggle','暂停')+button('calm-done','我完成了','','primary')+'</div>';
    }else{
      const stimulus=q.stimulus?'<div class="stimulus" style="color:'+esc(q.ink||'')+'">'+esc(q.stimulus)+'</div>':'';
      const hint=q.hint&&session.mode==='train'?'<div id="question-hint" hidden class="hint">'+esc(q.hint)+'</div>':'';
      play=passage+stimulus+'<div class="answer-list">'+q.options.map((value,i)=>button('answer',esc(value),'data-option="'+i+'"','answer')).join('')+'</div>'+
        (hint?button('hint',session.support?'先看看解题提示':'看提示','',session.support?'secondary':'plain')+hint:'');
    }
    controls=bar+'<h2 class="question">'+esc(q.prompt)+'</h2>'+play+
      (last&&m.kind!=='signal'&&m.kind!=='calm'?'<p class="feedback '+(last.valid&&last.correct?'positive':'')+'">'+
        (last.valid?(last.correct?'上一步答对了。':'上一步需要再看看。'):'上一项因中断未计入。')+(last.evidence?' '+esc(last.evidence):'')+'</p>':'');
  }
  return title+'<section class="card exercise">'+controls+
    '<div class="stop-row">'+button('back-home','稍后继续','','plain')+button('session-stop','跳过这组','data-fatigue="false"','plain')+
    button('session-stop','我累了，今天先到这','data-fatigue="true"','plain')+'</div><div id="retry"></div></section>';
}
function trainingPendingKey(){
  return 'cg.pending.'+selected+'.'+session.id;
}
function cycleTimer(fn,ms){
  clearTimeout(timer);
  const tag=epoch;
  timer=setTimeout(()=>{if(tag===epoch&&!busy) fn();},ms);
}
function writePending(data){
  try{sessionStorage.setItem(trainingPendingKey(),JSON.stringify(data));}catch{}
}
function readPending(){
  try{return JSON.parse(sessionStorage.getItem(trainingPendingKey())||'null');}catch{return null;}
}
async function submitAnswer(answer,reason=invalid){
  if(busy||!session||session.status!=='active') return;
  const isRetry=answer===undefined;
  const data=isRetry?readPending():{answer,index:session.index,nonce:nonce(),hint:hinted,rt:performance.now()-startTime,invalid:reason};
  if(!data)return;
  if(!isRetry)writePending(data);
  busy=true;
  clearTimeout(timer);
  const controls=Array.from(app.querySelectorAll('.exercise button')).filter(b=>!b.disabled);
  controls.forEach(b=>b.disabled=true);
  try{
    const updated=await api(childPath('/sessions/'+session.id+'/answer'),data);
    sessionStorage.removeItem(trainingPendingKey());
    session=updated;
    hinted=false;
    invalid=null;
    busy=false;
    if(session.status!=='active') detail=await api(childPath()).catch(()=>detail);
    paint();
  }catch(error){
    busy=false;
    const retry=$('#retry');
    if(retry)retry.innerHTML='<p>这次作答已暂存，恢复连接后可以继续。</p>'+button('retry','重试提交','','primary')+button('back-home','返回首页');
    notice(error.message==='Failed to fetch'?'连接已中断，作答已暂存。':error.message);
  }
}
function wireTraining(){
  clearTimeout(timer);
  epoch++;
  resetActivity=null;
  startTime=performance.now();
  const s=session;
  if(s.status!=='active'||awaitingInput)return;
  const pending=readPending();
  if(pending){
    submitAnswer(undefined);
    return;
  }
  const q=s.question;
  switch(moduleFor(s.module).kind) {
    case 'signal':
      cycleTimer(()=>submitAnswer('wait'),q.deadline);
      $('#signal').focus({preventScroll:true});
      break;
    case 'memory': {
      const cells=[...app.querySelectorAll('[data-action="memory-cell"]')];
      let chosen=[], step=0;
      const label=$('#activity-label');
      const flash=()=>{
        cells.forEach(el=>el.classList.remove('lit'));
        if(step===q.sequence.length){
          cells.forEach(el=>el.disabled=false);
          label.textContent='现在，按原顺序点击 '+q.sequence.length+' 个位置';
          return;
        }
        const cell=cells[q.sequence[step++]];
        cell.classList.add('lit');
        cycleTimer(()=>{cell.classList.remove('lit');cycleTimer(flash,180);},500);
      };
      cycleTimer(flash,360);
      resetActivity=(value)=>{
        if(value===null){chosen=[];cells.forEach(el=>el.classList.remove('travelled'));return;}
        cells[value].classList.add('travelled');
        chosen.push(value);
        if(chosen.length===q.sequence.length)submitAnswer(chosen);
      };
      break;
    }
    case 'path': {
      const cells=[...app.querySelectorAll('[data-action="track-cell"]')];
      let route=[0];
      resetActivity=(value)=>{
        if(value===null)route=[0];
        else{
          const last=route.at(-1);
          const adjacent=Math.abs(Math.floor(last/q.size)-Math.floor(value/q.size))+Math.abs(last%q.size-value%q.size)===1;
          if(!adjacent||route.length>q.limit)return;
          route.push(value);
        }
        cells.forEach((cell,i)=>cell.classList.toggle('travelled',route.includes(i)));
        $('#activity-label').textContent='剩余 '+(q.limit-route.length+1)+' 步';
        if(value===q.end)submitAnswer(route);
        else if(route.length>q.limit)$('#activity-label').textContent='步数已用完，换一条路线试试。';
      };
      break;
    }
    case 'tower': {
      const pegs=[...app.querySelectorAll('[data-action="peg"]')];
      let stacks, moves, from;
      const reset=()=>{ stacks=[Array.from({length:q.disks},(_,i)=>q.disks-i),[],[]]; moves=[]; from=null; };
      const render=()=>pegs.forEach((peg,i)=>{
        peg.classList.toggle('picked',from===i);
        peg.innerHTML='<span class="sr-only">柱子 '+(i+1)+'，'+stacks[i].length+' 个圆盘</span>'+stacks[i].map(d=>'<span class="disk" style="--disk:'+(28+d*13)+'%"></span>').join('');
      });
      reset();
      render();
      resetActivity=value=>{
        if(value===null){reset();render();return;}
        if(from===null){if(stacks[value].length)from=value;}
        else{
          const moving=stacks[from].at(-1);
          if(value!==from&&(!stacks[value].length||stacks[value].at(-1)>moving)){
            stacks[value].push(stacks[from].pop());
            moves.push([from,value]);
          }
          from=null;
        }
        render();
        $('#activity-label').textContent='已移动 '+moves.length+' / '+q.limit+' 步';
        if(stacks[2].length===q.disks||moves.length===q.limit)submitAnswer(moves);
      };
      break;
    }
    case 'calm': {
      const draw=()=>{
        $('#activity-label').textContent=Math.floor(calmRemaining/60)+':'+String(calmRemaining%60).padStart(2,'0');
        if(!cut&&calmRemaining>0)cycleTimer(()=>{calmRemaining--;draw();},1000);
      };
      resetActivity=()=>{
        cut=!cut;
        clearTimeout(timer);
        $('.breathing').classList.toggle('still',cut);
        $('[data-action="calm-toggle"]').textContent=cut?'继续':'暂停';
        draw();
      };
      draw();
      break;
    }
  }
}
async function start(id,scheduled,mode){
  session=await api(childPath('/start'),{module:id,scheduled,mode,device:matchMedia('(pointer:coarse)').matches?'touch':'pointer'});
  awaitingInput=true;
  calmRemaining=120;
  cut=false;
  invalid=null;
  hinted=false;
  paint();
}
function leave(){
  clearTimeout(timer);
  epoch++;
  session=null;
  awaitingInput=false;
  invalid=null;
  hinted=false;
}
const actions={
  'auth-mode':()=>{ authMode=authMode==='child'?'':'child';paint(); },
  logout:async()=>{ await api('/logout',{}); leave(); panel=''; authMode=''; selected=null; detail=null; await load('today'); },
  'open-calendar':()=>load('calendar'),
  'open-settings':()=>load('settings'),
  'open-modules':()=>load('modules'),
  'month-prev':()=>{ month=nextDate(month+'-01',-1).slice(0,7);panel='';return load('calendar'); },
  'month-next':()=>{month=nextDate(month+'-01',32).slice(0,7);panel='';return load('calendar');},
  date:d=>{panel='date:'+d.date;paint();},
  rest:async d=>{await api(childPath('/rest'),{date:d.date,rest:d.value==='true'});await load('calendar');},
  review:async d=>{await api(childPath('/review'),{id:d.id,approve:d.approve==='true'});await load();notice(d.approve==='true'?'材料已加入练习。':'材料已弃用。');},
  'new-profile':()=>{panel='new';paint();},
  cycle:d=>{
    const inp=$('#cycle'),i=Number(d.index), chars=[...inp.value];
    chars[i]=chars[i]==='1'?'0':'1';
    inp.value=chars.join('');
    $('#cycle-chips').innerHTML=cycleChips(inp.value);
  },
  start:d=>start(d.id,d.scheduled==='true',d.mode),
  resume:async d=>{session=await api(childPath('/sessions/'+d.id));awaitingInput=true;calmRemaining=120;cut=false;paint();},
  begin:()=>{awaitingInput=false;paint();},
  answer:d=>submitAnswer(d.option===undefined?Number(d.number):session.question.options[Number(d.option)]),
  hit:()=>submitAnswer('hit'),
  'memory-cell':d=>resetActivity?.(Number(d.index)),
  'memory-reset':()=>resetActivity?.(null),
  'track-cell':d=>resetActivity?.(Number(d.index)),
  'track-reset':()=>resetActivity?.(null),
  peg:d=>resetActivity?.(Number(d.index)),
  'tower-reset':()=>resetActivity?.(null),
  'calm-toggle':()=>resetActivity?.(),
  'calm-done':()=>submitAnswer('done'),
  hint:()=>{hinted=true;$('#question-hint').hidden=false;},
  retry:()=>submitAnswer(undefined),
  'back-home':()=>{leave();return load('today');},
  'session-stop':async d=>{
    clearTimeout(timer);
    session=await api(childPath('/sessions/'+session.id+'/stop'),{fatigue:d.fatigue==='true'});
    detail=await api(childPath());
    paint();
  }
};
let navigationBusy=false;
app.addEventListener('click', async event=>{
  const nav=event.target.closest('[data-nav]');
  const action=event.target.closest('[data-action]');
  if((!nav&&!action)||navigationBusy||busy)return;
  const name=action?.dataset.action;
  const fast=['answer','hit','memory-cell','memory-reset','track-cell','track-reset','peg','tower-reset','calm-toggle','calm-done','hint','retry'].includes(name);
  navigationBusy=!fast;
  try{
    if(nav){panel='';leave();await load(nav.dataset.nav);}
    else await actions[name]?.(action.dataset);
  }catch(error){
    if(!session&&bootstrap?.role)paint();
    notice(error.message);
  }finally{navigationBusy=false;}
});
app.addEventListener('change',async event=>{
  if(event.target.id==='child-select'&&!busy&&!navigationBusy){
    navigationBusy=true;
    try{selected=event.target.value;leave();panel='';await load('today');}catch(error){notice(error.message);}
    finally{navigationBusy=false;}
  }
});
app.addEventListener('input',event=>{
  if(event.target.id==='cycle')$('#cycle-chips').innerHTML=cycleChips(event.target.value.replace(/[^01]/g,''));
});
app.addEventListener('submit',async event=>{
  event.preventDefault();
  if(navigationBusy||busy)return;
  navigationBusy=true;
  const form=event.target;
  const data=formData(form);
  const submit=form.querySelector('[type="submit"]');
  submit.disabled=true;
  try{
    if(form.id==='auth'){
      await api('/'+form.dataset.kind,data);await load('today');
    }else if(form.id==='profile'){
      data.grade=Number(data.grade);
      if(!detail||panel==='new'){
        selected=(await api('/children',data)).id;
        panel=''; await load('today');notice('儿童档案和首轮计划已创建。');
      }else{
        await api(childPath('/profile'),data);await load();notice('成长档案已更新。');
      }
    }else if(form.id==='plan'){
      data.minutes=Number(data.minutes);data.paused=data.paused==='on';
      await api(childPath('/plan'),data);await load();notice('后续训练计划已更新。');
    }else if(form.id==='access'){
      panel='code:'+(await api(childPath('/access'),data)).code;paint();
    }else if(form.id==='observation'){
      await api(childPath('/observation'),data);await load();notice('观察记录已保存。');
    }else if(form.id==='draft'){
      notice('正在生成待审材料。');await api(childPath('/drafts'),data);await load();notice('材料已生成，可以审核。');
    }else if(form.id==='delete'){
      await api(childPath('/delete'),data);selected=null;detail=null;await load('today');notice('档案已删除。');
    }
  }catch(error){notice(error.message);}
  finally{navigationBusy=false;submit.disabled=false;}
});
function interrupt(reason){
  if(!session||session.status!=='active'||awaitingInput||busy)return;
  const kind=moduleFor(session.module).kind;
  if(kind==='signal'){awaitingInput=true;submitAnswer('wait',reason);}
  if(kind==='grid')invalid=reason;
  if(kind==='memory'){awaitingInput=true;submitAnswer([],reason);}
  if(kind==='calm'&&!cut)resetActivity?.();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt('hidden');});
window.addEventListener('blur',()=>interrupt('blur'));
window.addEventListener('online',()=>{if(session?.status==='active'&&readPending())submitAnswer(undefined);});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
load().catch(error=>{
  app.innerHTML='<section class="card boot"><h1>暂时无法连接</h1><p>'+esc(error.message)+'</p><a class="primary" href="/">重新加载</a></section>';
});
