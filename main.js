// ================== STATE ==================
const STORAGE_KEY = 'mysubs_state_v1';
let state = loadState() || {
    user: null,
    subscriptions: [],
    wallet: { balance: 0, autoTopup: null, transactions: [] },
    merchants: [],
    history: [],
};
let tmpPhone = '';
let editingId = null;
let dashboardCalendarMonth = null;

function loadState(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)); }catch(e){ return null; } }
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function uid(){ return Math.random().toString(36).slice(2,10); }
function fmt(n, cur='RUB'){
    const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '₽';
    const formatted = Math.round(n).toLocaleString('ru-RU');
    return cur === 'RUB' ? `${formatted} ${sym}` : `${sym}${formatted}`;
}
function daysUntil(dateStr){
    const d = new Date(dateStr); d.setHours(0,0,0,0);
    const now = new Date(); now.setHours(0,0,0,0);
    return Math.round((d - now) / 86400000);
}

function shortDaysLabel(days){
    if(days < 0) return `${Math.abs(days)}д назад`;
    if(days === 0) return 'Сегодня';
    if(days === 1) return 'Завтра';
    return `${days}д`;
}
function greetingLabel(){
    const h = new Date().getHours();
    if(h >= 5 && h < 12) return 'Доброе утро 👋';
    if(h >= 12 && h < 18) return 'Добрый день 👋';
    if(h >= 18 && h < 22) return 'Добрый вечер 👋';
    return 'Доброй ночи 👋';
}
function monthlyAmount(s){
    if(s.cycle === 'yearly') return s.amount / 12;
    if(s.cycle === 'weekly') return s.amount * 4.33;
    return s.amount;
}
function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(()=> t.classList.remove('show'), 2200);
}

// ================== DEMO SEED ==================
function seedDemo(phone){
    const today = new Date();
    const addDays = d => { const x = new Date(today); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10); };
    state.user = { phone, name: 'Вы' };
    state.subscriptions = [
        { id:uid(), name:'Netflix', amount:799, currency:'RUB', cycle:'monthly', next:addDays(2), category:'entertainment', active:true, color:'#e50914' },
        { id:uid(), name:'Яндекс Плюс', amount:399, currency:'RUB', cycle:'monthly', next:addDays(5), category:'entertainment', active:true, color:'#ffcc00', textDark:true },
        { id:uid(), name:'Spotify', amount:299, currency:'RUB', cycle:'monthly', next:addDays(12), category:'entertainment', active:true, color:'#1db954' },
        { id:uid(), name:'GitHub Copilot', amount:10, currency:'USD', cycle:'monthly', next:addDays(8), category:'software', active:true, color:'#24292e' },
        { id:uid(), name:'Notion', amount:8, currency:'USD', cycle:'monthly', next:addDays(20), category:'software', active:true, color:'#000000' },
        { id:uid(), name:'iCloud+ 200GB', amount:199, currency:'RUB', cycle:'monthly', next:addDays(1), category:'software', active:true, color:'#3b82f6' },
        { id:uid(), name:'МТС Домашний интернет', amount:599, currency:'RUB', cycle:'monthly', next:addDays(14), category:'communication', active:true, color:'#ed2024' },
    ];
    state.wallet = {
        balance: 1250,
        autoTopup: null,
        transactions: [
            { id:uid(), type:'deposit', amount:1000, date:addDays(-3), title:'Пополнение с карты **4242' },
            { id:uid(), type:'payment', amount:799, date:addDays(-5), title:'Netflix' },
            { id:uid(), type:'deposit', amount:2000, date:addDays(-10), title:'Пополнение с карты **4242' },
        ]
    };
    state.history = [
        { date:addDays(-2), name:'Spotify', amount:299, currency:'RUB', status:'success' },
        { date:addDays(-5), name:'Netflix', amount:799, currency:'RUB', status:'success' },
        { date:addDays(-8), name:'iCloud+ 200GB', amount:199, currency:'RUB', status:'success' },
        { date:addDays(-15), name:'Яндекс Плюс', amount:399, currency:'RUB', status:'success' },
        { date:addDays(-22), name:'Netflix', amount:799, currency:'RUB', status:'success' },
        { date:addDays(-35), name:'GitHub Copilot', amount:900, currency:'RUB', status:'success' },
    ];
    state.merchants = [
        { id:uid(), name:'Закрытый клуб инвесторов', desc:'Еженедельные обзоры рынка и рекомендации', amount:490, cycle:'monthly', subscribers:23, earned:11270 },
    ];
    saveState();
}

