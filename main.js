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

// ================== AUTHORS UI ==================
const authors = [
    {id:'maria',initials:'МД',name:'Мария Дизайнова',handle:'@maria_designs',color:'linear-gradient(135deg,#ff7a28,#ff3d20)',bio:'Делюсь секретами UI/UX дизайна, кейсами и инсайтами из мира digital. Эксклюзивный контент каждую неделю ✨',rating:'4.9',reviews:'247',followers:'12,4К'},
    {id:'alex',initials:'АК',name:'Алекс Кодеров',handle:'@alex_code',color:'linear-gradient(135deg,#2563eb,#22c55e)',bio:'Показываю, как создавать приложения, backend и автоматизацию без лишней воды.',rating:'4.8',reviews:'183',followers:'8,7К'},
    {id:'lina',initials:'ЛМ',name:'Лина Маркетолог',handle:'@lina_growth',color:'linear-gradient(135deg,#a855f7,#ec4899)',bio:'Разбираю рост продуктов, рекламу, упаковку и подписочные модели.',rating:'4.7',reviews:'156',followers:'6,2К'},
];

const authorMaterials = [
    {type:'Статья',icon:'fa-fire-flame-curved',cover:'linear-gradient(135deg,#9b5cf6,#ec4899)',title:'10 принципов современного UI для мобильных приложений',desc:'Разбираем главные тренды 2026 года: микроанимации, glassmorphism, адаптивная типографика...',meta:'2 дня назад · 8 мин',likes:342,comments:2,shares:14},
    {type:'PREMIUM',premium:true,title:'Секретный гайд: Figma + AI для дизайнеров',desc:'Полный курс с готовыми шаблонами, плагинами и пошаговыми инструкциями...',meta:'5 дней назад',likes:178,comments:2,shares:11},
    {type:'Статья',icon:'fa-palette',cover:'linear-gradient(135deg,#38bdf8,#2563eb)',title:'Психология цвета в digital-продуктах',desc:'Как цвета влияют на конверсию и поведение пользователей в интерфейсах...',meta:'1 неделю назад · 6 мин',likes:219,comments:5,shares:8},
    {type:'Статья',icon:'fa-layer-group',cover:'linear-gradient(135deg,#10b981,#06b6d4)',title:'Дизайн-система с нуля за один спринт',desc:'Токены, компоненты и документация — собираем масштабируемую систему шаг за шагом...',meta:'2 недели назад · 12 мин',likes:401,comments:9,shares:22},
];

function renderAuthors(){
    const root = document.getElementById('authorsGrid');
    if(!root) return;
    root.innerHTML = authors.map(author => `
        <article class="author-card">
            <div class="author-card-top">
                <div class="author-card-avatar" style="background:${author.color}">${author.initials}</div>
                <div><h3>${author.name}</h3><div class="handle">${author.handle}</div></div>
            </div>
            <p>${author.bio}</p>
            <div class="author-card-stats">
                <span><i class="fa-solid fa-star"></i> <strong>${author.rating}</strong></span><span>·</span>
                <span><strong>${author.reviews}</strong> отзывов</span><span>·</span>
                <span><strong>${author.followers}</strong> подписчиков</span>
            </div>
            <div class="author-card-actions">
                <button class="open" type="button" onclick="openAuthorProfile('${author.id}')">Открыть профиль</button>
                <button class="mini" type="button" onclick="toast('Автор добавлен в избранное')"><i class="fa-regular fa-heart"></i></button>
            </div>
        </article>
    `).join('');
}

function openAuthorProfile(id){
    const author = authors.find(a => a.id === id) || authors[0];

    const avatar = document.getElementById('authorProfileAvatar');
    const name = document.getElementById('authorProfileName');
    const handle = document.getElementById('authorProfileHandle');
    const bio = document.getElementById('authorProfileBio');
    const rating = document.getElementById('authorProfileRating');
    const reviews = document.getElementById('authorProfileReviews');
    const followers = document.getElementById('authorProfileFollowers');

    if(avatar){
        avatar.textContent = author.initials;
        avatar.style.background = author.color;
    }
    if(name) name.textContent = author.name;
    if(handle) handle.textContent = author.handle;
    if(bio) bio.textContent = author.bio;
    if(rating) rating.textContent = author.rating;
    if(reviews) reviews.textContent = author.reviews;
    if(followers) followers.textContent = author.followers;

    if(typeof renderAuthorContent === 'function') renderAuthorContent();
    switchView('author-profile');
}

