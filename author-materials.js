(function(){
  'use strict';

  const details = [
    {
      type:'Статья',
      title:'10 принципов современного UI для мобильных приложений',
      meta:'2 дня назад · 8 мин чтения',
      intro:'Современный интерфейс должен быть не только красивым, но и понятным, быстрым и предсказуемым для пользователя.',
      sections:[
        ['Начинайте с иерархии','Пользователь должен сразу понимать, что на экране главное, а что относится к дополнительным действиям.'],
        ['Сокращайте визуальный шум','Каждый цвет, отступ и декоративный элемент должен помогать восприятию, а не отвлекать от задачи.'],
        ['Проверяйте состояния','Загрузка, ошибка, пустой список и успешное действие являются частью интерфейса и должны быть продуманы заранее.']
      ]
    },
    {
      type:'Premium',
      title:'Секретный гайд: Figma + AI для дизайнеров',
      meta:'5 дней назад · Premium-материал',
      premium:true,
      intro:'Практический набор сценариев, который помогает ускорить исследование, подготовку компонентов и оформление дизайн-системы.',
      sections:[
        ['Подготовка структуры','Сначала формируется карта экранов и состояний, после чего AI используется для проверки полноты сценариев.'],
        ['Работа с компонентами','Повторяющиеся элементы объединяются в компоненты с понятными вариантами и едиными токенами.'],
        ['Финальная проверка','Перед передачей макета проверяются названия слоёв, адаптивность и все интерактивные состояния.']
      ]
    },
    {
      type:'Статья',
      title:'Психология цвета в digital-продуктах',
      meta:'1 неделю назад · 6 мин чтения',
      intro:'Цвет влияет на внимание, ощущение надёжности и скорость принятия решения, но работает только вместе с контрастом и контекстом.',
      sections:[
        ['Акцентный цвет','Используйте акцент для главного действия и не заставляйте несколько элементов конкурировать друг с другом.'],
        ['Контраст','Текст и управляющие элементы должны оставаться читаемыми в светлой и тёмной теме.'],
        ['Последовательность','Одинаковый смысл должен обозначаться одинаковым цветом на всех экранах продукта.']
      ]
    },
    {
      type:'Статья',
      title:'Дизайн-система с нуля за один спринт',
      meta:'2 недели назад · 12 мин чтения',
      intro:'Даже небольшому продукту полезен минимальный набор токенов, компонентов и правил, который снижает количество случайных расхождений.',
      sections:[
        ['Токены','Зафиксируйте основные цвета, размеры, радиусы и отступы до создания большого количества экранов.'],
        ['Компоненты','Начните с кнопок, полей, карточек и модальных окон, которые используются чаще всего.'],
        ['Документация','Короткое описание состояний компонента полезнее большой документации, которую никто не обновляет.']
      ]
    }
  ];

  let overlay;
  let activeIndex = 0;
  const PREMIUM_STORAGE_KEY = 'author_material_premium_unlocked_v2';

  function currentAuthorId(){
    if(window.currentAuthorProfileId) return String(window.currentAuthorProfileId);
    const handle = document.getElementById('authorProfileHandle')?.textContent?.trim();
    return handle || 'default-author';
  }

  function premiumStorageKey(){
    return `${PREMIUM_STORAGE_KEY}:${currentAuthorId()}:premium-guide`;
  }

  function readPremiumUnlocked(){
    try{
      const raw = window.AccountStorage
        ? window.AccountStorage.getItem(premiumStorageKey())
        : localStorage.getItem(premiumStorageKey());
      return raw === '1' || raw === 'true';
    }catch(_){
      return false;
    }
  }

  function savePremiumUnlocked(){
    try{
      if(window.AccountStorage) window.AccountStorage.setItem(premiumStorageKey(), '1');
      else localStorage.setItem(premiumStorageKey(), '1');
    }catch(_){ }
  }

  function isPremiumUnlocked(){
    return readPremiumUnlocked();
  }

  function refreshPremiumCards(){
    if(window.AuthorContentTabs && typeof window.AuthorContentTabs.render === 'function'){
      window.AuthorContentTabs.render();
    }else if(typeof window.renderAuthorContent === 'function'){
      window.renderAuthorContent();
    }
  }

  function purchasePremium(index){
    const targetIndex = Number.isInteger(index) ? index : 1;
    savePremiumUnlocked();
    if(window.authorButtonState) window.authorButtonState.premiumBought = true;
    refreshPremiumCards();
    if(typeof window.toast === 'function') window.toast('Премиум-материал открыт');

    if(overlay && overlay.classList.contains('is-open')){
      render(targetIndex);
      requestAnimationFrame(function(){
        const bodyRoot = document.getElementById('authorMaterialBody');
        if(bodyRoot) bodyRoot.scrollTop = 0;
      });
    }else{
      open(targetIndex);
    }
  }

  function ensureOverlay(){
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'author-material-overlay';
    overlay.id = 'authorMaterialOverlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML = `
      <div class="author-material-dialog" role="dialog" aria-modal="true" aria-labelledby="authorMaterialTitle">
        <div class="author-material-head">
          <div>
            <span class="author-material-type" id="authorMaterialType"></span>
            <h2 id="authorMaterialTitle"></h2>
            <p id="authorMaterialMeta"></p>
          </div>
          <button class="author-material-close" type="button" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="author-material-body" id="authorMaterialBody"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });
    overlay.querySelector('.author-material-close').addEventListener('click', close);
    return overlay;
  }

  function render(index){
    const item = details[index] || details[0];
    const root = ensureOverlay();
    root.querySelector('#authorMaterialType').textContent = item.type;
    root.querySelector('#authorMaterialTitle').textContent = item.title;
    root.querySelector('#authorMaterialMeta').textContent = item.meta;
    const body = root.querySelector('#authorMaterialBody');

    if(item.premium && !isPremiumUnlocked()){
      body.innerHTML = `
        <div class="author-material-locked">
          <div class="author-material-lock-icon"><i class="fa-solid fa-crown"></i></div>
          <h3>Материал доступен после покупки</h3>
          <p>Откройте Premium-материал, чтобы прочитать полный текст.</p>
          <button type="button" id="authorMaterialBuy">Купить за 299 ₽</button>
        </div>`;
      body.querySelector('#authorMaterialBuy').addEventListener('click', function(){
        purchasePremium(index);
      });
      return;
    }

    body.innerHTML = `
      <p class="author-material-intro">${item.intro}</p>
      ${item.sections.map(([title,text])=>`<section><h3>${title}</h3><p>${text}</p></section>`).join('')}
      <div class="author-material-end">Материал прочитан</div>`;
  }

  function open(index){
    activeIndex = index;
    render(index);
    const root = ensureOverlay();
    root.classList.add('is-open');
    root.setAttribute('aria-hidden','false');
    document.body.classList.add('author-material-open');
  }

  function close(){
    if(!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('author-material-open');
  }

  document.addEventListener('click', function(e){
    const card = e.target.closest('#view-author-profile .author-content-card');
    if(!card) return;
    if(card.classList.contains('author-media-card')) return;
    if(e.target.closest('.author-content-reactions, .author-paywall button, .author-content-favorite-btn')) return;
    const cards = Array.from(document.querySelectorAll('#view-author-profile .author-content-card'));
    const index = cards.indexOf(card);
    if(index < 0) return;
    e.preventDefault();
    open(index);
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && overlay && overlay.classList.contains('is-open')) close();
  });

  window.AuthorMaterials = {
    open,
    close,
    isPremiumUnlocked,
    purchaseAndOpen: function(){ purchasePremium(1); }
  };

  window.addEventListener('author-profile-changed', function(){
    if(overlay?.classList.contains('is-open')) close();
    if(window.AuthorContentTabs && typeof window.AuthorContentTabs.render === 'function'){
      window.AuthorContentTabs.render();
    }else if(typeof window.renderAuthorContent === 'function'){
      window.renderAuthorContent();
    }
  });

  window.addEventListener('account-changed', function(){
    const unlocked = readPremiumUnlocked();
    document.querySelectorAll('#view-author-profile .author-paywall button').forEach(button=>{
      button.disabled = unlocked;
      button.textContent = unlocked ? 'Куплено' : 'Купить за 299 ₽';
    });
    if(overlay?.classList.contains('is-open')) close();
  });
})();
