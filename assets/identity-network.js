(()=>{
 'use strict';
 const area=document.getElementById('identityNetworkMap');if(!area)return;
 const $=s=>document.querySelector(s);
 const info={
  analysis:{n:'01',name:'分析型思考',en:'ANALYTICAL THINKING',glyph:'∑',href:'01-analysis.html',quote:'比起答案，我更想知道它为什么成立。',body:'我习惯拆解问题中的前提、变量和因果链。学习数学时尤其如此：遇到结论，会继续追问条件、推导步骤与可能的例外。',related:['critical','curiosity','future']},
  goal:{n:'02',name:'目标导向',en:'GOAL ORIENTATION',glyph:'◎',href:'02-goal.html',quote:'把一个想法变成今天能执行的下一步。',body:'面对学习、跑步或长期规划，我倾向于设置阶段目标、检验反馈，再调整方法。计划对我而言是行动工具，而不是漂亮的承诺。',related:['drive','future','analysis']},
  autonomy:{n:'03',name:'独立意识',en:'PERSONAL AUTONOMY',glyph:'◇',href:'03-autonomy.html',quote:'愿意合作，也希望保有选择的自由。',body:'我看重个人边界、经济独立和决定自己生活方式的空间。即使在亲密关系里，我也更倾向平等、协商与彼此成长。',related:['critical','future','social']},
  future:{n:'04',name:'未来导向',en:'FUTURE ORIENTATION',glyph:'↗',href:'04-future.html',quote:'今天的选择，也要经得起未来的检视。',body:'我会提前思考职业、经济风险、长期关系与人生转折点，尝试在行动前判断机会成本和选择的可逆性。',related:['goal','autonomy','analysis']},
  curiosity:{n:'05',name:'跨领域探索',en:'INTERDISCIPLINARY EXPLORATION',glyph:'✳',href:'05-curiosity.html',quote:'数学、AI、金融与社会制度，可以放在一张思考地图里。',body:'兴趣不会只停留在一个学科。我从工程数学走向人工智能与数字工具，也会阅读心理学、历史、金融和制度问题。',related:['analysis','critical','social']},
  critical:{n:'06',name:'批判性思维',en:'CRITICAL THINKING',glyph:'⚖',href:'06-critical.html',quote:'不把观点的流行程度，误认成它的正确程度。',body:'我喜欢区分事实、解释和价值判断，关注信息来源、论据质量与推理漏洞。质疑不是为了反对，而是为了形成更独立的判断。',related:['analysis','autonomy','curiosity']},
  drive:{n:'07',name:'自我驱动',en:'SELF-MOTIVATION',glyph:'✦',href:'07-drive.html',quote:'没有人监督，也可以持续学习、训练和复盘。',body:'我倾向主动安排数学学习、力量训练、跑步与阅读，并观察自己的表现，而不是完全依靠外界督促。',related:['goal','future','analysis']},
  social:{n:'08',name:'选择性社交',en:'SELECTIVE SOCIALIZING',glyph:'✧',href:'08-social.html',quote:'可以长时间独处，也想把好的想法分享出去。',body:'我需要独立思考的空间，也有明显的分享欲。相比泛泛的社交，我更喜欢观点明确、彼此真诚的深度交流。',related:['autonomy','curiosity','critical']}
 };
 const nodes=[...area.querySelectorAll('[data-network-node]')],svg=$('#identityNetworkEdges');
 const pos={analysis:[500,88],critical:[780,184],autonomy:[840,448],social:[680,680],curiosity:[320,680],goal:[160,448],drive:[220,184],future:[500,528]};
 const NS='http://www.w3.org/2000/svg';let current='critical';
 const edges=new Map();
 for(const [id,v] of Object.entries(info))for(const dest of v.related){
  const key=[id,dest].sort().join('-');if(edges.has(key))continue;
  const a=pos[id],b=pos[dest],line=document.createElementNS(NS,'line');
  line.setAttribute('x1',String(a[0]));line.setAttribute('y1',String(a[1]));line.setAttribute('x2',String(b[0]));line.setAttribute('y2',String(b[1]));
  line.classList.add('network-line');line.dataset.ends=key;svg.append(line);edges.set(key,line);
 }
 function choose(id){
  const v=info[id];if(!v)return;current=id;
  nodes.forEach(b=>{let nodeId=b.dataset.networkNode;let on=nodeId===id,linked=v.related.includes(nodeId);b.classList.toggle('is-active',on);b.classList.toggle('is-linked',linked);b.classList.toggle('is-muted',!on&&!linked);b.setAttribute('aria-pressed',String(on));});
  for(const [key,line] of edges){const [a,b]=key.split('-');const on=(a===id&&v.related.includes(b))||(b===id&&v.related.includes(a));line.classList.toggle('is-lit',on);line.classList.toggle('is-dim',!on);}
  $('#networkMeta').textContent='IDENTITY / '+v.n;
  $('#networkGlyph').textContent=v.glyph;$('#networkEnglish').textContent=v.en;
  $('#networkDetailTitle').textContent=v.name;$('#networkDetailQuote').textContent=v.quote;
  $('#networkDetailBody').textContent=v.body;
  $('#networkRead').href='dimensions/'+v.href;
  const related=$('#networkRelated');related.replaceChildren();
  v.related.forEach(other=>{const x=info[other],a=document.createElement('a');a.href='dimensions/'+x.href;a.textContent=x.name+' ↗';a.title='进入'+x.name+'完整档案';related.appendChild(a);});
 }
 nodes.forEach(b=>b.addEventListener('click',()=>choose(b.dataset.networkNode)));
 choose('critical');
})();
