(function(){
  'use strict';

  const STORAGE_KEY = 'feed_comments_v1';
  const HOUR_MS = 60 * 60 * 1000;
  const seededComments = {
    'feed-1': [
      {id:'seed-1', author:'Анна', text:'Отличное обновление, комментарии очень пригодятся.', createdAt: Date.now() - 22 * 60 * 1000, mine:false}
    ],
    'feed-2': [
      {id:'seed-2', author:'Илья', text:'Стало намного понятнее, где искать код награды.', createdAt: Date.now() - 95 * 60 * 1000, mine:false},
      {id:'seed-3', author:'Мария', text:'Хорошее изменение.', createdAt: Date.now() - 70 * 60 * 1000, mine:false}
    ],
    'feed-3': [
      {id:'seed-4', author:'Данияр', text:'Тёмная тема теперь выглядит заметно лучше.', createdAt: Date.now() - 4 * 60 * 60 * 1000, mine:false}
    ],
    'feed-4': [
      {id:'seed-5', author:'Саша', text:'Загрузка действительно стала быстрее.', createdAt: Date.now() - 7 * 60 * 60 * 1000, mine:false}
    ]
  };

  let activePostId = '';
  let editCommentId = '';
  let deleteCommentId = '';

  function storageGet(){
    try{
      const raw = window.AccountStorage ? AccountStorage.getItem(STORAGE_KEY) : localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    }catch(error){ return {}; }
  }

  function storageSet(value){
    const raw = JSON.stringify(value);
    if(window.AccountStorage) AccountStorage.setItem(STORAGE_KEY, raw);
    else localStorage.setItem(STORAGE_KEY, raw);
  }

  function getUserComments(postId){
    const all = storageGet();
    return Array.isArray(all[postId]) ? all[postId] : [];
  }

  function setUserComments(postId, comments){
    const all = storageGet();
    all[postId] = comments;
    storageSet(all);
  }

  function getAllComments(postId){
    return [...(seededComments[postId] || []), ...getUserComments(postId)].sort((a,b) => a.createdAt - b.createdAt);
  }

  function ensurePostIds(){
    document.querySelectorAll('#view-feed .feed-web-card').forEach((card,index) => {
      if(!card.dataset.feedPostId) card.dataset.feedPostId = `feed-${index + 1}`;
    });
  }

  function formatTime(timestamp){
    const diff = Math.max(0, Date.now() - Number(timestamp || Date.now()));
    if(diff < 60 * 1000) return 'только что';
    if(diff < HOUR_MS) return `${Math.floor(diff / 60000)} мин назад`;
    if(diff < 24 * HOUR_MS) return `${Math.floor(diff / HOUR_MS)} ч назад`;
    return new Date(timestamp).toLocaleDateString('ru-RU');
  }

  function canEdit(comment){
    return Boolean(comment.mine) && Date.now() < Number(comment.createdAt) + HOUR_MS;
  }

  function escapeHtml(value){
    return String(value || '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  }

  function createUi(){
    if(document.getElementById('feedCommentsOverlay')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="feed-comments-overlay" id="feedCommentsOverlay" aria-hidden="true">
        <div class="feed-comments-modal" role="dialog" aria-modal="true" aria-labelledby="feedCommentsTitle">
          <div class="feed-comments-head">
            <div>
              <h2 id="feedCommentsTitle">Комментарии</h2>
              <p id="feedCommentsSubtitle"></p>
            </div>
            <button class="feed-comments-close" type="button" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="feed-comments-post" id="feedCommentsPost"></div>
          <div class="feed-comments-section-head">
            <h3>Комментарии</h3>
            <span id="feedCommentsCount">0</span>
          </div>
          <div class="feed-comments-list" id="feedCommentsList"></div>
          <form class="feed-comments-form" id="feedCommentsForm">
            <textarea id="feedCommentsInput" maxlength="500" placeholder="Напишите комментарий" rows="3"></textarea>
            <div class="feed-comments-form-bottom">
              <span id="feedCommentsLimit">0/500</span>
              <button type="submit" id="feedCommentsSubmit">Отправить</button>
            </div>
          </form>
        </div>
      </div>
      <div class="feed-comment-edit-overlay" id="feedCommentEditOverlay" aria-hidden="true">
        <div class="feed-comment-edit-modal" role="dialog" aria-modal="true" aria-labelledby="feedCommentEditTitle">
          <div class="feed-comments-head">
            <h2 id="feedCommentEditTitle">Редактировать комментарий</h2>
            <button class="feed-comment-edit-close" type="button" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <textarea id="feedCommentEditInput" maxlength="500" rows="4"></textarea>
          <div class="feed-comment-edit-actions">
            <button class="feed-comment-secondary" type="button" data-action="cancel-edit">Отмена</button>
            <button class="feed-comment-primary" type="button" data-action="save-edit">Сохранить</button>
          </div>
        </div>
      </div>
      <div class="feed-comment-delete-overlay" id="feedCommentDeleteOverlay" aria-hidden="true">
        <div class="feed-comment-delete-modal" role="dialog" aria-modal="true" aria-labelledby="feedCommentDeleteTitle">
          <div class="feed-comment-delete-icon"><i class="fa-regular fa-trash-can"></i></div>
          <h2 id="feedCommentDeleteTitle">Удалить комментарий?</h2>
          <p>Это действие нельзя отменить.</p>
          <div class="feed-comment-edit-actions">
            <button class="feed-comment-secondary" type="button" data-action="cancel-delete">Отмена</button>
            <button class="feed-comment-delete-confirm" type="button" data-action="confirm-delete">Удалить</button>
          </div>
        </div>
      </div>`);
  }

  function updateCounter(postId){
    const card = document.querySelector(`#view-feed .feed-web-card[data-feed-post-id="${postId}"]`);
    const counter = card?.querySelector('.feed-web-action.comment span');
    if(!counter) return;
    const base = Number(card.dataset.feedBaseComments || counter.textContent || 0);
    if(!card.dataset.feedBaseComments) card.dataset.feedBaseComments = String(base);
    counter.textContent = String(base + getUserComments(postId).length);
  }

  function updateAllCounters(){
    ensurePostIds();
    document.querySelectorAll('#view-feed .feed-web-card').forEach(card => updateCounter(card.dataset.feedPostId));
  }

  function renderPostPreview(card){
    const host = document.getElementById('feedCommentsPost');
    if(!host) return;
    if(!card){ host.innerHTML = ''; return; }
    const clone = card.cloneNode(true);
    clone.removeAttribute('data-feed-post-id');
    clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));

    const commentButton = clone.querySelector('.feed-web-action.comment');
    commentButton?.remove();

    clone.querySelectorAll('button').forEach(button => {
      button.type = 'button';
      button.disabled = false;
      button.removeAttribute('onclick');
      button.removeAttribute('data-comment-action');
      if(button.classList.contains('like')) button.dataset.previewAction = 'like';
      else if(button.classList.contains('share')) button.dataset.previewAction = 'share';
      else button.disabled = true;
    });
    host.replaceChildren(clone);
  }

  function syncPreviewAction(action){
    if(!activePostId) return;
    const original = document.querySelector(`#view-feed .feed-web-card[data-feed-post-id="${activePostId}"] .feed-web-action.${action}`);
    const preview = document.querySelector(`#feedCommentsPost .feed-web-action.${action}`);
    if(!original || !preview) return;
    preview.classList.toggle('liked', original.classList.contains('liked'));
    const sourceIcon = original.querySelector('i');
    const previewIcon = preview.querySelector('i');
    if(sourceIcon && previewIcon) previewIcon.className = sourceIcon.className;
    const sourceCount = original.querySelector('span');
    const previewCount = preview.querySelector('span');
    if(sourceCount && previewCount) previewCount.textContent = sourceCount.textContent;
  }

  function handlePreviewAction(button){
    const action = button?.dataset.previewAction;
    if(!action || !activePostId) return;
    const original = document.querySelector(`#view-feed .feed-web-card[data-feed-post-id="${activePostId}"] .feed-web-action.${action}`);
    if(!original) return;
    original.click();
    setTimeout(() => syncPreviewAction(action), 0);
  }

  function render(){
    const list = document.getElementById('feedCommentsList');
    const subtitle = document.getElementById('feedCommentsSubtitle');
    if(!list || !activePostId) return;
    const card = document.querySelector(`#view-feed .feed-web-card[data-feed-post-id="${activePostId}"]`);
    const title = card?.querySelector('h2')?.textContent?.trim() || 'Публикация';
    if(subtitle) subtitle.textContent = title;
    renderPostPreview(card);
    const comments = getAllComments(activePostId);
    const count = document.getElementById('feedCommentsCount');
    if(count) count.textContent = String(comments.length);
    list.innerHTML = comments.length ? comments.map(comment => {
      const editable = canEdit(comment);
      const remaining = editable ? Math.max(1, Math.ceil((Number(comment.createdAt) + HOUR_MS - Date.now()) / 60000)) : 0;
      return `<article class="feed-comment-item ${comment.mine ? 'is-mine' : ''}" data-comment-id="${escapeHtml(comment.id)}">
        <div class="feed-comment-avatar">${comment.mine ? 'В' : escapeHtml(comment.author).charAt(0)}</div>
        <div class="feed-comment-content">
          <div class="feed-comment-top"><strong>${comment.mine ? 'Вы' : escapeHtml(comment.author)}</strong><span>${formatTime(comment.createdAt)}</span></div>
          <p>${escapeHtml(comment.text)}</p>
          ${comment.mine ? `<div class="feed-comment-own-actions">
            ${editable ? `<button type="button" data-comment-action="edit"><i class="fa-regular fa-pen-to-square"></i>Редактировать</button><small>ещё ${remaining} мин</small>` : '<small>Время редактирования истекло</small>'}
            <button type="button" data-comment-action="delete"><i class="fa-regular fa-trash-can"></i>Удалить</button>
          </div>` : ''}
        </div>
      </article>`;
    }).join('') : '<div class="feed-comments-empty"><i class="fa-regular fa-comment-dots"></i><strong>Комментариев пока нет</strong><span>Будьте первым, кто оставит комментарий.</span></div>';
    list.scrollTop = list.scrollHeight;
  }

  function open(postId){
    activePostId = postId;
    createUi();
    render();
    const overlay = document.getElementById('feedCommentsOverlay');
    overlay?.setAttribute('aria-hidden','false');
    document.body.classList.add('feed-comments-open');
    setTimeout(() => document.getElementById('feedCommentsInput')?.focus(), 30);
  }

  function close(){
    document.getElementById('feedCommentsOverlay')?.setAttribute('aria-hidden','true');
    document.body.classList.remove('feed-comments-open');
    activePostId = '';
    const input = document.getElementById('feedCommentsInput');
    if(input) input.value = '';
    updateLimit();
  }

  function updateLimit(){
    const input = document.getElementById('feedCommentsInput');
    const limit = document.getElementById('feedCommentsLimit');
    if(limit) limit.textContent = `${input?.value.length || 0}/500`;
  }

  function submitComment(event){
    event.preventDefault();
    const input = document.getElementById('feedCommentsInput');
    const text = input?.value.trim() || '';
    if(!text){ if(typeof toast === 'function') toast('Введите комментарий'); return; }
    const comments = getUserComments(activePostId);
    comments.push({id:`comment-${Date.now()}-${Math.random().toString(16).slice(2)}`, author:'Вы', text, createdAt:Date.now(), mine:true});
    setUserComments(activePostId, comments);
    input.value = '';
    updateLimit();
    updateCounter(activePostId);
    render();
  }

  function openEdit(commentId){
    const comment = getUserComments(activePostId).find(item => item.id === commentId);
    if(!comment || !canEdit(comment)){ if(typeof toast === 'function') toast('Комментарий можно редактировать только в течение часа'); return; }
    editCommentId = commentId;
    const input = document.getElementById('feedCommentEditInput');
    if(input) input.value = comment.text;
    document.getElementById('feedCommentEditOverlay')?.setAttribute('aria-hidden','false');
    setTimeout(() => input?.focus(), 20);
  }

  function closeEdit(){
    editCommentId = '';
    document.getElementById('feedCommentEditOverlay')?.setAttribute('aria-hidden','true');
  }

  function saveEdit(){
    const input = document.getElementById('feedCommentEditInput');
    const text = input?.value.trim() || '';
    if(!text){ if(typeof toast === 'function') toast('Комментарий не может быть пустым'); return; }
    const comments = getUserComments(activePostId);
    const index = comments.findIndex(item => item.id === editCommentId);
    if(index < 0 || !canEdit(comments[index])){ closeEdit(); if(typeof toast === 'function') toast('Время редактирования истекло'); return; }
    comments[index] = {...comments[index], text, editedAt:Date.now()};
    setUserComments(activePostId, comments);
    closeEdit();
    render();
  }

  function openDelete(commentId){
    deleteCommentId = commentId;
    document.getElementById('feedCommentDeleteOverlay')?.setAttribute('aria-hidden','false');
  }

  function closeDelete(){
    deleteCommentId = '';
    document.getElementById('feedCommentDeleteOverlay')?.setAttribute('aria-hidden','true');
  }

  function confirmDelete(){
    const comments = getUserComments(activePostId);
    const filtered = comments.filter(item => item.id !== deleteCommentId);
    setUserComments(activePostId, filtered);
    closeDelete();
    updateCounter(activePostId);
    render();
    if(typeof toast === 'function') toast('Комментарий удалён');
  }

  document.addEventListener('click', function(event){
    const button = event.target.closest('#view-feed .feed-web-action.comment');
    if(!button) return;
    event.preventDefault();
    event.stopPropagation();
    const card = button.closest('.feed-web-card');
    if(!card) return;
    ensurePostIds();
    open(card.dataset.feedPostId);
  }, true);

  document.addEventListener('click', function(event){
    const previewAction = event.target.closest('#feedCommentsPost [data-preview-action]');
    if(previewAction){
      event.preventDefault();
      event.stopPropagation();
      handlePreviewAction(previewAction);
      return;
    }

    const overlay = event.target.closest('#feedCommentsOverlay');
    if(event.target.matches('#feedCommentsOverlay') || event.target.closest('.feed-comments-close')) close();
    if(event.target.matches('#feedCommentEditOverlay') || event.target.closest('.feed-comment-edit-close') || event.target.closest('[data-action="cancel-edit"]')) closeEdit();
    if(event.target.matches('#feedCommentDeleteOverlay') || event.target.closest('[data-action="cancel-delete"]')) closeDelete();
    if(event.target.closest('[data-action="save-edit"]')) saveEdit();
    if(event.target.closest('[data-action="confirm-delete"]')) confirmDelete();
    const commentItem = event.target.closest('.feed-comment-item');
    const action = event.target.closest('[data-comment-action]');
    if(commentItem && action){
      const id = commentItem.dataset.commentId;
      if(action.dataset.commentAction === 'edit') openEdit(id);
      if(action.dataset.commentAction === 'delete') openDelete(id);
    }
  });


  document.addEventListener('feed:repost-updated', function(event){
    const postKey = event?.detail?.postKey;
    if(!postKey || postKey !== activePostId) return;
    syncPreviewAction('share');
  });

  document.addEventListener('input', function(event){
    if(event.target.id === 'feedCommentsInput') updateLimit();
  });

  document.addEventListener('submit', function(event){
    if(event.target.id === 'feedCommentsForm') submitComment(event);
  });

  document.addEventListener('keydown', function(event){
    if(event.key !== 'Escape') return;
    if(document.getElementById('feedCommentDeleteOverlay')?.getAttribute('aria-hidden') === 'false') closeDelete();
    else if(document.getElementById('feedCommentEditOverlay')?.getAttribute('aria-hidden') === 'false') closeEdit();
    else if(document.getElementById('feedCommentsOverlay')?.getAttribute('aria-hidden') === 'false') close();
  });

  function init(){
    createUi();
    ensurePostIds();
    updateAllCounters();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
