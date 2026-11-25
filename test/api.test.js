import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

test('family flow, idempotent submissions, authorization, calendar and restoration', {timeout:18000}, async t=>{
  const dir=await mkdtemp(join(tmpdir(),'coggrow-test-'));
  let processRef;
  t.after(async()=>{
    if(processRef?.exitCode===null){const done=once(processRef,'exit');processRef.kill();await done;}
    await rm(dir,{recursive:true,force:true});
  });
  async function start(data=dir) {
    const proc=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),
      env:{...process.env,AI_BASE_URL:'',AI_MODEL:'',AI_KEY:'',DATA_DIR:data,PORT:'0',TZ:'Asia/Shanghai',SETUP_CODE:'test-only'}});
    processRef=proc;
    const [buffer]=await once(proc.stdout,'data');
    return 'http://127.0.0.1:'+buffer.toString().match(/on (\d+)/)[1];
  }
  let base=await start();
  function client(){
    let cookie='';
    return async (path,body,status=200) => {
      const response=await fetch(base+'/api'+path,{headers:{Cookie:cookie,'Content-Type':'application/json'},
        method:body===undefined?'GET':'POST',body:body===undefined?undefined:JSON.stringify(body)});
      const set=response.headers.get('set-cookie');
      if(set) cookie=set.split(';')[0];
      const json=await response.json();
      assert.equal(response.status,status,JSON.stringify(json));
      return json;
    };
  }
  const parent=client();
  assert.equal((await parent('/bootstrap')).setup,true);
  await parent('/setup',{username:'family',password:'test-password',setupCode:'test-only'});
  assert.equal((await parent('/bootstrap')).role,'parent');
  const profile={name:'小岚',birth:'2016-02-29',grade:4,theme:'rail',scope:'comparison'};
  const {id}=await parent('/children',{...profile,plan:{focus:'math'}},201);
  const other=await parent('/children',{...profile,name:'小禾'},201);
  const url='/child/'+id;
  const first=await parent(url);
  assert.equal(first.today.tasks[0].id,'math');
  const session=await parent(url+'/start',{module:'math',scheduled:true});
  const reopened=await parent(url+'/start',{module:'math',scheduled:true});
  assert.equal(reopened.id,session.id);
  assert.equal(reopened.question.correct,undefined);
  const data={index:0,nonce:randomUUID(),answer:session.question.options[0]};
  const answerUrl=url+'/sessions/'+session.id+'/answer';
  const [a,b]=await Promise.all([parent(answerUrl,data),parent(answerUrl,data)]);
  assert.equal(a.index,1);
  assert.equal(b.index,1);
  assert.equal((await parent(url+'/export.json')).trials.length,1);
  for(let cursor=a;cursor.status==='active';){
    cursor=await parent(answerUrl,{index:cursor.index,nonce:randomUUID(),answer:cursor.question.options[0]});
  }
  const {sessions}=await parent(url+'/report');
  assert.equal(sessions[0].n,8);
  assert.equal(sessions[0].status,'complete');
  const detail=await parent(url);
  assert.equal(detail.today.tasks[0].session.status,'complete');
  await parent(url+'/observation',{focus:'math',value:'unseen'});
  await parent(url+'/drafts',{module:'reading'},409);
  const calendar=await parent(url+'/calendar?month='+first.today.date.slice(0,7));
  assert.ok(calendar.days.length>=28);
  await parent(url+'/rest',{date:first.today.date,rest:true});
  assert.equal((await parent(url)).today.rest,true);
  const {code}=await parent(url+'/access',{pin:'482631'});
  const child=client();
  await child('/child-login',{code,pin:'482631'});
  assert.equal((await child('/bootstrap')).role,'child');
  await child(url+'/report',undefined,403);
  await child('/child/'+other.id,undefined,404);
  assert.equal((await child(url+'/sessions/'+session.id)).index,8);
  const backupDir=join(dir,'restored');
  await import('node:fs/promises').then(fs=>fs.mkdir(backupDir));
  const db=new DatabaseSync(join(dir,'coggrow.db'));
  db.exec("VACUUM INTO '"+join(backupDir,'coggrow.db').replaceAll("'","''")+"'");
  db.close();
  const stopped=once(processRef,'exit');
  processRef.kill();
  await stopped;
  base=await start(backupDir);
  await parent('/login',{username:'family',password:'test-password'});
  const restored=await parent(url+'/export.json');
  assert.equal(restored.trials.length,8);
  assert.equal(restored.observations[0].value,'unseen');
  assert.equal(restored.profile.name,'小岚');
});