// ================== AUTH ==================
function sendCode(){
    const phone = document.getElementById('phoneInput').value.trim();
    const consent = document.getElementById('consent').checked;
    if(phone.replace(/\D/g,'').length < 10){ toast('Введите корректный номер'); return; }
    if(!consent){ toast('Нужно согласие с условиями'); return; }
    tmpPhone = phone;
    document.getElementById('phoneDisplay').textContent = phone;
    document.getElementById('authStep1').style.display = 'none';
    document.getElementById('authStep2').style.display = 'block';
    document.getElementById('codeInput').focus();
}
function backToStep1(){
    document.getElementById('authStep1').style.display = 'block';
    document.getElementById('authStep2').style.display = 'none';
}
function verifyCode(){
    const code = document.getElementById('codeInput').value.trim();
    if(code !== '123456'){ toast('Неверный код. Демо-код: 123456'); return; }
    if(!state.user) seedDemo(tmpPhone);
    enterApp();
}
function enterApp(){
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appRoot').style.display = 'grid';
    document.getElementById('settingsPhone').value = state.user.phone;
    renderAll();
}
function logout(){
    state.user = null; saveState();
    document.getElementById('authScreen').style.display = 'grid';
    document.getElementById('appRoot').style.display = 'none';
    backToStep1();
}
function deleteAccount(){
    state = { user:null, subscriptions:[], wallet:{balance:0, autoTopup:null, transactions:[]}, merchants:[], history:[] };
    localStorage.removeItem(STORAGE_KEY);
    logout(); toast('Аккаунт удалён');
}

// ================== NAV ==================
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});
function switchView(name){
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
}

// ================== RENDER ==================
function renderAll(){
    renderDashboard();
    renderSubscriptions();
    renderCalendar();
    renderWallet();
    renderHistory();
    renderMerchants();
}

function getActive(){ return state.subscriptions.filter(s => s.active); }
function computeTotals(){
    let monthly = 0;
    getActive().forEach(s => {
        const rubRate = s.currency === 'USD' ? 90 : s.currency === 'EUR' ? 100 : 1;
        monthly += monthlyAmount(s) * rubRate;
    });
    return { monthly, yearly: monthly * 12 };
}

function renderDashboard(){
    const active = getActive();
    const { monthly, yearly } = computeTotals();
    const greeting = document.getElementById('dashboardGreeting');
    if(greeting) greeting.textContent = greetingLabel();
    const topBalance = document.getElementById('dashboardTopBalance');
    if(topBalance) topBalance.textContent = fmt(state.wallet?.balance || 0);

    document.getElementById('kpiMonthly').textContent = fmt(monthly);
    document.getElementById('kpiYearly').textContent = fmt(yearly);
    document.getElementById('kpiCount').textContent = active.length;
    document.getElementById('kpiAvg').textContent = active.length ? fmt(monthly/active.length) : '0 ₽';

    const sorted = [...active].sort((a,b) => daysUntil(a.next) - daysUntil(b.next));
    const next = sorted[0];
    document.getElementById('kpiNext').textContent = next ? shortDaysLabel(daysUntil(next.next)) : '—';

    renderDashboardCalendar(sorted);

    const up = document.getElementById('dashUpcoming');
    up.innerHTML = '';
    sorted.slice(0,4).forEach(s => up.appendChild(dashboardUpcomingRow(s)));
    if(sorted.length === 0) up.innerHTML = emptyHTML('Нет списаний', 'plus');
}

