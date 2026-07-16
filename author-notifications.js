(() => {
  'use strict';

  const DEFAULTS = { posts: true, live: true, comments: false };
  let activeAuthorKey = 'default';

  function getAuthorKey() {
    const handle = document.getElementById('authorProfileHandle')?.textContent?.trim();
    const name = document.getElementById('authorProfileName')?.textContent?.trim();
    return (handle || name || 'default').toLowerCase().replace(/[^a-zа-я0-9_-]+/gi, '_');
  }

  function storageKey(authorKey) {
    return `author_notifications_v1:${authorKey}`;
  }

  function readSettings(authorKey) {
    try {
      const raw = window.AccountStorage?.getItem(storageKey(authorKey)) ?? localStorage.getItem(storageKey(authorKey));
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function writeSettings(authorKey, value) {
    const raw = JSON.stringify(value);
    if (window.AccountStorage) window.AccountStorage.setItem(storageKey(authorKey), raw);
    else localStorage.setItem(storageKey(authorKey), raw);
  }

  function overlay() {
    return document.getElementById('authorNotificationsOverlay');
  }

  function setOpen(open) {
    const root = overlay();
    if (!root) return;
    root.classList.toggle('open', open);
    root.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('author-notifications-open', open);
  }

  function fillForm(settings) {
    const posts = document.getElementById('authorNotifyPosts');
    const live = document.getElementById('authorNotifyLive');
    const comments = document.getElementById('authorNotifyComments');
    if (posts) posts.checked = Boolean(settings.posts);
    if (live) live.checked = Boolean(settings.live);
    if (comments) comments.checked = Boolean(settings.comments);
  }

  window.openAuthorNotifications = function openAuthorNotifications() {
    activeAuthorKey = getAuthorKey();
    fillForm(readSettings(activeAuthorKey));
    setOpen(true);
  };

  window.closeAuthorNotifications = function closeAuthorNotifications() {
    setOpen(false);
  };

  window.saveAuthorNotifications = function saveAuthorNotifications() {
    writeSettings(activeAuthorKey, {
      posts: Boolean(document.getElementById('authorNotifyPosts')?.checked),
      live: Boolean(document.getElementById('authorNotifyLive')?.checked),
      comments: Boolean(document.getElementById('authorNotifyComments')?.checked)
    });
    setOpen(false);
    if (typeof window.toast === 'function') window.toast('Настройки уведомлений сохранены');
  };

  document.addEventListener('click', event => {
    const root = overlay();
    if (root?.classList.contains('open') && event.target === root) setOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay()?.classList.contains('open')) setOpen(false);
  });

  window.addEventListener('account-changed', ()=>setOpen(false));
})();
