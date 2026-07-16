(() => {
  'use strict';

  const STORAGE_KEY = 'subscriptions_web_author_favorites_v1';
  let activeAuthorsFilter = 'all';

  function readFavorites() {
    try {
      const raw = window.AccountStorage ? window.AccountStorage.getItem(STORAGE_KEY) : localStorage.getItem(STORAGE_KEY);
      const value = JSON.parse(raw || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveFavorites(items) {
    const raw = JSON.stringify([...new Set(items)]);
    if (window.AccountStorage) window.AccountStorage.setItem(STORAGE_KEY, raw);
    else localStorage.setItem(STORAGE_KEY, raw);
  }

  function currentAuthorIdFromProfile() {
    const savedId = document.getElementById('authorProfileFavoriteButton')?.dataset?.authorId;
    if (savedId) return savedId;

    const handle = document.getElementById('authorProfileHandle')?.textContent?.trim();
    const byHandle = {
      '@maria_designs': 'maria',
      '@alex_code': 'alex',
      '@lina_growth': 'lina'
    };
    if (handle && byHandle[handle]) return byHandle[handle];

    const name = document.getElementById('authorProfileName')?.textContent?.trim();
    const byName = {
      'Мария Дизайнова': 'maria',
      'Алекс Кодеров': 'alex',
      'Лина Маркетолог': 'lina'
    };
    return byName[name] || '';
  }

  function authorIdFromCard(button) {
    const card = button.closest('.author-card');
    const openButton = card?.querySelector('.author-card-actions .open');
    const onclick = openButton?.getAttribute('onclick') || '';
    return onclick.match(/openAuthorProfile\(['\"]([^'\"]+)['\"]\)/)?.[1] || '';
  }

  function isFavorite(authorId) {
    return readFavorites().includes(authorId);
  }

  function updateButton(button, authorId) {
    if (!button || !authorId) return;
    const active = isFavorite(authorId);
    button.classList.toggle('author-favorite-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Удалить автора из избранного' : 'Добавить автора в избранное');
    const icon = button.querySelector('i');
    if (icon) icon.className = `${active ? 'fa-solid' : 'fa-regular'} fa-heart`;
  }

  function syncListButtons() {
    document.querySelectorAll('.author-card .author-card-actions .mini').forEach(button => {
      updateButton(button, authorIdFromCard(button));
    });
  }


  function ensureAuthorsFilter() {
    const view = document.getElementById('view-authors');
    const grid = document.getElementById('authorsGrid');
    if (!view || !grid) return;

    let controls = view.querySelector('#authorsFavoritesFilter');
    if (!controls) {
      controls = document.createElement('div');
      controls.id = 'authorsFavoritesFilter';
      controls.className = 'authors-favorites-filter';
      controls.setAttribute('role', 'tablist');
      controls.setAttribute('aria-label', 'Фильтр авторов');
      controls.innerHTML = `
        <button type="button" class="active" data-authors-filter="all" role="tab" aria-selected="true">Все</button>
        <button type="button" data-authors-filter="favorites" role="tab" aria-selected="false">
          <i class="fa-solid fa-heart"></i>
          Избранные
          <span id="authorsFavoritesCount">0</span>
        </button>`;
      grid.insertAdjacentElement('beforebegin', controls);
    }

    let empty = view.querySelector('#authorsFavoritesEmpty');
    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'authorsFavoritesEmpty';
      empty.className = 'authors-favorites-empty';
      empty.hidden = true;
      empty.innerHTML = `
        <i class="fa-regular fa-heart"></i>
        <strong>Избранных авторов пока нет</strong>
        <span>Нажмите на сердечко в карточке автора, чтобы добавить его сюда.</span>`;
      grid.insertAdjacentElement('afterend', empty);
    }
  }

  function applyAuthorsFilter() {
    ensureAuthorsFilter();
    const favorites = readFavorites();
    const cards = [...document.querySelectorAll('#authorsGrid .author-card')];
    let visibleCount = 0;

    cards.forEach(card => {
      const button = card.querySelector('.author-card-actions .mini');
      const authorId = button ? authorIdFromCard(button) : '';
      const visible = activeAuthorsFilter === 'all' || favorites.includes(authorId);
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    document.querySelectorAll('#authorsFavoritesFilter [data-authors-filter]').forEach(button => {
      const active = button.dataset.authorsFilter === activeAuthorsFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });

    const count = document.getElementById('authorsFavoritesCount');
    if (count) count.textContent = String(favorites.length);

    const grid = document.getElementById('authorsGrid');
    const empty = document.getElementById('authorsFavoritesEmpty');
    const showEmpty = activeAuthorsFilter === 'favorites' && visibleCount === 0;
    if (grid) grid.classList.toggle('is-empty-filter', showEmpty);
    if (empty) empty.hidden = !showEmpty;
  }

  function ensureProfileButton(preferredAuthorId = '') {
    const mainCard = document.querySelector('#view-author-profile .author-main-card');
    const subscribe = mainCard?.querySelector('.author-subscribe-btn');
    if (!mainCard || !subscribe) return;

    let button = mainCard.querySelector('#authorProfileFavoriteButton');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'authorProfileFavoriteButton';
      button.className = 'author-profile-favorite-btn';
      button.innerHTML = '<i class="fa-regular fa-heart"></i><span>В избранное</span>';
      subscribe.insertAdjacentElement('afterend', button);
    }

    const authorId = preferredAuthorId || currentAuthorIdFromProfile();
    const active = isFavorite(authorId);
    button.dataset.authorId = authorId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    const icon = button.querySelector('i');
    const label = button.querySelector('span');
    if (icon) icon.className = `${active ? 'fa-solid' : 'fa-regular'} fa-heart`;
    if (label) label.textContent = active ? 'В избранном' : 'В избранное';
  }

  function toggleFavorite(authorId) {
    if (!authorId) return;
    const items = readFavorites();
    const active = items.includes(authorId);
    const next = active ? items.filter(id => id !== authorId) : [...items, authorId];
    saveFavorites(next);
    syncListButtons();
    ensureProfileButton();
    applyAuthorsFilter();
    if (typeof window.toast === 'function') {
      window.toast(active ? 'Автор удалён из избранного' : 'Автор добавлен в избранное');
    }
  }

  document.addEventListener('click', event => {
    const listButton = event.target.closest('.author-card .author-card-actions .mini');
    if (listButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleFavorite(authorIdFromCard(listButton));
      return;
    }

    const filterButton = event.target.closest('#authorsFavoritesFilter [data-authors-filter]');
    if (filterButton) {
      event.preventDefault();
      activeAuthorsFilter = filterButton.dataset.authorsFilter || 'all';
      applyAuthorsFilter();
      return;
    }

    const profileButton = event.target.closest('#authorProfileFavoriteButton');
    if (profileButton) {
      event.preventDefault();
      toggleFavorite(profileButton.dataset.authorId || currentAuthorIdFromProfile());
    }
  }, true);

  const originalRenderAuthors = window.renderAuthors;
  if (typeof originalRenderAuthors === 'function') {
    window.renderAuthors = function wrappedRenderAuthors(...args) {
      const result = originalRenderAuthors.apply(this, args);
      queueMicrotask(() => { syncListButtons(); applyAuthorsFilter(); });
      return result;
    };
  }

  const originalOpenAuthorProfile = window.openAuthorProfile;
  if (typeof originalOpenAuthorProfile === 'function') {
    window.openAuthorProfile = function wrappedOpenAuthorProfile(...args) {
      const result = originalOpenAuthorProfile.apply(this, args);
      const authorId = args[0] || '';
      setTimeout(() => ensureProfileButton(authorId), 0);
      return result;
    };
  }

  function syncForAccount(){
    activeAuthorsFilter = 'all';
    syncListButtons();
    ensureProfileButton();
    applyAuthorsFilter();
  }

  window.addEventListener('account-changed', syncForAccount);

  document.addEventListener('DOMContentLoaded', () => {
    syncListButtons();
    ensureProfileButton();
    applyAuthorsFilter();
  });
})();
