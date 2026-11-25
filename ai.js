const schema = {
  passage:'80～220 字简体中文短段落',
  prompt:'一个关于段落含义、因果关系或证据的问题',
  options:['正确选项','干扰项','干扰项','干扰项'],
  evidence:'短段落内一段连续的原文，可以在原文中逐字找到',
  explanation:'说明该段原文为什么支持正确选项',
  hint:'给一个找线索的方法'
};
export const aiConfigured = () => Boolean(process.env.AI_BASE_URL && process.env.AI_MODEL && process.env.AI_KEY);
function validated(value) {
  const between = (v,min,max) => typeof v==='string' && v.trim().length>=min && v.trim().length<=max && !/[<>]/.test(v);
  const { passage,prompt,options,evidence,explanation,hint } = value || {};
  if(!between(passage,65,270)||!between(prompt,5,90)||!between(evidence,6,110)||!passage.includes(evidence)||
    !between(explanation,6,160)||!between(hint,4,110)||!Array.isArray(options)||options.length!==4||
    !options.every(option=>between(option,2,90))||new Set(options.map(option=>option.trim())).size!==4) throw Error('题目结构或原文依据未通过校验');
  return {passage,prompt,options:options.map(option=>option.trim()),correct:options[0].trim(),evidence:explanation+' 原文依据：“'+evidence+'”',hint,error:'证据或关系选择有误'};
}
export async function generateReading({ageMonths,theme},kind) {
  const endpoint=new URL(process.env.AI_BASE_URL);
  if(endpoint.protocol!=='https:' || endpoint.username || endpoint.password) throw Error('模型服务地址须为 HTTPS');
  endpoint.pathname=endpoint.pathname.replace(/\/$/,'')+'/chat/completions';
  const age=ageMonths<120?'8～9 岁':ageMonths<144?'10～11 岁':'12 岁';
  const response=await fetch(endpoint,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.AI_KEY},
    body:JSON.stringify({model:process.env.AI_MODEL,max_tokens:1200,messages:[
      {role:'system',content:'你为儿童设计安全的中文练习。只输出 JSON 对象，禁止 Markdown。四个选项必须不同，只有第一项正确。干扰项不能有多解。格式：'+JSON.stringify(schema)},
      {role:'user',content:'年龄段 '+age+'。练习类型 '+({reading:'段落理解',cause:'因果推理',sentence:'句子理解'}[kind])+'。主题 '+(theme==='rail'?'铁路模型':'日常探索')+'。'}
    ]})
  });
  if(!response.ok) throw Error('模型服务返回 HTTP '+response.status);
  const reply=await response.json();
  const raw=reply.choices?.[0]?.message?.content;
  if(typeof raw!=='string'||raw.length>8000) throw Error('模型没有返回可用的 JSON');
  return validated(JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi,'')));
}
