(() => {
  'use strict';

  const STORAGE_PREFIX = 'subscriptions_web_author_banner_v1:';
  const MAX_FILE_SIZE = 8 * 1024 * 1024;
  const DEFAULT_BACKGROUNDS = {
    maria: 'radial-gradient(circle at 18% 22%, rgba(255,255,255,.28), transparent 28%), linear-gradient(125deg,#342f58 0%,#7658c8 48%,#ed7d59 100%)',
    alex: 'radial-gradient(circle at 78% 18%, rgba(255,255,255,.24), transparent 26%), linear-gradient(125deg,#163a67 0%,#2476b8 48%,#3cbf8b 100%)',
    lina: 'radial-gradient(circle at 24% 22%, rgba(255,255,255,.24), transparent 26%), linear-gradient(125deg,#51265f 0%,#a044b3 48%,#ef668c 100%)'
  };

  function currentAuthorId() {
    if (window.currentAuthorProfileId) return String(window.currentAuthorProfileId);
    const handle = document.getElementById('authorProfileHandle')?.textContent?.trim();
    const map = {
      '@maria_designs': 'maria',
      '@alex_code': 'alex',
      '@lina_growth': 'lina'
    };
    return map[handle] || 'maria';
  }

  function storageKey(authorId) {
    return `${STORAGE_PREFIX}${authorId}`;
  }

  function readBanner(authorId) {
    const key = storageKey(authorId);
    try {
      const scoped = window.AccountStorage?.getItem(key);
      if (scoped) return scoped;
      return localStorage.getItem(key) || '';
    } catch (_) {
      return '';
    }
  }

  function writeBanner(authorId, dataUrl) {
    const key = storageKey(authorId);
    try {
      if (window.AccountStorage?.setItem(key, dataUrl)) return true;
      localStorage.setItem(key, dataUrl);
      return true;
    } catch (_) {
      return false;
    }
  }

  function applyBanner() {
    const banner = document.getElementById('authorProfileBanner');
    if (!banner) return;
    const authorId = currentAuthorId();
    const saved = readBanner(authorId);
    banner.dataset.authorId = authorId;
    banner.classList.toggle('has-custom-image', Boolean(saved));
    banner.style.backgroundImage = saved
      ? `url(${JSON.stringify(saved)})`
      : (DEFAULT_BACKGROUNDS[authorId] || DEFAULT_BACKGROUNDS.maria);
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('image'));
        image.onload = () => {
          const maxWidth = 1600;
          const maxHeight = 650;
          const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('canvas'));
            return;
          }
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.84));
        };
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  async function saveSelectedBanner(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.toast?.('Выберите изображение');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      window.toast?.('Изображение должно быть меньше 8 МБ');
      return;
    }

    const button = document.getElementById('authorBannerEditButton');
    if (button) button.disabled = true;
    try {
      const dataUrl = await compressImage(file);
      const saved = writeBanner(currentAuthorId(), dataUrl);
      if (!saved) throw new Error('storage');
      applyBanner();
      window.toast?.('Баннер обновлён');
    } catch (_) {
      window.toast?.('Не удалось сохранить баннер');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function init() {
    const button = document.getElementById('authorBannerEditButton');
    const input = document.getElementById('authorBannerInput');
    if (!button || !input || button.dataset.ready === 'true') return;
    button.dataset.ready = 'true';
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      saveSelectedBanner(file);
      input.value = '';
    });
    applyBanner();
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('author-profile-changed', applyBanner);
  window.addEventListener('account-changed', applyBanner);
})();
