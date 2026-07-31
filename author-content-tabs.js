(function(){
  'use strict';

  const mediaByTab = {
    video: [
      {type:'Видео', icon:'fa-circle-play', cover:'linear-gradient(135deg,#ff6b35,#ff2d55)', title:'Разбор интерфейса: как улучшить главный экран', desc:'Практический разбор композиции, навигации и визуальной иерархии.', meta:'12 минут · 3 дня назад', action:'Смотреть видео'},
      {type:'Видео', icon:'fa-wand-magic-sparkles', cover:'linear-gradient(135deg,#7c3aed,#2563eb)', title:'Микроанимации без перегруза', desc:'Какие анимации помогают пользователю, а какие только мешают.', meta:'8 минут · 1 неделю назад', action:'Смотреть видео'},
      {type:'Видео', icon:'fa-mobile-screen-button', cover:'linear-gradient(135deg,#06b6d4,#0891b2)', title:'Адаптивный UI на практике', desc:'Настраиваем карточки и сетки для разных размеров экрана.', meta:'15 минут · 2 недели назад', action:'Смотреть видео'}
    ],
    audio: [
      {type:'Аудио', icon:'fa-headphones', cover:'linear-gradient(135deg,#8b5cf6,#ec4899)', title:'Почему пользователи бросают подписки', desc:'Короткий выпуск о причинах отмены и способах удержания аудитории.', meta:'18 минут · 4 дня назад', action:'Слушать аудио'},
      {type:'Аудио', icon:'fa-microphone-lines', cover:'linear-gradient(135deg,#f59e0b,#ef4444)', title:'Разговор о дизайн-системах', desc:'Как поддерживать единый визуальный язык в растущем продукте.', meta:'26 минут · 9 дней назад', action:'Слушать аудио'},
      {type:'Аудио', icon:'fa-wave-square', cover:'linear-gradient(135deg,#10b981,#06b6d4)', title:'Как давать полезную обратную связь', desc:'Практические правила для командной работы над интерфейсом.', meta:'14 минут · 3 недели назад', action:'Слушать аудио'}
    ],
    gallery: [
      {type:'Галерея', icon:'fa-images', cover:'linear-gradient(135deg,#38bdf8,#8b5cf6)', title:'Подборка мобильных интерфейсов', desc:'12 экранов с примерами аккуратной типографики и сеток.', meta:'12 изображений · 2 дня назад', action:'Открыть галерею'},
      {type:'Галерея', icon:'fa-layer-group', cover:'linear-gradient(135deg,#14b8a6,#22c55e)', title:'Компоненты дизайн-системы', desc:'Кнопки, поля, карточки и состояния в одном наборе.', meta:'18 изображений · 1 неделю назад', action:'Открыть галерею'},
      {type:'Галерея', icon:'fa-palette', cover:'linear-gradient(135deg,#fb7185,#f97316)', title:'Цветовые решения для приложений', desc:'Примеры спокойных и контрастных палитр для светлой и тёмной темы.', meta:'10 изображений · 2 недели назад', action:'Открыть галерею'}
    ]
  };

  let currentTab = 'all';
  let overlay = null;

  const originalRender = window.renderAuthorContent;

  function iconForType(type){
    if(type === 'Видео') return 'fa-video';
    if(type === 'Аудио') return 'fa-headphones';
    return 'fa-images';
  }

  function mediaCardsMarkup(tab){
    const items = mediaByTab[tab] || [];
    return items.map((item,index)=>`
      <article class="author-content-card author-media-card" data-author-media-tab="${tab}" data-author-media-index="${index}">
        <div class="author-content-cover" style="background:${item.cover}">
          <span class="badge"><i class="fa-solid ${iconForType(item.type)}"></i> ${item.type}</span>
          <i class="fa-solid ${item.icon} main"></i>
          <span class="author-media-play"><i class="fa-solid ${tab === 'audio' ? 'fa-play' : tab === 'gallery' ? 'fa-up-right-and-down-left-from-center' : 'fa-play'}"></i></span>
        </div>
        <div class="author-content-body">
          <h3>${item.title}</h3>
          <p>${item.desc}</p>
          <div class="author-content-meta"><span>${item.meta}</span></div>
        </div>
      </article>`).join('');
  }

  function renderMedia(tab){
    const root = document.getElementById('authorContentGrid');
    if(!root) return;
    root.innerHTML = mediaCardsMarkup(tab);
  }

  function renderAll(){
    const root = document.getElementById('authorContentGrid');
    if(!root) return;
    if(typeof originalRender === 'function') originalRender();
    const mediaMarkup = ['video','audio','gallery'].map(mediaCardsMarkup).join('');
    root.insertAdjacentHTML('beforeend', mediaMarkup);
  }


  function renderCalendar(){
    const root = document.getElementById('authorContentGrid');
    if(!root) return;
    root.innerHTML = `
      <div class="author-calendar-list" aria-label="Календарь автора">
        <div class="author-calendar-item">
          <div class="author-calendar-date"><strong>28</strong><span>МАЯ</span></div>
          <div class="author-calendar-info"><h3>Прямой эфир: Q&amp;A</h3><p><i class="fa-regular fa-clock"></i>19:00 · Длительность ~1 ч</p></div>
          <i class="fa-solid fa-bell author-calendar-bell" aria-hidden="true"></i>
        </div>
        <div class="author-calendar-item">
          <div class="author-calendar-date"><strong>02</strong><span>ИЮН</span></div>
          <div class="author-calendar-info"><h3>Новый воркшоп по Figma</h3><p><i class="fa-regular fa-clock"></i>18:00 · Premium доступ</p></div>
          <i class="fa-solid fa-bell author-calendar-bell" aria-hidden="true"></i>
        </div>
        <div class="author-calendar-item">
          <div class="author-calendar-date"><strong>10</strong><span>ИЮН</span></div>
          <div class="author-calendar-info"><h3>Релиз курса: AI для дизайна</h3><p><i class="fa-regular fa-clock"></i>Весь день</p></div>
          <i class="fa-solid fa-bell author-calendar-bell" aria-hidden="true"></i>
        </div>
      </div>`;
  }

  function renderCurrent(){
    if(currentTab === 'all'){
      renderAll();
      return;
    }
    if(currentTab === 'articles'){
      if(typeof originalRender === 'function') originalRender();
      return;
    }
    if(currentTab === 'calendar'){
      renderCalendar();
      return;
    }
    if(currentTab === 'favorites'){
      if(window.AuthorContentFavorites && typeof window.AuthorContentFavorites.renderFavorites === 'function'){
        window.AuthorContentFavorites.renderFavorites();
      }else{
        const root = document.getElementById('authorContentGrid');
        if(root) root.innerHTML = '<div class="author-content-favorites-empty">Загрузка избранных материалов…</div>';
      }
      return;
    }
    renderMedia(currentTab);
  }

  window.renderAuthorContent = renderCurrent;

  function setTab(tab){
    currentTab = tab;
    document.querySelectorAll('#authorContentTabs [data-author-content-tab]').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.authorContentTab === tab);
    });
    renderCurrent();
  }

  function ensureOverlay(){
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'author-media-overlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML = `
      <div class="author-media-dialog" role="dialog" aria-modal="true" aria-labelledby="authorMediaTitle">
        <div class="author-media-head">
          <div>
            <span id="authorMediaType"></span>
            <h2 id="authorMediaTitle"></h2>
            <p id="authorMediaMeta"></p>
          </div>
          <button class="author-media-close" type="button" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="author-media-view" id="authorMediaView"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e=>{ if(e.target === overlay) closeMedia(); });
    overlay.querySelector('.author-media-close').addEventListener('click', closeMedia);
    return overlay;
  }

  function openMedia(tab,index){
    const item = (mediaByTab[tab] || [])[index];
    if(!item) return;
    const root = ensureOverlay();
    root.querySelector('#authorMediaType').textContent = item.type;
    root.querySelector('#authorMediaTitle').textContent = item.title;
    root.querySelector('#authorMediaMeta').textContent = item.meta;
    const view = root.querySelector('#authorMediaView');
    const mediaIcon = tab === 'audio' ? 'fa-headphones' : tab === 'gallery' ? 'fa-images' : 'fa-circle-play';
    view.innerHTML = `
      <div class="author-media-preview" style="background:${item.cover}">
        <i class="fa-solid ${mediaIcon}"></i>
      </div>
      <p>${item.desc}</p>
      <button type="button" class="author-media-action"><i class="fa-solid fa-play"></i>${item.action}</button>`;
    view.querySelector('.author-media-action').addEventListener('click', ()=>{
      if(typeof window.toast === 'function') window.toast(`${item.action}: ${item.title}`);
    });
    root.classList.add('is-open');
    root.setAttribute('aria-hidden','false');
    document.body.classList.add('author-media-open');
  }

  function closeMedia(){
    if(!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('author-media-open');
  }

  function bindTabs(){
    document.querySelectorAll('#authorContentTabs [data-author-content-tab]').forEach(btn=>{
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        setTab(this.dataset.authorContentTab || 'all');
      });
    });
  }

  document.addEventListener('click', function(e){
    if(e.target.closest('#view-author-profile .author-content-favorite-btn')) return;
    const card = e.target.closest('#view-author-profile .author-media-card');
    if(!card) return;
    e.preventDefault();
    openMedia(card.dataset.authorMediaTab, Number(card.dataset.authorMediaIndex));
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeMedia();
  });

  document.addEventListener('DOMContentLoaded', bindTabs);
  if(document.readyState !== 'loading') bindTabs();

  const originalOpenAuthorProfile = window.openAuthorProfile;
  if(typeof originalOpenAuthorProfile === 'function'){
    window.openAuthorProfile = function(id){
      currentTab = 'all';
      const result = originalOpenAuthorProfile(id);
      requestAnimationFrame(()=>setTab('all'));
      return result;
    };
  }

  window.AuthorContentTabs = { setTab, render:renderCurrent, renderAll };
})();
