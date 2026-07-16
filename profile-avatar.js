(function(){
  'use strict';

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const MAX_IMAGE_SIDE = 512;

  function getProfile(){
    try{
      if(!state.user) state.user = {};
      if(!state.user.profile || typeof state.user.profile !== 'object') state.user.profile = {};
      return state.user.profile;
    }catch(error){
      return null;
    }
  }

  function avatarUrl(){
    return getProfile()?.avatarDataUrl || '';
  }

  function setAvatarElement(element, dataUrl){
    if(!element) return;
    if(dataUrl){
      element.classList.add('has-profile-photo');
      element.style.backgroundImage = `url("${dataUrl.replace(/"/g, '%22')}")`;
      element.textContent = '';
      element.setAttribute('aria-label', 'Фотография профиля');
    }else{
      element.classList.remove('has-profile-photo');
      element.style.backgroundImage = '';
      const name = (typeof getAccountDisplayName === 'function' ? getAccountDisplayName() : '') || 'П';
      element.textContent = (name.charAt(0) || 'П').toUpperCase();
      element.removeAttribute('aria-label');
    }
  }

  function applyProfileAvatar(){
    const dataUrl = avatarUrl();
    setAvatarElement(document.getElementById('profileAvatarLetter'), dataUrl);
    setAvatarElement(document.getElementById('accountEditAvatar'), dataUrl);

    document.querySelectorAll('.dashboard-avatar, .user-avatar').forEach(element => {
      if(!element.dataset.profileAvatarTarget) return;
      setAvatarElement(element, dataUrl);
    });
  }

  function persistAvatar(dataUrl){
    const profile = getProfile();
    if(!profile) return;
    profile.avatarDataUrl = dataUrl || '';
    if(typeof saveState === 'function') saveState();
    applyProfileAvatar();
  }

  function resizeImage(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Не удалось открыть изображение'));
        image.onload = () => {
          const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * ratio));
          const height = Math.max(1, Math.round(image.height * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file){
    if(!file) return;
    if(!file.type.startsWith('image/')){
      if(typeof toast === 'function') toast('Выберите изображение');
      return;
    }
    if(file.size > MAX_FILE_SIZE){
      if(typeof toast === 'function') toast('Файл должен быть меньше 5 МБ');
      return;
    }
    try{
      const dataUrl = await resizeImage(file);
      persistAvatar(dataUrl);
      closeAvatarMenu();
      if(typeof toast === 'function') toast('Фотография профиля обновлена');
    }catch(error){
      if(typeof toast === 'function') toast(error.message || 'Не удалось загрузить фотографию');
    }
  }

  function ensureFileInput(){
    let input = document.getElementById('profileAvatarFileInput');
    if(input) return input;
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'profileAvatarFileInput';
    input.accept = 'image/*';
    input.hidden = true;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      handleFile(file);
    });
    document.body.appendChild(input);
    return input;
  }

  function ensureAvatarMenu(){
    let overlay = document.getElementById('profileAvatarMenuOverlay');
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'profileAvatarMenuOverlay';
    overlay.className = 'profile-avatar-menu-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="profile-avatar-menu" role="dialog" aria-modal="true" aria-labelledby="profileAvatarMenuTitle">
        <div class="profile-avatar-menu-head">
          <h3 id="profileAvatarMenuTitle">Фотография профиля</h3>
          <button type="button" class="profile-avatar-menu-close" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <button type="button" class="profile-avatar-menu-action" data-avatar-action="choose">
          <i class="fa-regular fa-image"></i><span>Выбрать фотографию</span>
        </button>
        <button type="button" class="profile-avatar-menu-action danger" data-avatar-action="remove">
          <i class="fa-regular fa-trash-can"></i><span>Удалить фотографию</span>
        </button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => {
      if(event.target === overlay) closeAvatarMenu();
    });
    overlay.querySelector('.profile-avatar-menu-close')?.addEventListener('click', closeAvatarMenu);
    overlay.querySelector('[data-avatar-action="choose"]')?.addEventListener('click', () => ensureFileInput().click());
    overlay.querySelector('[data-avatar-action="remove"]')?.addEventListener('click', () => {
      if(!avatarUrl()){
        if(typeof toast === 'function') toast('Фотография профиля не установлена');
        return;
      }
      persistAvatar('');
      closeAvatarMenu();
      if(typeof toast === 'function') toast('Фотография профиля удалена');
    });
    return overlay;
  }

  function openAvatarMenu(){
    const overlay = ensureAvatarMenu();
    const removeButton = overlay.querySelector('[data-avatar-action="remove"]');
    if(removeButton) removeButton.hidden = !avatarUrl();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeAvatarMenu(){
    const overlay = document.getElementById('profileAvatarMenuOverlay');
    if(!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function bindCameraButton(){
    const button = document.querySelector('.profile-web-cam');
    if(!button) return;
    button.removeAttribute('onclick');
    button.addEventListener('click', openAvatarMenu);
  }

  const originalRenderAccountIdentity = window.renderAccountIdentity;
  if(typeof originalRenderAccountIdentity === 'function'){
    window.renderAccountIdentity = function(){
      const result = originalRenderAccountIdentity.apply(this, arguments);
      applyProfileAvatar();
      return result;
    };
  }

  window.openProfileAvatarMenu = openAvatarMenu;
  window.closeProfileAvatarMenu = closeAvatarMenu;
  window.applyProfileAvatar = applyProfileAvatar;

  document.addEventListener('keydown', event => {
    if(event.key === 'Escape') closeAvatarMenu();
  });

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      bindCameraButton();
      applyProfileAvatar();
    });
  }else{
    bindCameraButton();
    applyProfileAvatar();
  }
})();