function renderAuthorContent(){
    const root = document.getElementById('authorContentGrid');
    if(!root) return;
    root.innerHTML = authorMaterials.map(item => {
        if(item.premium){
            return `
                <article class="author-content-card">
                    <div class="author-content-cover">
                        <div class="author-paywall">
                            <span class="badge premium-badge"><i class="fa-solid fa-crown"></i> PREMIUM</span>
                            <h3>Доступ за разовую покупку</h3>
                            <button type="button">Купить за 299 ₽</button>
                        </div>
                    </div>
                    <div class="author-content-body">
                        <h3>${item.title}</h3><p>${item.desc}</p>
                        <div class="author-content-meta"><span>${item.meta}</span><div class="author-content-reactions">
                            <span class="liked"><i class="fa-regular fa-heart"></i> ${item.likes}</span>
                            <span><i class="fa-regular fa-comment"></i> ${item.comments}</span>
                            <span><i class="fa-solid fa-share"></i> ${item.shares}</span>
                        </div></div>
                    </div>
                </article>`;
        }
        return `
            <article class="author-content-card">
                <div class="author-content-cover" style="background:${item.cover}">
                    <span class="badge"><i class="fa-solid fa-file-lines"></i> ${item.type}</span>
                    <i class="fa-solid ${item.icon} main"></i>
                </div>
                <div class="author-content-body">
                    <h3>${item.title}</h3><p>${item.desc}</p>
                    <div class="author-content-meta"><span>${item.meta}</span><div class="author-content-reactions">
                        <span class="liked"><i class="fa-solid fa-heart"></i> ${item.likes}</span>
                        <span><i class="fa-regular fa-comment"></i> ${item.comments}</span>
                        <span><i class="fa-solid fa-share"></i> ${item.shares}</span>
                    </div></div>
                </div>
            </article>`;
    }).join('');
}


// ================== AUTHOR PROFILE BUTTON CLICK FIX ==================
const authorButtonState = {
    subscribed: true,
    tariffIndex: 0,
    premiumBought: false,
    liked: {},
    shares: {},
};
const authorTariffs = [
    { name:'Premium', price:'490 ₽/мес · Следующее списание: 27.06.2026' },
    { name:'Author', price:'790 ₽/мес · Следующее списание: 27.06.2026' },
    { name:'Basic', price:'199 ₽/мес · Следующее списание: 27.06.2026' },
];

function refreshAuthorSubscribeButton(){
    const btn = document.querySelector('#view-author-profile .author-subscribe-btn');
    const plan = document.querySelector('#view-author-profile .author-plan-card');
    if(!btn) return;

    if(authorButtonState.subscribed){
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Подписан';
        btn.style.background = '#1a1a1e';
        if(plan) plan.style.display = '';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Подписаться';
        btn.style.background = 'var(--accent)';
        if(plan) plan.style.display = 'none';
    }
}

function toggleAuthorSubscribe(){
    authorButtonState.subscribed = !authorButtonState.subscribed;
    refreshAuthorSubscribeButton();
    if(typeof toast === 'function'){
        toast(authorButtonState.subscribed ? 'Вы подписались на автора' : 'Подписка отменена');
    }
}

function changeAuthorTariff(){
    authorButtonState.tariffIndex = (authorButtonState.tariffIndex + 1) % authorTariffs.length;
    const tariff = authorTariffs[authorButtonState.tariffIndex];

    const title = document.querySelector('#view-author-profile .author-plan-card h3');
    const desc = document.querySelector('#view-author-profile .author-plan-card p');

    if(title) title.innerHTML = `${tariff.name} <i class="fa-solid fa-star"></i>`;
    if(desc) desc.textContent = tariff.price;

    if(typeof toast === 'function') toast(`Тариф изменён на ${tariff.name}`);
}

function buyAuthorPremium(button){
    authorButtonState.premiumBought = true;
    if(button){
        button.textContent = 'Куплено';
        button.disabled = true;
        button.style.opacity = '0.75';
    }
    if(typeof toast === 'function') toast('Премиум-материал открыт');
}

