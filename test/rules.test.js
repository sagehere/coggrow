import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptation, ageInMonths, dayKey, tasksFor } from '../rules.js';
import { modules, makeQuestions, score } from '../content.js';

test('uses the family timezone and preserves the eight-day rhythm across months',()=>{
  assert.equal(dayKey('Asia/Shanghai',new Date('2026-01-31T17:01Z')),'2026-02-01');
  assert.equal(ageInMonths('2016-02-29','2026-02-28'),120);
  assert.equal(ageInMonths('2016-02-29','2026-02-27'),119);
  const plan={cycle:'11011010',anchor:'2026-01-28',minutes:9,focus:'math'};
  const january=tasksFor(plan,'2026-01-30',modules,{});
  const february=tasksFor(plan,'2026-02-05',modules,{math:{level:2,support:0}});
  assert.deepEqual(january,[]);
  assert.equal(february[0].id,'math');
  assert.equal(february[0].level,2);
  assert.ok(february.reduce((sum,t)=>sum+t.minutes,0)<=9);
});

test('adapts by repeated independent evidence and respects group sizes and regression cooldown',()=>{
  const state={level:1,support:false,changedAt:10};
  const group=(startedAt,n,independent,comparison=0)=>({startedAt,n,independent,comparison});
  const good=[group(41,8,8),group(31,8,7),group(21,8,6)];
  assert.equal(adaptation(state,good,modules.math)?.level,2);
  assert.equal(adaptation({...state,support:true},good,modules.math)?.support,false);
  assert.equal(adaptation(state,[good[0]],modules.math),null);
  assert.equal(adaptation({...state,changedAt:21},good,modules.math),null);
  assert.equal(adaptation(state,[group(42,8,2,2),group(32,8,2,2)],modules.math)?.reason,'连续两组漏掉比较对象，加入比较提示');
  assert.equal(adaptation(state,[group(43,2,0),group(33,2,0)],modules.math),null);
});

test('all modules generate well-formed items and support scoring',()=>{
  for(const mod of Object.values(modules)){
    for(let level=1;level<=mod.max;level++){
      const questions=makeQuestions(mod.id,level,{ageMonths:125,grade:4,theme:'rail',scope:'multi-step'});
      assert.ok(questions.length>0,mod.id);
      for(const item of questions){
        if(item.options) {
          assert.ok(item.options.includes(item.correct),mod.id);
          assert.equal(new Set(item.options).size,item.options.length,mod.id);
        }
        if('correct' in item) assert.equal(score(item,mod.kind,item.correct),true,mod.id);
      }
    }
  }
  const math=makeQuestions('math',3,{ageMonths:125,grade:4,scope:'comparison'});
  assert.ok(math.every(q=>!q.passage.includes('取走')));
  const reading=makeQuestions('reading',3,{ageMonths:125,grade:4},'check');
  assert.ok(reading.every(q=>q.options.length===4));
});

test('every generated route is solvable within its budget',()=>{
  for(let level=1;level<=3;level++) for(let run=0;run<12;run++){
    for(const q of makeQuestions('tracks',level,{ageMonths:120})){
      const distance=cell=>[Math.floor(cell/q.size),cell%q.size];
      const neighbors=cell=>Array.from({length:q.end+1},(_,i)=>i).filter(next=>{
        const [a,b]=distance(cell),[c,d]=distance(next);
        return Math.abs(a-c)+Math.abs(b-d)===1&&!q.walls.includes(next);
      });
      const seen=new Set([0]), queue=[[0]];
      for(const route of queue) for(const cell of neighbors(route.at(-1))){
        if(!seen.has(cell)){seen.add(cell);queue.push([...route,cell]);}
      }
      const route=queue.find(r=>r.at(-1)===q.end);
      assert.equal(score(q,'path',route),true);
      assert.equal(score(q,'path',[0,q.end]),false);
    }
  }
});
