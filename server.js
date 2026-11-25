import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modules, makeQuestions, score } from './content.js';
import { aiConfigured, generateReading } from './ai.js';
import { adaptation, ageInMonths, cycleDay, cycleDefault, dayKey, dayOffset, daysBetween, focusLabels, ruleVersion, tasksFor, validDate } from './rules.js';

const root = dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.DATA_DIR || join(root,'data');
mkdirSync(dataPath,{recursive:true,mode:0o700});
const db = new DatabaseSync(join(dataPath,'coggrow.db'));
const now = () => Date.now();
const timezone = process.env.TZ || 'Asia/Shanghai';
dayKey(timezone);
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
BEGIN;
CREATE TABLE IF NOT EXISTS parents (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, secret TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS children (id TEXT PRIMARY KEY, parent TEXT NOT NULL REFERENCES parents(id), profile TEXT NOT NULL, code TEXT UNIQUE, secret TEXT);
CREATE TABLE IF NOT EXISTS auth (token TEXT PRIMARY KEY, parent TEXT REFERENCES parents(id), child TEXT REFERENCES children(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS plans (child TEXT REFERENCES children(id) ON DELETE CASCADE, version INTEGER, effective TEXT, created INTEGER, reason TEXT, config TEXT, PRIMARY KEY(child, version));
CREATE TABLE IF NOT EXISTS days (child TEXT REFERENCES children(id) ON DELETE CASCADE, date TEXT, version INTEGER, tasks TEXT, rest INTEGER DEFAULT 0, PRIMARY KEY(child,date));
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, child TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE, date TEXT, module TEXT, mode TEXT,
  level INTEGER, support INTEGER, device TEXT, questions TEXT, started INTEGER, finished INTEGER, status TEXT, scheduled INTEGER,
  UNIQUE(id,child));
CREATE INDEX IF NOT EXISTS session_child ON sessions(child,started);
CREATE UNIQUE INDEX IF NOT EXISTS one_scheduled ON sessions(child,date,module) WHERE scheduled=1;
CREATE TABLE IF NOT EXISTS trials (session TEXT REFERENCES sessions(id) ON DELETE CASCADE, idx INTEGER, nonce TEXT, info TEXT, PRIMARY KEY(session,idx), UNIQUE(session,nonce));
CREATE TABLE IF NOT EXISTS states (child TEXT REFERENCES children(id) ON DELETE CASCADE, module TEXT, level INTEGER, support INTEGER, changedAt INTEGER, PRIMARY KEY(child,module));
CREATE TABLE IF NOT EXISTS events (child TEXT REFERENCES children(id) ON DELETE CASCADE, time INTEGER, module TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, child TEXT REFERENCES children(id) ON DELETE CASCADE, date TEXT, focus TEXT, value TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, child TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE, module TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL);
PRAGMA user_version = 2;
COMMIT;`);
const q = sql => db.prepare(sql);
const all = (sql,...args) => q(sql).all(...args);
const get = (sql,...args) => q(sql).get(...args);
const run = (sql,...args) => q(sql).run(...args);
const json = JSON.stringify;
const parse = JSON.parse;
const hash = token => createHash('sha256').update(token).digest('hex');
const makeSecret = value => {
  const salt = randomBytes(16).toString('hex');
  return salt+':'+scryptSync(value,salt,32).toString('hex');
};
const matches = (value,secret) => {
  if(typeof value!=='string' || value.length>128 || !secret) return false;
  const [salt,digest] = secret.split(':');
  return timingSafeEqual(scryptSync(value,salt,32),Buffer.from(digest,'hex'));
};
function fail(status,message){throw Object.assign(Error(message),{status});}
function tx(work){
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch(error){db.exec('ROLLBACK');throw error;}
}
function respond(res,value,status=200){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(json(value));
}
function protect(request){
  const token = request.headers.cookie?.match(/(?:^|;\s*)cg=([a-f0-9]{64})(?:;|$)/)?.[1];
  return token && get('SELECT * FROM auth WHERE token=? AND expires>?',hash(token),now());
}
function newAuth(req,res,{parent=null,child=null}){
  const token = randomBytes(32).toString('hex');
  const ttl = parent?14*86400:30*86400;
  run('DELETE FROM auth WHERE expires<=?',now());
  const old = protect(req);
  if(old) run('DELETE FROM auth WHERE token=?',old.token);
  run('INSERT INTO auth VALUES(?,?,?,?)',hash(token),parent,child,now()+ttl*1000);
  const secure = process.env.SECURE_COOKIE==='1' ? '; Secure' : '';
  res.setHeader('Set-Cookie','cg='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+ttl+secure);
}
const attempts = new Map();
function loginLimit(req){
  const ip=req.socket.remoteAddress;
  const time=now();
  if(attempts.size>1000) for(const [key,row] of attempts) if(row.end<time) attempts.delete(key);
  const old=attempts.get(ip);
  const row=old?.end>time?old:{count:0,end:time+600000};
  if(row.count>=20) fail(429,'尝试次数过多，稍等几分钟再试。');
  row.count++;
  attempts.set(ip,row);
}
async function body(req){
  if(req.headers['content-type']?.split(';')[0]!=='application/json') fail(415,'需要 JSON 请求。');
  let data='';
  for await(const piece of req){
    data+=piece;
    if(data.length>65536) fail(413,'提交内容过长。');
  }
  let value;
  try { value=parse(data); } catch { fail(400,'请求内容格式有误。'); }
  if(!value||typeof value!=='object'||Array.isArray(value)) fail(400,'请求内容格式有误。');
  return value;
}
const today = () => dayKey(timezone);
const configOf = plan => parse(plan.config);
const formatProfile = row => {
  const profile=parse(row.profile);
  const ageMonths=ageInMonths(profile.birth,today());
  return {id:row.id,...profile,ageMonths,ageBand:ageMonths<96||ageMonths>=156?'试用年龄范围外':ageMonths<120?'8～9 岁':ageMonths<144?'10～11 岁':'12 岁'};
};
function validateProfile(data){
  const name=typeof data.name==='string'?data.name.trim():'';
  const birth=data.birth;
  if(!name||name.length>24||!validDate(birth)||birth>today()||ageInMonths(birth,today())>215) fail(400,'请填写昵称和有效生日。');
  if(!Number.isInteger(data.grade)||data.grade<1||data.grade>12) fail(400,'请选择当前年级。');
  return {name,birth,grade:data.grade,theme:data.theme==='rail'?'rail':'general',scope:typeof data.scope==='string'?data.scope.trim().slice(0,200):''};
}
function configInput(input,old){
  const fields={...old,...input};
  const {cycle,minutes,focus,anchor,paused}=fields;
  const longGoal=typeof fields.longGoal==='string'?fields.longGoal.trim().slice(0,150):'';
  const stageStart=validDate(old.stageStart)?old.stageStart:today();
  if(typeof cycle!=='string'||!(/^[01]{1,31}$/.test(cycle))||!cycle.includes('1')) fail(400,'一轮支持 1～31 天，至少安排一天训练。');
  if(!Number.isInteger(minutes)||minutes<3||minutes>25) fail(400,'时长须为 3～25 分钟。');
  if(!Object.hasOwn(focusLabels,focus)||!validDate(anchor)||typeof paused!=='boolean') fail(400,'请确认训练重点和起始日期。');
  return {cycle,minutes,focus,anchor,paused,longGoal,stageStart};
}
function currentPlan(child,date='9999-12-31'){
  return get('SELECT * FROM plans WHERE child=? AND effective<=? ORDER BY effective DESC,version DESC LIMIT 1',child,date);
}
function statesOf(child){
  return Object.fromEntries(all('SELECT module,level,support,changedAt FROM states WHERE child=?',child).map(state=>[state.module,state]));
}
function revise(child,config,reason,effective=today()){
  const version=get('SELECT coalesce(max(version),0)+1 n FROM plans WHERE child=?',child).n;
  run('INSERT INTO plans VALUES(?,?,?,?,?,?)',child,version,effective,now(),reason,json(config));
  run(`DELETE FROM days WHERE child=? AND date>=? AND rest=0 AND NOT EXISTS
    (SELECT 1 FROM sessions s WHERE s.child=days.child AND s.date=days.date AND s.scheduled=1)`,child,effective);
  return version;
}
function dayView(child,date,save=false,states=statesOf(child)){
  const plan=currentPlan(child,date);
  if(!plan) return {date,tasks:[],cycle:-1,rest:true};
  const config=configOf(plan);
  const row=get('SELECT * FROM days WHERE child=? AND date=?',child,date);
  const sessions=all('SELECT id,module,status FROM sessions WHERE child=? AND date=? AND scheduled=1',child,date);
  const persisted=row?parse(row.tasks):tasksFor(config,date,modules,states);
  const tasks=(row?.rest||config.paused)?persisted.filter(task=>sessions.some(s=>s.module===task.id)):persisted;
  if(save&&!row) run('INSERT INTO days VALUES(?,?,?,?,0)',child,date,plan.version,json(tasks));
  return {date,tasks:tasks.map(task=>({...task,session:sessions.find(s=>s.module===task.id)})),
    rest:!!row?.rest||config.paused||!tasks.length, override:row?.rest||0,cycle:cycleDay(config,date),version:row?.version||plan.version,reason:plan.reason};
}
function prepareCycle(child,date){
  const plan=currentPlan(child,date);
  if(!plan) return;
  const config=configOf(plan);
  const offset=daysBetween(config.anchor,date);
  if(offset<config.cycle.length) return;
  const start=dayOffset(date,-cycleDay(config,date));
  if(start<=plan.effective) return;
  const count=get('SELECT count(*) n FROM sessions WHERE child=? AND finished IS NOT NULL AND started<=? AND status=?',child,now(),'complete').n;
  revise(child,config,'进入新一轮，参考各模块最近练习与提示需求（累计完成 '+count+' 组）',start);
}
const getSession = (id,child) => get('SELECT * FROM sessions WHERE id=? AND child=?',id,child);
function viewSession(s,results){
  const mod=modules[s.module], questions=parse(s.questions);
  const rows=results||all('SELECT idx,info FROM trials WHERE session=? ORDER BY idx',s.id);
  const last=rows.at(-1);
  const question=questions[rows.length];
  let next;
  if(question && s.status==='active'){
    const {correct,evidence,error,comparison,target,...publicQuestion}=question;
    if(!publicQuestion.hint&&s.support&&mod.kind==='choice') publicQuestion.hint=mod.desc+'。';
    next={...publicQuestion};
  }
  const result=last?parse(last.info):null;
  const valid=rows.map(row=>parse(row.info)).filter(r=>r.valid);
  return {id:s.id,module:s.module,mode:s.mode,level:s.level,support:!!s.support,device:s.device,total:questions.length,
    index:rows.length,status:s.status,question:next,
    last:s.mode==='check'?null:result&&{correct:result.correct,valid:result.valid,evidence:result.evidence,error:result.error},
    summary:s.status==='active'?undefined:{valid:valid.length,correct:valid.filter(r=>r.correct).length,independent:valid.filter(r=>r.correct&&!r.hint).length},
    title:mod.name};
}
function metrics(row){
  const data=all('SELECT info FROM trials WHERE session=? ORDER BY idx',row.id).map(x=>parse(x.info)).filter(x=>x.valid);
  const rt=data.filter(x=>x.correct&&x.rt!==null&&x.answer!=='wait').map(x=>x.rt).sort((a,b)=>a-b);
  return {startedAt:row.started,n:data.length,independent:data.filter(x=>x.correct&&!x.hint).length,
    correct:data.filter(x=>x.correct).length,hints:data.filter(x=>x.hint).length,
    targets:data.filter(x=>x.target===true).length,distractors:data.filter(x=>x.target===false).length,
    misses:data.filter(x=>x.target===true&&!x.correct).length,falseAlarms:data.filter(x=>x.target===false&&!x.correct).length,
    comparison:data.filter(x=>x.error==='比较对象读反').length,
    errors:data.filter(x=>x.error).map(x=>x.error),medianMs:rt.length?rt[Math.floor(rt.length/2)]:null};
}
function finish(s){
  run("UPDATE sessions SET status='complete',finished=? WHERE id=?",now(),s.id);
  const mod=modules[s.module];
  if(s.mode==='check'){
    const effective=dayOffset(today(),1);
    const config=configOf(currentPlan(s.child,effective));
    if(daysBetween(config.stageStart||config.anchor,today())>=28){
      revise(s.child,{...config,stageStart:effective},mod.name+'已完成阶段复测，保留当前重点进入下一阶段',effective);
    }
    return;
  }
  if(s.mode!=='train'||mod.max===1) return;
  const state=statesOf(s.child)[s.module]||{level:1,support:0,changedAt:0};
  if(state.level!==s.level||!!state.support!==!!s.support) return;
  const groups=all(`SELECT * FROM sessions WHERE child=? AND module=? AND mode='train' AND status='complete'
    AND level=? AND support=? AND device=? ORDER BY started DESC LIMIT 3`,s.child,s.module,s.level,s.support,s.device).map(metrics);
  const change=adaptation(state,groups,mod);
  if(!change) return;
  run(`INSERT INTO states VALUES(?,?,?,?,?) ON CONFLICT(child,module) DO UPDATE SET
    level=excluded.level,support=excluded.support,changedAt=excluded.changedAt`,s.child,s.module,change.level,+change.support,now());
  run('INSERT INTO events VALUES(?,?,?,?)',s.child,now(),s.module,json({...change,from:state.level,ruleVersion,evidence:groups.map(({n,independent})=>({n,independent}))}));
  const effective=dayOffset(today(),1);
  const base=currentPlan(s.child,effective);
  revise(s.child,configOf(base),mod.name+' · '+change.reason,effective);
}
function loadReport(child){
  const sessions=all("SELECT * FROM sessions WHERE child=? AND status != 'active' ORDER BY started DESC LIMIT 32",child);
  return {sessions:sessions.map(s=>({id:s.id,date:s.date,module:s.module,mode:s.mode,status:s.status,level:s.level,device:s.device,...metrics(s)})),
    observations:all('SELECT * FROM observations WHERE child=? ORDER BY date DESC, rowid DESC LIMIT 36',child),
    events:all('SELECT * FROM events WHERE child=? ORDER BY time DESC LIMIT 30',child).map(x=>({...x,detail:parse(x.detail)})),
    versions:all('SELECT version,effective,reason,config FROM plans WHERE child=? ORDER BY version DESC LIMIT 30',child).map(x=>({...x,config:parse(x.config)}))};
}
function download(res,content,type,filename){
  res.writeHead(200,{'Content-Type':type,'Content-Disposition':'attachment; filename="'+filename+'"','Cache-Control':'no-store'});
  res.end(content);
}
function csvCell(value){
  const str=typeof value==='object'?json(value):String(value??'');
  return '"'+(/^[=+@\-\t\r]/.test(str)?"'":"")+str.replaceAll('"','""')+'"';
}

async function api(req,res,url){
  const method=req.method;
  const p=url.pathname;
  const auth=protect(req);
  if(p==='/api/bootstrap'&&method==='GET'){
    const profile=auth?.child?get('SELECT * FROM children WHERE id=?',auth.child):null;
    const list=auth?.parent?all('SELECT * FROM children WHERE parent=? ORDER BY rowid',auth.parent):[];
    return respond(res,{role:auth?.parent?'parent':profile?'child':null,
      parent:auth?.parent?get('SELECT username FROM parents WHERE id=?',auth.parent).username:null,
      profiles:profile?[formatProfile(profile)]:list.map(formatProfile),
      setup:!get('SELECT id FROM parents LIMIT 1'),modules,timezone,today:today(),ai:!!auth?.parent&&aiConfigured()});
  }
  if(p==='/api/logout'&&method==='POST'){
    if(auth) run('DELETE FROM auth WHERE token=?',auth.token);
    res.setHeader('Set-Cookie','cg=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    return respond(res,{ok:true});
  }
  if(['/api/setup','/api/login','/api/child-login'].includes(p)&&method==='POST'){
    loginLimit(req);
    const data=await body(req);
    if(p==='/api/child-login'){
      const child=typeof data.code==='string'&&get('SELECT * FROM children WHERE code=?',data.code.toUpperCase().trim());
      if(!child||!matches(data.pin,child.secret)) fail(401,'儿童识别码或口令有误。');
      newAuth(req,res,{child:child.id});
    }else{
      const name=typeof data.username==='string'?data.username.trim().toLowerCase():'';
      if(p==='/api/setup'){
        if(!/^[\p{L}\p{N}_-]{2,32}$/u.test(name)||typeof data.password!=='string'||data.password.length<10||data.password.length>128)
          fail(400,'账号填 2～32 个文字、数字或下划线，密码至少 10 位。');
        const expected = process.env.SETUP_CODE;
        if(expected ? data.setupCode!==expected : !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) fail(403,'请填写部署时设置的初始化口令。');
        const parent=tx(()=>{
          if(get('SELECT id FROM parents LIMIT 1')) fail(409,'家长账号已建立，请直接登录。');
          const id=randomUUID();
          run('INSERT INTO parents VALUES(?,?,?)',id,name,makeSecret(data.password));
          return id;
        });
        newAuth(req,res,{parent});
      }else{
        const parent=get('SELECT * FROM parents WHERE username=?',name);
        if(!parent||!matches(data.password,parent.secret)) fail(401,'家长账号或密码有误。');
        newAuth(req,res,{parent:parent.id});
      }
    }
    return respond(res,{ok:true});
  }
  if(!auth) fail(401,'请先登录。');
  if(p==='/api/children'&&method==='POST'&&auth.parent){
    const data=await body(req);
    const profile=validateProfile(data);
    const id=randomUUID();
    const config=configInput(data.plan||{},{cycle:cycleDefault,minutes:15,focus:'reading',anchor:today(),paused:false});
    tx(()=>{
      run('INSERT INTO children(id,parent,profile) VALUES(?,?,?)',id,auth.parent,json(profile));
      revise(id,config,'建立成长档案，生成首个四周阶段计划');
    });
    return respond(res,{id},201);
  }
  const match=p.match(/^\/api\/child\/([a-f0-9-]+)(\/.*)?$/);
  if(!match) fail(404,'该功能暂不可用。');
  const [,child,sub='/']=match;
  const row=get('SELECT * FROM children WHERE id=?',child);
  if(!row||!(auth.parent===row.parent||auth.child===child)) fail(404,'找不到该档案。');
  const profile=formatProfile(row);
  const parent=!!auth.parent;
  if(sub==='/'&&method==='GET'){
    tx(()=>prepareCycle(child,today()));
    const plan=currentPlan(child,today());
    const config=configOf(plan);
    const states=statesOf(child);
    const lastCheck=get("SELECT date FROM sessions WHERE child=? AND mode='check' AND status='complete' ORDER BY finished DESC LIMIT 1",child);
    return respond(res,{profile,config,states,today:dayView(child,today(),false,states),checkDue:lastCheck?dayOffset(lastCheck.date,28):today(),
      recent:all("SELECT * FROM sessions WHERE child=? AND mode='train' AND status='complete' ORDER BY finished DESC LIMIT 10",child)
        .map(s=>({module:s.module,date:s.date,level:s.level,...metrics(s)})),
      active:all("SELECT id,module,date,mode,scheduled FROM sessions WHERE child=? AND status='active' ORDER BY started DESC LIMIT 12",child)});
  }
  if(sub==='/calendar'&&method==='GET'){
    const first=(url.searchParams.get('month')||today().slice(0,7))+'-01';
    if(!validDate(first)) fail(400,'月份格式有误。');
    const states=statesOf(child);
    const month=first.slice(0,7);
    const days=[];
    for(let date=first;date.startsWith(month);date=dayOffset(date,1)) days.push(dayView(child,date,false,states));
    return respond(res,{days});
  }
  if(sub==='/start'&&method==='POST'){
    const input=await body(req);
    const mod=modules[input.module];
    if(!mod||!Object.hasOwn(modules,input.module)) fail(400,'请选择可用的训练。');
    const mode=['train','check','baseline'].includes(input.mode)?input.mode:'train';
    if(mode!=='train'&&mod.focus==='calm') fail(400,'该活动可直接开始练习。');
    const scheduled=input.scheduled===true && mode==='train';
    const current=today();
    return respond(res,tx(()=>{
      const available=dayView(child,current,scheduled);
      const task=available.tasks.find(t=>t.id===mod.id);
      if(scheduled && !task) fail(409,'今日安排已更新，请返回首页。');
      if(scheduled && task.session){
        if(task.session.status!=='active') fail(409,'这项任务今天已结束。');
        return viewSession(getSession(task.session.id,child));
      }
      if(scheduled&&available.rest) fail(409,'今日安排休息。');
      if(!scheduled){
        const existing=get("SELECT * FROM sessions WHERE child=? AND module=? AND mode=? AND scheduled=0 AND status='active' ORDER BY started DESC LIMIT 1",child,mod.id,mode);
        if(existing) return viewSession(existing);
      }
      const state=statesOf(child)[mod.id];
      const level=mode==='train'?((scheduled?task?.level:null)??state?.level??1):1;
      const support=mode==='train'&&!!((scheduled?task?.support:null)??state?.support);
      const id=randomUUID();
      const exposure=mode==='train'?0:get(
        "SELECT count(*) n FROM sessions WHERE child=? AND module=? AND mode IN ('baseline','check')",child,mod.id
      ).n;
      const questions=makeQuestions(mod.id,level,profile,mode,support,exposure);
      if(mode==='train'&&['reading','cause','sentence'].includes(mod.id)){
        const reviewed=get("SELECT body FROM drafts WHERE child=? AND module=? AND status='approved' ORDER BY created DESC LIMIT 1",child,mod.id);
        if(reviewed){
          const question=parse(reviewed.body);
          const options=question.options.map(option=>({option,order:randomInt(1_000_000)})).sort((a,b)=>a.order-b.order).map(v=>v.option);
          questions[questions.length-1]={...question,options};
        }
      }
      run('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',id,child,current,mod.id,mode,level,+support,
        input.device==='touch'?'touch':input.device==='keyboard'?'keyboard':'pointer',json(questions),now(),null,'active',+scheduled);
      return viewSession(getSession(id,child));
    }));
  }
  const sessionRoute=sub.match(/^\/sessions\/([a-f0-9-]+)(\/(answer|stop))?$/);
  if(sessionRoute){
    const [,id,,action]=sessionRoute;
    const initial=getSession(id,child);
    if(!initial) fail(404,'找不到这次训练。');
    if(method==='GET'&&!action) return respond(res,viewSession(initial));
    if(method!=='POST'||!action) fail(405,'请求方式有误。');
    const input=await body(req);
    return respond(res,tx(()=>{
      const session=getSession(id,child);
      if(action==='stop'){
        if(session.status==='active') run('UPDATE sessions SET status=?,finished=? WHERE id=?',input.fatigue?'fatigue':'skipped',now(),id);
        if(input.fatigue&&session.status==='active'&&session.scheduled){
          const plan=dayView(child,session.date,true);
          run('UPDATE days SET tasks=?,rest=2 WHERE child=? AND date=?',json(plan.tasks.filter(t=>t.session)),child,session.date);
        }
        return viewSession(getSession(id,child));
      }
      if(typeof input.nonce!=='string'||!(/^[\w-]{12,80}$/.test(input.nonce))||!Number.isInteger(input.index)) fail(400,'作答编号有误。');
      if(get('SELECT idx FROM trials WHERE session=? AND nonce=?',id,input.nonce)) return viewSession(session);
      if(session.status!=='active') return viewSession(session);
      const idx=get('SELECT count(*) n FROM trials WHERE session=?',id).n;
      if(input.index!==idx) return viewSession(session);
      const question=parse(session.questions)[idx];
      const kind=modules[session.module].kind;
      const invalid=['hidden','blur','paused','input-change'].includes(input.invalid)?input.invalid:null;
      const correct=score(question,kind,input.answer);
      const info={answer:input.answer??null,correct,valid:!invalid,invalid,hint:session.mode==='train'&&input.hint===true,
        rt:['signal','grid'].includes(kind)&&Number.isFinite(input.rt)?Math.max(0,Math.min(3600000,Math.round(input.rt))):null,target:question.target,
        error:correct||invalid?null:question.comparison===input.answer&&question.comparison?'比较对象读反':question.error||((kind==='signal')?(question.target?'漏答':'误触'):'作答有误'),
        evidence:question.evidence||null,ruleVersion};
      run('INSERT INTO trials VALUES(?,?,?,?)',id,idx,input.nonce,json(info));
      if(kind==='grid'&&(!correct||invalid)){
        // Unsuccessful clicks are stored alongside the target step, while the next index is still the same target.
        const questions=parse(session.questions);
        questions.splice(idx+1,0,question);
        if(questions.length<=questions[0].grid.length+45) run('UPDATE sessions SET questions=? WHERE id=?',json(questions),id);
      }
      const fresh=getSession(id,child);
      if(idx+1===parse(fresh.questions).length) finish(fresh);
      return viewSession(getSession(id,child));
    }));
  }
  if(!parent) fail(403,'这一项需要家长账号。');
  if(sub==='/drafts'&&method==='GET'){
    return respond(res,{drafts:all('SELECT * FROM drafts WHERE child=? ORDER BY created DESC LIMIT 10',child).map(row=>({...row,body:parse(row.body)}))});
  }
  if(sub==='/drafts'&&method==='POST'){
    const input=await body(req);
    if(!aiConfigured()) fail(409,'部署时尚未配置模型服务。');
    if(!['reading','cause','sentence'].includes(input.module)) fail(400,'请选择阅读练习。');
    loginLimit(req);
    let question;
    try{question=await generateReading(profile,input.module);}
    catch{fail(502,'没有生成可审核的题目，可继续使用内置练习。');}
    run('INSERT INTO drafts VALUES(?,?,?,?,?,?)',randomUUID(),child,input.module,json(question),'pending',now());
    return respond(res,{ok:true});
  }
  if(sub==='/review'&&method==='POST'){
    const input=await body(req);
    const action=input.approve===true?'approved':'rejected';
    const change=run("UPDATE drafts SET status=? WHERE child=? AND id=? AND status='pending'",action,child,String(input.id||''));
    if(!change.changes) fail(404,'没有找到待审核的材料。');
    return respond(res,{ok:true});
  }
  if(sub==='/profile'&&method==='POST'){
    const input=await body(req);
    const updated=validateProfile(input);
    tx(()=>{
      run('UPDATE children SET profile=? WHERE id=?',json(updated),child);
      revise(child,configOf(currentPlan(child)),'家长更新年级、已学范围或材料偏好');
    });
    return respond(res,{ok:true});
  }
  if(sub==='/plan'&&method==='POST'){
    const input=await body(req);
    const previous=configOf(currentPlan(child));
    const config=configInput(input,previous);
    tx(()=>{
      const latest=all('SELECT DISTINCT effective FROM plans WHERE child=? AND effective>?',child,today());
      revise(child,config,input.paused?'家长暂停训练':'家长更新目标、时间或训练周期');
      for(const entry of latest) revise(child,config,'沿用家长最新训练安排',entry.effective);
    });
    return respond(res,{ok:true});
  }
  if(sub==='/rest'&&method==='POST'){
    const input=await body(req);
    if(!validDate(input.date)||input.date<today()||daysBetween(today(),input.date)>180) fail(400,'请选择今天或未来六个月内的日期。');
    tx(()=>{
      dayView(child,input.date,true);
      run('UPDATE days SET rest=? WHERE child=? AND date=?',input.rest?1:0,child,input.date);
      if(!input.rest && !get('SELECT 1 FROM sessions WHERE child=? AND date=? AND scheduled=1',child,input.date)) run('DELETE FROM days WHERE child=? AND date=?',child,input.date);
    });
    return respond(res,{ok:true});
  }
  if(sub==='/access'&&method==='POST'){
    const input=await body(req);
    if(typeof input.pin!=='string'||!(/^[0-9]{6,10}$/.test(input.pin))) fail(400,'儿童口令需为 6～10 位数字。');
    const code=row.code||randomBytes(5).toString('hex').toUpperCase();
    run('UPDATE children SET code=?,secret=? WHERE id=?',code,makeSecret(input.pin),child);
    run('DELETE FROM auth WHERE child=?',child);
    return respond(res,{code});
  }
  if(sub==='/report'&&method==='GET') return respond(res,loadReport(child));
  if(sub==='/observation'&&method==='POST'){
    const input=await body(req);
    if(!Object.hasOwn(focusLabels,input.focus)||!['improved','same','harder','unseen'].includes(input.value)) fail(400,'请选择观察项目和结果。');
    if(input.note!=null&&(typeof input.note!=='string'||input.note.length>500)) fail(400,'备注最多 500 字。');
    run('INSERT INTO observations VALUES(?,?,?,?,?,?)',randomUUID(),child,today(),input.focus,input.value,input.note||'');
    return respond(res,{ok:true});
  }
  if((sub==='/export.json'||sub==='/export.csv')&&method==='GET'){
    const sessions=all('SELECT * FROM sessions WHERE child=? ORDER BY started',child);
    const trials=all('SELECT t.* FROM trials t JOIN sessions s ON s.id=t.session WHERE s.child=? ORDER BY s.started,t.idx',child)
      .map(x=>({...x,info:parse(x.info)}));
    if(sub==='/export.json') return download(res,json({schema:1,ruleVersion,profile,sessions:sessions.map(s=>({...s,questions:parse(s.questions)})),trials,
      plans:all('SELECT * FROM plans WHERE child=?',child),days:all('SELECT * FROM days WHERE child=?',child),
      observations:all('SELECT * FROM observations WHERE child=?',child),events:all('SELECT * FROM events WHERE child=?',child)}),'application/json','coggrow.json');
    const sessionMap=new Map(sessions.map(s=>[s.id,s]));
    const lines=[['会话','日期','模块','模式','序号','作答','正确','有效','无效原因','提示','毫秒','错误','规则版本']];
    for(const t of trials) {
      const s=sessionMap.get(t.session),i=t.info;
      lines.push([t.session,s.date,s.module,s.mode,t.idx+1,i.answer,i.correct,i.valid,i.invalid,i.hint,i.rt,i.error,i.ruleVersion]);
    }
    return download(res,'\ufeff'+lines.map(line=>line.map(csvCell).join(',')).join('\r\n'),'text/csv; charset=utf-8','coggrow-trials.csv');
  }
  if(sub==='/delete'&&method==='POST'){
    const input=await body(req);
    const secret=get('SELECT secret FROM parents WHERE id=?',auth.parent).secret;
    if(!matches(input.password,secret)) fail(401,'请输入正确的家长密码。');
    run('DELETE FROM children WHERE id=?',child);
    return respond(res,{ok:true});
  }
  fail(404,'该功能暂不可用。');
}
const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/sw.js':'sw.js','/manifest.webmanifest':'manifest.webmanifest','/icon.png':'icon.png'};
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',webmanifest:'application/manifest+json',png:'image/png'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if(url.pathname==='/health') return respond(res,{status:'ok'});
    if(url.pathname.startsWith('/api/')){
      if(req.method==='POST'&&req.headers['sec-fetch-site']==='cross-site') fail(403,'请从训练平台内操作。');
      return await api(req,res,url);
    }
    const file=Object.hasOwn(files,url.pathname)?files[url.pathname]:undefined;
    if(!file||!['GET','HEAD'].includes(req.method)) fail(404,'页面不存在。');
    const value=readFileSync(join(root,'public',file));
    res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)],'Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:value);
  }catch(error){
    if(!error.status) console.error(error);
    if(!res.headersSent) respond(res,{error:error.status?error.message:'服务暂时无法处理，请稍后重试。'},error.status||500);
    else res.end();
  }
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('CogGrow listening on '+server.address().port));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
