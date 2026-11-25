import assert from 'node:assert/strict';
import test from 'node:test';
import { AiGenerationError, generateReading } from '../ai.js';

const profile={ageMonths:126,theme:'rail'};
const sentence={
  passage:'下雨前，小禾把刚画好的画收进了柜子。',
  prompt:'谁把画收进了柜子？',
  options:['小禾','爷爷','老师','我'],
  evidence:'“小禾把刚画好的画收进了柜子”',
  explanation:'这句话说出了收画的人是小禾。',
  hint:'找找是谁做了这个动作。'
};
const env={AI_BASE_URL:'https://model.example/v1/',AI_MODEL:'test-model',AI_KEY:'private-test-key'};
const reply=(content,finish_reason='stop')=>Response.json({choices:[{finish_reason,message:{content}}]});

test('short sentence drafts accept quoted exact evidence, a single-character option, and fenced output',async()=>{
  const fence=String.fromCharCode(96).repeat(3);
  const draft=await generateReading(profile,'sentence',{env,request:async(url,init)=>{
    assert.equal(String(url),'https://model.example/v1/chat/completions');
    const body=JSON.parse(init.body);
    assert.equal(body.model,'test-model');
    assert.match(body.messages[0].content,/1～3 句/);
    return reply('好的。\n'+fence+'json\n'+JSON.stringify(sentence)+'\n'+fence);
  }});
  assert.equal(draft.correct,'小禾');
  assert.match(draft.evidence,/原文依据：“小禾把刚画好的画收进了柜子”/);
  assert.ok(draft.options.includes('我'));
});

test('an existing completion endpoint is preserved and text content parts can supply JSON',async()=>{
  const endpoint='https://model.example/proxy/v1/chat/completions';
  const draft=await generateReading(profile,'sentence',{env:{...env,AI_BASE_URL:endpoint+'/'},request:async url=>{
    assert.equal(String(url),endpoint);
    const json=JSON.stringify(sentence);
    return reply([{type:'text',text:json.slice(0,50)},{type:'text',text:json.slice(50)}]);
  }});
  assert.equal(draft.passage,sentence.passage);
});

test('retries once when the provider explicitly rejects the token-limit field',async()=>{
  let attempts=0;
  const draft=await generateReading(profile,'sentence',{env,request:async(url,init)=>{
    const body=JSON.parse(init.body);
    attempts++;
    if(attempts===1){
      assert.equal(body.max_tokens,3072);
      return Response.json({error:{code:'unsupported_parameter',param:'max_tokens'}},{status:400});
    }
    assert.equal(body.max_completion_tokens,3072);
    assert.equal(body.max_tokens,undefined);
    return reply(JSON.stringify(sentence));
  }});
  assert.equal(attempts,2);
  assert.equal(draft.correct,'小禾');
});

test('the official base URL accepts its documented token-limit field',async()=>{
  await generateReading(profile,'sentence',{env:{...env,AI_BASE_URL:'https://api.openai.com'},request:async(url,init)=>{
    assert.equal(String(url),'https://api.openai.com/v1/chat/completions');
    assert.equal(JSON.parse(init.body).max_completion_tokens,3072);
    return reply(JSON.stringify(sentence));
  }});
});

test('reports authorization, timeout, malformed replies, and nonliteral evidence without exposing provider details',async()=>{
  const checks=[
    [()=>Response.json({error:{message:env.AI_KEY}},{status:401}),/HTTP 401.*密钥/],
    [()=>new Response('<html>wrong route</html>'),/接口未返回 JSON/],
    [()=>reply(null,'length'),/截断/],
    [()=>reply('不是 JSON'),/完整 JSON/],
    [()=>reply(JSON.stringify({...sentence,evidence:'原文没有的词'})),/依据在原文中找不到/],
    [()=>{throw new DOMException(env.AI_KEY,'TimeoutError');},/超时/]
  ];
  for(const [request,expected] of checks){
    let attempts=0;
    await assert.rejects(generateReading(profile,'sentence',{env,request:async()=>{
      attempts++;
      return request();
    }}),error=>{
      assert.ok(error instanceof AiGenerationError);
      assert.match(error.message,expected);
      assert.ok(!error.message.includes(env.AI_KEY));
      return true;
    });
    assert.equal(attempts,1);
  }
});
