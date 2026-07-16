(function(){
  'use strict';

  const REWARDS_KEY='subscriptions_rewards_shop_v1';
  const BASE_ACHIEVEMENTS=[
    {title:'Достижение: Первая оплата',subtitle:'Начисление за достижение',points:10,daysAgo:8},
    {title:'Достижение: Постоянный клиент',subtitle:'Начисление за достижение',points:100,daysAgo:6},
    {title:'Достижение: Метроном',subtitle:'Начисление за достижение',points:25,daysAgo:3},
    {title:'Достижение: Первый анализ',subtitle:'Начисление за достижение',points:10,daysAgo:1}
  ];

  function readRewards(){
    try{
      const raw=window.AccountStorage?.getItem(REWARDS_KEY);
      const data=raw?JSON.parse(raw):null;
      return data&&typeof data==='object'?data:{balance:2800,purchased:[]};
    }catch(_){return {balance:2800,purchased:[]};}
  }

  function buildItems(){
    const now=Date.now();
    const items=BASE_ACHIEVEMENTS.map(item=>({
      title:item.title,subtitle:item.subtitle,points:item.points,date:new Date(now-item.daysAgo*86400000)
    }));
    const rewards=readRewards();
    (rewards.purchased||[]).forEach((reward,index)=>{
      const parsed=reward.purchasedAt?new Date(reward.purchasedAt):new Date(now-(index+1)*3600000);
      items.push({
        title:`Покупка: ${reward.title||'Награда'}`,
        subtitle:'Списание в магазине наград',
        points:-Math.abs(Number(reward.cost||reward.pointsCost||0)),
        date:Number.isNaN(parsed.getTime())?new Date():parsed
      });
    });
    return items.sort((a,b)=>b.date-a.date);
  }

  function formatDate(date){
    return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'long',year:'numeric'}).format(date);
  }

  function esc(value){
    return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function render(){
    const rewards=readRewards();
    const balance=document.getElementById('pointsHistoryBalance');
    if(balance) balance.innerHTML=`${Number(rewards.balance||0).toLocaleString('ru-RU')} <small>баллов</small>`;
    const list=document.getElementById('pointsHistoryList');
    if(!list) return;
    const items=buildItems();
    if(!items.length){list.innerHTML='<div class="points-history-empty">История пока пустая</div>';return;}
    list.innerHTML=items.map(item=>{
      const positive=item.points>=0;
      const sign=positive?'+':'−';
      return `<article class="points-history-item ${positive?'positive':'negative'}">
        <div class="points-history-icon"><i class="fa-solid ${positive?'fa-plus':'fa-minus'}"></i></div>
        <div class="points-history-copy"><strong>${esc(item.title)}</strong><span>${esc(item.subtitle)}</span><time class="points-history-date">${formatDate(item.date)}</time></div>
        <div class="points-history-amount">${sign}${Math.abs(item.points).toLocaleString('ru-RU')}</div>
      </article>`;
    }).join('');
  }

  function open(){
    render();
    const overlay=document.getElementById('pointsHistoryOverlay');
    if(!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function close(){
    const overlay=document.getElementById('pointsHistoryOverlay');
    if(!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const trigger=document.getElementById('profilePointsHistoryTrigger');
    trigger?.addEventListener('click',open);
    trigger?.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
    document.getElementById('pointsHistoryClose')?.addEventListener('click',close);
    document.getElementById('pointsHistoryOverlay')?.addEventListener('click',event=>{if(event.target.id==='pointsHistoryOverlay') close();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.getElementById('pointsHistoryOverlay')?.classList.contains('open')) close();});
  });

  const originalBuy=window.buyReward;
  if(typeof originalBuy==='function'){
    window.buyReward=function(id){
      const before=readRewards().purchased?.length||0;
      originalBuy(id);
      const data=readRewards();
      if((data.purchased?.length||0)>before){
        const last=data.purchased[data.purchased.length-1];
        if(last&&!last.purchasedAt){last.purchasedAt=new Date().toISOString();window.AccountStorage?.setItem(REWARDS_KEY,JSON.stringify(data));}
      }
    };
  }

  window.openPointsHistory=open;
  window.closePointsHistory=close;
})();
