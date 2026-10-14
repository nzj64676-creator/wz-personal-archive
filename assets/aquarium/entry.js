(() => {
  'use strict';
  const modal = document.getElementById('idealAquariumDialog');
  const mount = document.getElementById('aquariumEntryFrame');
  const close = document.getElementById('idealAquariumClose');
  const triggers = [document.getElementById('idealDeskAquarium'), document.getElementById('openAquarium')].filter(Boolean);
  if (!modal || !mount || !close || !triggers.length) return;
  let iframe = null;
  let iframeLoaded = false;
  let focusBeforeOpen = null;
  let immersive = false;

  const notify = visible => {
    iframe?.contentWindow?.postMessage({ type: 'wz-aquarium-visibility', visible }, location.origin);
  };
  const onEmbeddedKeydown = event => {
    if (event.key !== 'Escape' || !modal.open) return;
    const doc = iframe.contentDocument;
    // Let the embedded atlas's native dialog consume Escape first.
    if (doc.getElementById('fishAtlas')?.open) return;
    event.preventDefault();
    // Feeding, inspection and observation mode each keep their own Escape action.
    if (['feedFish', 'detailView', 'immersiveButton'].some(id => doc.getElementById(id)?.getAttribute('aria-pressed') === 'true')) return;
    modal.close();
  };
  const open = () => {
    if (modal.open) return;
    focusBeforeOpen = document.activeElement;
    modal.classList.toggle('is-immersive', immersive);
    modal.showModal();
    document.body.classList.add('ideal-aquarium-dialog-open');
    triggers.forEach(button => button.setAttribute('aria-expanded', 'true'));
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframeLoaded = false;
      const embeddedFrame = iframe;
      iframe.title = '互动三维金鱼缸';
      iframe.allow = 'fullscreen';
      iframe.addEventListener('load', () => {
        if (iframe !== embeddedFrame) return;
        iframeLoaded = true;
        iframe.contentDocument.addEventListener('keydown', onEmbeddedKeydown, true);
        notify(modal.open);
      });
      iframe.src = 'aquarium.html?embedded';
      mount.appendChild(iframe);
    } else notify(true);
    close.focus();
  };
  triggers.forEach(button => {
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', open);
  });
  close.addEventListener('click', () => modal.close());
  modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    const rect = modal.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close();
  });
  modal.addEventListener('close', () => {
    // Use the existing control to leave observation mode before the iframe sleeps.
    const observation = iframe?.contentDocument?.getElementById('immersiveButton');
    if (observation?.getAttribute('aria-pressed') === 'true') observation.click();
    immersive = false;
    document.body.classList.remove('ideal-aquarium-dialog-open');
    modal.classList.remove('is-immersive');
    triggers.forEach(button => button.setAttribute('aria-expanded', 'false'));
    notify(false);
    // A document that initialized at zero size must not be reused on the next open.
    if (iframe && !iframeLoaded) {
      iframe.remove();
      iframe = null;
    }
    if (focusBeforeOpen?.isConnected) focusBeforeOpen.focus({ preventScroll: true });
  });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || !iframe || event.source !== iframe.contentWindow || event.data?.type !== 'wz-aquarium-immersive') return;
    immersive = modal.open && Boolean(event.data.active);
    modal.classList.toggle('is-immersive', immersive);
  });
})();
