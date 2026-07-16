(() => {
  'use strict';

  function menu() {
    return document.getElementById('authorActionsMenu');
  }

  function trigger() {
    return document.getElementById('authorActionsMenuButton');
  }

  function setOpen(open) {
    const root = menu();
    const button = trigger();
    if (!root || !button) return;
    root.classList.toggle('open', open);
    root.setAttribute('aria-hidden', String(!open));
    button.setAttribute('aria-expanded', String(open));
  }

  window.toggleAuthorActionsMenu = function toggleAuthorActionsMenu(event) {
    event?.stopPropagation?.();
    const root = menu();
    if (!root) return;
    setOpen(!root.classList.contains('open'));
  };

  window.closeAuthorActionsMenu = function closeAuthorActionsMenu() {
    setOpen(false);
  };

  window.runAuthorAction = function runAuthorAction(action) {
    window.closeAuthorActionsMenu();
    if (action === 'notifications') {
      if (typeof window.openAuthorNotifications === 'function') {
        window.openAuthorNotifications();
      }
      return;
    }
    if (action === 'share') {
      if (typeof window.shareCurrentAuthorProfile === 'function') {
        window.shareCurrentAuthorProfile();
      }
      return;
    }
    if (action === 'report' && typeof window.openAuthorReport === 'function') {
      window.openAuthorReport();
    }
  };

  document.addEventListener('click', event => {
    const root = menu();
    const button = trigger();
    if (!root?.classList.contains('open')) return;
    if (root.contains(event.target) || button?.contains(event.target)) return;
    setOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu()?.classList.contains('open')) {
      setOpen(false);
      trigger()?.focus();
    }
  });
})();
