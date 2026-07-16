(function(){
  'use strict';

  let overlay = null;

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[char]));
  }

  function ensureOverlay(){
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'author-reviewer-overlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML = `
      <section class="author-reviewer-dialog" role="dialog" aria-modal="true" aria-labelledby="authorReviewerName">
        <button class="author-reviewer-close" type="button" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
        <div class="author-reviewer-head">
          <div class="author-reviewer-avatar" id="authorReviewerAvatar"></div>
          <div class="author-reviewer-info">
            <h3 id="authorReviewerName"></h3>
            <div class="author-reviewer-stars" id="authorReviewerStars"></div>
          </div>
        </div>
        <p class="author-reviewer-text" id="authorReviewerText"></p>
        <button class="author-reviewer-done" type="button">Закрыть</button>
      </section>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function close(){
    if(!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
  }

  function open(item){
    const root = ensureOverlay();
    const name = item.querySelector('.author-review-top strong')?.textContent?.trim() || 'Пользователь';
    const text = item.querySelector('.author-review-body > p')?.textContent?.trim() || '';
    const stars = item.querySelectorAll('.author-review-stars .fa-solid.fa-star').length;
    const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part.charAt(0)).join('').toUpperCase() || 'П';

    root.querySelector('#authorReviewerAvatar').textContent = initials;
    root.querySelector('#authorReviewerName').textContent = name;
    root.querySelector('#authorReviewerStars').innerHTML = Array.from({length:5},(_,index)=>
      `<i class="fa-${index < stars ? 'solid' : 'regular'} fa-star"></i>`
    ).join('');
    root.querySelector('#authorReviewerText').innerHTML = escapeHtml(text);
    root.classList.add('open');
    root.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    root.querySelector('.author-reviewer-close')?.focus();
  }

  document.addEventListener('click', event => {
    const item = event.target.closest('.author-review-item');
    if(item && !event.target.closest('.author-review-own-actions, button, textarea, input')){
      event.preventDefault();
      event.stopPropagation();
      open(item);
      return;
    }
    if(event.target.closest('.author-reviewer-close, .author-reviewer-done')){
      close();
      return;
    }
    if(overlay && event.target === overlay) close();
  }, true);

  document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && overlay?.classList.contains('open')) close();
  });
})();
