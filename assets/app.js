(()=>{
 const menu=document.querySelector('#menuButton'),nav=document.querySelector('#mobileNav');
 menu?.addEventListener('click',()=>{let show=nav.hidden;nav.hidden=!show;menu.setAttribute('aria-expanded',String(show));});
 nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.hidden=true;menu.setAttribute('aria-expanded','false')}));
 let prog=document.querySelector('#readingProgress');function setProgress(){if(prog){const h=document.documentElement;prog.style.width=(Math.max(0,window.scrollY)/(h.scrollHeight-innerHeight||1)*100)+'%'}};addEventListener('scroll',setProgress,{passive:true});setProgress();
 if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}}),{threshold:.07});document.querySelectorAll('.reveal').forEach(x=>io.observe(x));}else document.querySelectorAll('.reveal').forEach(x=>x.classList.add('visible'));
 const getSeen=()=>{try{const value=JSON.parse(localStorage.getItem('wz_seen_v5')||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[]}catch(e){return []}};
 const markSeen=(slug)=>{let data=getSeen();if(!data.includes(slug)){data.push(slug);try{localStorage.setItem('wz_seen_v5',JSON.stringify(data))}catch(e){}}};
 let dimension=document.body.dataset.dimension;if(dimension)markSeen(dimension);
 document.querySelectorAll('[data-seen-count]').forEach(el=>el.textContent=String(getSeen().length).padStart(2,'0'));
 document.querySelectorAll('[data-slug]').forEach(el=>{if(getSeen().includes(el.dataset.slug)){let mark=el.querySelector('.seen-slot');if(mark)mark.textContent='✓ 已探索'}});
 let filterBtns=document.querySelectorAll('[data-filter]'),search=document.querySelector('#searchDimension'),cards=document.querySelectorAll('.archive-card');
 function filter(){let active=document.querySelector('[data-filter].selected')?.dataset.filter||'全部',q=(search?.value||'').trim().toLowerCase(),found=0;cards.forEach(c=>{let matched=(active==='全部'||c.dataset.category===active)&&(!q||c.innerText.toLowerCase().includes(q));c.hidden=!matched;if(matched)found++});let n=document.querySelector('#resultsCount');if(n)n.textContent=String(found).padStart(2,'0');let empty=document.querySelector('#emptyState');if(empty)empty.style.display=found?'none':'block'}
 filterBtns.forEach(b=>b.addEventListener('click',()=>{filterBtns.forEach(x=>x.classList.remove('selected'));b.classList.add('selected');filter()}));search?.addEventListener('input',filter);filter();
 const random=document.querySelector('#randomProfile');random?.addEventListener('click',()=>{let links=Array.from(cards).filter(e=>!e.hidden),unseen=links.filter(e=>!getSeen().includes(e.dataset.slug));let bag=unseen.length?unseen:links;if(bag.length){let next=bag[Math.floor(Math.random()*bag.length)];location.href=next.href}});
 let nodes=[...document.querySelectorAll('[data-atlas]')],info=document.querySelector('#atlasInfo');if(nodes.length&&info){let data=JSON.parse(document.querySelector('#atlasData').textContent);function choose(id){nodes.forEach(n=>{let active=n.dataset.atlas===id;n.classList.toggle('active',active);n.setAttribute('aria-pressed',String(active))});let x=data[id];info.innerHTML='<div class="meta">'+x.en+'</div><div class="symbol">'+x.icon+'</div><h2>'+x.title+'</h2><p>'+x.desc+'</p><div class="source">'+x.detail+'</div>';}nodes.forEach(n=>n.addEventListener('click',()=>choose(n.dataset.atlas)));choose('math');}
 let noteBtns=[...document.querySelectorAll('[data-note]')];noteBtns.forEach(b=>b.addEventListener('click',()=>{noteBtns.forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',String(x===b))});document.querySelectorAll('[data-note-pane]').forEach(p=>p.classList.toggle('active',p.dataset.notePane===b.dataset.note))}));
 const shell=document.querySelector('#dialogShell');if(shell){let ds=JSON.parse(document.querySelector('#dialogData').textContent),idx=0,picked={};let count=document.querySelector('#dialogCount'),title=document.querySelector('#dialogQuestion'),options=document.querySelector('#dialogOptions'),result=document.querySelector('#dialogResult'),next=document.querySelector('#dialogNext'),back=document.querySelector('#dialogBack'),track=document.querySelector('#dialogTrack');function paint(){let q=ds[idx];count.textContent='QUESTION '+String(idx+1).padStart(2,'0')+' / '+String(ds.length).padStart(2,'0');title.textContent=q.q;options.innerHTML='';q.options.forEach((o,i)=>{let b=document.createElement('button');b.type='button';b.className='choice-btn'+(picked[idx]===i?' active':'');b.textContent=String.fromCharCode(65+i)+'  /  '+o;b.onclick=()=>{picked[idx]=i;paint()};options.append(b)});result.classList.toggle('show',picked[idx]!==undefined);result.querySelector('p').textContent=q.mine;next.disabled=picked[idx]===undefined;next.textContent=idx===ds.length-1?'重新开始 ↻':'下一问 →';back.disabled=idx===0;track.innerHTML=ds.map((_,i)=>'<i class="'+(i<=idx?'past':'')+'"></i>').join('')}next.addEventListener('click',()=>{if(idx===ds.length-1){idx=0;picked={}}else idx++;paint()});back.addEventListener('click',()=>{idx=Math.max(0,idx-1);paint()});paint();}

 // Contact actions shared by footer and contact page. Works on local files and hosted HTTPS.
 const copyValue=async(value)=>{
   try { if (navigator.clipboard && window.isSecureContext) {await navigator.clipboard.writeText(value);return true;} }
   catch(e){}
   const el=document.createElement('textarea');
   el.value=value;el.setAttribute('readonly','');el.style.cssText='position:fixed;opacity:0;left:-9999px;top:0';
   document.body.appendChild(el);el.select();let ok=false;
   try{ok=document.execCommand('copy')}catch(e){}
   el.remove();return ok;
 };
 document.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',async()=>{
   const label=btn.dataset.copyLabel||'复制';
   const copied=await copyValue(btn.dataset.copy);
   btn.textContent=copied?'已复制 ✓':'复制失败，请手动选择';
   btn.setAttribute('aria-label',copied?label+'已复制':label+'失败');
 }));
 document.querySelector('#copyIntro')?.addEventListener('click',async e=>{let txt='王振 / WZ. · INTJ｜理性求知，自由生长。热爱数学、阅读与运动；关注技术、社会与人的行为。';try{await navigator.clipboard.writeText(txt);e.target.textContent='已复制 ✓'}catch(err){let t=document.createElement('textarea');t.value=txt;document.body.append(t);t.select();document.execCommand('copy');t.remove();e.target.textContent='已复制 ✓'}});
})();
