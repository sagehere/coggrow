const kinds = {reading:'段落理解',cause:'因果推理',sentence:'句子理解'};
const outputTokens = 3072;
const requestTimeout = 60000;

export class AiGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiGenerationError';
  }
}

export const aiConfigured = () => ['AI_BASE_URL','AI_MODEL','AI_KEY'].every(key=>process.env[key]?.trim());

function completionEndpoint(address) {
  let endpoint;
  try { endpoint = new URL(address?.trim()); }
  catch { throw new AiGenerationError('AI 接口地址格式有误，请检查 COGGROW_AI_BASE_URL。'); }
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password) {
    throw new AiGenerationError('AI 接口地址须使用 HTTPS。请将密钥单独填入 COGGROW_AI_KEY。');
  }
  let path=endpoint.pathname.replace(/\/+$/,'');
  if(!path&&endpoint.hostname==='api.openai.com') path='/v1';
  endpoint.pathname=path.endsWith('/chat/completions')?path:path+'/chat/completions';
  endpoint.hash='';
  return endpoint;
}

function readObject(raw) {
  const text=raw.trim().replace(/^(?:<think>[\s\S]*?<\/think>\s*)+/i,'');
  const fenced=text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  const start=text.indexOf('{');
  const end=text.lastIndexOf('}');
  if(start!==-1&&end>start) {
    try { return JSON.parse(fenced?.[1]||text.slice(start,end+1)); }
    catch { /* Report invalid JSON without exposing the provider response. */ }
  }
  throw new AiGenerationError('模型返回的题目不是完整 JSON。请重试，或使用支持结构化回答的模型。');
}

function validateDraft(value, kind) {
  const sentence=kind==='sentence';
  const between=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max&&!/[<>]/.test(v);
  const {passage,prompt,options,evidence,explanation,hint}=value||{};
  if(!between(passage,sentence?15:45,300)||!between(prompt,3,100)||
    !between(explanation,5,180)||!between(hint,3,120)||
    !Array.isArray(options)||options.length!==4||!options.every(option=>between(option,1,100))||
    new Set(options.map(option=>option.trim())).size!==4) {
    throw new AiGenerationError('模型返回的题目字段不完整或选项重复。请重新生成。');
  }
  const excerpt=typeof evidence==='string'?evidence.trim():'';
  const quoted=excerpt.match(/^(?:“([\s\S]+)”|「([\s\S]+)」|"([\s\S]+)")$/);
  const original=quoted?.slice(1).find(Boolean)?.trim()||excerpt;
  if(!between(original,sentence?2:4,145)||!passage.includes(original)) {
    throw new AiGenerationError('模型提供的依据在原文中找不到。请重新生成。');
  }
  return {passage:passage.trim(),prompt:prompt.trim(),options:options.map(option=>option.trim()),correct:options[0].trim(),
    evidence:explanation.trim()+' 原文依据：“'+original+'”',hint:hint.trim(),error:'证据或关系选择有误'};
}

function rejectedTokenField(reply, field) {
  const error=reply?.error;
  if(!error||typeof error!=='object') return false;
  if(error.param===field&&['unsupported_parameter','unknown_parameter','invalid_parameter'].includes(error.code)) return true;
  const message=typeof error.message==='string'?error.message.toLowerCase():'';
  const namesField=new RegExp('(^|[^a-z_])'+field+'([^a-z_]|$)').test(message);
  return namesField&&/unsupported|not supported|does not support|unknown|unrecognized|deprecated|不支持/.test(message);
}

