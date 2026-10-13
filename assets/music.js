(()=>{
'use strict';
/* Three user-supplied local MP3s. No third-party services and no blocking splash screen. */
const assetBase = new URL('.',document.currentScript.src);
const tracks=[
  {title:'夜的钢琴曲五',artist:'Rorik · 钢琴演奏版',file:'music/night-piano-5.mp3'},
  {title:'梦中的婚礼 · 钢琴曲',artist:'LucySPA · 钢琴演奏版',file:'music/dream-wedding.mp3'},
  {title:'Merry Christmas, Mr. Lawrence',artist:'Chihiro Todo · 钢琴演奏版',file:'music/merry-christmas-mr-lawrence.mp3'}
].map(t=>({...t,src:new URL(t.file,assetBase).href}));
const STORE='wz_local_piano_playlist_v107',VOLUME='wz_music_volume_v1';
const get=(kind,key)=>{try{return window[kind].getItem(key)}catch{return null}};
const put=(kind,key,value)=>{try{window[kind].setItem(key,value)}catch{}};
let previous={};try{const saved=JSON.parse(get('sessionStorage',STORE)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))previous=saved}catch{}
let index=Number.isInteger(previous.index)&&previous.index>=0&&previous.index<tracks.length?previous.index:0;
const savedVolume=get('localStorage',VOLUME);let volume=savedVolume===null?.4:Number(savedVolume);volume=Number.isFinite(volume)?Math.min(1,Math.max(0,volume)):.4;
const audio=document.createElement('audio');audio.id='wzPianoAudio';audio.preload='metadata';audio.volume=volume;audio.loop=false;audio.style.display='none';document.body.appendChild(audio);
let restoreTime=Number(previous.time)||0,restorePlay=previous.playing===true,hasLoaded=false;
let statusMessage='点 ♪ 播放 · 三首歌曲循环',lastPersist=0,seekRequest=0;
const fullTrackUrls=new Map();
const dock=document.createElement('aside');
dock.className='wz-audio-dock';dock.setAttribute('aria-label','网站离线三首钢琴曲播放器');
dock.innerHTML=`
 <div class="wz-audio-controls">
  <button type="button" class="wz-audio-skip" id="wzMusicPrev" aria-label="上一首" title="上一首">‹</button>
  <button type="button" class="wz-audio-toggle" id="wzMusicToggle" aria-label="播放音乐" aria-pressed="false" title="播放或暂停">♫</button>
  <button type="button" class="wz-audio-skip" id="wzMusicNext" aria-label="下一首" title="下一首">›</button>
 </div>
 <div class="wz-audio-details"><span class="wz-audio-kicker" id="wzMusicTrackNo">01 / ${String(tracks.length).padStart(2,'0')} · 本地音乐</span><span class="wz-audio-title" id="wzMusicTitle"></span><span class="wz-audio-state" id="wzMusicStatus" role="status" aria-live="polite"></span></div>
 <div class="wz-audio-bars" aria-hidden="true"><b></b><b></b><b></b><b></b></div>
 <label class="wz-audio-volume-label" for="wzMusicVolume">音乐音量</label><input id="wzMusicVolume" class="wz-audio-volume" type="range" min="0" max="1" step="0.05" value="${volume}" aria-label="音乐音量">
 <button type="button" class="wz-audio-list" id="wzMusicList" aria-expanded="false" aria-label="展开歌曲列表" title="歌曲列表">☷</button>
 <section class="wz-playlist" id="wzPlaylist" aria-label="本地钢琴曲播放列表" hidden>
  <div class="wz-playlist-head">WZ. / PIANO PLAYLIST · ${tracks.length} TRACKS</div>
  ${tracks.map((t,i)=>`<button type="button" data-track="${i}" title="${t.title}"><span>${String(i+1).padStart(2,'0')} · ${t.title}</span><small>${t.artist.split(' · ')[0]}</small></button>`).join('')}
  <div class="wz-piano-timeline">
   <input id="wzMusicSeek" type="range" min="0" max="100" value="0" step="0.1" aria-label="歌曲播放进度">
   <div class="wz-piano-times"><span id="wzMusicCurrent">0:00</span><span id="wzMusicDuration">--:--</span></div>
  </div>
  <small class="wz-playlist-foot">你提供的 MP3 · 无需联网 · 3 首顺序循环，第三首结束后自动返回第一首。浏览器首次播放需要点击 ♪。</small>
 </section>`;
document.body.appendChild(dock);
const $=selector=>dock.querySelector(selector);
const toggle=$('#wzMusicToggle'),list=$('#wzMusicList'),playlist=$('#wzPlaylist'),title=$('#wzMusicTitle'),counter=$('#wzMusicTrackNo'),status=$('#wzMusicStatus'),volumeControl=$('#wzMusicVolume'),seek=$('#wzMusicSeek');
const clock=seconds=>{if(!Number.isFinite(seconds))return '--:--';let s=Math.max(0,Math.floor(seconds));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const storeState=()=>put('sessionStorage',STORE,JSON.stringify({index,time:Number.isFinite(audio.currentTime)?audio.currentTime:0,playing:!audio.paused}));
function render(){
 title.textContent=tracks[index].title;
 title.title=tracks[index].title+' · '+tracks[index].artist;
 counter.textContent=String(index+1).padStart(2,'0')+' / '+String(tracks.length).padStart(2,'0')+' · 本地音乐';
 dock.classList.toggle('is-playing',!audio.paused&&!audio.ended);
 toggle.textContent=audio.paused?'♫':'Ⅱ';
 toggle.setAttribute('aria-label',audio.paused?'播放音乐':'暂停音乐');
 toggle.setAttribute('aria-pressed',String(!audio.paused));
 playlist.querySelectorAll('[data-track]').forEach(b=>{const active=Number(b.dataset.track)===index;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'true':'false')});
 status.textContent=statusMessage;
 $('#wzMusicCurrent').textContent=clock(audio.currentTime);
 $('#wzMusicDuration').textContent=clock(audio.duration);
 seek.max=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:100;
 seek.value=Number.isFinite(audio.currentTime)?audio.currentTime:0;
}
function updateStatus(message){statusMessage=message;render()}
function loadTrack({seekTo=0,play=false}={}){
 hasLoaded=false;restoreTime=seekTo;
 audio.pause();audio.src=tracks[index].src;audio.load();
 // When switching after a click, play() is invoked in the actual event handler;
 // when restoring after navigation, a browser may require another click.
 if(play)start(); else updateStatus('点 ♪ 播放 · 三首歌曲循环');
}
async function start(){
 try{await audio.play();updateStatus('正在播放 · '+tracks[index].artist);storeState()}
 catch(err){updateStatus('浏览器要求先点击播放 ♪');storeState()}
}
function switchTo(nextIndex,play=true){
 seekRequest++;
 index=(nextIndex+tracks.length)%tracks.length;
 restoreTime=0;
 loadTrack({seekTo:0,play});storeState();
}
function showList(){const open=playlist.hidden;playlist.hidden=!open;list.setAttribute('aria-expanded',String(open));}
function timeUpdate(){
 $('#wzMusicCurrent').textContent=clock(audio.currentTime);
 if(!seek.matches(':active'))seek.value=Number.isFinite(audio.currentTime)?audio.currentTime:0;
 const now=Date.now();if(now-lastPersist>1200){lastPersist=now;storeState()}
}
// Seek before resuming if the listener navigated to another page.
audio.addEventListener('loadedmetadata',()=>{
 if(!hasLoaded){hasLoaded=true;
  const target=restoreTime;
  if(Number.isFinite(target)&&target>0&&audio.duration>target){try{audio.currentTime=target}catch{}}
  restoreTime=0;
 }
 render();
 if(restorePlay){restorePlay=false;start()}
});
audio.addEventListener('timeupdate',timeUpdate);
audio.addEventListener('play',()=>{statusMessage='正在播放 · '+tracks[index].artist;render();storeState()});
audio.addEventListener('pause',()=>{if(!audio.ended){statusMessage='已暂停 · 点击 ♪ 继续';render();storeState()}});
audio.addEventListener('ended',()=>switchTo(index+1,true));
audio.addEventListener('error',()=>updateStatus('音频加载失败，请确认 assets/music 文件齐全'));
toggle.addEventListener('click',()=>{if(audio.paused)start();else{audio.pause();updateStatus('已暂停 · 点击 ♪ 继续')}});
$('#wzMusicPrev').addEventListener('click',()=>switchTo(index-1,true));
$('#wzMusicNext').addEventListener('click',()=>switchTo(index+1,true));
list.addEventListener('click',showList);
playlist.querySelectorAll('[data-track]').forEach(b=>b.addEventListener('click',()=>switchTo(Number(b.dataset.track),true)));
volumeControl.addEventListener('input',()=>{audio.volume=Number(volumeControl.value);put('localStorage',VOLUME,volumeControl.value)});
async function seekTo(seconds){
 if(!Number.isFinite(audio.duration))return;
 const target=Math.max(0,Math.min(audio.duration,seconds)),track=index,request=++seekRequest;
 const canSeek=target===0||(audio.seekable.length&&audio.seekable.end(audio.seekable.length-1)>=target);
 if(canSeek){audio.currentTime=target;timeUpdate();storeState();return;}
 // Some static hosts stream MP3s without advertising byte-range support. A
 // complete same-origin Blob remains seekable even on those hosts.
 updateStatus('正在载入音频，稍后跳转到 '+clock(target));
 try{
  if(!fullTrackUrls.has(track))fullTrackUrls.set(track,fetch(tracks[track].src).then(response=>{
   if(!response.ok)throw new Error('Audio request failed');return response.blob();
  }).then(blob=>URL.createObjectURL(blob)).catch(error=>{fullTrackUrls.delete(track);throw error}));
  const url=await fullTrackUrls.get(track);
  if(request!==seekRequest||track!==index)return;
  const resume=!audio.paused;
  audio.pause();hasLoaded=false;restoreTime=target;restorePlay=resume;
  audio.src=url;audio.load();
 }catch(error){if(request===seekRequest&&track===index)updateStatus('暂时无法跳转，请稍后重试');}
}
seek.addEventListener('input',()=>seekTo(Number(seek.value)));
window.addEventListener('pagehide',storeState);
// The website always loads immediately. Sound starts only on an explicit user gesture
// or an allowed recovery following a previously-initiated playback across navigation.
loadTrack({seekTo:restoreTime,play:false});
})();
