const moduleInfo = {
  schulte:['舒尔特方格','按数字顺序点亮方格','attention','grid',3,5,6,.85,.62],
  cpt:['持续注意','看到目标就点，其他图形等它消失','attention','signal',4,3,18,.86,.65],
  go:['行动与等待','看到圆形就点，看到方形就等','attention','signal',4,3,18,.85,.66],
  flanker:['中央箭头','只判断中间箭头的方向','attention','choice',3,3,10,.87,.65],
  stroop:['颜色判断','看字体颜色，选择对应的颜色','attention','choice',3,3,10,.85,.65],
  memory:['空间记忆','记住亮起的位置，按原顺序点回去','attention','memory',4,5,4,.82,.55],
  search:['视觉搜索','在相似图形中找出目标','attention','choice',3,3,8,.86,.62],
  reading:['段落理解','回到原文找出能支持答案的句子','reading','choice',5,3,4,.75,.50],
  sentence:['句子理解','读清楚代词指谁、事情先后怎样','reading','choice',4,3,4,.75,.50],
  cause:['因果推理','从线索中找出最能解释结果的原因','logic','choice',4,3,4,.75,.50],
  math:['数学读题','先找条件和比较对象，再选出题目所求','math','choice',5,3,8,.75,.55],
  model:['数量关系','用算式表示数量之间的关系','math','choice',5,3,4,.75,.55],
  tracks:['轨道规划','绕开障碍，在步数限制内到站','logic','path',5,3,3,.80,.50],
  matrix:['规律推理','观察行与列的变化，补上空格','logic','choice',4,3,4,.75,.50],
  switch:['规则切换','看当轮提示，切换分类规则','logic','choice',4,3,8,.85,.60],
  tower:['汉诺塔规划','每次移动一个圆盘，把它们全部移到右侧','logic','tower',5,3,1,.80,.50],
  calm:['呼吸练习','让呼吸自然，留意当下，想停时随时停','calm','calm',2,1,1,1,0],
  break:['离屏活动','放下屏幕，活动肩膀并看向远处','calm','calm',2,1,1,1,0]
};
export const modules = Object.fromEntries(Object.entries(moduleInfo).map(([id,entry]) => {
  const [name,desc,focus,kind,minutes,max,minimum,up,down] = entry;
  return [id,{id,name,desc,focus,kind,minutes,max,minimum,up,down}];
}));
const passages = [
 ['图书角开张时，两盆同样的薄荷分别放在窗边和柜里。小乔每天给它们倒等量的水。几天后，柜里的薄荷叶发黄，窗边的仍然翠绿。','柜里的薄荷为什么可能发黄？','柜里得到的光更少','小乔少浇了水','两盆植物品种不同','几天都没下雨','两盆薄荷和浇水量相同，位置与光照不同。'],
 ['放学前天开始下雨。小周用袋子把书包裹好，把装作业本的袋口再折了一次。到家时，外袋已经湿了，作业本仍然是干的。','作业本保持干燥，最可能与什么有关？','袋子和折好的袋口挡住了雨','放学后一直没有下雨','书包里的作业本很薄','小周在路上写完了作业','外袋变湿而作业本保持干燥，说明袋子起到了阻挡作用。'],
 ['运动会上，班里的接力队先在跑道边练交接。前两次小宁起跑太早，队友追不上。第三次听到队友喊“走”才起跑，交接顺利。','第三次交接顺利的直接原因是什么？','小宁听到约定信号后才起跑','第三次跑道变短了','队友换成了老师','接力棒可以扔出去','前两次起跑过早，第三次通过信号协调了时机。'],
 ['小站的电子钟早上突然停了。维修员换上新电池，数字马上再次跳动。候车室的灯一直亮着，售票机也照常运行。','哪条线索最直接支持“旧电池没电了”？','换了新电池，数字马上跳动','候车室的灯一直亮着','小站早上有人候车','售票机照常运行','换电池前后时钟状态不同，其他信息没有直接说明时钟的问题。'],
 ['老师把美术材料交给小雨，并请她先分画纸，再分画笔。小雨照做后，把多余的画笔放回了盒子。','句子中的“她”指谁？','小雨','老师','画纸','画笔','老师请收到材料的小雨完成分发。'],
 ['阿星和连连一起整理模型。连连把快掉下来的车轮扶住，请阿星把它拧紧。随后，两人把模型放上了展台。','“把它拧紧”中的“它”指什么？','车轮','展台','连连','模型说明书','前一句提到了快掉下来的车轮。'],
 ['列车驶入山洞前，司机先打开灯，再提醒大家离车门远些。驶出山洞后，车厢里亮了起来。','司机先做了什么？','打开灯','提醒大家','驶出山洞','打开车门','原文“先打开灯，再提醒”明确给出顺序。'],
 ['乐乐把记号贴在红色的一盒上，因为那里装着易碎的小摆件。蓝色那盒装的是纸。搬运时，叔叔先把有记号的盒子放在软垫上。','叔叔放在软垫上的是什么？','装摆件的红盒','装纸的蓝盒','空纸盒','两只盒子的盖子','有记号的是红盒，里面装着易碎摆件。'],
 ['车站广播暂停时，站台工作人员举起写着“请在黄线内等待”的牌子。旅客看到后向后退了一步。广播恢复后再次提醒了同一条要求。','旅客第一次后退前收到了什么提示？','工作人员举起的提示牌','恢复后的广播','车门上的数字','自己的车票','先有举牌和后退，随后才恢复广播。'],
 ['盒子甲的拼图片已全部编号，盒子乙只有一半编号。两组同学用同一幅图作参考，同时开始。收拾时，乙组花了更长时间确认缺少哪一片。','哪项差异最可能解释乙组查找得更慢？','乙组有一半拼图片没有编号','两组同时开始','两组看同一幅图','乙组人数更多','有没有编号改变了逐一查找和核对的难度。'],
 ['记录员在球场门口写下“第一组借走三只球”。课后，他看见一只球仍放在架上，另外两只已还回。老师提醒他，架上那只在课前就没借出去。','还缺几只第一组借走的球？','一只','没有缺','两只','三只','借出三只，归还两只。课前留下的球不属于借出记录。'],
 ['旧地图标了两条小路。下雨后，低处小路积了水，志愿者在路口拉上绳子。指示牌仍画着两条路线，行人最终都经过高坡。','为什么大家走高坡？','低处小路积水，被绳子拦住','旧地图只标了一条路','行人都不认识低处小路','高坡原先被封锁','积水引发封路，封路改变了行人的路线。'],
 ['小青把写有“请先归还工具”的纸条夹在工作台上。小谷照着纸条做完后，才把手里的新材料领走。','小谷领材料前做了什么？','归还工具','写纸条','拿走工作台','整理新材料','他照着要求先归还工具。'],
 ['志愿者把厚书放到书架下层，把薄书放到上层。小冬按这个办法做完后，拎起空纸箱。','“这个办法”指什么？','厚书放下层，薄书放上层','厚书放上层，薄书放下层','把书全放入纸箱','只整理薄书','这个办法指上一句写出的摆放规则。'],
 ['几位同学刚把车厢模型安好，风忽然变大。小李用一块湿布按住图纸，再去收散落的零件。','小李用湿布做什么？','按住图纸','装零件','擦车厢模型','挡住车轮','原文明确说“用一块湿布按住图纸”。'],
 ['妹妹指着桌上的收纳袋问哥哥：“这是谁留下的？”哥哥说是他借来的，收拾好后会送还给同学。','妹妹说的“这”指什么？','收纳袋','桌子','同学','哥哥','她一边指着收纳袋，一边问是谁留下的。']
,
 ['小齐用两个相同的纸杯试声音。第一个杯口套上绷紧的薄膜，第二个杯口的薄膜松松地搭着。两次敲击都用同一把木勺，前者的声音更清楚。','哪条信息最能解释两次声音不同？','两张薄膜的松紧不同','两次用的是不同的勺子','两个纸杯大小不同','实验在两个房间进行','木勺和杯子相同，杯口的薄膜松紧不同。'],
 ['值日时，门边的留言写着“请把借来的剪刀放进绿筐”。小东把剪刀放好，又把自己带来的尺放回书包。后来，老师检查了绿筐。','老师会在绿筐里看到什么？','借来的剪刀','小东的尺','写留言的笔','小东的书包','留言要求归还剪刀，小东随后把剪刀放好。'],
 ['小组把同一份采访稿分成三段。若若负责第二段，她把它重新读了一遍，发现两个名字写反了。小丁负责第三段，正在找配图。','“把它重新读了一遍”的“它”指什么？','采访稿的第二段','采访稿的第三段','配图','两个名字','上文说明若若负责第二段。'],
 ['实验员先把一块干海绵称重，再用滴管滴上同样大小的水滴。她用纸巾擦干桌面后，最后称湿海绵的质量。','实验员第一次称重的是什么？','干海绵','湿海绵','纸巾','滴管','“先把一块干海绵称重”交代了第一次称重。'],
 ['周日早上图书馆暂时关闭一楼入口，入口前放着“活动请走东门”的牌子。拉着小提琴盒的孩子没停留，从东门上了二楼。','孩子选择走东门最有可能依据什么？','一楼入口前的指示牌','小提琴盒上的标签','二楼的人招手','书架上的分类号','关闭入口前的指示牌明确写着请走东门。'],
 ['两组组装同样的桥模型，都用了相同的零件。甲组把螺丝按长度分盒，乙组把所有螺丝混装。甲组找齐指定螺丝更快。','哪项做法有助于甲组更快找齐？','先按螺丝长度分类','给桥模型刷颜色','把螺丝放在同一个盒里','更换了一套零件','先分盒缩小了每次需要查找的范围。'],
 ['阿宁把钟表的照片发给乐乐，让她看一看表针的位置。乐乐说时针靠近七，分针正指着十二。','“让她看一看”中的“她”指谁？','乐乐','阿宁','送照片的人','时针','阿宁把照片发给了乐乐，请乐乐看。'],
 ['画册里夹着一张黄色便笺。小白拿起便笺上的号码去查资料，随后把它夹回原来那一页。','“把它夹回”说的是什么？','黄色便笺','号码','画册','资料','能从画册中拿走并夹回去的是那张便笺。']
];
function shuffle(values) {
  const copy = [...values];
  for(let i=copy.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]] = [copy[j],copy[i]];
  }
  return copy;
}
const pick = values => values[Math.floor(Math.random()*values.length)];
function choice(prompt, answers, fields = {}) {
  return {prompt, correct:answers[0], options:shuffle(answers), ...fields};
}
function shortest(grid,start,end,size) {
  const queue = [[start]];
  const seen = new Set([start]);
  for (const route of queue) {
    const index = route.at(-1);
    if(index===end) return route.length-1;
    for(const next of [index-size,index+size,index-1,index+1]) {
      if(next<0 || next>=size*size || Math.abs(Math.floor(next/size)-Math.floor(index/size))+Math.abs(next%size-index%size)!==1 || grid.includes(next) || seen.has(next)) continue;
      seen.add(next); queue.push([...route,next]);
    }
  }
  return Infinity;
}
export function makeQuestions(id, level, profile, mode='train', support=false, edition=0) {
  const fixed = mode!=='train';
  const l = fixed?1:level;
  const railway = !fixed && profile.theme==='rail';
  const ageBand = fixed?1:profile.ageMonths<120?0:profile.ageMonths<144?1:2;
  const question = (prompt,answers,other) => choice(prompt,answers,{...other});
  switch(id) {
    case 'schulte': {
      const size = 3 + Math.min(l-1,4);
      const values = shuffle(Array.from({length:size**2},(_,i)=>i+1));
      return Array.from({length:size**2},(_,i)=>({prompt:'点数字 '+(i+1),grid:values,size,correct:i+1}));
    }
    case 'cpt': case 'go': {
      const target = id==='cpt'?'★':'●';
      return shuffle([...Array(16).fill(true),...Array(12).fill(false)]).map(match=>({
        prompt:'看到 '+target+' 就点',symbol:match?target:pick(id==='cpt'?['◆','▲','■']:['■']),
        correct:match?'hit':'wait',deadline:[2600,2200,1800][l-1],target:match
      }));
    }
    case 'flanker':
      return Array.from({length:12},(_,i)=>{
        const right = Math.random()<.5; const inner = right?'→':'←';
        const outer = (l===1?i%3===0:l===2?i%3!==0:true)?(right?'←':'→'):inner;
        return question('中间箭头指向哪边？',[right?'右':'左',right?'左':'右'],{stimulus:outer.repeat(2)+inner+outer.repeat(2),options:['左','右']});
      });
    case 'stroop': {
      const colors = [['红','#b62942'],['蓝','#2457ae'],['绿','#287633'],['紫','#7448a1']].slice(0,l+1);
      return Array.from({length:12},()=>{
        const ink = pick(colors); const word = l===1?pick(colors):pick(colors.filter(c=>c!==ink));
        return question('这个字用什么颜色写的？',[ink[0],...colors.filter(c=>c!==ink).map(c=>c[0])],{stimulus:word[0],ink:ink[1]});
      });
    }
    case 'memory':
      return Array.from({length:4},()=> {
        const sequence = shuffle([0,1,2,3,4,5,6,7,8]).slice(0,l+1);
        return {prompt:'按顺序点亮刚才的位置',sequence,correct:sequence};
      });
    case 'search':
      return Array.from({length:10},()=>{
        const correct = 1+Math.floor(Math.random()*4);
        const symbols = ['◇','△','○','□'];
        return question('◆ 出现在哪一行？',[correct,...[1,2,3,4].filter(n=>n!==correct)],{
          stimulus:Array.from({length:4},(_,i)=>Array.from({length:3+l},(_,j)=>i===correct-1&&j===l?'◆':pick(symbols)).join('　')).join('\n'), options:[1,2,3,4]});
      });
    case 'sentence': case 'reading': case 'cause': {
      const isSentence=id==='sentence';
      const pool=isSentence
        ? (fixed?(edition%2?[18,19,22,23]:[12,13,14,15]):[4,5,6,7])
        : (fixed?(edition%2?[16,17,20,21]:[8,9,10,11]):[0,1,2,3]);
      return shuffle(pool).map((i)=>{
        const [base,prompt,a,b,c,d,evidence] = passages[i];
        const passage = (l===1 && ageBand===0) || fixed ? base : base + (
          l===3||ageBand===2?' 旁边另有一份昨天的值日记录，可以稍后再核对。':' 同学们把这件事记在了观察本上。');
        const ask = id==='reading' && l>1 ? '哪句话最能支持你对这件事的理解？' : prompt;
        return question(ask,id==='reading'&&l>1?[evidence,b,c,d]:[a,b,c,d],{passage, evidence,
          hint:'回到开头和结尾，圈出发生变化的那件事。',error:'证据或关系选择有误'});
      });
    }
    case 'math': case 'model':
      return shuffle(Array.from({length:4},(_,i)=>i)).flatMap((i)=>{
        const small = Math.max(2,profile.grade || 4);
        const a = (mode==='check'?22:mode==='baseline'?12:6)+i*(small+1)+Math.floor(Math.random()*3);
        const b = 2+i+l; const extra = 1+(i%3);
        const multistep = l===3 && profile.scope==='multi-step';
        const [one,two,thing] = fixed?['手工组','绘画组','盒彩纸']:railway?['甲站','乙站','节车厢']:['一组','二组','本图书'];
        const statement = one+'有 '+a+' '+thing+'，'+two+'比'+one+'多 '+b+' '+thing+'。';
        const passage = statement + (l>1?' 桌上另外有 '+extra+' 支笔。':'')+(multistep?' 上午又从'+two+'取走 '+extra+' '+thing+'。':'');
        const asked = multistep?two+'现在有多少'+thing+'？':two+'有多少'+thing+'？';
        const common = { passage:passage+' '+asked, hint:'先标记谁和谁在比较，再找“多几”和题末问句。' };
        if(id==='model'){
          const formula = multistep?a+' + '+b+' − '+extra:a+' + '+b;
          return [question('哪个算式对应所求数量？',[formula,a+' − '+b,b+' − '+a,a+' × '+b],
            {...common,evidence:'正确关系为 '+formula+'，结果是 '+(a+b-(multistep?extra:0))+' '+thing+'。',error:'数量关系选择有误'})];
        }
        return [
          question('根据哪组条件才能解题？',[one+'有 '+a+' '+thing+'，'+two+'比'+one+'多 '+b+' '+thing+(multistep?'，再从'+two+'取走 '+extra+' '+thing:''),
            two+'有 '+a+' '+thing+'，'+one+'比'+two+'多 '+b+' '+thing, '只知道多 '+b+' '+thing, '只需要知道一开始有 '+a+' '+thing],
          {...common,evidence:statement+(multistep?' 还需要减去后来取走的数量。':''),error:'找条件有误', comparison:two+'有 '+a+' '+thing+'，'+one+'比'+two+'多 '+b+' '+thing}),
          question('题目要你求什么？',[asked,one+'原来有多少'+thing+'？','两边相差多少'+thing+'？','一共有多少'+thing+'？'],
          {...common,evidence:'题目最后问的是“'+asked+'”',error:'识别所求有误'})
        ];
      });
    case 'tracks':
      return Array.from({length:3},()=>{
        const size=l+3; const last=size*size-1;
        const obstacles=shuffle(Array.from({length:last-1},(_,i)=>i+1));
        const walls=[];
        for(const candidate of obstacles){
          if(walls.length>=l+3) break;
          const next=[...walls,candidate];
          if(shortest(next,0,last,size)<=2*(size-1)+2) walls.push(candidate);
        }
        return {prompt:'到达终点，尽量少走',size,walls,end:last,limit:shortest(walls,0,last,size)+2};
      });
    case 'matrix':
      return Array.from({length:5},(_,i)=>{
        const a=i+1+(mode==='check'?8:0), b=l+1, c=l===3?3:1, n=a+2*b+2*c;
        return question('按行与列的规律补上最后一格',[n,n+1,n-b,n+b+1],{
          stimulus:[0,1,2].map(r=>[0,1,2].map(col=>r===2&&col===2?'？':a+r*b+col*c).join('　')).join('\n'),
          evidence:'每向右一格加 '+c+'，每向下一格加 '+b+'。',error:'行列规律选择有误'});
      });
    case 'switch':
      return Array.from({length:12},(_,i)=>{
        const shape=pick(['圆形','三角形']), ink=pick(['红','#2457ae']);
        const byShape=l===1?i<6:l===2?Math.floor(i/2)%2===0:i%2===0;
        const red=ink==='红';
        return question(byShape?'按形状选择':'按颜色选择',byShape?[shape, shape==='圆形'?'三角形':'圆形']:
          [red?'红色':'蓝色',red?'蓝色':'红色'],{stimulus:shape==='圆形'?'●':'▲',ink:red?'#b62942':ink});
      });
    case 'tower': return [{prompt:'把圆盘全部移到最右边',disks:l+2,limit:2**(l+2)+l}];
    case 'calm': case 'break': return [{prompt:modules[id].desc, correct:'done'}];
    default: throw Error('未知训练');
  }
}
export function score(question, kind, answer) {
  if(kind==='path'){
    if(!Array.isArray(answer)||answer[0]!==0||answer.at(-1)!==question.end||answer.length-1>question.limit) return false;
    return answer.every((cell,i)=>Number.isInteger(cell)&&cell>=0&&cell<=question.end&&!question.walls.includes(cell)&&(!i||
      Math.abs(Math.floor(cell/question.size)-Math.floor(answer[i-1]/question.size))+Math.abs(cell%question.size-answer[i-1]%question.size)===1));
  }
  if(kind==='tower'){
    const pegs=[Array.from({length:question.disks},(_,i)=>question.disks-i),[],[]];
    if(!Array.isArray(answer)||answer.length>question.limit) return false;
    for(const move of answer){
      if(!Array.isArray(move)||move.length!==2||!pegs[move[0]]||!pegs[move[1]]||move[0]===move[1]) return false;
      const from=pegs[move[0]],to=pegs[move[1]];
      if(!from.length||to.at(-1)<from.at(-1)) return false;
      to.push(from.pop());
    }
    return pegs[2].length===question.disks;
  }
  return JSON.stringify(question.correct)===JSON.stringify(answer);
}
