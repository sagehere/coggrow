export const cycleDefault = '11011010';
export const ruleVersion = '1';
export const focusLabels = { reading:'阅读理解', math:'数学读题', attention:'注意力', logic:'逻辑推理' };
export function dayKey(timezone, now = new Date()) {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone:timezone, year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(now).map(({type,value}) => [type,value]));
  return [fields.year,fields.month,fields.day].join('-');
}
export function dayOffset(date, count) {
  return new Date(Date.parse(date + 'T00:00:00Z') + count * 864e5).toISOString().slice(0,10);
}
export function daysBetween(start, end) {
  return (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 864e5;
}
export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && dayOffset(date,0) === date;
}
export function ageInMonths(birth, date) {
  const [y,m,d] = birth.split('-').map(Number);
  const [year,month,day] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year,month,0)).getUTCDate();
  return Math.max(0,(year-y)*12 + month-m - Number(day < Math.min(d,lastDay)));
}
export function cycleDay(config, date) {
  const offset = daysBetween(config.anchor,date);
  return offset < 0 ? -1 : offset % config.cycle.length;
}
export function tasksFor(config, date, modules, states) {
  const index = cycleDay(config,date);
  if (index < 0 || config.paused || config.cycle[index] !== '1') return [];
  const turn = daysBetween(config.anchor,date);
  const attention = ['schulte','go','memory','cpt','flanker','stroop','search'];
  const logic = ['tracks','matrix','switch','tower','cause'];
  const sequences = {
    attention:attention, logic,
    reading:['reading','cause','sentence','reading'],
    math:['math','model','math']
  };
  const focus = config.focus || 'reading';
  const preferred = sequences[focus];
  const priority = preferred.filter(id => states[id]?.support);
  const first = priority.length && turn % 2 === 0
    ? priority[Math.floor(turn/2) % priority.length] : preferred[turn % preferred.length];
  const secondary = focus === 'attention' ? ['reading','math','tracks','cause'] : attention;
  const companion = secondary[turn % secondary.length];
  const candidates = [...new Set([first,companion,'calm'])];
  if(modules[first].minutes>config.minutes && modules[companion].minutes>config.minutes) candidates.splice(0,0,'schulte');
  let remaining = config.minutes;
  return candidates.flatMap(id => {
    const minutes = modules[id].minutes;
    if (minutes > remaining) return [];
    remaining -= minutes;
    return [{id, minutes, level: states[id]?.level || 1, support: !!states[id]?.support}];
  });
}
export function adaptation(state, groups, mod) {
  const [a,b,c] = groups;
  if (!a || a.n < mod.minimum) return null;
  const good = g => g && g.n >= mod.minimum && g.independent/g.n >= mod.up
    && (mod.kind !== 'signal' || (g.targets >= 8 && g.distractors >= 5 && g.misses/g.targets <= .2 && g.falseAlarms/g.distractors <= .2));
  const weak = g => g && g.n >= mod.minimum && g.independent/g.n < mod.down;
  const lastChange = state.changedAt || 0;
  if (good(a) && good(b) && good(c) && c.startedAt > lastChange) {
    if (state.support) return {level:state.level,support:false,reason:'连续三组独立完成达标，减少提示'};
    if (state.level < mod.max) return {level:state.level+1,support:false,reason:'连续三组独立完成达标，提高一级'};
  }
  if (weak(a) && weak(b) && b.startedAt > lastChange) {
    const compare = a.comparison > 0 && b.comparison > 0;
    if (!state.support) return {level:state.level,support:true,reason:compare?'连续两组漏掉比较对象，加入比较提示':'连续两组需要更多帮助，加入提示'};
    if (state.level > 1) return {level:state.level-1,support:true,reason:'使用提示后仍有较多困难，降低一级'};
  }
  return null;
}