function toggleAuthorLike(element){
    const card = element.closest('.author-content-card');
    const cards = [...document.querySelectorAll('#view-author-profile .author-content-card')];
    const index = cards.indexOf(card);
    const key = String(index);

    let count = Number((element.textContent || '').replace(/\D/g, '')) || 0;
    const active = !authorButtonState.liked[key];
    authorButtonState.liked[key] = active;

    count = active ? count + 1 : Math.max(0, count - 1);
    const iconClass = active ? 'fa-solid' : 'fa-regular';

    element.classList.toggle('liked', active);
    element.innerHTML = `<i class="${iconClass} fa-heart"></i> ${count}`;

    if(typeof toast === 'function') toast(active ? 'Лайк добавлен' : 'Лайк убран');
}

function authorCommentClick(element){
    const count = Number((element.textContent || '').replace(/\D/g, '')) || 0;
    if(typeof toast === 'function') toast(`Комментарии: ${count}`);
}

function authorShareClick(element){
    let count = Number((element.textContent || '').replace(/\D/g, '')) || 0;
    count += 1;
    element.innerHTML = `<i class="fa-solid fa-share"></i> ${count}`;

    const title = element.closest('.author-content-card')?.querySelector('.author-content-body h3')?.textContent || 'Материал автора';
    if(navigator.share){
        navigator.share({ title, text:title }).catch(() => {});
    } else if(navigator.clipboard){
        navigator.clipboard.writeText(title).catch(() => {});
        if(typeof toast === 'function') toast('Ссылка скопирована');
    } else if(typeof toast === 'function'){
        toast('Репост отправлен');
    }
}

document.addEventListener('click', function(e){
    const profile = e.target.closest('#view-author-profile');
    if(!profile) return;

    const tab = e.target.closest('.author-tabs button');
    if(tab){
        e.preventDefault();
        profile.querySelectorAll('.author-tabs button').forEach(btn => btn.classList.remove('active'));
        tab.classList.add('active');

        const label = tab.textContent.trim();
        if(typeof toast === 'function') toast(`Раздел: ${label}`);
        return;
    }

    const subscribeBtn = e.target.closest('.author-subscribe-btn');
    if(subscribeBtn){
        e.preventDefault();
        toggleAuthorSubscribe();
        return;
    }

    const changeTariffBtn = e.target.closest('.author-plan-card button');
    if(changeTariffBtn){
        e.preventDefault();
        changeAuthorTariff();
        return;
    }

    const buyBtn = e.target.closest('.author-paywall button');
    if(buyBtn){
        e.preventDefault();
        buyAuthorPremium(buyBtn);
        return;
    }

    const reaction = e.target.closest('.author-content-reactions span');
    if(reaction){
        e.preventDefault();
        const hasHeart = reaction.querySelector('.fa-heart');
        const hasComment = reaction.querySelector('.fa-comment');
        const hasShare = reaction.querySelector('.fa-share');

        if(hasHeart) toggleAuthorLike(reaction);
        else if(hasComment) authorCommentClick(reaction);
        else if(hasShare) authorShareClick(reaction);
    }
});

document.addEventListener('DOMContentLoaded', refreshAuthorSubscribeButton);

// ================== ANALYTICS UI ==================
document.addEventListener('click', function(e){
    const toggle = e.target.closest('#view-analytics .analytics-toggle button');
    if(toggle){
        e.preventDefault();
        document.querySelectorAll('#view-analytics .analytics-toggle button').forEach(btn => btn.classList.remove('active'));
        toggle.classList.add('active');
        if(typeof toast === 'function') toast(`Период: ${toggle.textContent.trim()}`);
        return;
    }

    const insight = e.target.closest('#view-analytics .analytics-insight');
    if(insight){
        const title = insight.querySelector('.analytics-i-title')?.textContent?.trim() || 'Инсайт';
        if(typeof toast === 'function') toast(title);
        return;
    }

    const category = e.target.closest('#view-analytics .analytics-cat-row');
    if(category){
        const title = category.querySelector('.analytics-cat-name')?.textContent?.trim() || 'Категория';
        if(typeof toast === 'function') toast(`Категория: ${title}`);
    }
});

