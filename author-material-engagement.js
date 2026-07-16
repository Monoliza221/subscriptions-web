(function(){
  'use strict';

  const STATE_KEY = 'author_material_engagement_v1';
  const EDIT_WINDOW_MS = 60 * 60 * 1000;
  let overlay = null;
  let activeKey = '';
  let activeCard = null;
  let editingId = '';

  function scopedGet(key){
    try{
      return window.AccountStorage ? window.AccountStorage.getItem(key) : localStorage.getItem(key);
    }catch(_){ return null; }
  }
  function scopedSet(key,value){
    try{
      if(window.AccountStorage) window.AccountStorage.setItem(key,value);
      else localStorage.setItem(key,value);
    }catch(_){ }
  }
  function load(){
    try{
      const parsed = JSON.parse(scopedGet(STATE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    }catch(_){ return {}; }
  }
  function save(data){ scopedSet(STATE_KEY, JSON.stringify(data)); }

  function currentAuthorKey(){
    const handle = document.getElementById('authorProfileHandle')?.textContent?.trim();
    const name = document.getElementById('authorProfileName')?.textContent?.trim();
    return slug(handle || name || 'author');
  }
  function slug(value){
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zа-я0-9]+/gi,'_')
      .replace(/^_+|_+$/g,'') || 'material';
  }
  function titleFromCard(card){
    return card?.querySelector('.author-content-body h3')?.textContent?.trim() || 'Материал автора';
  }
  function keyFromCard(card){
    if(!card) return '';
    if(!card.dataset.authorMaterialEngagementKey){
      card.dataset.authorMaterialEngagementKey = `${currentAuthorKey()}__${slug(titleFromCard(card))}`;
    }
    return card.dataset.authorMaterialEngagementKey;
  }
  function numericText(node){
    return Number((node?.textContent || '').replace(/[^0-9]/g,'')) || 0;
  }
  function stateFor(card){
    const key = keyFromCard(card);
    const data = load();
    if(!data[key]){
      const reactions = card.querySelectorAll('.author-content-reactions span');
      data[key] = {
        baseLikes: numericText(reactions[0]),
        baseComments: numericText(reactions[1]),
        baseShares: numericText(reactions[2]),
        liked:false,
        shared:false,
        comments:[]
      };
      save(data);
    }
    return { key, data, item:data[key] };
  }
  function totalComments(item){ return Number(item.baseComments || 0) + (Array.isArray(item.comments) ? item.comments.length : 0); }
  function totals(item){
    return {
      likes:Number(item.baseLikes || 0) + (item.liked ? 1 : 0),
      comments:totalComments(item),
      shares:Number(item.baseShares || 0) + (item.shared ? 1 : 0)
    };
  }

  function reactionMarkup(item){
    const count = totals(item);
    return `
      <button type="button" class="author-engagement-action author-engagement-like ${item.liked ? 'is-active' : ''}" data-author-engagement-action="like" aria-label="Лайк">
        <i class="${item.liked ? 'fa-solid' : 'fa-regular'} fa-heart"></i><span>${count.likes}</span>
      </button>
      <button type="button" class="author-engagement-action" data-author-engagement-action="comment" aria-label="Комментарии">
        <i class="fa-regular fa-comment"></i><span>${count.comments}</span>
      </button>
      <button type="button" class="author-engagement-action ${item.shared ? 'is-shared' : ''}" data-author-engagement-action="share" aria-label="Поделиться">
        <i class="fa-solid fa-share"></i><span>${count.shares}</span>
      </button>`;
  }

  function reactionSignature(item){
    const count = totals(item);
    return [item.liked ? 1 : 0, item.shared ? 1 : 0, count.likes, count.comments, count.shares].join(':');
  }

  function renderReactionBlock(reactions,item){
    const signature = reactionSignature(item);
    if(reactions.dataset.engagementSignature === signature && reactions.querySelector('[data-author-engagement-action]')) return;
    reactions.innerHTML = reactionMarkup(item);
    reactions.dataset.engagementSignature = signature;
  }

  function decorateCard(card){
    if(!card || !card.querySelector('.author-content-body')) return;
    const {item} = stateFor(card);
    let reactions = card.querySelector('.author-content-reactions');
    if(!reactions){
      const meta = card.querySelector('.author-content-meta');
      if(!meta) return;
      reactions = document.createElement('div');
      reactions.className = 'author-content-reactions author-engagement-reactions';
      meta.appendChild(reactions);
    }
    reactions.classList.add('author-engagement-reactions');
    renderReactionBlock(reactions,item);
  }
  function decorateAll(){
    document.querySelectorAll('#view-author-profile .author-content-card').forEach(decorateCard);
  }
  function syncKey(key){
    const data = load();
    const item = data[key];
    if(!item) return;
    document.querySelectorAll(`#view-author-profile .author-content-card[data-author-material-engagement-key="${CSS.escape(key)}"]`).forEach(card=>{
      const reactions = card.querySelector('.author-content-reactions');
      if(reactions) renderReactionBlock(reactions,item);
    });
    if(activeKey === key && overlay?.classList.contains('is-open')){
      const badge = overlay.querySelector('#authorEngagementCommentsCount');
      if(badge) badge.textContent = totalComments(item);
    }
  }

  function toggleLike(card){
    const {key,data,item} = stateFor(card);
    item.liked = !item.liked;
    save(data);
    syncKey(key);
  }

  async function shareMaterial(card){
    const {key,data,item} = stateFor(card);
    const title = titleFromCard(card);
    const author = document.getElementById('authorProfileName')?.textContent?.trim() || 'Автор';
    const url = `${location.href.split('#')[0]}#author-material-${encodeURIComponent(key)}`;
    let completed = false;
    try{
      if(navigator.share){
        await navigator.share({title, text:`${author}: ${title}`, url});
        completed = true;
      }else if(navigator.clipboard){
        await navigator.clipboard.writeText(url);
        if(typeof window.toast === 'function') window.toast('Ссылка скопирована');
      }
    }catch(err){
      if(err && err.name !== 'AbortError' && typeof window.toast === 'function') window.toast('Не удалось отправить материал');
    }
    if(completed && !item.shared){
      item.shared = true;
      save(data);
      syncKey(key);
    }
  }

  function ensureOverlay(){
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'author-engagement-overlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML = `
      <div class="author-engagement-dialog" role="dialog" aria-modal="true" aria-labelledby="authorEngagementTitle">
        <div class="author-engagement-head">
          <div><h2 id="authorEngagementTitle">Комментарии</h2><p id="authorEngagementSubtitle"></p></div>
          <button type="button" class="author-engagement-close" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="author-engagement-material" id="authorEngagementMaterial"></div>
        <div class="author-engagement-comments-head"><h3>Комментарии</h3><span id="authorEngagementCommentsCount">0</span></div>
        <div class="author-engagement-comments" id="authorEngagementComments"></div>
        <form class="author-engagement-form" id="authorEngagementForm">
          <textarea id="authorEngagementInput" maxlength="500" placeholder="Напишите комментарий"></textarea>
          <div class="author-engagement-form-bottom">
            <span id="authorEngagementCounter">0/500</span>
            <div class="author-engagement-form-actions">
              <button type="button" id="authorEngagementCancelEdit" hidden>Отмена</button>
              <button type="submit" id="authorEngagementSubmit">Отправить</button>
            </div>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{ if(e.target === overlay) closeComments(); });
    overlay.querySelector('.author-engagement-close').addEventListener('click',closeComments);
    const input = overlay.querySelector('#authorEngagementInput');
    input.addEventListener('input',()=>{
      overlay.querySelector('#authorEngagementCounter').textContent = `${input.value.length}/500`;
    });
    overlay.querySelector('#authorEngagementCancelEdit').addEventListener('click',resetComposer);
    overlay.querySelector('#authorEngagementForm').addEventListener('submit',submitComment);
    overlay.querySelector('#authorEngagementComments').addEventListener('click',handleCommentAction);
    return overlay;
  }

  function materialPreview(card){
    const cover = card.querySelector('.author-content-cover')?.cloneNode(true);
    const title = titleFromCard(card);
    const desc = card.querySelector('.author-content-body p')?.textContent?.trim() || '';
    const meta = card.querySelector('.author-content-meta > span')?.textContent?.trim() || '';
    const wrapper = document.createElement('div');
    wrapper.className = 'author-engagement-preview-card';
    if(cover){
      cover.querySelectorAll('button').forEach(btn=>btn.remove());
      wrapper.appendChild(cover);
    }
    const body = document.createElement('div');
    body.className = 'author-engagement-preview-body';
    body.innerHTML = `<h3>${escapeHtml(title)}</h3>${desc ? `<p>${escapeHtml(desc)}</p>` : ''}<span>${escapeHtml(meta)}</span>`;
    wrapper.appendChild(body);
    return wrapper;
  }

  function escapeHtml(value){
    return String(value || '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function relativeTime(ts){
    const diff = Math.max(0, Date.now()-Number(ts || Date.now()));
    const min = Math.floor(diff/60000);
    if(min < 1) return 'только что';
    if(min < 60) return `${min} мин назад`;
    const h = Math.floor(min/60);
    if(h < 24) return `${h} ч назад`;
    return new Date(ts).toLocaleDateString('ru-RU');
  }
  function remainingText(ts){
    const left = EDIT_WINDOW_MS - (Date.now()-Number(ts));
    if(left <= 0) return '';
    const mins = Math.max(1,Math.ceil(left/60000));
    return `ещё ${mins} мин`;
  }

  function renderComments(){
    const root = ensureOverlay();
    const data = load();
    const item = data[activeKey];
    if(!item) return;
    const list = root.querySelector('#authorEngagementComments');
    const comments = Array.isArray(item.comments) ? item.comments : [];
    root.querySelector('#authorEngagementCommentsCount').textContent = totalComments(item);
    if(!comments.length){
      list.innerHTML = `<div class="author-engagement-empty">Пока нет новых комментариев. Будьте первым.</div>`;
      return;
    }
    list.innerHTML = comments.map(comment=>{
      const editable = Date.now()-Number(comment.createdAt) < EDIT_WINDOW_MS;
      return `<article class="author-engagement-comment ${comment.mine ? 'is-mine' : ''}" data-comment-id="${escapeHtml(comment.id)}">
        <div class="author-engagement-avatar">${comment.mine ? 'В' : escapeHtml((comment.author || 'А').slice(0,1))}</div>
        <div class="author-engagement-comment-card">
          <div class="author-engagement-comment-top"><strong>${comment.mine ? 'Вы' : escapeHtml(comment.author || 'Пользователь')}</strong><time>${relativeTime(comment.createdAt)}</time></div>
          <p>${escapeHtml(comment.text)}</p>
          ${comment.mine && editable ? `<div class="author-engagement-comment-actions"><button type="button" data-comment-action="edit">Редактировать</button><span>${remainingText(comment.createdAt)}</span><button type="button" data-comment-action="delete">Удалить</button></div>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  function openComments(card){
    activeCard = card;
    const {key,item} = stateFor(card);
    activeKey = key;
    editingId = '';
    const root = ensureOverlay();
    root.querySelector('#authorEngagementSubtitle').textContent = titleFromCard(card);
    const material = root.querySelector('#authorEngagementMaterial');
    material.innerHTML = '';
    material.appendChild(materialPreview(card));
    renderComments();
    resetComposer();
    root.classList.add('is-open');
    root.setAttribute('aria-hidden','false');
    document.body.classList.add('author-engagement-open');
  }
  function closeComments(){
    if(!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('author-engagement-open');
    activeCard = null;
    activeKey = '';
    editingId = '';
  }
  function resetComposer(){
    if(!overlay) return;
    editingId = '';
    const input = overlay.querySelector('#authorEngagementInput');
    input.value = '';
    overlay.querySelector('#authorEngagementCounter').textContent = '0/500';
    overlay.querySelector('#authorEngagementSubmit').textContent = 'Отправить';
    overlay.querySelector('#authorEngagementCancelEdit').hidden = true;
  }
  function submitComment(e){
    e.preventDefault();
    const input = overlay.querySelector('#authorEngagementInput');
    const text = input.value.trim();
    if(!text) return;
    const data = load();
    const item = data[activeKey];
    if(!item) return;
    if(!Array.isArray(item.comments)) item.comments=[];
    if(editingId){
      const comment = item.comments.find(c=>c.id===editingId && c.mine);
      if(comment && Date.now()-Number(comment.createdAt)<EDIT_WINDOW_MS){
        comment.text=text;
        comment.editedAt=Date.now();
      }
    }else{
      item.comments.push({id:`c_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,author:'Вы',text,mine:true,createdAt:Date.now()});
    }
    save(data);
    resetComposer();
    renderComments();
    syncKey(activeKey);
  }
  function handleCommentAction(e){
    const button=e.target.closest('[data-comment-action]');
    if(!button) return;
    const row=button.closest('[data-comment-id]');
    const id=row?.dataset.commentId;
    const data=load();
    const item=data[activeKey];
    const comment=item?.comments?.find(c=>c.id===id && c.mine);
    if(!comment || Date.now()-Number(comment.createdAt)>=EDIT_WINDOW_MS) return;
    if(button.dataset.commentAction==='edit'){
      editingId=id;
      const input=overlay.querySelector('#authorEngagementInput');
      input.value=comment.text;
      input.focus();
      overlay.querySelector('#authorEngagementCounter').textContent=`${input.value.length}/500`;
      overlay.querySelector('#authorEngagementSubmit').textContent='Сохранить';
      overlay.querySelector('#authorEngagementCancelEdit').hidden=false;
    }else if(button.dataset.commentAction==='delete'){
      if(!window.confirm('Удалить комментарий?')) return;
      item.comments=item.comments.filter(c=>c.id!==id);
      save(data);
      resetComposer();
      renderComments();
      syncKey(activeKey);
    }
  }

  document.addEventListener('click',function(e){
    const action=e.target.closest('#view-author-profile [data-author-engagement-action]');
    if(!action) return;
    const card=action.closest('.author-content-card');
    if(!card) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const type=action.dataset.authorEngagementAction;
    if(type==='like') toggleLike(card);
    else if(type==='comment') openComments(card);
    else if(type==='share') shareMaterial(card);
  },true);

  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && overlay?.classList.contains('is-open')) closeComments(); });

  const grid=document.getElementById('authorContentGrid');
  if(grid){
    new MutationObserver(()=>requestAnimationFrame(decorateAll)).observe(grid,{childList:true,subtree:true});
  }
  document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(decorateAll));
  if(document.readyState!=='loading') requestAnimationFrame(decorateAll);

  const originalOpen=window.openAuthorProfile;
  if(typeof originalOpen==='function'){
    window.openAuthorProfile=function(id){
      const result=originalOpen.apply(this,arguments);
      requestAnimationFrame(()=>requestAnimationFrame(decorateAll));
      return result;
    };
  }

  window.addEventListener('account-changed', ()=>{
    activeKey = ''; activeCard = null; editingId = '';
    document.querySelectorAll('#view-author-profile .author-content-reactions').forEach(node=>delete node.dataset.engagementSignature);
    decorateAll();
    if(overlay?.classList.contains('is-open')) closeComments();
  });

  window.AuthorMaterialEngagement={decorate:decorateAll,openComments};
})();
