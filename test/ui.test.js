import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { modules } from '../content.js';

test('page script paints today, calendar, report and parent settings with API responses',async()=>{
  const listeners={};
  const el={innerHTML:'',addEventListener:(name,handler)=>{listeners[name]=handler;}};
  const store=new Map();
  const profile={id:'test-child',name:'小岚',birth:'2016-03-25',ageMonths:124,grade:4,scope:'comparison'};
  const detail={profile,today:{date:'2026-08-02',cycle:1,rest:false,tasks:[{id:'math',minutes:5}]},config:{
    cycle:'11011010',focus:'math',minutes:15,anchor:'2026-08-01',stageStart:'2026-08-01',longGoal:'读清条件'
  },active:[],checkDue:'2026-08-30',states:{}};
  const replies={
    '/api/bootstrap':{role:'parent',profiles:[profile],modules,today:'2026-08-02',ai:false},
    '/api/child/test-child':detail,
    '/api/child/test-child/calendar?month=2026-08':{days:[detail.today]},
    '/api/child/test-child/report':{sessions:[],observations:[],events:[],versions:[]},
    '/api/child/test-child/drafts':{drafts:[]},
    '/api/child/test-child/start':{id:'s1',module:'math',mode:'train',status:'active',index:0,total:8,question:{
      prompt:'题目要你求什么？',passage:'两组正在比较数量。',options:['求总数','求第一组人数'],hint:'读最后一句'
    }}
  };
  const context=createContext({
    document:{querySelector:selector=>selector==='#app'?el:{},addEventListener(){}},window:{addEventListener(){}},
    navigator:{},sessionStorage:{setItem:(key,value)=>store.set(key,value),getItem:key=>store.get(key)},
    fetch:async path=>({ok:Object.hasOwn(replies,path),json:async()=>replies[path]??{error:'未预期的请求'}}),
    matchMedia:()=>({matches:false}),
    setTimeout,clearTimeout,performance,Intl,Date
  });
  runInContext(await readFile(new URL('../public/app.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(el.innerHTML,/你好，小岚/);
  assert.match(el.innerHTML,/开始今日训练/);
  assert.match(el.innerHTML,/<strong>5<\/strong>练习日/);
  const click=async (select,dataset)=>listeners.click({target:{closest:css=>css===select?{dataset}:null}});
  await click('[data-nav]',{nav:'calendar'});
  assert.match(el.innerHTML,/2026 年 8 月/);
  await click('[data-nav]',{nav:'report'});
  assert.match(el.innerHTML,/作业与生活观察/);
  await click('[data-nav]',{nav:'settings'});
  assert.match(el.innerHTML,/读清条件/);
  assert.match(el.innerHTML,/已学数学范围/);
  await click('[data-nav]',{nav:'today'});
  await click('[data-action]',{action:'start',id:'math',scheduled:'true'});
  assert.match(el.innerHTML,/先看规则/);
  await click('[data-action]',{action:'begin'});
  assert.match(el.innerHTML,/题目要你求什么/);
});