// ================== PROFILE UI ==================
document.addEventListener('click', function(e){
    const profile = e.target.closest('#view-profile');
    if(!profile) return;

    const birthday = e.target.closest('.profile-web-bday');
    if(birthday){
        birthday.innerHTML = '<i class="fa-solid fa-cake-candles"></i> Дата рождения добавлена · +10 баллов';
        if(typeof toast === 'function') toast('+10 баллов');
        return;
    }
});

// ================== ACHIEVEMENTS UI ==================
document.addEventListener('click', function(e){
    const card = e.target.closest('#view-achievements .achievements-web-card');
    if(!card) return;

    const title = card.querySelector('h3')?.textContent?.trim() || 'Достижение';
    const locked = card.classList.contains('locked');
    if(typeof toast === 'function'){
        toast(locked ? `${title}: пока закрыто` : `${title}: получено`);
    }
});

// ================== TIME CALCULATOR UI ==================
function timecalcFmt(n, d = 1){
    return Number(n || 0).toLocaleString('ru-RU', {
        minimumFractionDigits:d,
        maximumFractionDigits:d
    });
}

function timecalcPlural(n, one, few, many){
    const m10 = n % 10;
    const m100 = n % 100;
    if(m10 === 1 && m100 !== 11) return one;
    if(m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
}

function calculateTimeCalculator(){
    const salary = parseFloat(document.getElementById('timecalcSalary')?.value) || 0;
    const hours = parseFloat(document.getElementById('timecalcHours')?.value) || 0;
    const subs = parseFloat(document.getElementById('timecalcSubs')?.value) || 0;

    const rate = hours > 0 ? salary / hours : 0;
    const hoursOnSubs = rate > 0 ? subs / rate : 0;
    const share = salary > 0 ? (subs / salary) * 100 : 0;
    const daysMonth = hoursOnSubs / 8;
    const daysYear = daysMonth * 12;
    const yearsLife = daysYear / 365;

    const whole = document.getElementById('timecalcWhole');
    const heroSub = document.getElementById('timecalcHeroSub');
    const shareEl = document.getElementById('timecalcShare');
    const bar = document.getElementById('timecalcBar');
    const rateEl = document.getElementById('timecalcRate');

    if(whole) whole.textContent = timecalcFmt(hoursOnSubs);
    if(heroSub){
        heroSub.textContent = `Это ${timecalcFmt(daysMonth)} ${timecalcPlural(Math.round(daysMonth), 'день', 'дня', 'дней')} в месяц · ${timecalcFmt(daysYear)} ${timecalcPlural(Math.round(daysYear), 'день', 'дня', 'дней')} в год (${timecalcFmt(yearsLife, 2)} года жизни)`;
    }
    if(shareEl) shareEl.textContent = timecalcFmt(share) + '%';
    if(bar) bar.style.width = Math.min(share, 100) + '%';
    if(rateEl) rateEl.textContent = Math.round(rate).toLocaleString('ru-RU') + ' ₽';
}

document.addEventListener('input', function(e){
    if(e.target.closest('#view-time-calculator')){
        calculateTimeCalculator();
    }
});

document.addEventListener('click', function(e){
    const calcCard = e.target.closest('[data-action="open-time-calculator"], .open-time-calculator');
    if(calcCard){
        e.preventDefault();
        switchView('time-calculator');
        setTimeout(calculateTimeCalculator, 0);
    }
});


// ================== CALCULATOR OPEN FIX ==================
document.addEventListener('click', function(e){
    const dashboard = e.target.closest('#view-dashboard');
    if(!dashboard) return;

    const clickable = e.target.closest('button, a, article, .card, .feature-card, .quick-card, .dashboard-card, .overview-feature-card, .hero-action-card, .tile');
    if(!clickable) return;

    const text = (clickable.textContent || '').trim().toLowerCase();
    if(text.includes('калькулятор')){
        e.preventDefault();
        e.stopPropagation();
        switchView('time-calculator');
        setTimeout(() => {
            if(typeof calculateTimeCalculator === 'function'){
                calculateTimeCalculator();
            }
        }, 0);
    }
}, true);


function openTimeCalculatorFromDashboard(){
    switchView('time-calculator');
    setTimeout(() => {
        if(typeof calculateTimeCalculator === 'function'){
            calculateTimeCalculator();
        }
    }, 0);
}

// ================== FEED UI ==================
document.addEventListener('click', function(e){
    const feed = e.target.closest('#view-feed');
    if(!feed) return;

    const tab = e.target.closest('.feed-web-tab');
    if(tab){
        e.preventDefault();
        feed.querySelectorAll('.feed-web-tab').forEach(btn => btn.classList.remove('active'));
        tab.classList.add('active');
        if(typeof toast === 'function') toast(`Лента: ${tab.textContent.trim()}`);
        return;
    }

    const like = e.target.closest('.feed-web-action.like');
    if(like){
        e.preventDefault();
        const icon = like.querySelector('i');
        const countEl = like.querySelector('span');
        let count = Number(countEl?.textContent || 0);
        const liked = !like.classList.contains('liked');
        like.classList.toggle('liked', liked);
        if(icon) icon.className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
        if(countEl) countEl.textContent = String(liked ? count + 1 : Math.max(0, count - 1));
        return;
    }

    const comment = e.target.closest('.feed-web-action.comment');
    if(comment){
        e.preventDefault();
        const count = comment.querySelector('span')?.textContent || '0';
        if(typeof toast === 'function') toast(`Комментарии: ${count}`);
        return;
    }

    const share = e.target.closest('.feed-web-action.share');
    if(share){
        e.preventDefault();
        const countEl = share.querySelector('span');
        let count = Number(countEl?.textContent || 0);
        if(countEl) countEl.textContent = String(count + 1);

        const title = share.closest('.feed-web-card')?.querySelector('h2')?.textContent?.trim() || 'Пост из ленты';
        if(navigator.share){
            navigator.share({ title, text:title }).catch(() => {});
        } else if(navigator.clipboard){
            navigator.clipboard.writeText(title).catch(() => {});
            if(typeof toast === 'function') toast('Ссылка скопирована');
        } else if(typeof toast === 'function'){
            toast('Репост');
        }
    }
});

// ================== SETTINGS PERSONALIZATION BOTTOM UI ==================
let settingsHue = 234;
let settingsSat = 0.69;
let settingsVal = 0.94;
let settingsPickerReady = false;

function settingsHsvToRgb(h, s, v){
    let c = v * s;
    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = v - c;
    let r = 0, g = 0, b = 0;

    if(h < 60){ r = c; g = x; b = 0; }
    else if(h < 120){ r = x; g = c; b = 0; }
    else if(h < 180){ r = 0; g = c; b = x; }
    else if(h < 240){ r = 0; g = x; b = c; }
    else if(h < 300){ r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255)
    ];
}