function providerError(status) {
  if(status===401||status===403) return new AiGenerationError('模型服务拒绝了访问（HTTP '+status+'）。请检查 API 密钥及模型访问权限。');
  if(status===404||status===405) return new AiGenerationError('模型服务未找到接口或模型（HTTP '+status+'）。请检查 AI 地址与模型名称。');
  if(status===429) return new AiGenerationError('模型服务限流或可用额度不足（HTTP 429）。请稍后重试或检查用量。');
  if(status===400||status===422) return new AiGenerationError('模型服务拒绝了生成参数（HTTP '+status+'）。请确认选用支持 Chat Completions 的模型。');
  if(status===402) return new AiGenerationError('模型服务额度不足（HTTP 402）。请检查账户余额。');
  return new AiGenerationError('模型服务请求失败（HTTP '+status+'）。请稍后重试。');
}

export async function generateReading({ageMonths,theme},kind,{request=fetch,env=process.env}={}) {
  const endpoint=completionEndpoint(env.AI_BASE_URL);
  const age=ageMonths<120?'8～9 岁':ageMonths<144?'10～11 岁':'12 岁';
  const schema={
    passage:kind==='sentence'?'1～3 句简体中文原文，约 20～110 字':'约 80～220 字简体中文短段落',
    prompt:'一个针对'+kinds[kind]+'的问题',
    options:['正确选项','干扰项一','干扰项二','干扰项三'],
    evidence:'原文中连续的逐字摘录，不要加引号或省略号',
    explanation:'解释哪条原文信息支持正确选项',
    hint:'给一个找线索的方法'
  };
  const messages=[
    {role:'system',content:'你为儿童设计安全的理解练习。输出一个合法 JSON 对象，不写 Markdown。四个选项必须不同，且只有第一项正确。按字段说明生成：'+JSON.stringify(schema)},
    {role:'user',content:'年龄段 '+age+'。练习类型 '+kinds[kind]+'。主题 '+(theme==='rail'?'铁路模型':'日常探索')+'。'}
  ];
  const signal=AbortSignal.timeout(requestTimeout);
  const model=env.AI_MODEL?.trim();
  const tokenField=endpoint.hostname==='api.openai.com'?'max_completion_tokens':'max_tokens';
  const send=async field=>{
    try {
      return await request(endpoint,{method:'POST',redirect:'error',signal,
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.AI_KEY?.trim()},
        body:JSON.stringify({model,[field]:outputTokens,messages})
      });
    }catch(error){
      if(signal.aborted||error?.name==='TimeoutError') throw new AiGenerationError('等待模型回答超时。请稍后重试，或换响应较快的模型。');
      throw new AiGenerationError('无法连接模型服务。请检查容器能否访问 AI 地址，以及 HTTPS 和反向代理设置。');
    }
  };
  let response=await send(tokenField);
  if([400,422].includes(response.status)){
    const rejection=await response.json().catch(()=>null);
    if(rejectedTokenField(rejection,tokenField)){
      response=await send(tokenField==='max_tokens'?'max_completion_tokens':'max_tokens');
    }
  }
  if(!response.ok) throw providerError(response.status);
  const reply=await response.json().catch(()=>{
    if(signal.aborted) throw new AiGenerationError('等待模型回答超时。请稍后重试，或换响应较快的模型。');
    throw new AiGenerationError('接口未返回 JSON。请检查 AI 地址是否指向 Chat Completions 接口。');
  });
  const answer=reply?.choices?.[0];
  if(answer?.finish_reason==='length') throw new AiGenerationError('模型回答被输出长度上限截断。请改用较快的非推理模型，或检查代理的输出上限。');
  if(answer?.finish_reason==='content_filter'||answer?.message?.refusal) throw new AiGenerationError('模型没有生成可用的练习内容。可重试或更换模型。');
  const content=answer?.message?.content;
  const raw=Array.isArray(content)?content.filter(part=>part?.type==='text'&&typeof part.text==='string').map(part=>part.text).join(''):content;
  if(typeof raw!=='string'||!raw.trim()) throw new AiGenerationError('模型返回了空白回答。请确认配置的模型支持 Chat Completions 文本输出。');
  if(raw.length>16000) throw new AiGenerationError('模型返回的内容过长。请使用适合生成短题目的模型。');
  return validateDraft(readObject(raw),kind);
}
