(() => {
  'use strict';

  const STATE_KEY = 'author_subscription_state_v1';
  const REASON_KEY = 'author_subscription_cancel_reason_v1';
  const reasons = ['Слишком дорого', 'Не нравится контент', '⏰ Нет времени смотреть', 'Другое'];
  let selectedReason = '';

  function readScoped(key) {
    if (window.AccountStorage) return window.AccountStorage.getItem(key);
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function writeScoped(key, value) {
    if (window.AccountStorage) return window.AccountStorage.setItem(key, value);
    try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
  }


  function currentAuthorKey() {
    const handle = document.getElementById('authorProfileHandle')?.textContent?.trim();
    const name = document.getElementById('authorProfileName')?.textContent?.trim();
    return handle || name || 'author';
  }

  function scopedAuthorKey(baseKey) {
    return `${baseKey}:${currentAuthorKey()}`;
  }

  function ensureOverlay() {
    let overlay = document.getElementById('authorCancelSubscriptionOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'authorCancelSubscriptionOverlay';
    overlay.className = 'author-cancel-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="author-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="authorCancelTitle">
        <div class="author-cancel-head">
          <div>
            <h2 id="authorCancelTitle">Отменить подписку?</h2>
            <p>Доступ сохранится до 27.06.2026</p>
          </div>
          <button class="author-cancel-close" type="button" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="author-cancel-reasons"></div>
        <button class="author-cancel-confirm" type="button" disabled>Отменить подписку</button>
        <button class="author-cancel-back" type="button">Передумал(а)</button>
      </div>`;
    document.body.appendChild(overlay);
    renderReasons();
    return overlay;
  }

  function renderReasons() {
    const overlay = document.getElementById('authorCancelSubscriptionOverlay');
    if (!overlay) return;
    const list = overlay.querySelector('.author-cancel-reasons');
    list.innerHTML = reasons.map(reason => `
      <button type="button" class="author-cancel-reason${selectedReason === reason ? ' is-selected' : ''}" data-reason="${reason.replace(/"/g, '&quot;')}">
        <span>${reason}</span><span class="author-cancel-radio" aria-hidden="true"></span>
      </button>`).join('');
    overlay.querySelector('.author-cancel-confirm').disabled = !selectedReason;
  }

  function open() {
    selectedReason = '';
    const overlay = ensureOverlay();
    renderReasons();
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('author-cancel-modal-open');
  }

  function close() {
    const overlay = document.getElementById('authorCancelSubscriptionOverlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('author-cancel-modal-open');
  }

  function syncSavedState() {
    const saved = readScoped(scopedAuthorKey(STATE_KEY));
    authorButtonState.subscribed = saved !== 'unsubscribed';
    if (typeof refreshAuthorSubscribeButton === 'function') refreshAuthorSubscribeButton();
  }

  function confirmCancel() {
    if (!selectedReason) return;
    writeScoped(scopedAuthorKey(REASON_KEY), selectedReason);
    writeScoped(scopedAuthorKey(STATE_KEY), 'unsubscribed');
    authorButtonState.subscribed = false;
    if (typeof refreshAuthorSubscribeButton === 'function') refreshAuthorSubscribeButton();
    close();
    if (typeof window.toast === 'function') window.toast('Подписка отменена');
  }

  document.addEventListener('click', event => {
    const subscribeButton = event.target.closest('#view-author-profile .author-subscribe-btn');
    if (subscribeButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (authorButtonState.subscribed) {
        open();
      } else if (window.AuthorPlanPicker?.open) {
        window.AuthorPlanPicker.open();
      }
      return;
    }

    const reason = event.target.closest('.author-cancel-reason');
    if (reason) {
      selectedReason = reason.dataset.reason || '';
      renderReasons();
      return;
    }

    if (event.target.closest('.author-cancel-confirm')) {
      confirmCancel();
      return;
    }

    if (event.target.closest('.author-cancel-close, .author-cancel-back') || event.target.id === 'authorCancelSubscriptionOverlay') {
      close();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });

  document.addEventListener('DOMContentLoaded', syncSavedState);
  window.addEventListener('account-changed', syncSavedState);

  window.AuthorCancelSubscription = { open, close, sync: syncSavedState };
})();
