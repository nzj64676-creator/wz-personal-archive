(() => {
  const entry=document.getElementById('aquariumEntry');
  const open=document.getElementById('openAquarium');
  const holder=document.getElementById('aquariumEntryFrame');
  if(!entry||!open||!holder)return;
  let iframe;
  open.addEventListener('click',()=>{
    if(!iframe){
      iframe=document.createElement('iframe');iframe.src='aquarium.html?embedded';iframe.title='理想生活中的互动金鱼缸';iframe.allow='fullscreen';iframe.allowFullscreen=true;
      iframe.addEventListener('load',()=>iframe.contentWindow.postMessage({type:'wz-aquarium-visibility',visible:!holder.hidden},location.origin));
      holder.append(iframe);holder.hidden=false;open.setAttribute('aria-expanded','true');open.textContent='收起鱼缸';
    }else{
      holder.hidden=!holder.hidden;open.setAttribute('aria-expanded',String(!holder.hidden));open.textContent=holder.hidden?'打开互动鱼缸':'收起鱼缸';
      iframe.contentWindow.postMessage({type:'wz-aquarium-visibility',visible:!holder.hidden},location.origin);
    }
  });
  addEventListener('message',event=>{
    if(event.origin!==location.origin||!iframe||event.source!==iframe.contentWindow||event.data?.type!=='wz-aquarium-immersive')return;
    entry.classList.toggle('is-immersive',Boolean(event.data.active));document.body.style.overflow=event.data.active?'hidden':'';
  });
})();
