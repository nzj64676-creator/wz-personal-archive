/* WZ Personal Archive · Interest Atlas V7 — no dependencies, works offline */
(()=>{
 'use strict';
 const data={
 math:{title:'数学与工程',en:'MATHEMATICS / ENGINEERING',symbol:'∑',hook:'我不满足于记住公式，更想知道它为什么成立。',
 quick:'我喜欢数学中的严格推理与结构关系。学习高等数学、线性代数和机械相关知识时，我经常追问：这一步从哪里来？它在什么条件下才成立？',pills:['高等数学','线性代数','机械电子工程'],
 story:['学习矩阵、特征值、二次型时，我会反复追问公式推导与变量替换的逻辑，而不是只记住操作步骤。','我接触微分方程、机械制图和 C 语言，也会思考数学抽象怎样对应具体工程问题。','遇到不理解的题，我倾向于把问题拆成定义、条件、推理与结果，再寻找最关键的那个步骤。'],
 links:['ai','movement'],bridge:'抽象与实践的连接：数学为技术提供结构化工具；跑步训练中的配速和反馈，也可以借助数量分析。',concept:'数学建模（Mathematical Modeling）',definition:'将现实问题抽象为变量、关系和约束条件，用数学结构分析问题。模型始终需要验证其假设和适用边界。'},
 psych:{title:'心理与行为',en:'PSYCHOLOGY / BEHAVIOR',symbol:'◎',hook:'我好奇的不是“人怎么做”，而是“人为什么这么做”。',
 quick:'为什么群体会改变个人判断？权威、社会认同和认知偏差究竟如何影响决策？我喜欢从心理学和行为科学里寻找解释。',pills:['认知偏差','社会影响','决策心理'],
 story:['读过《思考，快与慢》《乌合之众》，也在阅读《影响力》。这些阅读让我关注认知偏差、说服机制与从众行为。','讨论一个观点时，我会追问它是来自证据，还是来自习惯、群体压力和情绪反应。','我也把这些问题用于自我观察：为什么有时觉得自己很理性，却仍可能受到选择性注意和先入为主的影响？'],
 links:['social','finance'],bridge:'个体心理可以放大为社会现象；行为偏差也会影响投资者对风险与收益的判断。',concept:'证实偏差（Confirmation Bias）',definition:'人更容易搜寻、记住或解释那些支持自己原有信念的信息。认识这种倾向不意味着人能完全免疫它。'},
 social:{title:'社会与制度',en:'SOCIETY / INSTITUTIONS',symbol:'⚖',hook:'我关心社会如何运行，也关心制度为什么会变成今天的样子。',
 quick:'从历史叙事到权力结构，从制度安排到激励机制，我希望比较不同立场与证据，而不是仅用一个标签概括复杂事件。',pills:['历史与制度','激励机制','多视角分析'],
 story:['讨论历史和现实社会议题时，我经常要求同时呈现官方、批判和相对中立的学术解释，并分析各自依据。','我对国家、社会与个人之间的关系感兴趣，也会追问制度如何改变参与者的决策。','相比简单的“好”或“坏”，我更愿意了解历史条件、实施过程以及长期后果。'],
 links:['psych','finance'],bridge:'制度通过激励影响个人选择，个人选择的累积又可能反过来改变制度及市场。',concept:'路径依赖（Path Dependence）',definition:'历史上形成的制度、技术或行为路径，可能通过转换成本与自我强化机制影响后续选择。并非意味着路径永远无法改变。'},
 finance:{title:'金融与全球化',en:'FINANCE / GLOBALIZATION',symbol:'↗',hook:'一张银行卡、一个指数，背后是更大的全球连接网络。',
 quick:'我正在逐步学习 ETF、指数基金、全球金融市场和跨境支付，也想弄清楚技术与制度怎样让信息、资金和服务跨越地域。',pills:['指数基金','跨境支付','全球互联网'],
 story:['我曾系统追问标普 500、纳斯达克 100、ETF 与交易所之间的关系，以及相关基金实际如何运作。','我关注银行卡国际支付、海外平台和境外手机号等基础设施，希望理解全球数字服务的接入门槛。','面对金融问题，我更希望先弄清术语、机制和风险，而不是根据单次涨跌快速下结论。'],
 links:['social','ai'],bridge:'金融体系依赖制度与信任，也依赖支付网络、身份认证和数字技术等基础设施。',concept:'机会成本（Opportunity Cost）',definition:'选择某一方案时所放弃的最佳可行替代方案的价值。它可以帮助比较行动方案，但并不等于所有价值都能准确用金钱衡量。'},
 movement:{title:'运动与训练',en:'RUNNING / TRAINING',symbol:'◷',hook:'训练不仅是完成一次跑步，也是观察身体如何适应的实验。',
 quick:'跑步和抗阻训练构成了我生活里稳定的一部分。我习惯关注训练目标、配速、疲劳和恢复，并根据反馈调整安排。',pills:['跑步训练','力量训练','负荷与恢复'],
 story:['我会记录不同距离的跑步表现，追问速度、步频、步幅以及疲劳对最后阶段动作的影响。','在深蹲和哑铃训练中，我不仅关注完成多少次数，也在意剩余次数感知、渐进负荷和训练质量。','我把训练视为长期过程：计划、执行、记录、调整，而不是只靠一时兴奋增加强度。'],
 links:['math','psych'],bridge:'运动表现可以量化，也与注意力、动机和疲劳感知有关：身体与心理并非两个完全独立的系统。',concept:'渐进超负荷（Progressive Overload）',definition:'在适应能力与恢复条件允许的前提下，逐步提高训练刺激。增加负荷并不是越快越好，需要结合个体状态。'},
 ai:{title:'AI 与数字技术',en:'AI / DIGITAL TOOLS',symbol:'✳',hook:'我不只想使用工具，也想知道怎样把工具用得更可靠。',
 quick:'我经常借助 AI 学习数学、分析问题并完善自己的项目，也接触 GitHub、C 语言和互联网工具。我对技术的能力边界保持好奇。',pills:['AI 辅助学习','人机协作','技术应用'],
 story:['我会让 AI 逐步解释数学问题，再围绕不理解的环节不断追问，直到能理解关键推理。','我正在尝试用网页技术制作自己的个人网站，把身份展示、交互设计与实际代码结合起来。','我关心模型输出是否准确，也喜欢比较不同工具在同一任务中的表现，而不是将任何生成结果直接视为事实。'],
 links:['math','finance'],bridge:'AI 是信息处理工具，也可以改变学习和商业服务；而它的可靠应用离不开数学基础与验证流程。',concept:'人机协作（Human–AI Collaboration）',definition:'将机器的计算与生成能力和人的任务理解、校验、决策结合。工具可以辅助判断，但不自动保证输出可靠。'}
 };
 const books={
 slow:{title:'《思考，快与慢》',meta:'判断、启发式与认知偏差',thought:'“当我以为自己在理性判断时，有没有可能只是在为直觉寻找理由？”',desc:'这本书引导我持续关注判断方式及其局限，也让我更愿意检视看似理所当然的结论。',ref:'psych',label:'心理与行为'},
 crowd:{title:'《乌合之众》',meta:'群体、暗示与社会影响',thought:'“如果许多人都相信一件事，究竟增加了多少可信度？”',desc:'阅读它后，我对集体行为、从众和群体情绪等现象更感兴趣。书中观点也应放在其写作时代和后续学术研究中审视。',ref:'social',label:'社会与制度'},
 influence:{title:'《影响力》',meta:'说服、社会认同与互惠 · 阅读中',thought:'“为什么有时明明没有被强迫，我们仍会改变决定？”',desc:'我正在通过这本书了解影响行为的常见机制，并试着在日常选择中辨认这些机制。',ref:'psych',label:'心理与行为'}
 };
 const routes={
 logic:{title:'从公式，到思维',desc:'从数学中的严密推导出发，经过 AI 这种知识工具，最后回到人本身的判断与认知偏差。',steps:['math','ai','psych']},
 society:{title:'从个体，到社会',desc:'从个人决策机制走向制度激励，再观察金融与全球化怎样把系统连接起来。',steps:['psych','social','finance']},
 action:{title:'从目标，到行动',desc:'从跑步训练中的反馈记录出发，理解分析工具与数字技术怎样帮助改善行动。',steps:['movement','math','ai']}
 };
 const order=['math','psych','social','finance','movement','ai'];
 const $=(q,r=document)=>r.querySelector(q);
 const $$=(q,r=document)=>[...r.querySelectorAll(q)];
 const nodes=$$('[data-atlas-point]');
 if(!nodes.length) return;
 const focusTitle=$('#atlasFocusTitle'),focusEn=$('#atlasFocusEn'),focusHook=$('#atlasFocusHook'),focusSymbol=$('#atlasFocusSymbol'),focusSeq=$('#atlasFocusSequence'),focusContent=$('#atlasContent'),focusStatus=$('#atlasFocusStatus');
 let active='math',activeTab='quick',journey=null,step=0;
 let visited=[];
 try{let val=JSON.parse(localStorage.getItem('wz_atlas_seen_v7')||'[]');visited=Array.isArray(val)?val.filter(id=>order.includes(id)):[]}catch(_){visited=[]}
 function store(){try{localStorage.setItem('wz_atlas_seen_v7',JSON.stringify(visited))}catch(_){}}
 function mark(id){if(!visited.includes(id)){visited.push(id);store()};$('#atlasVisitedText').textContent=`已探索 ${visited.length} / ${order.length}`;$('#atlasProgressBar').style.width=`${visited.length/order.length*100}%`;nodes.forEach(n=>n.classList.toggle('seen',visited.includes(n.dataset.atlasPoint)))}
 function updateVisited(){ $('#atlasVisitedText').textContent=`已探索 ${visited.length} / ${order.length}`;$('#atlasProgressBar').style.width=`${visited.length/order.length*100}%`;nodes.forEach(n=>n.classList.toggle('seen',visited.includes(n.dataset.atlasPoint)))}
 function make(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
 function drawContent(){
  const entry=data[active];focusContent.replaceChildren();focusContent.style.animation='none';void focusContent.offsetWidth;focusContent.style.animation='';
  if(activeTab==='quick'){
   focusContent.append(make('h4','content-head','为什么这件事吸引我？'),make('p','',entry.quick));
   const pills=make('div','atlas-quick-pills');entry.pills.forEach(v=>pills.append(make('span','',v)));focusContent.append(pills);
  }else if(activeTab==='story'){
   focusContent.append(make('h4','content-head','这些兴趣，真实地出现在我的生活里。'));
   const list=make('ol','atlas-detail-list');entry.story.forEach(v=>list.append(make('li','',v)));focusContent.append(list);
  }else{
   focusContent.append(make('h4','content-head','它与哪些领域相连？'),make('p','',entry.bridge));
   const related=make('div','atlas-bridge-actions');entry.links.forEach(id=>{const btn=make('button','atlas-bridge',`探索 ${data[id].title}  ↗`);btn.type='button';btn.addEventListener('click',()=>select(id,true,'links'));related.append(btn)});focusContent.append(related);
   const details=make('details','atlas-concept');const summary=make('summary','',entry.concept+' · 点击解释');details.append(summary,make('p','',entry.definition));focusContent.append(details);
  }
 }
 function setTab(which){activeTab=which;$$('[data-atlas-tab]').forEach(b=>{let on=b.dataset.atlasTab===which;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1});drawContent()}
 function select(id,record=true,tab='quick'){
  if(!data[id])return;active=id; if(record)mark(id);
  nodes.forEach(n=>{const yes=n.dataset.atlasPoint===id;n.classList.toggle('active',yes);n.setAttribute('aria-pressed',String(yes))});
  focusTitle.textContent=data[id].title;focusEn.textContent=data[id].en;focusHook.textContent=data[id].hook;focusSymbol.textContent=data[id].symbol;
  const idx=order.indexOf(id);focusSeq.textContent='FIELD '+String(idx+1).padStart(2,'0')+' / 06';focusStatus.textContent=String(idx+1).padStart(2,'0')+' / 06';
  setTab(tab);$('#atlasHoverInfo').textContent='当前焦点：'+data[id].title;
  if(journey){const position=routes[journey].steps.indexOf(id);if(position>=0)step=position;paintJourney()}
  drawLines();
 }
 nodes.forEach((node,i)=>{
  node.addEventListener('click',()=>select(node.dataset.atlasPoint));
  node.addEventListener('mouseenter',()=>{$('#atlasHoverInfo').textContent='预览：'+data[node.dataset.atlasPoint].hook});
  node.addEventListener('mouseleave',()=>{$('#atlasHoverInfo').textContent='当前焦点：'+data[active].title});
  node.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
   event.preventDefault();let target=event.key==='Home'?0:event.key==='End'?order.length-1:(i+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)+order.length)%order.length;
   nodes[target].focus();select(nodes[target].dataset.atlasPoint);
  });
 });
 $$('[data-atlas-tab]').forEach((btn,i,arr)=>{
  btn.addEventListener('click',()=>setTab(btn.dataset.atlasTab));
  btn.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const next=arr[(i+(event.key==='ArrowLeft'?-1:1)+arr.length)%arr.length];next.focus();setTab(next.dataset.atlasTab)});
 });
 function random(){let candidates=order.filter(v=>!visited.includes(v)&&v!==active);if(!candidates.length)candidates=order.filter(v=>v!==active);journey=null;paintJourney();select(candidates[Math.floor(Math.random()*candidates.length)]);}
 $('#atlasSurprise').addEventListener('click',random);$('#atlasHub').addEventListener('click',random);
 $('#atlasClear').addEventListener('click',()=>{visited=[];store();updateVisited();journey=null;paintJourney();select('math',false);$('#atlasHoverInfo').textContent='探索足迹已重置';});
 $('#atlasNext').addEventListener('click',()=>{if(journey){nextJourney();return}select(order[(order.indexOf(active)+1)%order.length])});
 function drawLines(){
  const cosmos=$('#atlasCosmos'),svg=$('#atlasLines');if(!cosmos||!svg)return;
  const b=cosmos.getBoundingClientRect();if(b.width<=0||b.height<=0)return;
  svg.setAttribute('viewBox',`0 0 ${b.width} ${b.height}`);svg.replaceChildren();
  const center=$('#atlasHub').getBoundingClientRect();const origin=[center.left+center.width/2-b.left,center.top+center.height/2-b.top];
  const centers=Object.fromEntries(nodes.map(n=>{const x=n.getBoundingClientRect();return[n.dataset.atlasPoint,[x.left+x.width/2-b.left,x.top+x.height/2-b.top]]}));
  const line=(start,end,cl)=>{let l=document.createElementNS('http://www.w3.org/2000/svg','line');l.setAttribute('x1',start[0]);l.setAttribute('y1',start[1]);l.setAttribute('x2',end[0]);l.setAttribute('y2',end[1]);l.setAttribute('class',cl);svg.append(l)};
  order.forEach(id=>line(origin,centers[id],'spoke'));data[active].links.forEach(id=>line(centers[active],centers[id],'connection'));line(origin,centers[active],'main-beam');
 }
 let resizeHandle;addEventListener('resize',()=>{cancelAnimationFrame(resizeHandle);resizeHandle=requestAnimationFrame(drawLines)});
 if('ResizeObserver' in window){const ob=new ResizeObserver(drawLines);ob.observe($('#atlasCosmos'))}
 function paintJourney(){
  const panel=$('#journeyActive');panel.hidden=!journey;
  $$('[data-journey]').forEach(x=>x.classList.toggle('is-active',journey===x.dataset.journey));
  if(!journey){$('#atlasNext').innerHTML='探索下一领域 <span>↗</span>';return}
  const r=routes[journey];$('#journeyActiveTitle').textContent=r.title;$('#journeyActiveDesc').textContent=r.desc;
  $('#journeySteps').replaceChildren();r.steps.forEach((id,i)=>{let b=make('button','journey-step'+(i===step?' current':i<step?' done':''),String(i+1).padStart(2,'0')+' '+data[id].title);b.addEventListener('click',()=>{step=i;select(id)});$('#journeySteps').append(b)});
  $('#journeyPrev').disabled=step===0;
  $('#journeyNext').textContent=step===r.steps.length-1?'完成路线 ✓':'下一站 →';
  $('#atlasNext').innerHTML=step===r.steps.length-1?'完成当前路线 <span>✓</span>':'沿路线下一站 <span>→</span>';
 }
 function startJourney(id){journey=id;step=0;select(routes[id].steps[0]);paintJourney();$('#explorer').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});}
 function nextJourney(){if(!journey)return;let r=routes[journey];if(step===r.steps.length-1){journey=null;paintJourney();$('#atlasHoverInfo').textContent='路线已完成，可以继续自由探索';return}step++;select(r.steps[step]);}
 $$('[data-journey]').forEach(b=>b.addEventListener('click',()=>startJourney(b.dataset.journey)));
 $('#journeyNext').addEventListener('click',nextJourney);$('#journeyPrev').addEventListener('click',()=>{if(!journey||step===0)return;step--;select(routes[journey].steps[step])});
 $('#journeyStop').addEventListener('click',()=>{journey=null;paintJourney()});
 function paintBook(id){const item=books[id];$$('[data-book]').forEach(b=>b.classList.toggle('active',b.dataset.book===id));const area=$('#readingDetail');area.replaceChildren();
  area.append(make('div','overline','READING NOTES / PERSONAL CONNECTION'),make('h3','',item.title),make('p','',item.meta),make('blockquote','atlas-reading-thought',item.thought),make('p','',item.desc));
  let b=make('button','',`去探索关联领域：${item.label} ↗`);b.type='button';b.addEventListener('click',()=>{select(item.ref);$('#explorer').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'})});area.append(b);
 }
 $$('[data-book]').forEach(b=>b.addEventListener('click',()=>paintBook(b.dataset.book)));
 updateVisited();select('math',false);paintJourney();paintBook('slow');
 requestAnimationFrame(drawLines);
})();
