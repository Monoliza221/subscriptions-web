(function(){
  'use strict';
  const STORAGE_KEY='profileNotificationsV1';
  const defaults=[
    {id:'welcome',type:'system',title:'Добро пожаловать!',message:'Профиль готов к работе. Здесь будут появляться важные уведомления.',createdAt:Date.now()-3600000,read:false},
    {id:'payment-reminder',type:'payment',title:'Скоро списание',message:'Проверьте ближайшие платежи в календаре подписок.',createdAt:Date.now()-86400000,read:false},
    {id:'achievement',type:'achievement',title:'Новый прогресс',message:'Вы стали ближе к следующему достижению.',createdAt:Date.now()-172800000,read:true}
  ];
  function cloneDefaults(){return defaults.map(item=>({...item}))}
  function load(){try{const raw=AccountStorage.getItem(STORAGE_KEY);const value=raw?JSON.parse(raw):null;return Array.isArray(value)?value:cloneDefaults()}catch(e){return cloneDefaults()}}
  function save(items){AccountStorage.setItem(STORAGE_KEY,JSON.stringify(items));updateBadge(items)}
  function esc(v){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  function meta(type){return ({payment:['fa-credit-card','#f97316'],achievement:['fa-trophy','#8b5cf6'],friend:['fa-user-group','#3b82f6'],system:['fa-bell','#10b981']})[type]||['fa-bell','#64748b']}
  function unreadCount(items){return items.reduce((count,item)=>count+(item.read?0:1),0)}
  function updateBadge(items){
    const badge=document.getElementById('profileNotificationsBadge');
    if(!badge)return;
    const count=unreadCount(items||load());
    badge.textContent=count>99?'99+':String(count);
    badge.hidden=count===0;
    const trigger=document.getElementById('profileNotificationsTrigger');
    if(trigger)trigger.setAttribute('aria-label',count?`Уведомления, непрочитанных: ${count}`:'Уведомления, непрочитанных нет');
  }
  function render(){
    const list=document.getElementById('profileNotificationsList');
    const actions=document.getElementById('profileNotificationsActions');
    if(!list)return;
    const items=load().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    updateBadge(items);
    if(actions)actions.style.display=items.length?'grid':'none';
    if(!items.length){list.innerHTML='<div class="profile-notifications-empty">Уведомлений пока нет</div>';return}
    list.innerHTML=items.map(item=>{
      const [icon,color]=meta(item.type);
      const status=item.read?'Прочитано':'Новое';
      return `<div class="profile-notification-item ${item.read?'is-read':'is-unread'}" data-id="${esc(item.id)}" onclick="markProfileNotificationRead('${esc(item.id)}')">`+
        `<span class="profile-notification-icon" style="--notification-color:${color}"><i class="fa-solid ${icon}"></i></span>`+
        `<span class="profile-notification-copy"><span class="profile-notification-title-row"><strong>${esc(item.title||'Уведомление')}</strong><small>${status}</small></span><p>${esc(item.message||'')}</p></span>`+
        `<button class="profile-notification-delete" type="button" aria-label="Удалить уведомление" onclick="event.stopPropagation();removeProfileNotification('${esc(item.id)}')"><i class="fa-regular fa-trash-can"></i></button>`+
      `</div>`;
    }).join('');
  }
  window.openProfileNotifications=function(){
    const el=document.getElementById('profileNotificationsOverlay');
    if(!el)return;
    render();
    el.classList.add('is-open');
    el.setAttribute('aria-hidden','false');
  };
  window.closeProfileNotifications=function(){const el=document.getElementById('profileNotificationsOverlay');if(!el)return;el.classList.remove('is-open');el.setAttribute('aria-hidden','true')};
  window.markProfileNotificationRead=function(id){
    const items=load();
    let changed=false;
    const next=items.map(item=>{if(String(item.id)===String(id)&&!item.read){changed=true;return {...item,read:true}}return item});
    if(changed){save(next);render()}
  };
  window.markAllProfileNotificationsRead=function(){save(load().map(x=>({...x,read:true})));render();if(typeof toast==='function')toast('Все уведомления прочитаны')};
  window.clearProfileNotifications=function(){save([]);render();if(typeof toast==='function')toast('Уведомления очищены')};
  window.removeProfileNotification=function(id){save(load().filter(x=>String(x.id)!==String(id)));render()};
  window.refreshProfileNotificationsBadge=function(){updateBadge(load())};
  window.addProfileNotification=function(notification){
    const item=notification&&typeof notification==='object'?notification:{};
    const next={
      id:item.id||`notification-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      type:item.type||'system',
      title:item.title||'Новое уведомление',
      message:item.message||'',
      createdAt:Number(item.createdAt)||Date.now(),
      read:false
    };
    const items=load();
    items.unshift(next);
    save(items);
    if(document.getElementById('profileNotificationsOverlay')?.classList.contains('is-open')) render();
    return next;
  };
  window.addEventListener('account-changed',()=>{
    window.closeProfileNotifications();
    updateBadge(load());
  });
  document.addEventListener('DOMContentLoaded',()=>{
    updateBadge(load());
    const el=document.getElementById('profileNotificationsOverlay');
    if(el)el.addEventListener('click',e=>{if(e.target===el)window.closeProfileNotifications()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')window.closeProfileNotifications()});
  });
})();