function settingsToHex(rgb){
    return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function settingsApplyColor(){
    const rgb = settingsHsvToRgb(settingsHue, settingsSat, settingsVal);
    const hex = settingsToHex(rgb);
    document.documentElement.style.setProperty('--settings-accent', hex);

    const badge = document.getElementById('settingsHexBadge');
    const dot = document.getElementById('settingsPickerDot');

    if(badge) badge.textContent = hex;
    if(dot) dot.style.background = hex;
}

function settingsDrawPicker(){
    const canvas = document.getElementById('settingsHueCanvas');
    const wrap = document.getElementById('settingsPickerWrap');
    if(!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = `hsl(${settingsHue},100%,50%)`;
    ctx.fillRect(0, 0, w, h);

    const gx = ctx.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(255,255,255,1)');
    gx.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gx;
    ctx.fillRect(0, 0, w, h);

    const gy = ctx.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(0,0,0,0)');
    gy.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gy;
    ctx.fillRect(0, 0, w, h);
}

function settingsPlaceDot(){
    const canvas = document.getElementById('settingsHueCanvas');
    const dot = document.getElementById('settingsPickerDot');
    const slider = document.getElementById('settingsHueSlider');
    const handle = document.getElementById('settingsHueHandle');

    if(canvas && dot){
        dot.style.left = (settingsSat * canvas.width) + 'px';
        dot.style.top = ((1 - settingsVal) * canvas.height) + 'px';
    }

    if(slider && handle){
        handle.style.left = (settingsHue / 360 * slider.clientWidth) + 'px';
    }
}

function settingsResizePicker(){
    settingsDrawPicker();
    settingsPlaceDot();
    settingsApplyColor();
}

function settingsPickSV(e){
    const wrap = document.getElementById('settingsPickerWrap');
    if(!wrap) return;

    const r = wrap.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const x = Math.max(0, Math.min(r.width, point.clientX - r.left));
    const y = Math.max(0, Math.min(r.height, point.clientY - r.top));

    settingsSat = x / r.width;
    settingsVal = 1 - y / r.height;

    settingsPlaceDot();
    settingsApplyColor();
}

function settingsPickHue(e){
    const slider = document.getElementById('settingsHueSlider');
    if(!slider) return;

    const r = slider.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const x = Math.max(0, Math.min(r.width, point.clientX - r.left));

    settingsHue = x / r.width * 360;
    settingsDrawPicker();
    settingsPlaceDot();
    settingsApplyColor();
}

function initSettingsPersonalizationBottom(){
    const view = document.getElementById('view-settings');
    const wrap = document.getElementById('settingsPickerWrap');
    const slider = document.getElementById('settingsHueSlider');
    const themeSwitch = document.getElementById('settingsThemeSwitch');

    if(!view || !wrap || !slider){
        return;
    }

    if(!settingsPickerReady){
        settingsPickerReady = true;

        let svDrag = false;
        let hueDrag = false;

        wrap.addEventListener('mousedown', e => {
            svDrag = true;
            settingsPickSV(e);
        });

        slider.addEventListener('mousedown', e => {
            hueDrag = true;
            settingsPickHue(e);
        });

        window.addEventListener('mousemove', e => {
            if(svDrag) settingsPickSV(e);
            if(hueDrag) settingsPickHue(e);
        });

        window.addEventListener('mouseup', () => {
            svDrag = false;
            hueDrag = false;
        });

        wrap.addEventListener('touchstart', e => {
            svDrag = true;
            settingsPickSV(e);
            e.preventDefault();
        }, { passive:false });

        slider.addEventListener('touchstart', e => {
            hueDrag = true;
            settingsPickHue(e);
            e.preventDefault();
        }, { passive:false });

        window.addEventListener('touchmove', e => {
            if(svDrag){
                settingsPickSV(e);
                e.preventDefault();
            }
            if(hueDrag){
                settingsPickHue(e);
                e.preventDefault();
            }
        }, { passive:false });

        window.addEventListener('touchend', () => {
            svDrag = false;
            hueDrag = false;
        });

        if(themeSwitch){
            themeSwitch.addEventListener('click', () => {
                themeSwitch.classList.toggle('off');
                // global theme is handled separately
            });
        }

        window.addEventListener('resize', settingsResizePicker);
    }

    settingsResizePicker();
}

document.addEventListener('DOMContentLoaded', initSettingsPersonalizationBottom);

document.addEventListener('click', function(e){
    if(e.target.closest('[data-view="settings"]')){
        setTimeout(initSettingsPersonalizationBottom, 80);
    }
});

// ================== GLOBAL DARK THEME FROM SETTINGS ==================
function applyGlobalDarkTheme(isDark){
    document.body.classList.toggle('global-dark-theme', Boolean(isDark));
    try{
        localStorage.setItem('globalDarkTheme', isDark ? '1' : '0');
    }catch(e){}
}

function syncGlobalThemeSwitch(){
    const themeSwitch = document.getElementById('settingsThemeSwitch');
    let isDark = false;
    try{
        isDark = localStorage.getItem('globalDarkTheme') === '1';
    }catch(e){}

    applyGlobalDarkTheme(isDark);

    if(themeSwitch){
        themeSwitch.classList.toggle('off', !isDark);
    }
}

document.addEventListener('click', function(e){
    const themeSwitch = e.target.closest('#settingsThemeSwitch');
    if(!themeSwitch) return;

    e.preventDefault();
    e.stopPropagation();

    const willBeDark = themeSwitch.classList.contains('off');
    themeSwitch.classList.toggle('off', !willBeDark);
    applyGlobalDarkTheme(willBeDark);

    if(typeof toast === 'function'){
        toast(willBeDark ? 'Тёмная тема включена' : 'Тёмная тема выключена');
    }
}, true);

document.addEventListener('DOMContentLoaded', syncGlobalThemeSwitch);
setTimeout(syncGlobalThemeSwitch, 0);

