(function(){
  const KEY='subscriptions_web_author_reviews_v1';
  const defaults={
    'Мария Дизайнова':[
      {id:'d1',author:'Анна',rating:5,text:'Очень полезные материалы и понятная подача. Особенно понравились разборы интерфейсов.',createdAt:Date.now()-86400000*3,mine:false},
      {id:'d2',author:'Илья',rating:5,text:'Подписка полностью оправдывает себя. Много практики и готовых решений.',createdAt:Date.now()-86400000*8,mine:false},
      {id:'d3',author:'Ольга',rating:4,text:'Хороший контент, хотелось бы больше материалов для начинающих.',createdAt:Date.now()-86400000*15,mine:false}
    ],
    'Алекс Кодеров':[
      {id:'a1',author:'Максим',rating:5,text:'Коротко, по делу и с рабочими примерами.',createdAt:Date.now()-86400000*4,mine:false}
    ],
    'Лина Маркетолог':[
      {id:'l1',author:'Светлана',rating:5,text:'Отличные разборы рекламы и роста продукта.',createdAt:Date.now()-86400000*6,mine:false}
    ]
  };
  let activeAuthor='Мария Дизайнова';
  let selectedRating=0;
  let editingReviewId=null;
  const REVIEW_ACTION_WINDOW_MS=60*60*1000;
  const q=id=>document.getElementById(id);
  function load(){try{const raw=window.AccountStorage?window.AccountStorage.getItem(KEY):localStorage.getItem(KEY);return JSON.parse(raw||'{}')}catch{return {}}}
  function save(v){const raw=JSON.stringify(v);if(window.AccountStorage)window.AccountStorage.setItem(KEY,raw);else localStorage.setItem(KEY,raw)}
  function normalizeOwnReviews(){
    const all=load();
    let changed=false;
    Object.keys(all).forEach(name=>{
      const arr=Array.isArray(all[name])?all[name]:[];
      const mine=arr.filter(item=>item.mine).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
      if(mine.length>1){
        const keep=mine[0].id;
        all[name]=arr.filter(item=>!item.mine||item.id===keep);
        changed=true;
      }
    });
    if(changed)save(all);
  }
  function mineName(){return document.getElementById('profileDisplayName')?.textContent?.trim()||'Вы'}
  function authorName(){return document.getElementById('authorProfileName')?.textContent?.trim()||'Мария Дизайнова'}
  function listFor(name){const stored=load()[name]||[];return [...stored,...(defaults[name]||[])]}
  function stars(r){return Array.from({length:5},(_,i)=>`<i class="fa-${i<r?'solid':'regular'} fa-star"></i>`).join('')}
  function dateText(ts){return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(ts))}
  function totalReviewsCount(name){
    return listFor(name).length;
  }
  function reviewWord(count){
    const mod100=count%100,mod10=count%10;
    if(mod100>=11&&mod100<=14)return 'отзывов';
    if(mod10===1)return 'отзыв';
    if(mod10>=2&&mod10<=4)return 'отзыва';
    return 'отзывов';
  }
  function syncReviewCounts(name=activeAuthor){
    const total=totalReviewsCount(name);
    if(authorName()===name){
      const profileCount=q('authorProfileReviews');
      if(profileCount) profileCount.textContent=String(total);
    }
    document.querySelectorAll('.author-card').forEach(card=>{
      if(card.querySelector('h3')?.textContent?.trim()!==name)return;
      const stats=card.querySelectorAll('.author-card-stats strong');
      if(stats[1]) stats[1].textContent=String(total);
    });
    return total;
  }
  function render(){
    const reviews=listFor(activeAuthor);
    const list=q('authorReviewsList');
    if(list) list.innerHTML=reviews.length?reviews.map(r=>{
      const manageable=r.mine&&canManage(r);
      const actions=r.mine?(manageable
        ? `<div class="author-review-own-actions"><button type="button" class="author-review-edit" data-review-id="${r.id}">Изменить</button><span>${remainingText(r)}</span><button type="button" class="author-review-delete" data-review-id="${r.id}">Удалить</button></div>`
        : '<div class="author-review-expired">Изменение и удаление недоступны</div>')
        : '';
      return `<article class="author-review-item ${r.mine?'mine':''}"><div class="author-review-avatar">${(r.author||'П').charAt(0).toUpperCase()}</div><div class="author-review-body"><div class="author-review-top"><div><strong>${escapeHtml(r.author)}</strong><div class="author-review-stars">${stars(r.rating)}</div></div><time>${dateText(r.createdAt)}</time></div>${r.text?`<p>${escapeHtml(r.text)}</p>`:''}${actions}</div></article>`;
    }).join(''):'<div class="author-reviews-empty">Пока нет отзывов</div>';
    const score=parseFloat(document.getElementById('authorProfileRating')?.textContent||'4.9');
    const total=syncReviewCounts(activeAuthor);
    q('authorReviewsScore').textContent=score.toFixed(1);
    q('authorReviewsCount').textContent=`${total} ${reviewWord(total)}`;
    q('authorReviewsSummaryStars').innerHTML=stars(Math.round(score));
    const add=q('authorReviewsAdd');
    const mine=ownReview();
    if(add){
      add.textContent=mine?(canManage(mine)?'Изменить отзыв':'Отзыв оставлен'):'Оставить отзыв';
      add.disabled=!!mine&&!canManage(mine);
    }
  }
  function escapeHtml(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  function ownReview(name=activeAuthor){return (load()[name]||[]).find(item=>item.mine)||null}
  function canManage(review){return !!review&&Date.now()-Number(review.createdAt||0)<REVIEW_ACTION_WINDOW_MS}
  function remainingText(review){
    const left=Math.max(0,REVIEW_ACTION_WINDOW_MS-(Date.now()-Number(review.createdAt||0)));
    const minutes=Math.max(1,Math.ceil(left/60000));
    return `ещё ${minutes} мин`;
  }
  function resetForm(){
    selectedRating=0;
    editingReviewId=null;
    const text=q('authorReviewText'); if(text) text.value='';
    const form=q('authorReviewForm'); if(form) form.hidden=true;
    const submit=q('authorReviewSubmit'); if(submit){submit.disabled=true;submit.textContent='Опубликовать'}
    updateStars();
  }
  function openComposer(review=null){
    const existing=review||ownReview();
    if(existing&&!canManage(existing)){
      if(typeof toast==='function')toast('Отзыв уже оставлен. Время изменения истекло');
      return;
    }
    editingReviewId=existing?.id||null;
    selectedRating=Number(existing?.rating||0);
    const text=q('authorReviewText'); if(text) text.value=existing?.text||'';
    const form=q('authorReviewForm'); if(form) form.hidden=false;
    const submit=q('authorReviewSubmit'); if(submit){submit.disabled=!selectedRating;submit.textContent=editingReviewId?'Сохранить':'Опубликовать'}
    updateStars();
    text?.focus();
  }
  function updateStars(){document.querySelectorAll('#authorReviewRating button').forEach(b=>{const on=Number(b.dataset.rating)<=selectedRating;b.classList.toggle('active',on);b.querySelector('i').className=`fa-${on?'solid':'regular'} fa-star`})}
  function open(){activeAuthor=authorName();q('authorReviewsTitle').textContent=`Отзывы · ${document.getElementById('authorProfileRating')?.textContent||'4.9'} ★`;q('authorReviewsSubtitle').textContent=activeAuthor;render();resetForm();const o=q('authorReviewsOverlay');o.classList.add('open');o.setAttribute('aria-hidden','false');document.body.classList.add('modal-open')}
  function close(){const o=q('authorReviewsOverlay');o.classList.remove('open');o.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');resetForm()}
  function publish(){
    const text=q('authorReviewText').value.trim();
    if(!selectedRating)return;
    const all=load();
    const arr=all[activeAuthor]||[];
    const existingIndex=arr.findIndex(item=>item.mine);
    if(existingIndex>=0){
      const existing=arr[existingIndex];
      if(!canManage(existing)){if(typeof toast==='function')toast('Время изменения отзыва истекло');resetForm();render();return}
      arr[existingIndex]={...existing,rating:selectedRating,text,updatedAt:Date.now()};
    }else{
      arr.unshift({id:`r_${Date.now()}`,author:mineName(),rating:selectedRating,text,createdAt:Date.now(),mine:true});
    }
    all[activeAuthor]=arr;save(all);resetForm();render();
    if(typeof toast==='function')toast(existingIndex>=0?'Отзыв изменён':'Отзыв опубликован');
  }
  function remove(id){
    const all=load();
    const review=(all[activeAuthor]||[]).find(x=>x.id===id&&x.mine);
    if(!review)return;
    if(!canManage(review)){if(typeof toast==='function')toast('Время удаления отзыва истекло');render();return}
    all[activeAuthor]=(all[activeAuthor]||[]).filter(x=>x.id!==id);save(all);resetForm();render();if(typeof toast==='function')toast('Отзыв удалён');
  }

  document.addEventListener('click',e=>{
    const reviewsCount=e.target.closest('#authorProfileReviews');
    const rating=e.target.closest('#authorProfileRating');
    if((reviewsCount||rating)&&document.getElementById('view-author-profile')?.classList.contains('active')){e.preventDefault();open();return}
    if(e.target.closest('#authorReviewsClose')){close();return}
    if(e.target===q('authorReviewsOverlay')){close();return}
    if(e.target.closest('#authorReviewsAdd')){openComposer();return}
    if(e.target.closest('#authorReviewCancel')){resetForm();return}
    const rate=e.target.closest('#authorReviewRating button');if(rate){selectedRating=Number(rate.dataset.rating);updateStars();q('authorReviewSubmit').disabled=!selectedRating;return}
    if(e.target.closest('#authorReviewSubmit')){publish();return}
    const edit=e.target.closest('.author-review-edit');if(edit){const review=(load()[activeAuthor]||[]).find(x=>x.id===edit.dataset.reviewId);openComposer(review);return}
    const del=e.target.closest('.author-review-delete');if(del&&confirm('Удалить ваш отзыв?'))remove(del.dataset.reviewId)
  });
  q('authorReviewText')?.addEventListener('input',()=>{q('authorReviewSubmit').disabled=!selectedRating});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&q('authorReviewsOverlay')?.classList.contains('open'))close()});

  const originalOpenAuthorProfile=window.openAuthorProfile;
  if(typeof originalOpenAuthorProfile==='function'){
    window.openAuthorProfile=function(id){
      originalOpenAuthorProfile(id);
      setTimeout(()=>syncReviewCounts(authorName()),0);
    };
  }
  document.addEventListener('DOMContentLoaded',()=>{
    normalizeOwnReviews();
    Object.keys(defaults).forEach(name=>syncReviewCounts(name));
  });
  window.addEventListener('account-changed',()=>{
    if(q('authorReviewsOverlay')?.classList.contains('open')) close();
    normalizeOwnReviews();
    Object.keys(defaults).forEach(name=>syncReviewCounts(name));
  });
  window.openAuthorReviews=open;
  window.openAuthorReviewComposer=function(){
    open();
    window.setTimeout(()=>{
      openComposer();
    },0);
  };
})();