function renderDashboardCalendar(sorted){
    const daysBox = document.getElementById('dashboardCalendarDays');
    const eventsBox = document.getElementById('dashboardCalendarEvents');
    if(!daysBox) return;
    if(eventsBox) eventsBox.innerHTML = '';

    const weekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const items = sorted || getActive().slice().sort((a,b) => daysUntil(a.next) - daysUntil(b.next));

    if(!dashboardCalendarMonth){
        const now = new Date();
        dashboardCalendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const year = dashboardCalendarMonth.getFullYear();
    const month = dashboardCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
    const gridStart = new Date(year, month, 1 - startOffset);

    const byDate = new Map();
    items.forEach(s => {
        const d = new Date(s.next);
        if(isNaN(d)) return;
        d.setHours(0,0,0,0);
        const key = d.toISOString().slice(0,10);
        if(!byDate.has(key)) byDate.set(key, []);
        byDate.get(key).push(s);
    });

    let html = `
        <div class="dashboard-calendar-month-card">
            <div class="dashboard-calendar-month-top">
                <button class="dashboard-calendar-month-nav" type="button" onclick="changeDashboardCalendarMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
                <div class="dashboard-calendar-month-title">${months[month]} ${year}</div>
                <button class="dashboard-calendar-month-nav" type="button" onclick="changeDashboardCalendarMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div class="dashboard-calendar-month-grid">
                ${weekdays.map(d => `<div class="dashboard-calendar-month-head">${d}</div>`).join('')}
    `;

    for(let i = 0; i < 35; i++){
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        d.setHours(0,0,0,0);
        const key = d.toISOString().slice(0,10);
        const inMonth = d.getMonth() === month;
        const isToday = (() => { const t = new Date(); t.setHours(0,0,0,0); return d.getTime() === t.getTime(); })();
        const payments = (byDate.get(key) || []).sort((a,b) => (a.amount||0) - (b.amount||0));

        let topMark = `<div class="dashboard-calendar-cell-number">${d.getDate()}</div>`;
        if(payments.length === 0 && inMonth && (i === 8 || i === 13)){
            topMark = `<div class="dashboard-calendar-cell-number dashboard-calendar-pill-day">${d.getDate()}</div>`;
        }
        let content = topMark;

        if(payments.length){
            const first = payments[0];
            const palette = ['orange','blue','green','gray'];
            const tone = first.currency === 'USD' ? 'blue' : palette[(d.getDate() + payments.length) % palette.length];
            content += `
                <div class="dashboard-calendar-event-mini ${tone}">
                    <div class="dashboard-calendar-event-mini-name">${first.name}</div>
                    <div class="dashboard-calendar-event-mini-price">${fmt(first.amount, first.currency)}</div>
                    ${payments.length > 1 ? `<div class="dashboard-calendar-event-mini-more">+${payments.length - 1} ещё</div>` : ''}
                </div>
            `;
        }

        html += `<div class="dashboard-calendar-cell ${inMonth ? '' : 'muted'} ${isToday ? 'today' : ''}">${content}</div>`;
    }

    html += '</div></div>';
    daysBox.innerHTML = html;
}

function changeDashboardCalendarMonth(offset){
    if(!dashboardCalendarMonth){
        const now = new Date();
        dashboardCalendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    dashboardCalendarMonth = new Date(dashboardCalendarMonth.getFullYear(), dashboardCalendarMonth.getMonth() + offset, 1);
    renderDashboard();
}

function dashboardUpcomingRow(s){
    const el = document.createElement('div');
    el.className = 'sub-row';
    const cycleLabel = {monthly:'/мес', yearly:'/год', weekly:'/нед'}[s.cycle];
    const d = daysUntil(s.next);
    el.innerHTML = `
        ${subIconHTML(s)}
        <div>
            <div class="sub-name">${s.name}</div>
            <div class="sub-cat">${shortDaysLabel(d)}</div>
        </div>
        <div>
            <div class="sub-price">${fmt(s.amount, s.currency)}</div>
            <div class="sub-cycle">${cycleLabel}</div>
        </div>
    `;
    return el;
}

function subIconHTML(s){
    const letter = s.name.charAt(0).toUpperCase();
    const bg = s.color || '#14140f';
    const color = s.textDark ? '#14140f' : '#fff';
    return `<div class="sub-icon" style="background:${bg}; color:${color}">${letter}</div>`;
}

function billingPill(s){
    const d = daysUntil(s.next);
    let cls = '', text;
    if(d < 0) { cls = 'urgent'; text = `Просрочено ${Math.abs(d)}д`; }
    else if(d === 0) { cls = 'urgent'; text = 'Сегодня'; }
    else if(d <= 3) { cls = 'urgent'; text = `через ${d}д`; }
    else if(d <= 7) { cls = 'soon'; text = `через ${d}д`; }
    else text = `через ${d}д`;
    return `<span class="billing-pill ${cls}">${text}</span>`;
}

function subRow(s){
    const el = document.createElement('div');
    el.className = 'sub-row';
    const cycleLabel = {monthly:'/мес', yearly:'/год', weekly:'/нед'}[s.cycle];
    el.innerHTML = `
        ${subIconHTML(s)}
        <div>
            <div class="sub-name">${s.name}</div>
            <div class="sub-cat">${s.category || 'other'}</div>
        </div>
        ${billingPill(s)}
        <div>
            <div class="sub-price">${fmt(s.amount, s.currency)}</div>
            <div class="sub-cycle">${cycleLabel}</div>
        </div>
        <div class="sub-actions">
            <button class="icon-btn" title="Редактировать" onclick="editSub('${s.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn danger" title="Отменить" onclick="confirmCancel('${s.id}')"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `;
    return el;
}

let subFilter = 'active';
document.querySelectorAll('#subTabs .tab').forEach(t => {
    t.addEventListener('click', () => {
        document.querySelectorAll('#subTabs .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active'); subFilter = t.dataset.filter; renderSubscriptions();
    });
});

function renderSubscriptions(){
    const list = document.getElementById('subList');
    const items = state.subscriptions.filter(s => subFilter === 'active' ? s.active : !s.active);
    list.innerHTML = '';
    if(items.length === 0){ list.innerHTML = emptyHTML(subFilter==='active' ? 'Добавьте первую подписку' : 'В архиве пусто', 'box'); return; }
    items.forEach(s => list.appendChild(subRow(s)));
}

function renderCalendar(){
    const list = document.getElementById('calList');
    const items = getActive().slice().sort((a,b) => daysUntil(a.next) - daysUntil(b.next));
    list.innerHTML = '';
    const months = ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'];
    if(items.length === 0){ list.innerHTML = emptyHTML('Нет предстоящих списаний','calendar'); return; }
    items.forEach(s => {
        const d = new Date(s.next);
        const row = document.createElement('div');
        row.className = 'sub-row';
        row.style.gridTemplateColumns = '60px 42px 1fr auto auto';
        const cycleLabel = {monthly:'/мес', yearly:'/год', weekly:'/нед'}[s.cycle];
        row.innerHTML = `
            <div class="cal-date">
                <div class="cal-day">${d.getDate()}</div>
                <div class="cal-mon">${months[d.getMonth()]}</div>
            </div>
            ${subIconHTML(s)}
            <div>
                <div class="sub-name">${s.name}</div>
                <div class="sub-cat">${billingPill(s).replace(/<[^>]+>/g,'').trim()}</div>
            </div>
            <div>
                <div class="sub-price">${fmt(s.amount, s.currency)}</div>
                <div class="sub-cycle">${cycleLabel}</div>
            </div>
            <div class="sub-actions">
                <button class="icon-btn" title="Я заплатил" onclick="markPaid('${s.id}')"><i class="fa-solid fa-check"></i></button>
            </div>
        `;
        list.appendChild(row);
    });
}

function renderWallet(){
    document.getElementById('walletBalance').textContent = fmt(state.wallet.balance);
    const at = state.wallet.autoTopup;
    document.getElementById('autoTopupLabel').textContent = at ? `при балансе < ${fmt(at.threshold)} пополнение на ${fmt(at.amount)}` : 'выключено';
    const tx = document.getElementById('walletTx');
    const items = state.wallet.transactions;
    if(items.length === 0){ tx.innerHTML = '<div class="muted" style="text-align:center; padding:20px;">Пока нет операций</div>'; return; }
    tx.innerHTML = items.map(t => `
        <div class="hist-row">
            <div class="hist-left">
                <div class="hist-dot" style="background:${t.type==='deposit'?'var(--good)':'var(--accent)'}"></div>
                <div>
                    <div style="font-weight:500;">${t.title}</div>
                    <div class="hist-date">${formatDate(t.date)}</div>
                </div>
            </div>
            <div class="hist-amount" style="color:${t.type==='deposit'?'var(--good)':'var(--ink)'}">
                ${t.type==='deposit'?'+':'−'} ${fmt(t.amount)}
            </div>
        </div>
    `).join('');
}

let histPeriod = 'month';
document.querySelectorAll('#histTabs .tab').forEach(t => {
    t.addEventListener('click', () => {
        document.querySelectorAll('#histTabs .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active'); histPeriod = t.dataset.period; renderHistory();
    });
});
function renderHistory(){
    const el = document.getElementById('historyList');
    const days = histPeriod === 'month' ? 30 : histPeriod === 'quarter' ? 90 : 365;
    const items = state.history.filter(h => daysUntil(h.date) >= -days).sort((a,b) => new Date(b.date) - new Date(a.date));
    if(items.length === 0){ el.innerHTML = emptyHTML('Нет операций за период','clock-rotate-left'); return; }
    const total = items.reduce((a,b) => a + b.amount, 0);
    el.innerHTML = `
        <div style="display:flex; justify-content:space-between; padding-bottom:14px; border-bottom:1px solid var(--line); margin-bottom:6px;">
            <div class="muted" style="font-size:13px;">Всего за период</div>
            <div style="font-weight:600; font-family:'Space Grotesk';">${fmt(total)}</div>
        </div>
        ${items.map(h => `
            <div class="hist-row">
                <div class="hist-left">
                    <div class="hist-dot"></div>
                    <div>
                        <div style="font-weight:500;">${h.name}</div>
                        <div class="hist-date">${formatDate(h.date)}</div>
                    </div>
                </div>
                <div class="hist-amount">${fmt(h.amount, h.currency)}</div>
            </div>
        `).join('')}
    `;
}

function renderMerchants(){
    const el = document.getElementById('merchantList');
    if(state.merchants.length === 0){ el.innerHTML = emptyHTML('Создайте свою подписку и зарабатывайте','store'); return; }
    el.innerHTML = state.merchants.map(m => `
        <div class="merch-card">
            <div class="merch-top">
                <div class="merch-avatar"><i class="fa-solid fa-store"></i></div>
                <div>
                    <h3>${m.name}</h3>
                    <div class="muted" style="font-size:12.5px;">${fmt(m.amount)} / ${m.cycle==='monthly'?'мес':'год'}</div>
                </div>
            </div>
            <div class="merch-desc">${m.desc || ''}</div>
            <div style="display:flex; gap:8px; margin-bottom:12px;">
                <button class="btn btn-ghost btn-sm" onclick="copyShareLink('${m.id}')"><i class="fa-solid fa-link"></i> Ссылка</button>
                <button class="btn btn-ghost btn-sm" onclick="withdraw('${m.id}')"><i class="fa-solid fa-arrow-down"></i> Вывод</button>
            </div>
            <div class="merch-stats">
                <div><div class="muted">Подписчики</div><strong>${m.subscribers}</strong></div>
                <div><div class="muted">Доход</div><strong>${fmt(m.earned)}</strong></div>
            </div>
        </div>
    `).join('');
}

function emptyHTML(text, icon){
    return `<div class="empty"><i class="fa-solid fa-${icon}"></i><div>${text}</div></div>`;
}
function formatDate(s){
    const d = new Date(s);
    return d.toLocaleDateString('ru-RU', {day:'numeric', month:'long'});
}

// ================== ACTIONS ==================
function openAddModal(){
    editingId = null;
    document.getElementById('addModalTitle').textContent = 'Новая подписка';
    document.getElementById('subName').value = '';
    document.getElementById('subAmount').value = '';
    document.getElementById('subCurrency').value = 'RUB';
    document.getElementById('subCycle').value = 'monthly';
    const t = new Date(); t.setDate(t.getDate() + 7);
    document.getElementById('subDate').value = t.toISOString().slice(0,10);
    document.getElementById('subCategory').value = 'entertainment';
    openModal('addModal');
}
function editSub(id){
    const s = state.subscriptions.find(x => x.id === id); if(!s) return;
    editingId = id;
    document.getElementById('addModalTitle').textContent = 'Редактировать подписку';
    document.getElementById('subName').value = s.name;
    document.getElementById('subAmount').value = s.amount;
    document.getElementById('subCurrency').value = s.currency;
    document.getElementById('subCycle').value = s.cycle;
    document.getElementById('subDate').value = s.next;
    document.getElementById('subCategory').value = s.category || 'other';
    openModal('addModal');
}
function saveSubscription(){
    const name = document.getElementById('subName').value.trim();
    const amount = parseFloat(document.getElementById('subAmount').value);
    const currency = document.getElementById('subCurrency').value;
    const cycle = document.getElementById('subCycle').value;
    const next = document.getElementById('subDate').value;
    const category = document.getElementById('subCategory').value;
    if(!name || name.length < 2){ toast('Введите название'); return; }
    if(!amount || amount <= 0){ toast('Введите сумму'); return; }
    if(!next){ toast('Укажите дату списания'); return; }
    const colors = ['#14140f','#1db954','#e50914','#3b82f6','#ff5a1f','#7c3aed','#059669'];
    if(editingId){
        const s = state.subscriptions.find(x => x.id === editingId);
        Object.assign(s, { name, amount, currency, cycle, next, category });
    } else {
        state.subscriptions.push({
            id:uid(), name, amount, currency, cycle, next, category, active:true,
            color: colors[state.subscriptions.length % colors.length]
        });
    }
    saveState(); closeModal('addModal'); renderAll();
    toast(editingId ? 'Сохранено' : 'Подписка добавлена');
}

function confirmCancel(id){
    const s = state.subscriptions.find(x => x.id === id); if(!s) return;
    document.getElementById('confirmTitle').textContent = `Отменить «${s.name}»?`;
    document.getElementById('confirmText').textContent = `Подписка уйдёт в архив. ${fmt(s.amount, s.currency)} больше списываться не будут.`;
    document.getElementById('confirmBtn').onclick = () => {
        s.active = false; saveState(); closeModal('confirmModal'); renderAll();
        toast('Подписка отменена и перемещена в архив');
    };
    openModal('confirmModal');
}

function markPaid(id){
    const s = state.subscriptions.find(x => x.id === id); if(!s) return;
    state.history.unshift({ date:new Date().toISOString().slice(0,10), name:s.name, amount:s.amount, currency:s.currency, status:'success' });
    // next billing
    const d = new Date(s.next);
    if(s.cycle === 'monthly') d.setMonth(d.getMonth()+1);
    else if(s.cycle === 'yearly') d.setFullYear(d.getFullYear()+1);
    else d.setDate(d.getDate()+7);
    s.next = d.toISOString().slice(0,10);
    saveState(); renderAll(); toast('Оплата записана');
}

function exportExcel(){
    const rows = [['Название','Сумма','Валюта','Периодичность','Дата списания','Категория','Статус']];
    state.subscriptions.forEach(s => rows.push([s.name, s.amount, s.currency, s.cycle, s.next, s.category, s.active?'active':'archived']));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'subscriptions.csv'; a.click();
    toast('Файл скачан');
}

function openDepositModal(){ openModal('depositModal'); }
function depositConfirm(){
    const amt = parseFloat(document.getElementById('depositAmount').value);
    if(!amt || amt <= 0){ toast('Введите сумму'); return; }
    state.wallet.balance += amt;
    state.wallet.transactions.unshift({ id:uid(), type:'deposit', amount:amt, date:new Date().toISOString().slice(0,10), title:'Пополнение с карты **4242' });
    saveState(); closeModal('depositModal'); renderAll(); toast(`Кошелёк пополнен на ${fmt(amt)}`);
}
function openAutoTopupModal(){
    if(state.wallet.autoTopup){
        document.getElementById('atThreshold').value = state.wallet.autoTopup.threshold;
        document.getElementById('atAmount').value = state.wallet.autoTopup.amount;
    }
    openModal('autoTopupModal');
}
function saveAutoTopup(){
    const t = parseFloat(document.getElementById('atThreshold').value);
    const a = parseFloat(document.getElementById('atAmount').value);
    if(!t || !a || t <= 0 || a <= 0){ toast('Укажите значения'); return; }
    state.wallet.autoTopup = { threshold:t, amount:a };
    saveState(); closeModal('autoTopupModal'); renderWallet(); toast('Автопополнение включено');
}

function openMerchantModal(){
    document.getElementById('mName').value=''; document.getElementById('mDesc').value='';
    document.getElementById('mAmount').value=''; document.getElementById('mCycle').value='monthly';
    openModal('merchantModal');
}
function saveMerchant(){
    const name = document.getElementById('mName').value.trim();
    const desc = document.getElementById('mDesc').value.trim();
    const amount = parseFloat(document.getElementById('mAmount').value);
    const cycle = document.getElementById('mCycle').value;
    if(!name || !amount){ toast('Заполните поля'); return; }
    state.merchants.push({ id:uid(), name, desc, amount, cycle, subscribers:0, earned:0 });
    saveState(); closeModal('merchantModal'); renderMerchants(); toast('Подписка создана');
}
function copyShareLink(id){
    const link = `https://subapp.example/s/${id}`;
    navigator.clipboard?.writeText(link);
    toast('Ссылка скопирована: ' + link);
}
function withdraw(id){
    const m = state.merchants.find(x => x.id === id);
    if(!m || m.earned < 100){ toast('Минимальная сумма вывода 100 ₽'); return; }
    toast(`Запрос на вывод ${fmt(m.earned)} отправлен`);
    m.earned = 0; saveState(); renderMerchants();
}

function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => { if(e.target === m) m.classList.remove('open'); });
});

// ================== INIT ==================
if(state.user){ enterApp(); }