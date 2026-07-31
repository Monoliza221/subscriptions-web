(function(){
  'use strict';

  const STORAGE_KEY = 'author_content_favorites_v1';
  let decorating = false;
  let favoritesCache = null;

  function scopedGet(key){
    try{
      if(window.AccountStorage){
        const accountId = window.AccountStorage.getActiveAccount?.();
        if(accountId) return window.AccountStorage.getItem(key);
      }
      return localStorage.getItem(key);
    }catch(_){return null;}
  }
  function scopedSet(key,value){
    try{
      if(window.AccountStorage){
        const accountId = window.AccountStorage.getActiveAccount?.();
        if(accountId && window.AccountStorage.setItem(key,value)) return true;
      }
      localStorage.setItem(key,value);
      return true;
    }catch(_){return false;}
  }
  function load(forceReload=false){
    if(!forceReload && favoritesCache) return favoritesCache;
    try{
      const value = JSON.parse(scopedGet(STORAGE_KEY) || '{}');
      favoritesCache = value && typeof value === 'object' ? value : {};
    }catch(_){favoritesCache = {};}
    return favoritesCache;
  }
  function save(value){
    favoritesCache = value && typeof value === 'object' ? value : {};
    scopedSet(STORAGE_KEY, JSON.stringify(favoritesCache));
  }

  function slug(value){
    return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zа-я0-9]+/gi,'_').replace(/^_+|_+$/g,'') || 'material';
  }
  function authorKey(){
    const handle = document.getElementById('authorProfileHandle')?.textContent?.trim();
    const name = document.getElementById('authorProfileName')?.textContent?.trim();
    return slug(handle || name || 'author');
  }
  function titleOf(card){return card?.querySelector('.author-content-body h3')?.textContent?.trim() || 'Материал';}
  function keyOf(card){
    if(!card.dataset.authorContentFavoriteKey){
      card.dataset.authorContentFavoriteKey = `${authorKey()}__${slug(titleOf(card))}`;
    }
    return card.dataset.authorContentFavoriteKey;
  }
  function isFavorite(card){return !!load()[keyOf(card)];}

  function buttonMarkup(active){
    return `<button type="button" class="author-content-favorite-btn ${active ? 'is-active' : ''}" aria-label="${active ? 'Удалить из избранного' : 'Добавить в избранное'}" title="${active ? 'В избранном' : 'В избранное'}"><i class="${active ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i></button>`;
  }

  function decorateCard(card){
    if(!card) return;
    const cover = card.querySelector('.author-content-cover');
    if(!cover) return;
    const active = isFavorite(card);
    let button = card.querySelector('.author-content-favorite-btn');
    if(!button){
      cover.insertAdjacentHTML('beforeend', buttonMarkup(active));
      return;
    }
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-label', active ? 'Удалить из избранного' : 'Добавить в избранное');
    button.title = active ? 'В избранном' : 'В избранное';
    button.innerHTML = `<i class="${active ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>`;
  }

  function decorateAll(){
    if(decorating) return;
    decorating = true;
    document.querySelectorAll('#view-author-profile .author-content-card').forEach(decorateCard);
    decorating = false;
  }

  function toggle(card){
    const key = keyOf(card);
    const data = load();
    if(data[key]) delete data[key];
    else data[key] = {title:titleOf(card), savedAt:Date.now()};
    save(data);
    const button = card.querySelector('.author-content-favorite-btn');
    const active = !!data[key];
    if(button){
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-label', active ? 'Удалить из избранного' : 'Добавить в избранное');
      button.title = active ? 'В избранном' : 'В избранное';
      button.innerHTML = `<i class="${active ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>`;
    }
    if(typeof window.toast === 'function') window.toast(active ? 'Материал добавлен в избранное' : 'Материал удалён из избранного');
    const activeTab = document.querySelector('#authorContentTabs [data-author-content-tab="favorites"].active');
    if(activeTab) renderFavorites();
  }

  function renderFavorites(){
    const root = document.getElementById('authorContentGrid');
    if(!root) return;
    if(window.AuthorContentTabs && typeof window.AuthorContentTabs.renderAll === 'function'){
      window.AuthorContentTabs.renderAll();
    }
    decorateAll();
    const data = load();
    const cards = [...root.querySelectorAll('.author-content-card')];
    let visible = 0;
    cards.forEach(card=>{
      const show = !!data[keyOf(card)];
      card.hidden = !show;
      card.classList.toggle('author-content-favorite-hidden', !show);
      card.setAttribute('aria-hidden', show ? 'false' : 'true');
      if(show) visible += 1;
    });
    root.querySelector('.author-content-favorites-empty')?.remove();
    if(!visible){
      root.insertAdjacentHTML('beforeend', `<div class="author-content-favorites-empty"><i class="fa-regular fa-bookmark"></i><h3>Нет избранных материалов</h3><p>Сохраняйте статьи, видео, аудио и галереи, чтобы быстро находить их здесь.</p></div>`);
    }
  }

  document.addEventListener('click', function(event){
    const button = event.target.closest('#view-author-profile .author-content-favorite-btn');
    if(!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const card = button.closest('.author-content-card');
    if(card) toggle(card);
  }, true);

  const observer = new MutationObserver(()=>requestAnimationFrame(decorateAll));
  document.addEventListener('DOMContentLoaded', ()=>{
    const root = document.getElementById('authorContentGrid');
    if(root) observer.observe(root,{childList:true,subtree:true});
    decorateAll();
  });
  if(document.readyState !== 'loading'){
    const root = document.getElementById('authorContentGrid');
    if(root) observer.observe(root,{childList:true,subtree:true});
    decorateAll();
  }

  window.addEventListener('account-changed', ()=>{
    favoritesCache = null;
    load(true);
    decorateAll();
    const activeTab = document.querySelector('#authorContentTabs [data-author-content-tab="favorites"].active');
    if(activeTab) renderFavorites();
  });

  window.AuthorContentFavorites = {renderFavorites, decorateAll};
})();
