(()=>{
'use strict';
const data=window.WZ_READING_LIBRARY;
if(!data?.books)return;
const $=s=>document.querySelector(s);
const books=data.books;
const total=books.reduce((n,b)=>n+b.parts.reduce((k,p)=>k+p.chapters.reduce((c,ch)=>c+ch.points.length,0),0),0);
const KEY='wz_reading_knowledge_progress_v1';
let mastered=[];
try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(v))mastered=v;}catch{}
let state={book:null,part:null,chapter:null,point:null,tab:'mechanism'};
let openPart=null;
const NOTE_KEY='wz_reading_personal_notes_v1';let personalNotes={};try{const obj=JSON.parse(localStorage.getItem(NOTE_KEY)||'{}');if(obj&&typeof obj==='object')personalNotes=obj}catch{}
const bridges={
 'thinking/p1/c5/k1':['crowd/p2/c3/k1','influence/p1/c1/k1'],
 'thinking/p2/c3/k1':['crowd/p2/c2/k1'],
 'thinking/p1/c9/k2':['influence/p1/c6/k1'],
 'crowd/p2/c3/k1':['thinking/p1/c5/k1','influence/p1/c4/k1'],
 'crowd/p1/c4/k2':['influence/p1/c5/k1'],
 'influence/p1/c4/k1':['crowd/p2/c3/k1'],
 'influence/p1/c5/k1':['crowd/p1/c4/k2'],
 'influence/p1/c6/k1':['thinking/p1/c9/k2']
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=(b,p,c,k)=>[b,p,c,k].join('/');
const sourceBooks=books.map((b,i)=>({...b,index:i+1,count:b.parts.reduce((n,p)=>n+p.chapters.length,0)}));
function save(){try{localStorage.setItem(KEY,JSON.stringify(mastered))}catch{}}
function current(){
 const book=books.find(x=>x.id===state.book);
 const part=book?.parts.find(x=>x.id===state.part);
 const chapter=part?.chapters.find(x=>x.id===state.chapter);
 const point=chapter?.points.find(x=>x.id===state.point);
 return {book,part,chapter,point};
}
function updateHash(){const p=new URLSearchParams();['book','part','chapter','point'].forEach(k=>{if(state[k])p.set(k,state[k])});if(state.point&&state.tab)p.set('tab',state.tab);const target=p.toString();const hash=target?'#'+target:'';if(location.hash!==hash){try{history.pushState(null,'',location.pathname+location.search+hash)}catch{location.hash=hash}}render()}
function go(next,reset=true){state={book:null,part:null,chapter:null,point:null,tab:'mechanism',...next};if(state.book&&state.part)openPart=state.part;updateHash();if(reset)window.scrollTo({top:0,behavior:'auto'});}
function parseHash(){const p=new URLSearchParams(location.hash.slice(1));state={book:p.get('book'),part:p.get('part'),chapter:p.get('chapter'),point:p.get('point'),tab:p.get('tab')||'mechanism'};const {book,part,chapter,point}=current();if(!book)state={book:null,part:null,chapter:null,point:null,tab:'mechanism'};else if(!part)Object.assign(state,{part:null,chapter:null,point:null});else if(!chapter)Object.assign(state,{chapter:null,point:null});else if(!point)state.point=null;openPart=part?.id||openPart;render();}
const step=(name,val,change)=>`<button type="button" class="library-crumb" ${change?`data-route="${esc(val)}"`:''}>${esc(name)}</button>`;
function crumbs(){const{book,part,chapter,point}=current(),parts=[];parts.push(step('我的三本书','books',!!book));if(book)parts.push(step(book.title,'book:'+book.id,!!part));if(part)parts.push(step(part.title,'part:'+part.id,!!chapter));if(chapter)parts.push(step(chapter.title,'chapter:'+chapter.id,!!point));if(point)parts.push(step(point.name,null,false));$('#libraryBreadcrumb').innerHTML=parts.join('<span class="library-crumb-divider">/</span>')}
function stats(book){let count=0,done=0;book.parts.forEach(p=>p.chapters.forEach(ch=>ch.points.forEach(pt=>{count++;if(mastered.includes(key(book.id,p.id,ch.id,pt.id)))done++})));return {done,count}}
function side(){const {book}=current();$('#librarySideBooks').innerHTML=sourceBooks.map(b=>{
 const s=stats(b),sel=b.id===book?.id;
 return `<button type="button" class="library-side-book ${sel?'active':''}" data-route="book:${esc(b.id)}" style="--baccent:${b.accent}"><span class="library-side-number">0${b.index}</span><span><strong>${esc(b.title)}</strong><small>${s.done}/${s.count} 个知识点</small></span><b>↗</b></button>`}).join('');
 $('#libraryTotalProgress').textContent=mastered.length+' / '+total+' 已掌握';$('#libraryProgressFill').style.width=(mastered.length/total*100)+'%';
 $('#libraryHome').classList.toggle('active',!book);
}
function bookCard(b){let s=stats(b);return `<button class="library-book-card" type="button" data-route="book:${b.id}" style="--baccent:${b.accent}">
 <div class="library-book-cover"><span class="library-cover-top">WZ / READING FILE ${String(b.index).padStart(2,'0')}</span><span class="library-cover-letter">${b.initial}</span><span class="library-cover-title">${esc(b.title)}</span><span class="library-cover-en">${esc(b.english)}</span><span class="library-cover-bottom">PERSONAL KNOWLEDGE ARCHIVE</span></div>
 <div class="library-book-meta"><div><span>0${b.index} · ${esc(b.focus)}</span><h3>${esc(b.title)}</h3><p>${esc(b.intro)}</p></div><span class="library-book-next">↗</span></div>
 <div class="library-book-counter"><span>${esc(b.structure)}</span><b>${s.done} / ${s.count} 已掌握</b></div></button>`}
function shelf(){return `<div class="library-current-label">LIBRARY / 01</div><h2 class="library-large-heading">选择一本书，<br><em>开始知识探索。</em></h2><p class="library-body-lead">三本书，三个入口：理解自己的判断，观察群体的行动，识别说服如何发生。每个章节都可以继续深入知识点与现实案例。</p><div class="library-book-grid">${sourceBooks.map(bookCard).join('')}</div><div class="library-mini-guide"><span>HOW TO EXPLORE</span><p>点书籍 → 点章节 → 点知识点 → 再点运行机制、案例或反向检验。已掌握的内容会保存在当前浏览器。</p></div>`}
function directory(b){if(!openPart)openPart=b.parts[0].id;const st=stats(b);return `<div class="library-book-feature" style="--baccent:${b.accent}"><div><div class="library-current-label">${esc(b.english)} / CONTENTS</div><h2>${esc(b.title)}</h2><span>${esc(b.author)} · ${esc(b.focus)}</span><p>${esc(b.intro)}</p><div class="library-book-stat">${b.parts.length} 个部分 · ${st.count/2} 章 · ${st.count} 个知识点</div></div><div class="library-book-feature-glyph">${b.initial}</div></div>
 <div class="library-section-top"><div><h3>选择目录章节</h3><p>目录采用参考版本的篇章结构；知识点与例子为本站重新整理。</p></div><span>${esc(b.structure)}</span></div>
 <div class="library-directory">${b.parts.map(p=>{
 const expanded=(openPart===p.id)||(!openPart&&p===b.parts[0]);return `<div class="library-part ${expanded?'expanded':''}"><button type="button" class="library-part-toggle" data-expand="${p.id}"><span class="library-part-icon">${expanded?'−':'+'}</span><span>${esc(p.title)}</span><small>${p.chapters.length} 章</small><span class="library-part-caret">⌄</span></button><div class="library-chapters" ${expanded?'':'hidden'}>${p.chapters.map((c,i)=>`<button type="button" class="library-chapter-row" data-route="chapter:${p.id}/${c.id}"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(c.title)}</strong><small>${c.points.length} 个知识点</small><b>↗</b></button>`).join('')}</div></div>`}).join('')}</div>
 <div class="library-translation-note"><b>书目说明</b><p>${esc(b.edition)} 各章要点以本站主题笔记的形式呈现。</p><a href="${esc(b.source)}" target="_blank" rel="noopener noreferrer">查看参考目录来源 ↗</a></div>`}
function chapterView(b,p,c){return `<div class="library-current-label">CHAPTER / ${esc(p.title)}</div><h2 class="library-large-heading library-chapter-heading">${esc(c.title)}</h2><p class="library-body-lead">这里不复述原文，而是把这一章拆成适合反复探索的核心概念。点击下面任意知识点，还能进入更深一层：原理、场景和判断方法。</p>
 <div class="library-level-chain"><span>书籍：${esc(b.title)}</span><i>→</i><span>章节：${esc(c.title)}</span><i>→</i><span>知识点</span></div>
 <div class="library-knowledge-grid">${c.points.map((pt,i)=>{
 const learned=mastered.includes(key(b.id,p.id,c.id,pt.id));return `<button class="library-knowledge-card" data-route="point:${pt.id}" type="button"><span class="library-knowledge-num">POINT / 0${i+1} ${learned?'<b class="library-done-indicator">✓ 已掌握</b>':''}</span><h3>${esc(pt.name)}</h3><p>${esc(pt.summary)}</p><span class="library-knowledge-more">展开知识点的三层结构 <b>↗</b></span></button>`}).join('')}</div>
 <div class="library-next-actions"><button type="button" data-route="part:${p.id}">← 返回本部分目录</button><button type="button" data-route="book:${b.id}">查看整本书目录 ↗</button></div>`}
function pointView(b,p,c,pt){const id=key(b.id,p.id,c.id,pt.id),isMaster=mastered.includes(id);const blocks=[{id:'mechanism',sym:'◇',title:'运行机制',subtitle:'它为什么会发生',body:pt.mechanism,tag:'UNDERSTAND THE WHY'},{id:'example',sym:'↗',title:'现实案例',subtitle:'它如何出现在生活中',body:pt.example,tag:'SEE THE PATTERN'},{id:'test',sym:'?',title:'反向检验',subtitle:'怎样避免把它用错',body:pt.test,tag:'CHALLENGE THE IDEA'}];let tab=blocks.find(x=>x.id===state.tab)||blocks[0];
 const related=c.points.filter(x=>x.id!==pt.id);const bridgeItems=(bridges[id]||[]).map(v=>{const [bid,pid,cid,kid]=v.split('/');const bb=books.find(x=>x.id===bid),pp=bb?.parts.find(x=>x.id===pid),cc=pp?.chapters.find(x=>x.id===cid),kk=cc?.points.find(x=>x.id===kid);return bb&&kk?{book:bb,point:kk,ref:v}:null}).filter(Boolean);
 return `<div class="library-current-label">DEEP DIVE / ${esc(b.title)} · ${esc(c.title)}</div><h2 class="library-large-heading library-deep-heading">${esc(pt.name)}<span>.</span></h2><p class="library-deep-summary">${esc(pt.summary)}</p>
 <div class="library-deep-progress"><span>知识拆解</span><div><i>书</i><b>→</b><i>章</i><b>→</b><i>概念</i><b>→</b><strong>${esc(tab.title)}</strong></div></div>
 <div class="library-subtopic-heading"><h3>继续拆分这个知识点</h3><span>SELECT A LAYER</span></div>
 <div class="library-subtopic-tabs" role="tablist" aria-label="知识点的深入拆解">${blocks.map((s,i)=>`<button type="button" role="tab" aria-selected="${s.id===tab.id}" class="library-subtopic-tab ${s.id===tab.id?'active':''}" data-tab="${s.id}"><small>0${i+1} / ${s.tag}</small><strong>${s.sym} ${s.title}</strong><span>${s.subtitle}</span></button>`).join('')}</div>
 <section class="library-deep-answer" aria-live="polite"><span class="library-answer-kicker">${tab.tag}</span><h3>${tab.title} / ${esc(pt.name)}</h3><p>${esc(tab.body)}</p>${tab.id==='test'?`<div class="library-check-block"><b>三个检查步骤</b><ol>${pt.checklist.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`:''}
 <button type="button" class="library-next-layer" data-tab="${blocks[(blocks.indexOf(tab)+1)%blocks.length].id}">${blocks.indexOf(tab)===2?'重新查看运行机制':'继续：'+blocks[(blocks.indexOf(tab)+1)%blocks.length].title} →</button></section>
 <div class="library-learning-row"><button type="button" class="library-master-btn ${isMaster?'is-mastered':''}" data-master="${esc(id)}">${isMaster?'✓ 已掌握 · 点击取消':'○ 标记为已掌握'}</button><span>进度仅保存在当前浏览器</span></div>
 <div class="library-personal-note"><div><span>MY OWN THOUGHTS / 个人批注</span><h3>关于这个概念，我怎么理解？</h3><p>可以写下自己的例子、质疑或新的判断。仅保存在这台设备的浏览器中。</p></div><textarea id="libraryMyNote" rows="3" maxlength="1500" placeholder="我的例子 / 我的反驳 / 下一次观察什么…">${esc(personalNotes[id]||'')}</textarea><div class="library-note-actions"><button type="button" data-save-note="${esc(id)}">保存我的思考 ↗</button><small id="libraryNoteStatus">${personalNotes[id]?'此前已保存':'尚未记录'}</small></div></div>
 ${bridgeItems.length?`<div class="library-related library-bridges"><h3>跨书连接 · 不同视角看同一个问题</h3><p>这些概念来自不同的书，可以互相印证，也可能提醒我们注意另一种解释。</p>${bridgeItems.map(x=>`<button type="button" data-bridge="${esc(x.ref)}">${esc(x.book.title)} · ${esc(x.point.name)} <b>↗</b></button>`).join('')}</div>`:''}
 <div class="library-related"><h3>同一章节 · 继续探索</h3>${related.map(x=>`<button type="button" data-route="point:${x.id}">${esc(x.name)} <b>↗</b></button>`).join('')}<button type="button" data-route="chapter:${p.id}/${c.id}">← 返回章节全部知识点</button></div>`}
function render(){const{book,part,chapter,point}=current();crumbs();side();const level=point?'LEVEL 05 / DEEP DIVE':chapter?'LEVEL 04 / CONCEPTS':book?'LEVEL 02 / CONTENTS':'LEVEL 01 / BOOKS';$('#libraryLevel').textContent=level;
 const content=point?pointView(book,part,chapter,point):chapter?chapterView(book,part,chapter):book?directory(book):shelf();$('#libraryContent').innerHTML=content;}
function route(value){if(value==='books')return go({});if(value.startsWith('book:'))return go({book:value.slice(5)});if(value.startsWith('part:'))return go({book:state.book,part:value.slice(5)});if(value.startsWith('chapter:')){const[p,c]=value.slice(8).split('/');return go({book:state.book,part:p,chapter:c})}if(value.startsWith('point:'))return go({book:state.book,part:state.part,chapter:state.chapter,point:value.slice(6)})}
function search(q){const box=$('#librarySearchResults');q=q.trim().toLowerCase();box.hidden=!q;if(!q)return;const matches=[];
 for(const b of books)for(const p of b.parts)for(const ch of p.chapters){if((b.title+' '+ch.title+' '+p.title).toLowerCase().includes(q))matches.push({book:b,part:p,chapter:ch});for(const pt of ch.points)if((pt.name+' '+pt.summary+' '+pt.example).toLowerCase().includes(q))matches.push({book:b,part:p,chapter:ch,point:pt})}
 box.innerHTML=`<div class="library-search-title">检索结果 · ${matches.length} 项 ${matches.length>36?'（显示前 36 项）':''}</div>${matches.slice(0,36).map(m=>`<button type="button" data-search-route="${[m.book.id,m.part.id,m.chapter.id,m.point?.id||''].join('/')}" class="library-search-item"><span>${esc(m.book.title)} / ${esc(m.chapter.title)}</span><strong>${esc(m.point?.name||m.chapter.title)} ↗</strong></button>`).join('')||'<p class="library-search-empty">没有找到匹配内容。试试“概率”“社会认同”“互惠”。</p>'}`}
$('#libraryHome').addEventListener('click',()=>go({}));
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-route]');if(nav){route(nav.dataset.route);return}
 const expand=e.target.closest('[data-expand]');if(expand){openPart=expand.dataset.expand===openPart?'none':expand.dataset.expand;render();return}
 const tab=e.target.closest('[data-tab]');if(tab){state.tab=tab.dataset.tab;updateHash();return}
 const bridge=e.target.closest('[data-bridge]');if(bridge){const[b,p,c,k]=bridge.dataset.bridge.split('/');go({book:b,part:p,chapter:c,point:k});return}
 const saveNote=e.target.closest('[data-save-note]');if(saveNote){const id=saveNote.dataset.saveNote;const txt=$('#libraryMyNote').value.trim();if(txt)personalNotes[id]=txt;else delete personalNotes[id];try{localStorage.setItem(NOTE_KEY,JSON.stringify(personalNotes))}catch{}$('#libraryNoteStatus').textContent=txt?'✓ 已保存本地批注':'已清空批注';return}
 const mast=e.target.closest('[data-master]');if(mast){const k=mast.dataset.master;if(mastered.includes(k))mastered=mastered.filter(x=>x!==k);else mastered.push(k);save();render();return}
 const searchRoute=e.target.closest('[data-search-route]');if(searchRoute){const[b,p,c,k]=searchRoute.dataset.searchRoute.split('/');$('#librarySearch').value='';$('#librarySearchResults').hidden=true;go({book:b,part:p,chapter:c,point:k||null});return}
});
$('#librarySearch').addEventListener('input',e=>search(e.target.value));
$('#librarySearch').addEventListener('keydown',e=>{if(e.key==='Escape'){e.target.value='';search('');e.target.blur()}else if(e.key==='Enter'){const first=$('#librarySearchResults [data-search-route]');if(first)first.click()}});
document.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(tag)){e.preventDefault();$('#librarySearch').focus()}});
window.addEventListener('popstate',parseHash);window.addEventListener('hashchange',parseHash);
parseHash();
})();
