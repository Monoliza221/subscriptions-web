// ================== STATE ==================
const STORAGE_KEY = 'mysubs_state_v1';
function createEmptyState(){
    return {
        user: null,
        subscriptions: [],
        wallet: { balance: 0, autoTopup: null, transactions: [] },
        history: [],
        customCategories: [],
        deletedCategoryKeys: [],
    };
}
let state = loadState() || createEmptyState();
let tmpPhone = '';
let editingId = null;
let dashboardCalendarMonth = null;
let dashboardCalendarExpanded = false;
let selectedSubscriptionId = null;
let activeCategoryEditorKey = '';
let pendingCategoryTransferSubscriptionId = null;

function loadState(){ try{ return JSON.parse(AccountStorage.getItem(STORAGE_KEY)); }catch(e){ return null; } }
function saveState(){ AccountStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

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
let toastTimer = null;
function toast(msg, actionLabel = '', actionHandler = null){
    const t = document.getElementById('toast');
    if(!t) return;
    clearTimeout(toastTimer);
    t.innerHTML = '';

    const text = document.createElement('span');
    text.textContent = msg;
    t.appendChild(text);

    if(actionLabel && typeof actionHandler === 'function'){
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'toast-action';
        action.textContent = actionLabel;
        action.onclick = () => {
            t.classList.remove('show');
            actionHandler();
        };
        t.appendChild(action);
    }

    t.classList.add('show');
    toastTimer = setTimeout(() => t.classList.remove('show'), actionLabel ? 5000 : 2200);
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
    saveState();
}

// ================== AUTH ==================
function normalizeRussianPhoneDigits(value){
    let digits = String(value || '').replace(/\D/g, '');
    if(digits.startsWith('8')) digits = `7${digits.slice(1)}`;
    else if(digits && !digits.startsWith('7')) digits = `7${digits}`;
    if(!digits) digits = '7';
    return digits.slice(0, 11);
}

function formatRussianPhone(value){
    const digits = normalizeRussianPhoneDigits(value);
    const local = digits.slice(1);
    let result = '+7';

    if(local.length > 0) result += ` (${local.slice(0, 3)}`;
    if(local.length >= 3) result += ')';
    if(local.length > 3) result += ` ${local.slice(3, 6)}`;
    if(local.length > 6) result += `-${local.slice(6, 8)}`;
    if(local.length > 8) result += `-${local.slice(8, 10)}`;

    return result;
}

function initPhoneInputMask(){
    const input = document.getElementById('phoneInput');
    if(!input || input.dataset.phoneMaskReady === 'true') return;
    input.dataset.phoneMaskReady = 'true';

    const applyMask = () => {
        input.value = formatRussianPhone(input.value);
        try{ input.setSelectionRange(input.value.length, input.value.length); }catch(error){}
    };

    input.addEventListener('input', applyMask);
    input.addEventListener('focus', () => {
        if(!input.value.trim()) input.value = '+7';
    });
    input.addEventListener('keydown', event => {
        if((event.key === 'Backspace' || event.key === 'Delete') && normalizeRussianPhoneDigits(input.value).length <= 1){
            event.preventDefault();
            input.value = '+7';
        }
    });

    applyMask();
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPhoneInputMask, {once:true});
else initPhoneInputMask();
function sendCode(){
    const phoneInput = document.getElementById('phoneInput');
    const phoneDigits = normalizeRussianPhoneDigits(phoneInput?.value || '');
    const consent = document.getElementById('consent').checked;
    if(phoneDigits.length !== 11){ toast('Введите номер полностью'); return; }
    if(!consent){ toast('Нужно согласие с условиями'); return; }
    const formattedPhone = formatRussianPhone(phoneDigits);
    if(phoneInput) phoneInput.value = formattedPhone;
    tmpPhone = `+${phoneDigits}`;
    document.getElementById('phoneDisplay').textContent = formattedPhone;
    document.getElementById('authStep1').style.display = 'none';
    document.getElementById('authStep2').style.display = 'block';
    document.getElementById('codeInput').focus();
}
function backToStep1(){
    document.getElementById('authStep1').style.display = 'block';
    document.getElementById('authStep2').style.display = 'none';
}
function socialLogin(provider){
    const normalizedProvider = String(provider || '').trim();
    if(!['Яндекс','VK'].includes(normalizedProvider)) return;

    const accountId = `social:${normalizedProvider.toLowerCase()}`;
    AccountStorage.setActiveAccount(accountId);
    window.dispatchEvent(new CustomEvent('account-changed', { detail: { accountId } }));

    state = loadState() || createEmptyState();
    if(!state.user){
        seedDemo('');
        state.user.name = 'Пользователь';
        state.user.authProvider = normalizedProvider;
        saveState();
    }else{
        let changed = false;
        if(!state.user.authProvider){
            state.user.authProvider = normalizedProvider;
            changed = true;
        }
        if(/^Вход через\s+/i.test(String(state.user.phone || ''))){
            state.user.phone = '';
            changed = true;
        }
        if(changed) saveState();
    }
    enterApp();
}
function verifyCode(){
    const code = document.getElementById('codeInput').value.trim();
    if(code !== '123456'){ toast('Неверный код. Демо-код: 123456'); return; }

    AccountStorage.migrateLegacyAccount(tmpPhone, STORAGE_KEY, [
        'subscriptions_web_friend_states_v1',
        'subscriptions_rewards_shop_v1',
        'subscriptionsWebTimezone',
        'subscriptionsWebSystemNotifications',
        'profileNotificationsV1'
    ]);
    AccountStorage.setActiveAccount(tmpPhone);
    window.dispatchEvent(new CustomEvent('account-changed', { detail: { accountId: AccountStorage.getActiveAccount() } }));
    state = loadState() || createEmptyState();
    if(!state.user) seedDemo(formatRussianPhone(tmpPhone));
    enterApp();
}
function enterApp(){
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appRoot').style.display = 'grid';
    renderAll();
    // These modules and tariff constants are declared later in the page scripts.
    // Defer account-scoped refresh until the current script stack is complete.
    setTimeout(() => {
        if(typeof renderTariffSettings === 'function') renderTariffSettings();
        if(typeof window.refreshProfileNotificationsBadge === 'function') window.refreshProfileNotificationsBadge();
        if(typeof window.refreshSystemNotificationsSummary === 'function') window.refreshSystemNotificationsSummary();
    }, 0);
}
function logout(){
    saveState();
    AccountStorage.clearActiveAccount();
    window.dispatchEvent(new CustomEvent('account-changed', { detail: { accountId: '' } }));
    state = createEmptyState();
    tmpPhone = '';
    document.getElementById('authScreen').style.display = 'grid';
    document.getElementById('appRoot').style.display = 'none';
    const phoneInput = document.getElementById('phoneInput');
    const codeInput = document.getElementById('codeInput');
    if(phoneInput) phoneInput.value = '+7';
    if(codeInput) codeInput.value = '';
    backToStep1();
}
// ================== NAV ==================
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});
function switchView(name){
    const targetView = name === 'history' ? 'wallet' : name;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + targetView));
    if(name === 'history'){
        requestAnimationFrame(() => {
            const historyPanel = document.getElementById('walletHistoryPanel');
            if(historyPanel) historyPanel.scrollIntoView({ behavior:'smooth', block:'start', inline:'nearest' });
        });
    }
    if(name === 'categories') renderCategoriesUi();
    if(name === 'friends') renderFriendsScreen();
    if(name === 'friend-profile') renderFriendProfileScreen();
    if(name === 'friend-connections') renderFriendConnectionsScreen();
}

// ================== RENDER ==================
function renderAll(){
    renderAccountIdentity();
    renderNotificationSettings();
    renderPaymentMethods();
    renderPrivacySettings();
    renderDashboard();
    renderSubscriptions();
    renderWallet();
    renderHistory();
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
    const miniBox = document.getElementById('dashboardMiniCalendar');
    const details = document.getElementById('dashboardCalendarDetails');
    const daysBox = document.getElementById('dashboardCalendarDays');
    const eventsBox = document.getElementById('dashboardCalendarEvents');
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
    const startOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const miniWeeks = Math.ceil((startOffset + daysInMonth) / 7);
    const miniCellCount = miniWeeks * 7;
    const today = new Date();
    today.setHours(0,0,0,0);

    const byDate = new Map();
    items.forEach(subscription => {
        const date = new Date(subscription.next);
        if(Number.isNaN(date.getTime())) return;
        date.setHours(0,0,0,0);
        const key = calendarDateKey(date);
        if(!byDate.has(key)) byDate.set(key, []);
        byDate.get(key).push(subscription);
    });

    if(details) details.hidden = !dashboardCalendarExpanded;

    if(miniBox){
        const cells = [];
        for(let i = 0; i < miniCellCount; i++){
            const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
            date.setHours(0,0,0,0);
            const key = calendarDateKey(date);
            const payments = byDate.get(key) || [];
            const classes = ['dashboard-mini-calendar-day'];
            if(date.getMonth() !== month) classes.push('outside');
            if(date.getTime() === today.getTime()) classes.push('today');
            if(payments.length) classes.push('has-payment');

            cells.push(`
                <div class="${classes.join(' ')}" aria-label="${formatDate(key)}${payments.length ? `, списаний: ${payments.length}` : ''}">
                    <span>${date.getDate()}</span>
                    ${payments.length ? '<i></i>' : ''}
                </div>`);
        }

        miniBox.innerHTML = `
            <div class="dashboard-mini-calendar ${miniWeeks === 6 ? 'six-weeks' : ''}">
                <div class="dashboard-mini-calendar-head">
                    <button type="button" onclick="changeDashboardCalendarMonth(-1)" aria-label="Предыдущий месяц"><i class="fa-solid fa-chevron-left"></i></button>
                    <strong>${months[month]} ${year}</strong>
                    <button type="button" onclick="changeDashboardCalendarMonth(1)" aria-label="Следующий месяц"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
                <div class="dashboard-mini-calendar-weekdays">${weekdays.map(day => `<span>${day}</span>`).join('')}</div>
                <div class="dashboard-mini-calendar-grid">${cells.join('')}</div>
                <button class="dashboard-mini-calendar-more" type="button" onclick="toggleDashboardCalendar(true)">Подробнее</button>
            </div>`;
    }

    if(!daysBox || !dashboardCalendarExpanded){
        if(daysBox) daysBox.innerHTML = '';
        return;
    }

    let html = `
        <div class="dashboard-calendar-month-card">
            <div class="dashboard-calendar-month-top">
                <button class="dashboard-calendar-month-nav" type="button" onclick="changeDashboardCalendarMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
                <div class="dashboard-calendar-month-title">${months[month]} ${year}</div>
                <button class="dashboard-calendar-month-nav" type="button" onclick="changeDashboardCalendarMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div class="dashboard-calendar-month-grid">
                ${weekdays.map(day => `<div class="dashboard-calendar-month-head">${day}</div>`).join('')}
    `;

    for(let i = 0; i < 35; i++){
        const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
        date.setHours(0,0,0,0);
        const key = calendarDateKey(date);
        const inMonth = date.getMonth() === month;
        const isToday = date.getTime() === today.getTime();
        const payments = (byDate.get(key) || []).sort((a,b) => (a.amount || 0) - (b.amount || 0));

        let content = `<div class="dashboard-calendar-cell-number">${date.getDate()}</div>`;
        if(payments.length){
            const first = payments[0];
            const palette = ['orange','blue','green','gray'];
            const tone = first.currency === 'USD' ? 'blue' : palette[(date.getDate() + payments.length) % palette.length];
            content += `
                <div class="dashboard-calendar-event-mini ${tone}">
                    <div class="dashboard-calendar-event-mini-name">${first.name}</div>
                    <div class="dashboard-calendar-event-mini-price">${fmt(first.amount, first.currency)}</div>
                    ${payments.length > 1 ? `<div class="dashboard-calendar-event-mini-more">+${payments.length - 1} ещё</div>` : ''}
                </div>`;
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

function toggleDashboardCalendar(expanded){
    dashboardCalendarExpanded = Boolean(expanded);
    renderDashboard();

    if(dashboardCalendarExpanded){
        requestAnimationFrame(() => {
            document.getElementById('dashboardCalendarDetails')?.scrollIntoView({ behavior:'smooth', block:'start' });
        });
    }
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
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `Открыть детали подписки ${s.name}`);
    el.addEventListener('click', () => openSubscriptionDetail(s.id));
    el.addEventListener('keydown', event => {
        if(event.key === 'Enter' || event.key === ' '){
            event.preventDefault();
            openSubscriptionDetail(s.id);
        }
    });
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
            <button class="icon-btn" title="Редактировать" onclick="event.stopPropagation(); editSub('${s.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn danger" title="Отменить" onclick="event.stopPropagation(); confirmCancel('${s.id}')"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `;
    return el;
}

let subFilter = 'active';
let subscriptionSearchQuery = '';

function setSubscriptionSearch(value){
    subscriptionSearchQuery = String(value || '').trim().toLocaleLowerCase('ru-RU');
    const clearButton = document.getElementById('subscriptionSearchClear');
    if(clearButton) clearButton.hidden = subscriptionSearchQuery.length === 0;
    renderSubscriptions();
}

function clearSubscriptionSearch(){
    const input = document.getElementById('subscriptionSearchInput');
    if(input){
        input.value = '';
        input.focus();
    }
    setSubscriptionSearch('');
}

document.querySelectorAll('#subTabs .tab').forEach(t => {
    t.addEventListener('click', () => {
        document.querySelectorAll('#subTabs .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active'); subFilter = t.dataset.filter; renderSubscriptions();
    });
});

function renderSubscriptions(){
    const list = document.getElementById('subList');
    if(!list) return;
    const items = state.subscriptions.filter(subscription => {
        const matchesStatus = subFilter === 'active' ? subscription.active : !subscription.active;
        const matchesSearch = !subscriptionSearchQuery || String(subscription.name || '')
            .toLocaleLowerCase('ru-RU')
            .includes(subscriptionSearchQuery);
        return matchesStatus && matchesSearch;
    });
    list.innerHTML = '';
    if(items.length === 0){
        const message = subscriptionSearchQuery
            ? 'По вашему запросу ничего не найдено'
            : (subFilter === 'active' ? 'Добавьте первую подписку' : 'В архиве пусто');
        list.innerHTML = emptyHTML(message, subscriptionSearchQuery ? 'magnifying-glass' : 'box');
        return;
    }
    items.forEach(s => list.appendChild(subRow(s)));
}

function subscriptionCategoryLabel(category){
    const customCategory = (state.customCategories || []).find(item => item.key === category);
    if(customCategory) return customCategory.name;
    return {
        entertainment: 'Развлечения',
        software: 'Программы',
        communication: 'Связь',
        education: 'Образование',
        health: 'Здоровье',
        finance: 'Финансы',
        other: 'Другое'
    }[category] || category || 'Другое';
}

function subscriptionPeriodLabel(cycle){
    return { monthly:'месяц', yearly:'год', weekly:'неделю' }[cycle] || 'месяц';
}

function findSubscriptionById(id){
    const normalizedId = String(id ?? '');
    return (state.subscriptions || []).find(item => String(item?.id ?? '') === normalizedId) || null;
}

function subscriptionPaidThrough(subscription){
    if(!subscription) return '';
    return subscription.paidThrough || (subscription.lastPaidAt ? subscription.next : '');
}

function hasActivePaidPeriod(subscription){
    if(!subscription || subscription.active === false) return false;
    const paidThrough = subscriptionPaidThrough(subscription);
    return Boolean(paidThrough) && daysUntil(paidThrough) > 0;
}

function subscriptionAnnualAmount(subscription){
    if(subscription.cycle === 'yearly') return subscription.amount;
    if(subscription.cycle === 'weekly') return subscription.amount * 52;
    return subscription.amount * 12;
}

function openSubscriptionDetail(id){
    selectedSubscriptionId = id;
    renderSubscriptionDetail();
    switchView('subscription-detail');
}

function renderSubscriptionDetail(){
    const content = document.getElementById('subscriptionDetailContent');
    if(!content) return;
    const subscription = findSubscriptionById(selectedSubscriptionId);
    if(!subscription){
        content.innerHTML = `<div class="subscription-detail-card subscription-detail-empty">Подписка не найдена</div>`;
        return;
    }

    const days = daysUntil(subscription.next);
    const status = subscription.active && days > 0 ? 'Активна' : subscription.active ? 'Срок завершён' : 'В архиве';
    const paidForCurrentPeriod = hasActivePaidPeriod(subscription);
    const when = days < 0 ? `${Math.abs(days)} дн. назад` : days === 0 ? 'Сегодня' : days === 1 ? 'Завтра' : `Через ${days} дн.`;
    const period = subscriptionPeriodLabel(subscription.cycle);

    content.innerHTML = `
        <article class="subscription-detail-card subscription-detail-hero">
            ${subIconHTML(subscription).replace('class="sub-icon"','class="subscription-detail-icon"')}
            <h2>${subscription.name}</h2>
            <p class="subscription-detail-category">${subscriptionCategoryLabel(subscription.category)}</p>
        </article>

        <article class="subscription-detail-card subscription-detail-info">
            <div class="subscription-detail-row"><span>Сумма</span><strong>${fmt(subscription.amount, subscription.currency)} / ${period}</strong></div>
            <div class="subscription-detail-row"><span>Следующее списание</span><strong>${formatDate(subscription.next)}</strong></div>
            <div class="subscription-detail-row"><span>Когда</span><strong>${when}</strong></div>
            <div class="subscription-detail-row"><span>Статус</span><strong>${status}</strong></div>
            <div class="subscription-detail-row"><span>Годовая сумма</span><strong>${fmt(subscriptionAnnualAmount(subscription), subscription.currency)}</strong></div>
        </article>

        <div class="subscription-detail-actions">
            ${subscription.active ? `
                <button class="subscription-detail-action primary" type="button" ${paidForCurrentPeriod ? 'disabled aria-disabled="true"' : `onclick="confirmMarkPaidFromDetail('${subscription.id}')"`}><i class="fa-regular fa-circle-check"></i> ${paidForCurrentPeriod ? 'Подписка уже оплачена' : 'Я уже оплатил'}</button>
                <button class="subscription-detail-action secondary" type="button" onclick="editSubscriptionFromDetail('${subscription.id}')"><i class="fa-regular fa-pen-to-square"></i> Редактировать</button>
                <button class="subscription-detail-action secondary danger" type="button" onclick="archiveSubscriptionFromDetail('${subscription.id}')"><i class="fa-solid fa-box-archive"></i> Отменить в архив</button>
            ` : `
                <button class="subscription-detail-action primary" type="button" onclick="restoreSubscriptionFromDetail('${subscription.id}')"><i class="fa-solid fa-rotate-left"></i> Вернуть из архива</button>
            `}
            <button class="subscription-detail-action secondary danger" type="button" onclick="deleteSubscriptionFromDetail('${subscription.id}')"><i class="fa-regular fa-trash-can"></i> Удалить полностью</button>
        </div>
    `;
}

function configureSubscriptionConfirm({ title, text, confirmLabel, onConfirm, danger = true }){
    const titleEl = document.getElementById('confirmTitle');
    const textEl = document.getElementById('confirmText');
    const button = document.getElementById('confirmBtn');
    if(!titleEl || !textEl || !button) return;

    titleEl.textContent = title;
    textEl.textContent = text;
    button.textContent = confirmLabel;
    button.classList.toggle('btn-danger', danger);
    button.classList.toggle('btn-primary', !danger);
    button.onclick = onConfirm;
    openModal('confirmModal');
}

function editSubscriptionFromDetail(id){
    editSub(id);
}

function archiveSubscriptionFromDetail(id){
    const subscription = findSubscriptionById(id);
    if(!subscription) return;
    subscription.active = false;
    saveState();
    renderAll();
    selectedSubscriptionId = null;
    switchView('subscriptions');
    toast('Подписка перемещена в архив');
}

function restoreSubscriptionFromDetail(id){
    const subscription = findSubscriptionById(id);
    if(!subscription) return;
    subscription.active = true;
    saveState();
    renderAll();
    selectedSubscriptionId = null;
    switchView('subscriptions');
    toast('Подписка восстановлена');
}

function confirmMarkPaidFromDetail(id){
    const subscription = findSubscriptionById(id);
    if(!subscription) return;
    configureSubscriptionConfirm({
        title: 'Отметить оплату?',
        text: `Мы сохраним отметку «${subscription.name} оплачено» в истории, спишем ${fmt(subscription.amount, subscription.currency)} с кошелька и перенесём следующую дату списания.`,
        confirmLabel: 'Подтвердить',
        danger: false,
        onConfirm: () => {
            closeModal('confirmModal');
            markPaid(id, true);
            renderSubscriptionDetail();
        }
    });
}

function deleteSubscriptionFromDetail(id){
    const subscription = findSubscriptionById(id);
    if(!subscription) return;

    if(subscription.active && (hasActivePaidPeriod(subscription) || daysUntil(subscription.next) > 0)){
        configureSubscriptionConfirm({
            title: 'Подписка активна',
            text: `Подписка ${subscription.name} уже оплачена и действует до ${formatDate(subscription.next)}. Удалить её можно только после окончания оплаченного срока.`,
            confirmLabel: 'Понятно',
            danger: false,
            onConfirm: () => closeModal('confirmModal')
        });
        return;
    }

    configureSubscriptionConfirm({
        title: 'Удалить подписку?',
        text: `Подписка ${subscription.name} будет удалена полностью.`,
        confirmLabel: 'Удалить',
        onConfirm: () => {
            state.subscriptions = state.subscriptions.filter(item => String(item.id) !== String(id));
            state.history = (state.history || []).filter(item => String(item.subscriptionId ?? '') !== String(id));
            state.wallet.transactions = (state.wallet.transactions || []).filter(item => String(item.subscriptionId ?? '') !== String(id));
            saveState();
            closeModal('confirmModal');
            renderAll();
            selectedSubscriptionId = null;
            switchView('subscriptions');
            toast('Подписка удалена');
        }
    });
}

let calendarViewMode = 'month';
let calendarFocusedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calendarSelectedDate = null;

function setCalendarViewMode(mode){
    calendarViewMode = mode === 'list' ? 'list' : 'month';
    renderCalendar();
}

function shiftCalendarMonth(offset){
    calendarFocusedMonth = new Date(
        calendarFocusedMonth.getFullYear(),
        calendarFocusedMonth.getMonth() + offset,
        1
    );
    calendarSelectedDate = null;
    renderCalendar();
}

function selectCalendarDate(dateKey){
    const selected = new Date(`${dateKey}T12:00:00`);
    if(Number.isNaN(selected.getTime())) return;
    calendarFocusedMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    calendarSelectedDate = dateKey;
    renderCalendar();
}

function calendarDateKey(value){
    const date = value instanceof Date ? value : new Date(value);
    if(Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function calendarSubscriptionRows(items){
    if(!items.length) return '<div class="calendar-empty-day muted">На выбранную дату списаний нет</div>';
    const months = ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'];
    return items.map(s => {
        const d = new Date(s.next);
        const cycleLabel = {monthly:'/мес', yearly:'/год', weekly:'/нед'}[s.cycle] || '';
        return `
            <div class="sub-row calendar-sub-row">
                <div class="cal-date">
                    <div class="cal-day">${String(d.getDate()).padStart(2,'0')}</div>
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
            </div>`;
    }).join('');
}

function renderCalendar(){
    const list = document.getElementById('calList');
    const monthView = document.getElementById('calendarMonthView');
    if(!list || !monthView) return;

    const monthButton = document.getElementById('calendarMonthMode');
    const listButton = document.getElementById('calendarListMode');
    monthButton?.classList.toggle('active', calendarViewMode === 'month');
    listButton?.classList.toggle('active', calendarViewMode === 'list');
    monthView.hidden = calendarViewMode !== 'month';
    list.hidden = calendarViewMode !== 'list';

    const items = getActive().slice().sort((a,b) => new Date(a.next) - new Date(b.next));
    if(items.length === 0){
        const empty = emptyHTML('Нет предстоящих списаний','calendar');
        list.innerHTML = empty;
        monthView.innerHTML = empty;
        return;
    }

    list.innerHTML = calendarSubscriptionRows(items);
    if(calendarViewMode === 'list') return;

    const year = calendarFocusedMonth.getFullYear();
    const month = calendarFocusedMonth.getMonth();
    const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const first = new Date(year, month, 1);
    const mondayIndex = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - mondayIndex);
    const todayKey = calendarDateKey(new Date());
    const byDate = new Map();
    items.forEach(item => {
        const key = calendarDateKey(item.next);
        if(!byDate.has(key)) byDate.set(key, []);
        byDate.get(key).push(item);
    });

    const cells = [];
    for(let i=0; i<42; i++){
        const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate()+i);
        const key = calendarDateKey(day);
        const dayItems = byDate.get(key) || [];
        const classes = ['calendar-day'];
        if(day.getMonth() !== month) classes.push('outside');
        if(key === todayKey) classes.push('today');
        if(key === calendarSelectedDate) classes.push('selected');
        cells.push(`
            <button class="${classes.join(' ')}" type="button" onclick="selectCalendarDate('${key}')" aria-label="${formatDate(key)}${dayItems.length ? `, списаний: ${dayItems.length}` : ''}">
                <span class="calendar-day-number">${day.getDate()}</span>
                ${dayItems.length ? `<span class="calendar-day-dot"></span>` : ''}
            </button>`);
    }

    const monthItems = items.filter(item => {
        const date = new Date(item.next);
        return date.getFullYear() === year && date.getMonth() === month;
    });
    const selectedItems = calendarSelectedDate ? (byDate.get(calendarSelectedDate) || []) : null;
    const selectedBlock = calendarSelectedDate ? `
        <div class="calendar-section-title">Списания на ${formatDate(calendarSelectedDate)}</div>
        <div class="sub-list cal-list">${calendarSubscriptionRows(selectedItems)}</div>` : '';

    monthView.innerHTML = `
        <div class="card calendar-month-card">
            <div class="calendar-month-head">
                <button class="icon-btn" type="button" onclick="shiftCalendarMonth(-1)" aria-label="Предыдущий месяц"><i class="fa-solid fa-chevron-left"></i></button>
                <strong>${monthNames[month]} ${year}</strong>
                <button class="icon-btn" type="button" onclick="shiftCalendarMonth(1)" aria-label="Следующий месяц"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div class="calendar-weekdays">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => `<span>${day}</span>`).join('')}</div>
            <div class="calendar-grid">${cells.join('')}</div>
        </div>
        ${selectedBlock}
        <div class="calendar-section-title">Списания месяца</div>
        <div class="sub-list cal-list">${monthItems.length ? calendarSubscriptionRows(monthItems) : '<div class="calendar-empty-day muted">В этом месяце списаний нет</div>'}</div>`;
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
    const summary = document.getElementById('historyPaidSummary');
    const summaryValue = document.getElementById('historyPaidSummaryValue');
    const summaryNote = document.getElementById('historyPaidSummaryNote');
    const days = histPeriod === 'month' ? 30 : histPeriod === 'quarter' ? 90 : 365;
    const items = state.history.filter(h => daysUntil(h.date) >= -days).sort((a,b) => new Date(b.date) - new Date(a.date));
    const total = items.reduce((a,b) => a + b.amount, 0);
    const periodLabels = { month:'месяц', quarter:'квартал', year:'год' };
    const emptyLabels = {
        month:'За текущий месяц операций не было',
        quarter:'За текущий квартал операций не было',
        year:'За текущий год операций не было'
    };
    if(summary){
        summary.querySelector('.history-paid-summary-label').textContent = `Оплачено за ${periodLabels[histPeriod]}`;
        summaryValue.textContent = fmt(total);
        summaryNote.textContent = items.length ? `${items.length} ${items.length === 1 ? 'операция' : items.length < 5 ? 'операции' : 'операций'}` : emptyLabels[histPeriod];
    }
    if(items.length === 0){ el.innerHTML = emptyHTML('Нет операций за период','clock-rotate-left'); return; }
    el.innerHTML = items.map(h => `
        <div class="hist-row">
            <div class="hist-left">
                <div class="hist-dot"></div>
                <div>
                    <div style="font-weight:500;">${h.name}</div>
                    <div class="hist-date">Оплачено ${formatDate(h.date)}</div>
                </div>
            </div>
            <div class="hist-amount history-paid-amount">${fmt(Math.abs(h.amount), h.currency)}</div>
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
    const wasEditing = Boolean(editingId);
    saveState(); closeModal('addModal'); renderAll();
    if(wasEditing && selectedSubscriptionId === editingId){
        renderSubscriptionDetail();
    }
    editingId = null;
    toast(wasEditing ? 'Сохранено' : 'Подписка добавлена');
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

function markPaid(id, allowUndo = false){
    const s = findSubscriptionById(id); if(!s) return;
    if(!state.wallet || typeof state.wallet !== 'object') state.wallet = { balance:0, autoTopup:null, transactions:[] };
    if(!Array.isArray(state.wallet.transactions)) state.wallet.transactions = [];
    if(!Array.isArray(state.history)) state.history = [];

    const paidDate = new Date().toISOString().slice(0,10);
    const previousNext = s.next;
    const previousBalance = Number(state.wallet.balance) || 0;
    const previousLastPaidAt = s.lastPaidAt || null;
    const previousPaidThrough = s.paidThrough || null;
    const historyId = uid();
    const transactionId = uid();

    state.history.unshift({
        id: historyId,
        subscriptionId: s.id,
        date: paidDate,
        name: `${s.name} оплачено`,
        amount: s.amount,
        currency: s.currency,
        status: 'success'
    });
    state.wallet.transactions.unshift({
        id: transactionId,
        subscriptionId: s.id,
        type: 'payment',
        amount: s.amount,
        date: paidDate,
        title: `${s.name} оплачено`
    });
    const paymentAmount = Number(String(s.amount).replace(',', '.')) || 0;
    state.wallet.balance = previousBalance - paymentAmount;
    s.lastPaidAt = paidDate;

    const d = new Date(s.next);
    if(s.cycle === 'monthly') d.setMonth(d.getMonth()+1);
    else if(s.cycle === 'yearly') d.setFullYear(d.getFullYear()+1);
    else d.setDate(d.getDate()+7);
    s.next = d.toISOString().slice(0,10);
    s.paidThrough = s.next;

    saveState();
    renderAll();
    if(typeof window.addProfileNotification === 'function'){
        window.addProfileNotification({
            type:'payment',
            title:'Подписка оплачена',
            message:`Оплата «${s.name}» на сумму ${fmt(s.amount, s.currency)} сохранена.`
        });
    }
    if(allowUndo){
        window.lastPaidSubscriptionUndo = { subscriptionId:String(id), previousNext, previousBalance, previousLastPaidAt, previousPaidThrough, historyId, transactionId };
        toast('Оплата сохранена, дата сдвинута', 'Отменить', undoLastMarkedPayment);
    } else {
        toast('Оплата записана');
    }
}

function undoLastMarkedPayment(){
    const action = window.lastPaidSubscriptionUndo;
    if(!action) return;
    const subscription = findSubscriptionById(action.subscriptionId);
    if(subscription){
        subscription.next = action.previousNext;
        if(action.previousLastPaidAt) subscription.lastPaidAt = action.previousLastPaidAt;
        else delete subscription.lastPaidAt;
        if(action.previousPaidThrough) subscription.paidThrough = action.previousPaidThrough;
        else delete subscription.paidThrough;
    }
    state.wallet.balance = Number(action.previousBalance) || 0;
    state.history = (state.history || []).filter(item => item.id !== action.historyId);
    state.wallet.transactions = (state.wallet.transactions || []).filter(item => item.id !== action.transactionId);
    window.lastPaidSubscriptionUndo = null;
    saveState();
    renderAll();
    renderSubscriptionDetail();
    toast('Оплата отменена');
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
function openWithdrawModal(){
    const balance = Number(state.wallet?.balance) || 0;
    if(balance <= 0){ toast('Нет средств для вывода'); return; }

    const message = document.getElementById('withdrawModalText');
    const amountInput = document.getElementById('withdrawAmount');
    if(message) message.textContent = `Доступно для вывода: ${fmt(balance)}`;
    if(amountInput){
        amountInput.value = '';
        amountInput.max = String(balance);
    }
    openModal('withdrawModal');
    setTimeout(() => amountInput?.focus(), 0);
}
function withdrawConfirm(){
    const balance = Number(state.wallet?.balance) || 0;
    const amountInput = document.getElementById('withdrawAmount');
    const amount = Math.round(Number(amountInput?.value) * 100) / 100;

    if(balance <= 0){
        closeModal('withdrawModal');
        toast('Нет средств для вывода');
        return;
    }
    if(!Number.isFinite(amount) || amount <= 0){
        toast('Введите сумму вывода');
        amountInput?.focus();
        return;
    }
    if(amount > balance){
        toast('Недостаточно средств на балансе');
        amountInput?.focus();
        return;
    }

    state.wallet.balance = Math.round((balance - amount) * 100) / 100;
    state.wallet.transactions.unshift({
        id:uid(),
        type:'withdraw',
        amount,
        date:new Date().toISOString().slice(0,10),
        title:'Вывод средств'
    });
    saveState();
    closeModal('withdrawModal');
    renderAll();
    toast(`Выведено ${fmt(amount)}`);
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

function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => { if(e.target === m) m.classList.remove('open'); });
});

// ================== ONBOARDING ==================
const ONBOARDING_STORAGE_KEY = 'mysubs_onboarding_seen_v1';
const onboardingSlides = [
    { icon:'fa-table-columns', title:'Управляй подписками', text:'Добавляй сервисы, контролируй списания и держи расходы под рукой.' },
    { icon:'fa-user-group', title:'Авторы и лента', text:'Следи за авторами, делись активностью и находи полезные рекомендации.' },
    { icon:'fa-chart-line', title:'Аналитика и подсказки', text:'Смотри статистику, получай советы и планируй подписки заранее.' }
];
let onboardingPage = 0;
function renderOnboarding(){
    const slide = onboardingSlides[onboardingPage];
    const visual = document.getElementById('onboardingVisual');
    const title = document.getElementById('onboardingTitle');
    const text = document.getElementById('onboardingText');
    const dots = document.getElementById('onboardingDots');
    const next = document.getElementById('onboardingNext');
    if(!slide || !visual || !title || !text || !dots || !next) return;
    visual.innerHTML = `<i class="fa-solid ${slide.icon}"></i>`;
    title.textContent = slide.title;
    text.textContent = slide.text;
    dots.innerHTML = onboardingSlides.map((_, index) => `<button type="button" class="onboarding-dot${index === onboardingPage ? ' active' : ''}" aria-label="Шаг ${index + 1}" onclick="setOnboardingSlide(${index})"></button>`).join('');
    next.textContent = onboardingPage === onboardingSlides.length - 1 ? 'Начать' : 'Далее';
}
function setOnboardingSlide(index){
    onboardingPage = Math.max(0, Math.min(onboardingSlides.length - 1, Number(index) || 0));
    renderOnboarding();
}
function nextOnboardingSlide(){
    if(onboardingPage >= onboardingSlides.length - 1){ completeOnboarding(); return; }
    onboardingPage += 1;
    renderOnboarding();
}
function completeOnboarding(){
    try{ localStorage.setItem(ONBOARDING_STORAGE_KEY, '1'); }catch(error){}
    document.getElementById('onboardingScreen')?.classList.remove('open');
    document.getElementById('onboardingScreen')?.setAttribute('aria-hidden','true');
    document.getElementById('authScreen')?.classList.remove('onboarding-hidden');
    document.getElementById('appRoot')?.classList.remove('onboarding-hidden');
}
function initOnboarding(){
    let seen = false;
    try{ seen = localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'; }catch(error){}
    if(seen) return;
    onboardingPage = 0;
    renderOnboarding();
    document.getElementById('onboardingScreen')?.classList.add('open');
    document.getElementById('onboardingScreen')?.setAttribute('aria-hidden','false');
    document.getElementById('authScreen')?.classList.add('onboarding-hidden');
    document.getElementById('appRoot')?.classList.add('onboarding-hidden');
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initOnboarding, {once:true});
else initOnboarding();

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

let authorsSearchQuery = '';
function renderAuthors(){
    const root = document.getElementById('authorsGrid');
    if(!root) return;
    const query = authorsSearchQuery.trim().toLocaleLowerCase('ru-RU');
    const filteredAuthors = query ? authors.filter(author =>
        [author.name, author.handle, author.bio].some(value => String(value).toLocaleLowerCase('ru-RU').includes(query))
    ) : authors;
    root.innerHTML = filteredAuthors.map(author => `
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
    const empty = document.getElementById('authorsEmpty');
    if(empty) empty.hidden = filteredAuthors.length !== 0;
}

function initAuthorSearch(){
    const input = document.getElementById('authorsSearchInput');
    const clear = document.getElementById('authorsSearchClear');
    if(!input || input.dataset.ready === 'true') return;
    input.dataset.ready = 'true';
    input.addEventListener('input', () => {
        authorsSearchQuery = input.value;
        if(clear) clear.hidden = !authorsSearchQuery;
        renderAuthors();
    });
    clear?.addEventListener('click', () => {
        input.value = '';
        authorsSearchQuery = '';
        clear.hidden = true;
        renderAuthors();
        input.focus();
    });
    renderAuthors();
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAuthorSearch, {once:true});
else initAuthorSearch();

function openAuthorProfile(id){
    const author = authors.find(a => a.id === id) || authors[0];
    window.currentAuthorProfileId = String(author.id || 'default-author');

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

    switchView('author-profile');

    if(window.AuthorCancelSubscription && typeof window.AuthorCancelSubscription.sync === 'function'){
        window.AuthorCancelSubscription.sync();
    }
    if(window.AuthorPlanPicker && typeof window.AuthorPlanPicker.sync === 'function'){
        window.AuthorPlanPicker.sync();
    }
    if(typeof renderAuthorContent === 'function') renderAuthorContent();

    window.dispatchEvent(new CustomEvent('author-profile-changed', { detail: { authorId: author.id } }));
}

function renderAuthorContent(){
    const root = document.getElementById('authorContentGrid');
    if(!root) return;
    root.innerHTML = authorMaterials.map(item => {
        if(item.premium){
            const premiumUnlocked = !!(window.AuthorMaterials && typeof window.AuthorMaterials.isPremiumUnlocked === 'function' && window.AuthorMaterials.isPremiumUnlocked());
            return `
                <article class="author-content-card">
                    <div class="author-content-cover">
                        <div class="author-paywall ${premiumUnlocked ? 'is-purchased' : ''}">
                            <span class="badge premium-badge"><i class="fa-solid fa-crown"></i> PREMIUM</span>
                            <h3>${premiumUnlocked ? 'Материал куплен' : 'Доступ за разовую покупку'}</h3>
                            <button type="button" ${premiumUnlocked ? 'disabled' : ''}>${premiumUnlocked ? 'Куплено' : 'Купить за 299 ₽'}</button>
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
    { name:'Base', price:'199 ₽/мес · Следующее списание: 27.06.2026' },
    { name:'Pro', price:'490 ₽/мес · Следующее списание: 27.06.2026' },
    { name:'Premium', price:'799 ₽/мес · Следующее списание: 27.06.2026' },
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
    if(window.AuthorPlanPicker && typeof window.AuthorPlanPicker.open === 'function'){
        window.AuthorPlanPicker.open();
        return;
    }

    authorButtonState.tariffIndex = (authorButtonState.tariffIndex + 1) % authorTariffs.length;
    const tariff = authorTariffs[authorButtonState.tariffIndex];

    const title = document.querySelector('#view-author-profile .author-plan-card h3');
    const desc = document.querySelector('#view-author-profile .author-plan-card p');

    if(title) title.innerHTML = `${tariff.name} <i class="fa-solid fa-star"></i>`;
    if(desc) desc.textContent = tariff.price;

    if(typeof toast === 'function') toast(`Тариф изменён на ${tariff.name}`);
}

function buyAuthorPremium(button){
    if(window.AuthorMaterials && typeof window.AuthorMaterials.purchaseAndOpen === 'function'){
        window.AuthorMaterials.purchaseAndOpen();
        return;
    }

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
const analyticsMetricDetails = {
    'Всего за месяц': {icon:'fa-money-bill', text:'Сумма всех активных подписок, которые списываются в выбранном месяце.', rows:[['Текущий месяц','3 636 ₽'],['Активных подписок','5'],['За год при текущем темпе','43 632 ₽']]},
    'Средний чек': {icon:'fa-receipt', text:'Средняя стоимость одной активной подписки за выбранный период.', rows:[['Средний платёж','727 ₽'],['Самая дорогая','1 990 ₽'],['Самая доступная','149 ₽']]},
    'Прогноз года': {icon:'fa-arrow-trend-up', text:'Прогноз рассчитывается по текущим регулярным платежам без учёта будущих изменений тарифов.', rows:[['Прогноз на 12 месяцев','43 632 ₽'],['В среднем в месяц','3 636 ₽'],['Подписок в расчёте','5']]},
    'Можно сэкономить': {icon:'fa-piggy-bank', text:'Здесь отображается сумма доступной экономии по найденным рекомендациям.', rows:[['Доступная экономия','0 ₽'],['Активных рекомендаций','0'],['Статус','Новых рекомендаций нет']]}
};

function openAnalyticsDetails(title, text, rows = [], icon = 'fa-chart-pie'){
    const modal = document.getElementById('analyticsDetailsModal');
    if(!modal) return;
    document.getElementById('analyticsDetailsTitle').textContent = title;
    document.getElementById('analyticsDetailsText').textContent = text || '';
    document.getElementById('analyticsDetailsIcon').innerHTML = `<i class="fa-solid ${icon}"></i>`;
    document.getElementById('analyticsDetailsList').innerHTML = rows.map(([label,value]) => `
        <div class="analytics-details-row"><span>${label}</span><strong>${value}</strong></div>
    `).join('');
    openModal('analyticsDetailsModal');
}

document.addEventListener('click', function(e){
    const toggle = e.target.closest('#view-analytics .analytics-toggle button');
    if(toggle){
        e.preventDefault();
        document.querySelectorAll('#view-analytics .analytics-toggle button').forEach(btn => btn.classList.remove('active'));
        toggle.classList.add('active');
        if(typeof toast === 'function') toast(`Период: ${toggle.textContent.trim()}`);
        return;
    }

    const metric = e.target.closest('#view-analytics .analytics-metric');
    if(metric){
        e.preventDefault();
        const title = metric.querySelector('.analytics-m-label')?.textContent?.trim() || 'Подробности';
        const details = analyticsMetricDetails[title] || {text:'Подробная информация по выбранному показателю.', rows:[]};
        openAnalyticsDetails(title, details.text, details.rows, details.icon);
        return;
    }

    const insight = e.target.closest('#view-analytics .analytics-insight');
    if(insight){
        const cap = insight.querySelector('.analytics-i-cap')?.textContent?.trim() || 'Инсайт';
        const title = insight.querySelector('.analytics-i-title')?.textContent?.trim() || 'Инсайт';
        const subtitle = insight.querySelector('.analytics-i-sub')?.textContent?.trim() || '';
        openAnalyticsDetails(title, cap, [['Данные', subtitle]], 'fa-lightbulb');
        return;
    }

    const category = e.target.closest('#view-analytics .analytics-cat-row, #view-analytics .analytics-legend-row');
    if(category){
        const title = category.querySelector('.analytics-cat-name, .analytics-name')?.textContent?.trim() || 'Категория';
        const amount = category.querySelector('.analytics-cat-amt, .analytics-val')?.textContent?.trim() || '—';
        const percent = category.querySelector('.analytics-cat-meta, .analytics-pct')?.textContent?.trim() || '—';
        openAnalyticsDetails(title, 'Расходы по выбранной категории за текущий период.', [['Сумма', amount],['Доля расходов', percent],['Период','Текущий месяц']], 'fa-folder');
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


// ================== OWN / FRIEND ACHIEVEMENTS ==================
let achievementsViewMode = 'self';
let achievementsFriendId = null;

const selfAchievementsWeb = [
    {title:'Первая оплата',desc:'Совершите первую оплату через сервис',rarity:'Обычное',points:'+10',icon:'fa-credit-card',bg:'#eef6ee',color:'#3aa657',received:true},
    {title:'Постоянный клиент',desc:'Активные подписки 3 месяца',rarity:'Редкое',points:'+100',icon:'fa-user',bg:'#eef1fb',color:'#4a6cf7',received:true},
    {title:'Метроном',desc:'7 дней подряд в приложении',rarity:'Обычное',points:'+25',icon:'fa-fire',bg:'#eef6ee',color:'#3aa657',received:true},
    {title:'Первый анализ',desc:'Откройте отчёт «На что»',rarity:'Обычное',points:'+10',icon:'fa-chart-pie',bg:'#eef6ee',color:'#3aa657',received:true},
    {title:'Знакомство',desc:'Добавьте свою первую цель',rarity:'Обычное',points:'+5',icon:'fa-plus',bg:'#eef6ee',color:'#3aa657',received:false},
    {title:'Марафонец',desc:'30 дней подряд активности',rarity:'Легендарное',points:'+200',icon:'fa-trophy',bg:'#fbf1e8',color:'#ff5a1f',received:false},
    {title:'Мастер бюджета',desc:'Достигните всех финансовых целей',rarity:'Легендарное',points:'+300',icon:'fa-crown',bg:'#fbf1e8',color:'#ff5a1f',received:false}
];

const friendAchievementsWeb = [
    {title:'Первая оплата',desc:'Совершите первую оплату через сервис',rarity:'Обычное',points:'+10',icon:'fa-credit-card',bg:'#eef6ee',color:'#3aa657',received:true},
    {title:'Постоянный клиент',desc:'Активные подписки 3 месяца',rarity:'Редкое',points:'+100',icon:'fa-user-check',bg:'#eef1fb',color:'#4a6cf7',received:true},
    {title:'Метроном',desc:'7 дней подряд в приложении',rarity:'Обычное',points:'+25',icon:'fa-fire',bg:'#eef6ee',color:'#3aa657',received:true},
    {title:'Первый анализ',desc:'Откройте отчёт «На что уходят деньги»',rarity:'Обычное',points:'+10',icon:'fa-chart-pie',bg:'#eef6ee',color:'#3aa657',received:true},
    {title:'Знакомство',desc:'Добавьте свою первую подписку',rarity:'Обычное',points:'+5',icon:'fa-plus',bg:'#eef6ee',color:'#3aa657',received:true},
    {title:'Архивариус',desc:'Добавьте 5 подписок вручную',rarity:'Обычное',points:'+20',icon:'fa-folder-tree',bg:'#eef6ee',color:'#3aa657',received:true},
    {title:'Полное досье',desc:'Заполните профиль полностью',rarity:'Обычное',points:'+15',icon:'fa-address-card',bg:'#eef6ee',color:'#3aa657',received:true}
];

function openOwnAchievements(){
    achievementsViewMode = 'self';
    achievementsFriendId = null;
    renderAchievementsView();
    switchView('achievements');
}

function openFriendAchievements(){
    const friend = currentFriend();
    if(!friend) return;
    achievementsViewMode = 'friend';
    achievementsFriendId = friend.id;
    renderAchievementsView();
    switchView('achievements');
}

function backFromAchievements(){
    if(achievementsViewMode === 'friend' && achievementsFriendId){
        activeFriendProfileId = achievementsFriendId;
        switchView('friend-profile');
        return;
    }
    switchView('profile');
}

function renderAchievementsView(){
    const view = document.getElementById('view-achievements');
    if(!view) return;
    const isFriend = achievementsViewMode === 'friend';
    const friend = isFriend ? friendsWebItems.find(item=>item.id===achievementsFriendId) : null;
    const items = isFriend ? friendAchievementsWeb : selfAchievementsWeb;
    const unlocked = items.filter(item=>item.received).length;
    const points = isFriend && friend ? friendProfilePoints(friend) : 2800;
    const title = view.querySelector('.achievements-web-topbar h1');
    if(title) title.textContent = isFriend && friend ? `Достижения ${friend.firstName}` : 'Достижения';
    const labels = view.querySelectorAll('.achievements-web-label');
    if(labels[0]) labels[0].textContent = isFriend ? 'Баланс друга' : 'Ваш баланс';
    const values = view.querySelectorAll('.achievements-web-value');
    if(values[0]) values[0].innerHTML = `${Number(points).toLocaleString('ru-RU')}<span>баллов</span>`;
    if(values[1]) values[1].innerHTML = `${unlocked} <span>из ${items.length}</span>`;
    const count = view.querySelector('.achievements-web-count');
    if(count) count.textContent = `${unlocked} из ${items.length}`;
    const grid = view.querySelector('.achievements-web-grid');
    if(grid){
        grid.innerHTML = items.map(item=>`<article class="achievements-web-card${item.received?'':' locked'}">
            <div class="achievements-web-card-top">
                <div class="achievements-web-icon" style="background:${item.bg};color:${item.color};"><i class="fa-solid ${item.icon}"></i></div>
                <div class="achievements-web-check"><i class="fa-solid ${item.received?'fa-check':'fa-lock'}"></i></div>
            </div>
            <h3>${item.title}</h3>
            <p>${item.desc}</p>
            <div class="achievements-web-foot"><span>${item.rarity}</span><span class="achievements-web-points"><span></span>${item.points}</span></div>
        </article>`).join('');
    }
}

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

// ================== FEED REPOST STATE ==================
const FEED_REPOST_STORAGE_KEY = 'feed_reposted_posts_v1';

function feedRepostStorageGet(){
    try{
        const raw = window.AccountStorage ? AccountStorage.getItem(FEED_REPOST_STORAGE_KEY) : localStorage.getItem(FEED_REPOST_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    }catch(error){
        return {};
    }
}

function feedRepostStorageSet(value){
    const raw = JSON.stringify(value || {});
    if(window.AccountStorage) AccountStorage.setItem(FEED_REPOST_STORAGE_KEY, raw);
    else localStorage.setItem(FEED_REPOST_STORAGE_KEY, raw);
}

function feedPostKey(card){
    if(!card) return '';
    if(card.dataset.feedPostId) return card.dataset.feedPostId;
    const cards = Array.from(document.querySelectorAll('#view-feed .feed-web-card'));
    const index = cards.indexOf(card);
    const key = `feed-${index >= 0 ? index + 1 : 1}`;
    card.dataset.feedPostId = key;
    return key;
}

function syncFeedRepostStates(){
    const reposted = feedRepostStorageGet();
    document.querySelectorAll('#view-feed .feed-web-card').forEach(card => {
        const key = feedPostKey(card);
        const button = card.querySelector('.feed-web-action.share');
        if(!button) return;
        const countEl = button.querySelector('span');
        if(countEl && !card.dataset.feedBaseShares){
            card.dataset.feedBaseShares = String(Number(countEl.textContent || 0));
        }
        const baseCount = Number(card.dataset.feedBaseShares || countEl?.textContent || 0);
        const isReposted = Boolean(reposted[key]);
        button.classList.toggle('shared', isReposted);
        button.setAttribute('aria-pressed', isReposted ? 'true' : 'false');
        if(countEl) countEl.textContent = String(baseCount + (isReposted ? 1 : 0));
    });
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncFeedRepostStates);
else syncFeedRepostStates();

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
        const card = share.closest('.feed-web-card');
        const postKey = feedPostKey(card);
        const reposted = feedRepostStorageGet();
        const alreadyReposted = Boolean(reposted[postKey]);
        const title = card?.querySelector('h2')?.textContent?.trim() || 'Пост из ленты';
        const text = card?.querySelector('p')?.textContent?.trim() || title;

        const completeRepost = () => {
            const latest = feedRepostStorageGet();
            if(!latest[postKey]){
                latest[postKey] = true;
                feedRepostStorageSet(latest);
            }
            if(card && !card.dataset.feedBaseShares){
                const current = Number(share.querySelector('span')?.textContent || 0);
                card.dataset.feedBaseShares = String(current - (alreadyReposted ? 1 : 0));
            }
            const baseCount = Number(card?.dataset.feedBaseShares || 0);
            const finalCount = baseCount + 1;
            share.classList.add('shared');
            share.setAttribute('aria-pressed','true');
            const countEl = share.querySelector('span');
            if(countEl) countEl.textContent = String(finalCount);
            document.dispatchEvent(new CustomEvent('feed:repost-updated', {
                detail: { postKey, count: finalCount }
            }));
            if(!alreadyReposted && typeof toast === 'function') toast('Репост отправлен');
        };

        if(navigator.share){
            navigator.share({ title, text }).then(() => {
                completeRepost();
            }).catch(error => {
                if(error?.name !== 'AbortError' && typeof toast === 'function'){
                    toast('Не удалось отправить репост');
                }
            });
        } else if(navigator.clipboard){
            navigator.clipboard.writeText(`${title}
${text}`).then(() => {
                if(typeof toast === 'function') toast('Ссылка скопирована. Счётчик репостов не изменён');
            }).catch(() => {
                if(typeof toast === 'function') toast('Не удалось скопировать ссылку');
            });
        } else if(typeof toast === 'function'){
            toast('Отправка недоступна в этом браузере');
        }
        return;
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

// ================== GLOBAL THEME FROM SETTINGS ==================
let systemThemeMedia = null;

function getSavedThemeMode(){
    try{
        const saved = localStorage.getItem('globalThemeMode');
        if(['system','light','dark'].includes(saved)) return saved;
        return localStorage.getItem('globalDarkTheme') === '1' ? 'dark' : 'light';
    }catch(e){
        return 'light';
    }
}

function systemPrefersDark(){
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function resolveThemeMode(mode){
    return mode === 'dark' || (mode === 'system' && systemPrefersDark());
}

function applyGlobalDarkTheme(isDark){
    document.body.classList.toggle('global-dark-theme', Boolean(isDark));
    try{ localStorage.setItem('globalDarkTheme', isDark ? '1' : '0'); }catch(e){}
}

function syncThemeModeControls(){
    const mode = getSavedThemeMode();
    document.querySelectorAll('[data-theme-mode]').forEach(button => {
        const selected = button.dataset.themeMode === mode;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-checked', selected ? 'true' : 'false');
    });
    applyGlobalDarkTheme(resolveThemeMode(mode));
}

function selectThemeMode(mode){
    if(!['system','light','dark'].includes(mode)) return;
    try{ localStorage.setItem('globalThemeMode', mode); }catch(e){}
    syncThemeModeControls();
    if(typeof toast === 'function'){
        const labels = {system:'Тема будет меняться как в системе',light:'Светлая тема включена',dark:'Тёмная тема включена'};
        toast(labels[mode]);
    }
}

function initSystemThemeListener(){
    if(!window.matchMedia) return;
    systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
        if(getSavedThemeMode() === 'system') syncThemeModeControls();
    };
    if(systemThemeMedia.addEventListener) systemThemeMedia.addEventListener('change', update);
    else if(systemThemeMedia.addListener) systemThemeMedia.addListener(update);
}

document.addEventListener('DOMContentLoaded', () => {
    syncThemeModeControls();
    initSystemThemeListener();
});
setTimeout(syncThemeModeControls, 0);

// ================== SUBSCRIPTION TEST ==================
const subscriptionTestQuestions = [
    'Вы думаете о своих\nподписках чаще, чем\nхотелось бы?',
    'Подписки — это то, что\nвы обсуждаете с друзьями\nили коллегами?',
    'Вам нужно всё больше\nподписок, чтобы чувствовать\nсебя «в теме»?',
    'Раньше вам хватало\n2–3 сервисов, а теперь\nнужно больше?',
    'Вы чувствуете тревогу,\nкогда думаете об отмене\nподписки?',
    'Вам не по себе, если день\nбез подписанных сервисов?',
    'Подписки мешают вам\nоткладывать деньги\nна важное?',
    'Вы ссорились с близкими\nиз-за трат на подписки?',
    'Вы отменяли подписку,\nно потом возвращались\nк ней?',
    'Вы обещали «больше\nне подписываться»,\nно нарушали обещание?',
    'Вы оформляете подписки,\nдаже не уверены, что будете\nими пользоваться?',
    'Вы не можете остановиться\nи подписываетесь\nна новое?',
    'Вы говорите себе\n«это всего 199 ₽»,\nчтобы оправдать подписку?',
    'Вы скрываете от других,\nсколько тратите\nна подписки?'
];
const subscriptionTestCategories = ['Доминирование','Толерантность','Ломка','Конфликт','Срыв','Потеря контроля','Самообман'];
let subscriptionTestAnswers = Array(subscriptionTestQuestions.length).fill(3);
let subscriptionTestIndex = 0;

function setSubscriptionTestStep(id){
    document.querySelectorAll('#view-subscription-test .subscription-test-step').forEach(step=>step.classList.toggle('active',step.id===id));
    window.scrollTo({top:0,behavior:'smooth'});
}
function openSubscriptionTestFromDashboard(){
    switchView('subscription-test');
    setSubscriptionTestStep('subscriptionTestIntro');
}
function startSubscriptionTest(){
    subscriptionTestAnswers = Array(subscriptionTestQuestions.length).fill(3);
    subscriptionTestIndex = 0;
    setSubscriptionTestStep('subscriptionTestQuestions');
    renderSubscriptionTestQuestion();
}
function renderSubscriptionTestQuestion(){
    const n=subscriptionTestIndex+1;
    document.getElementById('subscriptionTestCounter').textContent=`${n} из ${subscriptionTestQuestions.length}`;
    document.getElementById('subscriptionTestProgressFill').style.width=`${n/subscriptionTestQuestions.length*100}%`;
    document.getElementById('subscriptionTestCategory').innerHTML=`<i class="fa-solid fa-circle-question"></i> ${subscriptionTestCategories[Math.floor(subscriptionTestIndex/2)]}`;
    document.getElementById('subscriptionTestQuestion').textContent=subscriptionTestQuestions[subscriptionTestIndex];
    const range=document.getElementById('subscriptionTestRange');
    range.value=subscriptionTestAnswers[subscriptionTestIndex];
    document.getElementById('subscriptionTestRangeValue').textContent=range.value;
}
function updateSubscriptionTestAnswer(value){
    subscriptionTestAnswers[subscriptionTestIndex]=Number(value);
    document.getElementById('subscriptionTestRangeValue').textContent=value;
}
function subscriptionTestBack(){
    if(subscriptionTestIndex===0){ setSubscriptionTestStep('subscriptionTestIntro'); return; }
    subscriptionTestIndex--; renderSubscriptionTestQuestion();
}
function subscriptionTestNext(){
    if(subscriptionTestIndex<subscriptionTestQuestions.length-1){ subscriptionTestIndex++; renderSubscriptionTestQuestion(); return; }
    renderSubscriptionTestResult();
}
function subscriptionTestScore(){
    const raw=subscriptionTestAnswers.reduce((a,b)=>a+b,0), min=subscriptionTestAnswers.length, max=min*5;
    return Math.round((raw-min)/(max-min)*100);
}
function subscriptionTestLevel(score){
    if(score<34) return {title:'«Свободный подписчик»',color:'#34c759',description:'Вы полностью контролируете свои подписки. Отличный результат — поделитесь опытом с друзьями!'};
    if(score<67) return {title:'«Осознанный подписчик»',color:'#ff9500',description:'Вы в целом контролируете свои подписки, но некоторые траты стоит пересмотреть внимательнее.'};
    return {title:'«Зависимый подписчик»',color:'#ff3b30',description:'Подписки занимают слишком много внимания и бюджета. Самое время сократить лишние сервисы.'};
}
function renderSubscriptionTestResult(){
    const score=subscriptionTestScore(), level=subscriptionTestLevel(score);
    setSubscriptionTestStep('subscriptionTestResult');
    const scoreEl=document.getElementById('subscriptionTestScore'), levelEl=document.getElementById('subscriptionTestLevel'), pointer=document.getElementById('subscriptionTestPointer');
    scoreEl.textContent=score; scoreEl.style.color=level.color;
    levelEl.textContent=level.title; levelEl.style.color=level.color;
    document.getElementById('subscriptionTestDescription').textContent=level.description;
    pointer.style.left=`${Math.max(1,Math.min(99,score))}%`; pointer.style.borderColor=level.color;
}
function showSubscriptionTestResult(){ renderSubscriptionTestResult(); }
function subscriptionTestDimensionScores(){
    return subscriptionTestCategories.map((_,i)=>subscriptionTestAnswers[i*2]+subscriptionTestAnswers[i*2+1]);
}
function showSubscriptionTestBreakdown(){
    setSubscriptionTestStep('subscriptionTestBreakdown');
    const scores=subscriptionTestDimensionScores();
    document.getElementById('subscriptionTestDimensions').innerHTML=scores.map((score,i)=>`<div class="subscription-test-dimension"><div class="subscription-test-dimension-head"><span>${subscriptionTestCategories[i]}</span><span>${score}/10</span></div><div class="subscription-test-dimension-bar"><div style="width:${score*10}%"></div></div></div>`).join('');
    const total=subscriptionTestScore(), strongest=scores.indexOf(Math.max(...scores)), dimension=subscriptionTestCategories[strongest];
    const first=total<34?'Отличный контроль! Вы уверенно управляете своими подписками. Поделитесь опытом с друзьями.':total<67?'У вас есть зоны риска. Начните с одной подписки, которой пользовались меньше всего за последний месяц.':'Сделайте паузу перед новыми подписками и проверьте, какие сервисы реально нужны каждый месяц.';
    const tips={
        'Доминирование':'Раз в месяц проверяйте, не стали ли подписки занимать слишком много внимания.',
        'Толерантность':'Зафиксируйте лимит на количество активных сервисов и не добавляйте новые без отмены старых.',
        'Ломка':'Попробуйте один день без развлекательных подписок и оцените, насколько это комфортно.',
        'Конфликт':'Обсудите общий бюджет на подписки с близкими, чтобы траты не вызывали напряжение.',
        'Срыв':'Перед повторным оформлением подписки делайте паузу хотя бы 24 часа.',
        'Потеря контроля':'Включите ежемесячный лимит и проверяйте список активных подписок в начале месяца.',
        'Самообман':'Замените фразу «это всего 199 ₽» на проверку пользы: пользовались ли вы сервисом за последние 30 дней?'
    };
    const third=total<34?'Вы — хороший пример осознанного потребления.':total<67?'Выберите 1–2 сервиса, которые можно временно отключить без сильного дискомфорта.':'Начните с челленджа «30 дней без новой подписки», чтобы вернуть контроль над расходами.';
    document.getElementById('subscriptionTestRecommendations').innerHTML=[first,tips[dimension],third].map((t,i)=>`<div class="subscription-test-recommendation"><b>${i+1}</b><span>${t}</span></div>`).join('');
}
async function shareSubscriptionTestResult(){
    const score=subscriptionTestScore(), level=subscriptionTestLevel(score).title.replace(/[«»]/g,'');
    const text=`Я прошёл подписочный тест: ${score}/100 — ${level}.`;
    try{
        if(navigator.share){ await navigator.share({title:'Подписочный тест',text}); }
        else{ await navigator.clipboard.writeText(text); toast('Результат скопирован'); }
    }catch(e){}
}


// ================== CATEGORIES UI ==================
const defaultCategoryUiItems = [
    { key:'entertainment', name:'Развлечения', color:'#8b5cf6', icon:'fa-film' },
    { key:'software', name:'Сервисы и ПО', color:'#3b82f6', icon:'fa-laptop-code' },
    { key:'communication', name:'Связь', color:'#ef4444', icon:'fa-signal' },
    { key:'education', name:'Образование', color:'#f59e0b', icon:'fa-graduation-cap' },
    { key:'health', name:'Здоровье', color:'#10b981', icon:'fa-heart-pulse' },
    { key:'finance', name:'Финансы', color:'#06b6d4', icon:'fa-chart-line' },
    { key:'other', name:'Другое', color:'#64748b', icon:'fa-folder' }
];

let categoryUiItems = [...defaultCategoryUiItems];

function syncCategoryUiItems(){
    if(!Array.isArray(state.customCategories)) state.customCategories = [];
    categoryUiItems = [...defaultCategoryUiItems, ...state.customCategories];
}

function openCategoriesFromDashboard(){
    renderCategoriesUi();
    switchView('categories');
}

function categoryCount(key){
    return (state.subscriptions || []).filter(item => (item.category || 'other') === key).length;
}

function renderCategoriesUi(){
    syncCategoryUiItems();
    const list = document.getElementById('categoriesList');
    if(!list) return;
    list.innerHTML = categoryUiItems.map(item => {
        const count = categoryCount(item.key);
        return `
            <button class="category-list-card" type="button" onclick="openCategoryEditor('${item.key}')">
                <span class="category-list-icon" style="--category-color:${item.color}">
                    <i class="fa-solid ${item.icon}"></i>
                </span>
                <span class="category-list-copy">
                    <strong>${item.name}</strong>
                    <small>${count} ${categorySubscriptionWord(count)}</small>
                </span>
                <i class="fa-solid fa-chevron-right category-list-arrow"></i>
            </button>`;
    }).join('');
}

function categorySubscriptionWord(count){
    const mod10=count%10, mod100=count%100;
    if(mod10===1 && mod100!==11) return 'подписка';
    if(mod10>=2 && mod10<=4 && !(mod100>=12 && mod100<=14)) return 'подписки';
    return 'подписок';
}

function openCategoryEditor(key){
    syncCategoryUiItems();
    const item = categoryUiItems.find(category => category.key === key);
    const title = document.getElementById('categoryEditorTitle');
    const input = document.getElementById('categoryNameInput');
    const deleteButton = document.getElementById('categoryDeleteButton');
    activeCategoryEditorKey = key || '';
    if(title) title.textContent = item ? 'Редактировать категорию' : 'Новая категория';
    if(input) input.value = item?.name || '';
    if(deleteButton) deleteButton.style.visibility = item && (state.customCategories || []).some(category => category.key === item.key) ? 'visible' : 'hidden';
    renderCategorySubscriptionsUi(activeCategoryEditorKey);
    switchView('category-editor');
}

function categorySubscriptionCard(subscription, options = {}){
    const action = options.action || '';
    const categoryLabel = subscriptionCategoryLabel(subscription.category);
    return `
        <button class="category-subscription-card ${options.picker ? 'is-picker' : ''}" type="button" ${action}>
            <span class="category-subscription-logo" style="background:${subscription.color || '#111827'};color:${subscription.textDark ? '#111827' : '#fff'}">${(subscription.name || '?').slice(0,1).toUpperCase()}</span>
            <span class="category-subscription-copy">
                <strong>${subscription.name}</strong>
                <small>${options.subtitle || categoryLabel}</small>
            </span>
            ${options.picker ? '<i class="fa-solid fa-plus category-picker-plus"></i>' : '<i class="fa-solid fa-check category-current-check"></i>'}
        </button>`;
}

function renderCategorySubscriptionsUi(categoryKey){
    const list = document.getElementById('categorySubscriptionsList');
    if(!list) return;
    const subscriptions = (state.subscriptions || []).filter(subscription => subscription.category === categoryKey);
    if(!subscriptions.length){
        list.innerHTML = '<div class="category-empty"><i class="fa-regular fa-folder-open"></i><strong>В категории пока нет подписок</strong><span>Нажмите «Добавить подписку», чтобы выбрать её из списка</span></div>';
        return;
    }
    list.innerHTML = subscriptions.map(subscription => categorySubscriptionCard(subscription, {
        subtitle: subscriptionCategoryLabel(categoryKey)
    })).join('');
}

function openCategorySubscriptionPicker(){
    if(!activeCategoryEditorKey){
        toast('Сначала сохраните новую категорию');
        return;
    }
    const modal = document.getElementById('categorySubscriptionModal');
    const list = document.getElementById('categorySubscriptionPickerList');
    const target = categoryUiItems.find(item => item.key === activeCategoryEditorKey);
    const available = (state.subscriptions || []).filter(subscription => subscription.category !== activeCategoryEditorKey);
    document.getElementById('categoryModalSubtitle').textContent = target
        ? `Выберите подписку для категории «${target.name}»`
        : 'Выберите подписку из списка';
    if(!available.length){
        list.innerHTML = '<div class="category-empty"><i class="fa-solid fa-check"></i><strong>Все подписки уже добавлены</strong><span>В этой категории находятся все доступные подписки</span></div>';
    }else{
        list.innerHTML = available.map(subscription => categorySubscriptionCard(subscription, {
            picker:true,
            subtitle:`Сейчас: ${subscriptionCategoryLabel(subscription.category)}`,
            action:`onclick="selectSubscriptionForCategory('${subscription.id}')"`
        })).join('');
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
}

function closeCategorySubscriptionPicker(){
    const modal = document.getElementById('categorySubscriptionModal');
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden','true');
}

function selectSubscriptionForCategory(subscriptionId){
    const subscription = (state.subscriptions || []).find(item => item.id === subscriptionId);
    if(!subscription) return;
    const currentCategory = categoryUiItems.find(item => item.key === subscription.category);
    const targetCategory = categoryUiItems.find(item => item.key === activeCategoryEditorKey);
    pendingCategoryTransferSubscriptionId = subscriptionId;
    closeCategorySubscriptionPicker();

    if(subscription.category && subscription.category !== activeCategoryEditorKey){
        const text = document.getElementById('categoryTransferText');
        if(text) text.innerHTML = `Подписка <strong>«${subscription.name}»</strong> уже добавлена в категорию <strong>«${currentCategory?.name || subscriptionCategoryLabel(subscription.category)}»</strong>.<br><br>Перенести её в категорию <strong>«${targetCategory?.name || 'выбранную категорию'}»</strong>?`;
        const modal = document.getElementById('categoryTransferModal');
        modal.classList.add('open');
        modal.setAttribute('aria-hidden','false');
        return;
    }
    confirmCategoryTransfer();
}

function closeCategoryTransferConfirmation(){
    const modal = document.getElementById('categoryTransferModal');
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden','true');
    pendingCategoryTransferSubscriptionId = null;
}

function confirmCategoryTransfer(){
    const subscription = (state.subscriptions || []).find(item => item.id === pendingCategoryTransferSubscriptionId);
    if(!subscription || !activeCategoryEditorKey){
        closeCategoryTransferConfirmation();
        return;
    }
    subscription.category = activeCategoryEditorKey;
    saveState();
    closeCategoryTransferConfirmation();
    renderCategorySubscriptionsUi(activeCategoryEditorKey);
    renderCategoriesUi();
    toast(`«${subscription.name}» добавлена в категорию`);
}


function deleteCategoryUi(){
    if(!activeCategoryEditorKey) return;

    syncCategoryUiItems();
    const customIndex = (state.customCategories || []).findIndex(item => item.key === activeCategoryEditorKey);
    if(customIndex < 0){
        toast('Стандартные категории удалить нельзя');
        return;
    }

    const category = state.customCategories[customIndex];
    const subscriptionsCount = categoryCount(activeCategoryEditorKey);
    const message = subscriptionsCount > 0
        ? `Удалить категорию «${category.name}»? Подписки из неё будут перенесены в категорию «Другое».`
        : `Удалить категорию «${category.name}»?`;

    if(!window.confirm(message)) return;

    (state.subscriptions || []).forEach(subscription => {
        if(subscription.category === activeCategoryEditorKey) subscription.category = 'other';
    });

    state.customCategories.splice(customIndex, 1);

    const deletedName = category.name;
    activeCategoryEditorKey = '';
    saveState();
    syncCategoryUiItems();
    renderCategoriesUi();
    switchView('categories');
    toast(`Категория «${deletedName}» удалена`);
}

function saveCategoryUi(){
    const name = document.getElementById('categoryNameInput')?.value.trim();
    if(!name){ toast('Введите название категории'); return; }

    if(!Array.isArray(state.customCategories)) state.customCategories = [];

    if(!activeCategoryEditorKey){
        const palette = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4'];
        const newCategory = {
            key: `custom_${uid()}`,
            name,
            color: palette[state.customCategories.length % palette.length],
            icon: 'fa-folder'
        };
        state.customCategories.push(newCategory);
        activeCategoryEditorKey = newCategory.key;
        saveState();
        syncCategoryUiItems();
        renderCategoriesUi();
        toast(`Категория «${name}» создана`);
        switchView('categories');
        return;
    }

    const customCategory = state.customCategories.find(item => item.key === activeCategoryEditorKey);
    if(customCategory){
        customCategory.name = name;
        saveState();
        syncCategoryUiItems();
        renderCategoriesUi();
        toast('Название категории сохранено');
    }else{
        toast('Категория сохранена');
    }
    switchView('categories');
}


// ================== FRIENDS UI ==================
const FRIENDS_STORAGE_KEY = 'subscriptions_web_friend_states_v1';
const friendsWebDefaults = [
    {id:'maria',name:'Мария Соколова',firstName:'Мария',initials:'МС',level:4,common:3,color:'#d72f83',relation:'friend'},
    {id:'ivan',name:'Иван Петров',firstName:'Иван',initials:'ИП',level:2,common:1,color:'#2f65d4',relation:'friend'},
    {id:'olga',name:'Ольга Васильева',firstName:'Ольга',initials:'ОВ',level:5,common:2,color:'#ff572f',relation:'friend'},
    {id:'dmitry',name:'Дмитрий Козлов',firstName:'Дмитрий',initials:'ДК',level:3,common:4,color:'#07956f',relation:'follower'},
    {id:'anna',name:'Анна Новикова',firstName:'Анна',initials:'АН',level:4,common:0,color:'#ff6a3d',relation:'request'},
    {id:'sasha',name:'Саша Миронов',firstName:'Саша',initials:'СМ',level:3,common:1,color:'#8b5cf6',relation:'not_friend'},
    {id:'kirill',name:'Кирилл Орлов',firstName:'Кирилл',initials:'КО',level:2,common:1,color:'#0ea5e9',relation:'not_friend'},
    {id:'elena',name:'Елена Морозова',firstName:'Елена',initials:'ЕМ',level:4,common:2,color:'#ec4899',relation:'not_friend'}
];
let friendsWebItems = loadFriendsWebItems();
let friendsWebTab = 0;
let activeFriendProfileId = 'maria';
let friendProfileBackTarget = 'friends';
let friendConnectionsOwnerId = null;
let friendConnectionsReturnTarget = 'friends';

function loadFriendsWebItems(){
    try{
        const saved=JSON.parse(AccountStorage.getItem(FRIENDS_STORAGE_KEY)||'null');
        if(!Array.isArray(saved)) return friendsWebDefaults.map(x=>({...x}));
        return friendsWebDefaults.map(base=>({...base,relation:saved.find(x=>x.id===base.id)?.relation||base.relation}));
    }catch(_){ return friendsWebDefaults.map(x=>({...x})); }
}
function saveFriendsWebItems(){
    AccountStorage.setItem(FRIENDS_STORAGE_KEY,JSON.stringify(friendsWebItems.map(({id,relation})=>({id,relation}))));
}
function friendCounts(){
    return {
        friend:friendsWebItems.filter(x=>x.relation==='friend').length,
        follower:friendsWebItems.filter(x=>x.relation==='follower').length,
        request:friendsWebItems.filter(x=>x.relation==='request').length
    };
}
function updateFriendsBadges(){
    const c=friendCounts();
    const a=document.getElementById('friendsCountBadge'); if(a) a.textContent=c.friend;
    const b=document.getElementById('followersCountBadge'); if(b) b.textContent=c.follower;
    const d=document.getElementById('requestsCountBadge'); if(d) d.textContent=c.request;
}
function openFriendsScreen(tab=0){ friendsWebTab=tab; switchView('friends'); }
function setFriendsTab(tab){ friendsWebTab=tab; renderFriendsScreen(); }
function toggleFriendsSearch(){
    const box=document.getElementById('friendsWebSearch');
    box?.classList.toggle('open');
    if(box?.classList.contains('open')) document.getElementById('friendsWebSearchInput')?.focus();
    else closeFriendsSearch();
}
function closeFriendsSearch(){
    const box=document.getElementById('friendsWebSearch');
    const input=document.getElementById('friendsWebSearchInput');
    box?.classList.remove('open'); if(input) input.value=''; renderFriendsScreen();
}
function friendsWebForTab(){
    const relation=friendsWebTab===1?'follower':friendsWebTab===2?'request':'friend';
    return friendsWebItems.filter(x=>x.relation===relation);
}
function friendRelationLabel(item){
    if(item.relation==='request') return ['Принять','request'];
    if(item.relation==='follower') return ['Подписан на вас','follower'];
    if(item.relation==='subscribed') return ['Вы подписаны','subscribed'];
    if(item.relation==='not_friend') return ['Добавить друга','not-friend'];
    return ['В друзьях',''];
}
function friendSubtitle(item){
    if(item.relation==='request') return 'Заявка в друзья';
    const common=item.common?`${item.common} ${item.common===1?'общая подписка':'общие подписки'}`:'нет общих подписок';
    return `Уровень ${item.level} · ${common}`;
}
function renderFriendsScreen(){
    updateFriendsBadges();
    document.querySelectorAll('[data-friends-tab]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.friendsTab)===friendsWebTab));
    const query=(document.getElementById('friendsWebSearchInput')?.value||'').trim().toLowerCase();
    const items=friendsWebForTab().filter(item=>[item.name,item.firstName,item.initials].join(' ').toLowerCase().includes(query));
    const list=document.getElementById('friendsWebList'); if(!list) return;
    if(!items.length){ list.innerHTML='<div class="friends-web-empty">Пользователи не найдены</div>'; return; }
    list.innerHTML=items.map(item=>`<button class="friends-web-card" type="button" onclick="openFriendProfile('${item.id}','friends')">
        <span class="friends-web-avatar" style="background:${item.color}">${item.initials}</span>
        <span class="friends-web-card-main"><span class="friends-web-card-name">${item.name}</span><span class="friends-web-card-sub">${friendSubtitle(item)}</span></span>
    </button>`).join('');
}
function openFriendProfile(id, backTarget){
    if(backTarget){
        friendProfileBackTarget = backTarget;
    }else{
        const connectionsView = document.getElementById('view-friend-connections');
        friendProfileBackTarget = connectionsView && connectionsView.classList.contains('active') ? 'friend-connections' : 'friends';
    }
    activeFriendProfileId=id;
    switchView('friend-profile');
}
function goBackFromFriendProfile(){
    if(friendProfileBackTarget === 'friend-connections'){
        switchView('friend-connections');
        return;
    }
    switchView(friendProfileBackTarget || 'friends');
}
function currentFriend(){ return friendsWebItems.find(x=>x.id===activeFriendProfileId)||friendsWebItems[0]; }
function relationButtonLabel(friend){ return friendRelationLabel(friend)[0]; }
function relationStatusText(friend){ return friendRelationLabel(friend)[0]; }
function friendActionText(friend){
    if(friend.relation==='request') return ['Добавить в друзья','Пользователь перейдёт в друзья','Добавить'];
    if(friend.relation==='follower') return ['Добавить в друзья','Пользователь перейдёт в друзья','Добавить'];
    if(friend.relation==='friend') return ['Убрать из друзей','Пользователь перейдёт в подписчики','Убрать'];
    if(friend.relation==='subscribed') return ['Отписаться','Заявка в друзья будет отменена','Отписаться'];
    return ['Добавить в друзья','Пользователь увидит вашу заявку','Добавить'];
}
function setFriendRelation(id,relation,message){
    const item=friendsWebItems.find(x=>x.id===id); if(!item) return;
    const previousRelation=item.relation;
    item.relation=relation; saveFriendsWebItems(); updateFriendsBadges();
    renderFriendsScreen(); renderFriendProfileScreen();
    if(typeof window.addProfileNotification === 'function' && previousRelation!==relation){
        if(relation==='friend'){
            window.addProfileNotification({type:'friend',title:'Новый друг',message:`${item.name} теперь в списке ваших друзей.`});
        }else if(relation==='subscribed'){
            window.addProfileNotification({type:'friend',title:'Заявка отправлена',message:`Вы отправили заявку пользователю ${item.name}.`});
        }
    }
    if(message) toast(message);
}
function showFriendConfirmation(friend,title,message,confirmLabel,onConfirm,isDestructive=false){
    const modal=document.getElementById('confirmModal');
    const titleEl=document.getElementById('confirmTitle');
    const textEl=document.getElementById('confirmText');
    const btn=document.getElementById('confirmBtn');
    if(!modal||!titleEl||!textEl||!btn){ if(window.confirm(`${title}\n\n${message}`)) onConfirm(); return; }
    titleEl.textContent=title; textEl.textContent=message; btn.textContent=confirmLabel;
    btn.classList.toggle('danger',!!isDestructive);
    btn.onclick=()=>{ closeModal('confirmModal'); onConfirm(); };
    openModal('confirmModal');
}
function handleFriendPrimaryAction(){
    const friend=currentFriend();
    if(friend.relation==='request'){
        showFriendConfirmation(friend,'Добавить в друзья','Пользователь перейдёт в друзья','Добавить',()=>setFriendRelation(friend.id,'friend',`${friend.firstName} добавлен(а) в друзья`));
    }else if(friend.relation==='follower'){
        showFriendRelationMenu(friend,'add');
    }else if(friend.relation==='friend'){
        showFriendRelationMenu(friend,'remove');
    }else if(friend.relation==='subscribed'){
        showFriendConfirmation(friend,'Отписаться','Заявка в друзья будет отменена','Отписаться',()=>setFriendRelation(friend.id,'not_friend',`Вы отписались от ${friend.firstName}`),true);
    }else{
        showFriendConfirmation(friend,'Добавить в друзья','Пользователь увидит вашу заявку','Добавить',()=>setFriendRelation(friend.id,'subscribed',`Вы подписались на ${friend.firstName}`));
    }
}
function showFriendRelationMenu(friend,action){
    const isAdd=action==='add';
    const title=isAdd?'Добавить в друзья':'Убрать из друзей';
    const subtitle=isAdd?'Пользователь перейдёт в друзья':'Пользователь перейдёт в подписчики';
    const menu=document.createElement('div');
    menu.className='friend-relation-menu';
    menu.innerHTML=`<button type="button"><i class="fa-solid ${isAdd?'fa-user-plus':'fa-user-minus'}"></i><span><strong>${title}</strong><small>${subtitle}</small></span></button>`;
    document.body.appendChild(menu);
    const anchor=document.querySelector('.friend-profile-web-primary');
    const r=anchor?.getBoundingClientRect();
    menu.style.left=`${Math.max(16,Math.min((r?.left||20),window.innerWidth-300))}px`;
    menu.style.top=`${(r?.bottom||100)+8}px`;
    const close=()=>menu.remove();
    setTimeout(()=>document.addEventListener('click',close,{once:true}),0);
    menu.querySelector('button').onclick=(e)=>{
        e.stopPropagation(); close();
        if(isAdd) setFriendRelation(friend.id,'friend',`${friend.firstName} добавлен(а) в друзья`);
        else setFriendRelation(friend.id,'follower',`${friend.firstName} теперь в подписчиках`);
    };
}
function openFriendMoreActions(){
    const friend=currentFriend();
    const [title,message,confirmLabel]=friendActionText(friend);
    const destructive=friend.relation==='friend'||friend.relation==='subscribed';
    showFriendConfirmation(friend,title,message,confirmLabel,()=>{
        if(friend.relation==='request'||friend.relation==='follower') setFriendRelation(friend.id,'friend',`${friend.firstName} добавлен(а) в друзья`);
        else if(friend.relation==='friend') setFriendRelation(friend.id,'follower',`${friend.firstName} теперь в подписчиках`);
        else if(friend.relation==='subscribed') setFriendRelation(friend.id,'not_friend',`Вы отписались от ${friend.firstName}`);
        else setFriendRelation(friend.id,'subscribed',`Вы подписались на ${friend.firstName}`);
    },destructive);
}
function friendProfileAge(friend){
    const ages={maria:28,ivan:31,olga:27,dmitry:30,anna:26,sasha:29,kirill:25,elena:28};
    return ages[friend.id] || 28;
}
function friendProfilePoints(friend){
    const points={maria:3120,ivan:1840,olga:4260,dmitry:2380,anna:2950,sasha:2160,kirill:1720,elena:3120};
    return points[friend.id] || 3120;
}
function friendProfileLevelTitle(friend){
    const titles={2:'Исследователь',3:'Знаток подписок',4:'Экономист',5:'Магистр подписок'};
    return `${titles[friend.level] || 'Экономист'} ${friend.level}-го уровня`;
}
function formatFriendPoints(value){ return Number(value).toLocaleString('ru-RU'); }

function renderFriendProfileScreen(){
    const friend=currentFriend();
    const title=document.getElementById('friendProfileWebTitle'); if(title) title.textContent='Профиль друга';
    const more=document.querySelector('#view-friend-profile .friends-web-search-toggle'); if(more) more.onclick=openFriendMoreActions;
    const box=document.getElementById('friendProfileWebContent'); if(!box) return;
    const achievements=[
        {title:'Экономист',description:'Отслеживает все подписки',icon:'fa-piggy-bank',color:'#ff9a3d'},
        {title:'Меломан',description:'Подключено 3 музыкальных сервиса',icon:'fa-headphones',color:'#8b5cf6'},
        {title:'Стратег',description:'Планирует расходы по подпискам',icon:'fa-gamepad',color:'#0ea5b8'},
        {title:'Любимчик',description:'Делится подписками с друзьями',icon:'fa-heart',color:'#d72f83'}
    ];
    const friendCount=friendConnectionFriends(friend).length;
    const points=friendProfilePoints(friend);
    const level=Number(friend.level) || 1;
    const nextLevel=level + 1;
    const nextTitles={1:'Исследователь',2:'Знаток подписок',3:'Экономист',4:'Стратег подписок',5:'Легенда подписок'};
    const remainByLevel={1:520,2:470,3:455,4:435,5:390};
    const progressByLevel={1:34,2:47,3:58,4:62,5:76};
    const progress=progressByLevel[level] || 60;
    const nextTitle=nextTitles[level] || 'Следующий уровень';
    const remainingXp=remainByLevel[level] || 420;
    const subscriptionsMarkup=getFriendSubscriptions(friend).slice(0,3).map(s=>{
        const owned=isFriendSubscriptionOwned(s);
        return `<button class="friend-profile-web-sub" type="button" onclick="openFriendSubscriptionPreview('${s.key}',this)">${friendSubscriptionIcon(s)}<div class="friend-profile-web-sub-copy"><strong>${s.name}</strong><span>${owned?'Общая подписка':'Только у друга'}</span><small>${fmt(s.amount)} / месяц</small></div>${owned?'<i class="fa-solid fa-check friend-subscription-common-check"></i>':''}</button>`;
    }).join('');
    box.innerHTML=`<div class="friend-profile-web-grid friend-profile-web-grid-aligned friend-profile-web-single-layout">
        <div class="friend-profile-web-card friend-profile-web-main-card friend-profile-web-main-card-similar">
            <div class="friend-profile-web-overview">
                <div class="friend-profile-web-identity-panel">
                    <div class="friend-profile-web-header">
                        <div class="friend-profile-web-avatar" style="background:${friend.color}">${friend.initials}</div>
                        <div class="friend-profile-web-person-info">
                            <div class="friend-profile-web-name-row">
                                <div class="friend-profile-web-name">${friend.name}</div>
                            </div>
                            <div class="friend-profile-web-age"><i class="fa-solid fa-cake-candles"></i><span>${friendProfileAge(friend)} лет</span></div>
                            <div class="friend-profile-web-level"><i class="fa-solid fa-trophy"></i><span>${friendProfileLevelTitle(friend)}</span></div>
                        </div>
                    </div>
                    <div class="friend-profile-web-actions"><button class="friend-profile-web-primary" type="button" onclick="handleFriendPrimaryAction()">${relationButtonLabel(friend)}</button></div>
                </div>

                <div class="friend-profile-web-level-panel">
                    <div class="friend-profile-web-level-top">
                        <div>
                            <div class="friend-profile-web-level-title">${friendProfileLevelTitle(friend)}</div>
                            <div class="friend-profile-web-level-sub">До «${nextTitle}» — ${remainingXp} XP</div>
                        </div>
                        <div class="friend-profile-web-points" aria-label="Баллы друга">
                            <div class="friend-profile-web-num">${formatFriendPoints(points)}</div>
                            <div class="friend-profile-web-lbl">баллов</div>
                        </div>
                    </div>
                    <div class="friend-profile-web-bar"><span style="width:${progress}%"></span></div>
                    <div class="friend-profile-web-bar-labels">
                        <span>Уровень ${level}</span>
                        <span>Уровень ${nextLevel}</span>
                    </div>
                </div>
            </div>

            <hr class="friend-profile-web-divider">

            <div class="friend-profile-web-stats">
                <button type="button" class="friend-profile-web-stat" onclick="openFriendConnections(0)"><i class="fa-solid fa-user-group"></i><span><strong>${friendCount}</strong><small>друзей</small></span></button>
                <div class="friend-profile-web-stat"><i class="fa-solid fa-star"></i><span><strong>${formatFriendPoints(points)}</strong><small>баллов</small></span></div>
            </div>

            <div class="friend-profile-web-main-content-grid">
                <section class="friend-profile-web-embedded-section friend-profile-web-subscriptions-section">
                    <div class="friend-profile-web-section-title"><h3>Подписки</h3><button type="button" class="friend-profile-web-more" onclick="openAllFriendSubscriptions()" aria-label="Все подписки"><i class="fa-solid fa-ellipsis"></i></button></div>
                    <div class="friend-profile-web-subscriptions">${subscriptionsMarkup}</div>
                </section>
                ${renderFriendProfileCommonFriends(friend)}
            </div>
        </div>

        <div class="friend-profile-web-card friend-profile-web-achievements-card">
            <div class="friend-profile-web-ach-head"><h3>Достижения</h3><button type="button" class="friend-profile-web-section-link" onclick="openFriendAchievements()">Все</button></div>
            <div class="friend-profile-web-ach-grid">${achievements.map(a=>`<button class="friend-profile-web-ach" type="button" style="background:${a.color}" onclick="openFriendAchievements()"><i class="fa-solid ${a.icon}"></i></button>`).join('')}</div>
            <div class="friend-profile-web-ach-list">${achievements.slice(0,3).map(a=>`<button class="friend-profile-web-ach-item" type="button" onclick="openFriendAchievements()"><div class="friend-profile-web-ach-ic" style="background:${a.color};"><i class="fa-solid ${a.icon}"></i></div><div><div class="friend-profile-web-ach-t">${a.title}</div><div class="friend-profile-web-ach-d">${a.description}</div></div></button>`).join('')}</div>
        </div>
    </div>`;
}


// ================== FRIEND CONNECTIONS / COMMON FRIENDS ==================
let friendConnectionsTab = 0;

function friendConnectionPool(profileFriend){
    const pool = friendsWebItems.filter(item => item.id !== profileFriend.id);
    if(!pool.length) return [];
    const shift = [...profileFriend.initials].reduce((sum,ch)=>sum+ch.charCodeAt(0),0) % pool.length;
    return [...pool.slice(shift), ...pool.slice(0,shift)];
}
function friendConnectionFriends(profileFriend){
    const count = profileFriend.initials === 'ОВ' ? 4 : 5;
    return friendConnectionPool(profileFriend).slice(0,count);
}
function friendConnectionCommonFriends(profileFriend){
    return friendConnectionFriends(profileFriend).filter(item => item.relation === 'friend');
}
function friendConnectionFollowers(profileFriend){
    const friendIds = new Set(friendConnectionFriends(profileFriend).map(item=>item.id));
    return friendConnectionPool(profileFriend).filter(item=>!friendIds.has(item.id));
}
function friendConnectionSubtitle(profileFriend,item,tab){
    if(tab === 2) return `Подписчик профиля ${profileFriend.firstName}`;
    if(item.relation === 'friend') return `В друзьях · ${item.common} ${item.common===1?'общая подписка':'общие подписки'}`;
    if(item.relation === 'follower') return `Подписан на вас · друг ${profileFriend.firstName}`;
    if(item.relation === 'request') return `Заявка в друзья · друг ${profileFriend.firstName}`;
    if(item.relation === 'subscribed') return `Вы подписаны · друг ${profileFriend.firstName}`;
    return `Не в друзьях · друг ${profileFriend.firstName}`;
}
function renderFriendProfileCommonFriends(friend){
    const common = friendConnectionCommonFriends(friend);
    const shown = common.slice(0,3);
    return `<button class="friend-profile-web-common-card friend-profile-web-common-embedded friend-profile-web-embedded-section" type="button" onclick="openFriendConnections(1)">
        <div class="friend-profile-web-section-title"><h3>Общие друзья</h3><span>${common.length}</span></div>
        ${shown.length ? `<div class="friend-profile-web-common-list">${shown.map(item=>`
            <span class="friend-profile-web-common-person" onclick="event.stopPropagation();openFriendProfile('${item.id}')">
                <span class="friends-web-avatar" style="background:${item.color}">${item.initials}</span>
                <span>${item.firstName}</span>
            </span>`).join('')}</div>` : '<div class="friends-web-empty compact">У вас нет общих друзей</div>'}
    </button>`;
}
function openFriendConnections(tab=0){
    friendConnectionsTab = Math.max(0,Math.min(2,Number(tab)||0));
    friendConnectionsOwnerId = activeFriendProfileId;
    friendConnectionsReturnTarget = friendProfileBackTarget || 'friends';
    switchView('friend-connections');
}
function backFromFriendConnections(){
    if(friendConnectionsOwnerId){
        activeFriendProfileId = friendConnectionsOwnerId;
        friendProfileBackTarget = friendConnectionsReturnTarget || 'friends';
    }
    switchView('friend-profile');
}
function setFriendConnectionsTab(tab){
    friendConnectionsTab = tab;
    renderFriendConnectionsScreen();
}
function renderFriendConnectionsScreen(){
    const profileFriend = friendsWebItems.find(x=>x.id===friendConnectionsOwnerId) || currentFriend();
    if(!profileFriend) return;
    const friends = friendConnectionFriends(profileFriend);
    const common = friendConnectionCommonFriends(profileFriend);
    const followers = friendConnectionFollowers(profileFriend);
    const sets=[friends,common,followers];
    const labels=['Друзья','Общие друзья','Подписчики'];
    const title=document.getElementById('friendConnectionsTitle');
    if(title) title.textContent=`Друзья ${profileFriend.firstName}`;
    const tabs=document.getElementById('friendConnectionsTabs');
    if(tabs) tabs.innerHTML=labels.map((label,index)=>`<button type="button" class="${index===friendConnectionsTab?'active':''}" onclick="setFriendConnectionsTab(${index})">${label} <span>${sets[index].length}</span></button>`).join('');
    const list=document.getElementById('friendConnectionsList');
    if(!list) return;
    const items=sets[friendConnectionsTab];
    if(!items.length){
        list.innerHTML=`<div class="friends-web-empty">${friendConnectionsTab===1?'У вас нет общих друзей':`В разделе «${labels[friendConnectionsTab]}» пока нет пользователей`}</div>`;
        return;
    }
    list.innerHTML=items.map(item=>`<button class="friends-web-card" type="button" onclick="openFriendProfile('${item.id}','friend-connections')">
        <span class="friends-web-avatar" style="background:${item.color}">${item.initials}</span>
        <span class="friends-web-card-main"><span class="friends-web-card-name">${item.name}</span><span class="friends-web-card-sub">${friendConnectionSubtitle(profileFriend,item,friendConnectionsTab)}</span></span>
        <span class="friends-web-relation ${friendRelationLabel(item)[1]}">${friendRelationLabel(item)[0]}</span>
    </button>`).join('');
}

// ================== FRIEND SUBSCRIPTIONS ==================
const friendSubscriptionsCatalog = {
    maria: [
        {key:'netflix',name:'Netflix',amount:799,category:'Видео',categoryKey:'entertainment',color:'#e50914',icon:'N',common:true},
        {key:'spotify',name:'Spotify Premium',amount:299,category:'Музыка',categoryKey:'entertainment',color:'#1db954',icon:'<i class="fa-solid fa-music"></i>',common:true},
        {key:'bookmate',name:'Bookmate',amount:459,category:'Книги',categoryKey:'entertainment',color:'#7c3fe6',icon:'<i class="fa-solid fa-book-open"></i>',common:false},
        {key:'kinopoisk',name:'Кинопоиск',amount:299,category:'Видео',categoryKey:'entertainment',color:'#ff4b55',icon:'<i class="fa-solid fa-film"></i>',common:false},
        {key:'yandex',name:'Яндекс Плюс',amount:399,category:'Развлечения',categoryKey:'entertainment',color:'#ffcc00',textDark:true,icon:'Я',common:true}
    ],
    default: [
        {key:'netflix',name:'Netflix',amount:799,category:'Видео',categoryKey:'entertainment',color:'#e50914',icon:'N',common:true},
        {key:'spotify',name:'Spotify Premium',amount:299,category:'Музыка',categoryKey:'entertainment',color:'#1db954',icon:'<i class="fa-solid fa-music"></i>',common:true},
        {key:'bookmate',name:'Bookmate',amount:459,category:'Книги',categoryKey:'entertainment',color:'#7c3fe6',icon:'<i class="fa-solid fa-book-open"></i>',common:false}
    ]
};
function getFriendSubscriptions(friend=currentFriend()){
    return friendSubscriptionsCatalog[friend.id] || friendSubscriptionsCatalog.default;
}
function isFriendSubscriptionOwned(item){
    return (state.subscriptions||[]).some(s=>{
        const ownedName=(s.name||'').trim().toLowerCase();
        const friendName=(item.name||'').trim().toLowerCase();
        return ownedName===friendName || (item.key==='spotify' && ownedName==='spotify');
    });
}
function friendSubscriptionIcon(data, extraClass=''){
    const classMap={
        netflix:'netflix',
        spotify:'spotify',
        bookmate:'bookmate',
        yandex:'yandex',
        kinopoisk:'kinopoisk'
    };
    const iconMap={
        netflix:'N',
        spotify:'<i class="fa-solid fa-music"></i>',
        bookmate:'<i class="fa-solid fa-book-open"></i>',
        yandex:'Я',
        kinopoisk:'<i class="fa-solid fa-film"></i>'
    };
    const iconClass=classMap[data.key]||'';
    const icon=iconMap[data.key]||data.icon;
    return `<span class="friend-profile-web-sub-icon ${iconClass} ${extraClass}">${icon}</span>`;
}
function closeFriendSubscriptionsOverlay(){
    document.querySelectorAll('.friend-subscriptions-sheet,.friend-subscription-preview,.friend-subscriptions-backdrop').forEach(el=>el.remove());
}
function openAllFriendSubscriptions(){
    closeFriendSubscriptionsOverlay();
    const friend=currentFriend();
    const backdrop=document.createElement('div');
    backdrop.className='friend-subscriptions-backdrop';
    backdrop.onclick=e=>{ if(e.target===backdrop) closeFriendSubscriptionsOverlay(); };
    backdrop.innerHTML=`<section class="friend-subscriptions-sheet" role="dialog" aria-modal="true">
        <div class="friend-subscriptions-handle"></div>
        <div class="friend-subscriptions-sheet-head"><h2>Все подписки</h2><button type="button" onclick="closeFriendSubscriptionsOverlay()" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="friend-subscriptions-sheet-list">${getFriendSubscriptions(friend).map(item=>friendSubscriptionListItem(item)).join('')}</div>
    </section>`;
    document.body.appendChild(backdrop);
}
function friendSubscriptionListItem(item){
    const owned=isFriendSubscriptionOwned(item);
    return `<button class="friend-subscription-list-item" type="button" onclick="openFriendSubscriptionPreview('${item.key}',this)">
        ${friendSubscriptionIcon(item)}
        <span class="friend-subscription-list-copy"><strong>${item.name}</strong><span>${owned?'Общая подписка':'Только у друга'}</span></span>
        ${owned?'<i class="fa-solid fa-check friend-subscription-common-check"></i>':''}
    </button>`;
}
function openFriendSubscriptionPreview(key,anchor){
    document.querySelector('.friend-subscription-preview')?.remove();
    const item=getFriendSubscriptions().find(x=>x.key===key); if(!item) return;
    const owned=isFriendSubscriptionOwned(item);
    const popup=document.createElement('div');
    popup.className='friend-subscription-preview';
    popup.innerHTML=`<div class="friend-subscription-preview-head">${friendSubscriptionIcon(item,'large')}<strong>${item.name}</strong></div>
        <div class="friend-subscription-preview-row"><span>Цена</span><b>${fmt(item.amount)} / месяц</b></div>
        <div class="friend-subscription-preview-row"><span>Категория</span><b>${item.category}</b></div>
        <button type="button" class="friend-subscription-preview-action ${owned?'cancel':''}" onclick="${owned?`cancelFriendSubscription('${item.key}')`:`subscribeFromFriend('${item.key}')`}">${owned?'Отменить подписку':'Оформить подписку'}</button>`;
    document.body.appendChild(popup);
    const r=anchor?.getBoundingClientRect();
    const width=290;
    let left=(r?.left||20)+64, top=(r?.top||100)+8;
    left=Math.max(12,Math.min(left,window.innerWidth-width-12));
    top=Math.max(12,Math.min(top,window.innerHeight-220));
    popup.style.left=`${left}px`; popup.style.top=`${top}px`;
    setTimeout(()=>document.addEventListener('click',function close(e){
        if(!popup.contains(e.target)){ popup.remove(); document.removeEventListener('click',close); }
    }),0);
}
function subscribeFromFriend(key){
    const item=getFriendSubscriptions().find(x=>x.key===key); if(!item) return;
    if(isFriendSubscriptionOwned(item)){ toast(`Подписка «${item.name}» уже оформлена`); return; }
    const next=new Date(); next.setDate(next.getDate()+30);
    state.subscriptions.push({id:uid(),name:item.name,amount:item.amount,currency:'RUB',cycle:'monthly',next:next.toISOString().slice(0,10),category:item.categoryKey,active:true,color:item.color,textDark:!!item.textDark});
    saveState(); renderAll();
    document.querySelector('.friend-subscription-preview')?.remove();
    refreshFriendSubscriptionsOverlay();
    toast(`Подписка «${item.name}» оформлена`);
}
function cancelFriendSubscription(key){
    const item=getFriendSubscriptions().find(x=>x.key===key); if(!item) return;
    const before=(state.subscriptions||[]).length;
    state.subscriptions=(state.subscriptions||[]).filter(s=>{
        const ownedName=(s.name||'').trim().toLowerCase();
        const friendName=(item.name||'').trim().toLowerCase();
        return !(ownedName===friendName || (item.key==='spotify' && ownedName==='spotify'));
    });
    if(state.subscriptions.length===before){ toast(`Подписка «${item.name}» не найдена`); return; }
    saveState(); renderAll();
    document.querySelector('.friend-subscription-preview')?.remove();
    refreshFriendSubscriptionsOverlay();
    toast(`Подписка «${item.name}» отменена`);
}
function refreshFriendSubscriptionsOverlay(){
    const list=document.querySelector('.friend-subscriptions-sheet-list');
    if(list){
        list.innerHTML=getFriendSubscriptions(currentFriend()).map(item=>friendSubscriptionListItem(item)).join('');
    }
}


// ================== REWARDS SHOP (isolated) ==================
const REWARDS_SHOP_KEY = 'subscriptions_rewards_shop_v1';
const rewardsShopCatalog = [
    {id:'discount10',title:'Скидка 10% на любую подписку',desc:'Одноразовая скидка на следующую оплату любой активной подписки.',cost:500,icon:'fa-percent'},
    {id:'pro100',title:'Подписка Pro бесплатно',desc:'Полная скидка 100% на один месяц тарифа Pro.',cost:500,icon:'fa-crown'}
];
let rewardsShopTab='active';
function loadRewardsShopState(){
    try{
        const saved=JSON.parse(AccountStorage.getItem(REWARDS_SHOP_KEY)||'null');
        return saved&&typeof saved==='object'?saved:{balance:2800,purchased:[]};
    }catch(_){ return {balance:2800,purchased:[]}; }
}
function saveRewardsShopState(data){ AccountStorage.setItem(REWARDS_SHOP_KEY,JSON.stringify(data)); }
function openRewardsShop(){ rewardsShopTab='active'; renderRewardsShop(); switchView('rewards-shop'); }
function closeRewardsShop(){ switchView('profile'); }
function setRewardsShopTab(tab){ rewardsShopTab=tab; renderRewardsShop(); }
function renderRewardsShop(){
    const data=loadRewardsShopState();
    const balance=document.getElementById('rewardsShopBalance');
    if(balance) balance.innerHTML=`${Number(data.balance||0).toLocaleString('ru-RU')} <small>баллов</small>`;
    document.querySelectorAll('[data-rewards-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.rewardsTab===rewardsShopTab));
    const grid=document.getElementById('rewardsShopGrid');
    if(!grid) return;
    const items=rewardsShopTab==='purchased'?(data.purchased||[]):rewardsShopCatalog;
    if(!items.length){ grid.innerHTML=`<div class="rewards-shop-empty">${rewardsShopTab==='purchased'?'У вас пока нет купленных наград':'Нет доступных наград'}</div>`; return; }
    grid.innerHTML=items.map(item=>{
        const purchased=rewardsShopTab==='purchased';
        const insufficient=!purchased && data.balance<item.cost;
        return `<article class="rewards-shop-card">
            <div class="rewards-shop-card-icon"><i class="fa-solid ${item.icon||'fa-gift'}"></i></div>
            <h3>${item.title}</h3><p>${item.desc}</p>
            ${purchased&&item.code?`<div class="rewards-shop-code">${item.code}</div>`:''}
            <div class="rewards-shop-card-bottom">
                <span class="rewards-shop-price">${item.cost} баллов</span>
                ${purchased?`<button class="rewards-shop-buy" type="button" onclick="copyRewardCode('${item.code||''}')">Скопировать код</button>`:`<button class="rewards-shop-buy" type="button" ${insufficient?'disabled':''} onclick="buyReward('${item.id}')">${insufficient?'Не хватает баллов':'Купить'}</button>`}
            </div>
        </article>`;
    }).join('');
}
function buyReward(id){
    const item=rewardsShopCatalog.find(x=>x.id===id); if(!item) return;
    const data=loadRewardsShopState();
    if(data.balance<item.cost){ toast('Недостаточно баллов'); return; }
    if(!confirm(`Купить «${item.title}» за ${item.cost} баллов?`)) return;
    data.balance-=item.cost;
    data.purchased=[...(data.purchased||[]),{...item,code:`REWARD-${Math.random().toString(36).slice(2,8).toUpperCase()}`}];
    saveRewardsShopState(data);
    renderRewardsShop();
    if(typeof window.addProfileNotification === 'function'){
        window.addProfileNotification({type:'achievement',title:'Награда куплена',message:`Вы приобрели «${item.title}» за ${item.cost} баллов.`});
    }
    toast('Награда куплена');
}
function copyRewardCode(code){
    if(!code) return;
    if(navigator.clipboard?.writeText){ navigator.clipboard.writeText(code).then(()=>toast('Код скопирован')).catch(()=>toast(code)); }
    else toast(code);
}


// ================== ACCOUNT SETTINGS ==================
function ensureProfileState(){
    if(!state.user) state.user = { phone:'', name:'Данияр' };
    if(!state.user.profile || typeof state.user.profile !== 'object') state.user.profile = {};
    const p = state.user.profile;
    if(!p.email) p.email = 'a.kravtsov@mail.ru';
    if(!p.gender) p.gender = 'Мужской';
    if(!p.country) p.country = 'Россия';
    if(typeof p.city !== 'string') p.city = '';
    if(typeof p.birthDate !== 'string') p.birthDate = '';
}
function getAccountDisplayName(){
    const name = state.user && typeof state.user.name === 'string' ? state.user.name.trim() : '';
    return name && name !== 'Вы' ? name : 'Данияр';
}
function profileAge(dateText){
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateText || '');
    if(!m) return null;
    const d = new Date(+m[3], +m[2]-1, +m[1]);
    if(d.getFullYear()!=+m[3] || d.getMonth()!=+m[2]-1 || d.getDate()!=+m[1]) return null;
    const now = new Date(); let age = now.getFullYear()-d.getFullYear();
    if(now.getMonth()<d.getMonth() || (now.getMonth()===d.getMonth() && now.getDate()<d.getDate())) age--;
    return age>=1 && age<=120 ? age : null;
}
function formatBirthInput(value){
    const d=String(value||'').replace(/\D/g,'').slice(0,8);
    return d.length>4 ? d.slice(0,2)+'.'+d.slice(2,4)+'.'+d.slice(4) : d.length>2 ? d.slice(0,2)+'.'+d.slice(2) : d;
}
function formatPhoneInput(value){
    let d=String(value||'').replace(/\D/g,'');
    if(d.startsWith('8')) d='7'+d.slice(1); if(!d.startsWith('7')) d='7'+d; d=d.slice(0,11);
    const x=d.slice(1); let out='+7';
    if(x.length) out+=' ('+x.slice(0,3); if(x.length>=3) out+=')';
    if(x.length>3) out+=' '+x.slice(3,6); if(x.length>6) out+='-'+x.slice(6,8); if(x.length>8) out+='-'+x.slice(8,10);
    return out;
}
function renderAccountIdentity(){
    ensureProfileState();
    const name=getAccountDisplayName(), p=state.user.profile, letter=(name.charAt(0)||'П').toUpperCase();
    const values={profileDisplayName:name,settingsAccountName:name,accountEditPreviewName:name,profileAvatarLetter:letter,accountEditAvatar:letter,profileEmailText:p.email||'',profileGenderText:p.gender||'Не указывать'};
    Object.entries(values).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
    const b=document.getElementById('profileBirthDateButton');
    if(b){ const age=profileAge(p.birthDate); b.innerHTML=`<i class="fa-solid fa-cake-candles"></i> ${age!==null ? age+' '+(age%10===1&&age%100!==11?'год':age%10>=2&&age%10<=4&&(age%100<10||age%100>=20)?'года':'лет') : 'Добавить дату рождения'}${age===null?' · +10 баллов':''}`; }
    const phone=document.getElementById('settingsPhone');
    if(phone){
        const provider = String(state.user.authProvider || '').trim();
        phone.value = state.user.phone || (provider ? `Вход через ${provider}` : '');
    }
}
function setSelectedGender(value){
    document.querySelectorAll('#accountGenderOptions [data-gender]').forEach(b=>b.classList.toggle('active',b.dataset.gender===value));
}
function openAccountSettingsModal(){
    ensureProfileState(); const p=state.user.profile;
    const fields={accountNameInput:getAccountDisplayName(),accountBirthDateInput:p.birthDate||'',accountEmailInput:p.email||'',accountPhoneInput:state.user.phone||'',accountCountryInput:p.country||'Россия',accountCityInput:p.city||''};
    Object.entries(fields).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});
    setSelectedGender(p.gender||'Мужской'); renderAccountIdentity();
    document.getElementById('accountSettingsModal')?.classList.add('open');
}
function closeAccountSettingsModal(){ document.getElementById('accountSettingsModal')?.classList.remove('open'); }
function saveAccountProfileDetails(){
    ensureProfileState();
    const name=document.getElementById('accountNameInput')?.value.trim().replace(/\s+/g,' ')||'';
    const birth=document.getElementById('accountBirthDateInput')?.value.trim()||'';
    const email=document.getElementById('accountEmailInput')?.value.trim()||'';
    const phoneInputValue=document.getElementById('accountPhoneInput')?.value.trim()||'';
    const phoneDigits=String(phoneInputValue).replace(/\D/g,'');
    const phone=phoneDigits.length<=1 ? '' : phoneInputValue;
    const country=document.getElementById('accountCountryInput')?.value.trim().replace(/\s+/g,' ')||'';
    const city=document.getElementById('accountCityInput')?.value.trim().replace(/\s+/g,' ')||'';
    const gender=document.querySelector('#accountGenderOptions [data-gender].active')?.dataset.gender||'Не указывать';
    if(name.length<2){toast('Имя должно быть не короче 2 символов');return;}
    if(name.length>40){toast('Имя должно быть не длиннее 40 символов');return;}
    if(birth && profileAge(birth)===null){toast('Введите корректную дату рождения в формате ДД.ММ.ГГГГ');return;}
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Введите корректную почту');return;}
    if(phone && phoneDigits.length!==11){toast('Введите корректный телефон');return;}
    state.user.name=name; state.user.phone=phone;
    Object.assign(state.user.profile,{birthDate:birth,email,gender,country,city});
    saveState(); renderAccountIdentity(); closeAccountSettingsModal(); toast('Данные аккаунта обновлены');
}
document.querySelectorAll('#accountGenderOptions [data-gender]').forEach(b=>b.addEventListener('click',()=>setSelectedGender(b.dataset.gender)));
document.getElementById('accountNameInput')?.addEventListener('input',e=>{const v=e.target.value.trim();const n=document.getElementById('accountEditPreviewName'),a=document.getElementById('accountEditAvatar');if(n)n.textContent=v||'Имя пользователя';if(a)a.textContent=(v.charAt(0)||'П').toUpperCase();});
document.getElementById('accountBirthDateInput')?.addEventListener('input',e=>{e.target.value=formatBirthInput(e.target.value);});
document.getElementById('accountPhoneInput')?.addEventListener('input',e=>{e.target.value=formatPhoneInput(e.target.value);});
document.getElementById('accountEmailInput')?.addEventListener('input',e=>{const err=document.getElementById('accountEmailError');if(err)err.textContent=e.target.value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)?'Некорректный формат почты':'';});
document.getElementById('accountSettingsModal')?.addEventListener('click',e=>{if(e.target.id==='accountSettingsModal')closeAccountSettingsModal();});

// ================== PAYMENT METHODS ==================
function ensurePaymentMethodsState(){
    if(!Array.isArray(state.paymentMethods)) state.paymentMethods = [];
}
function paymentDigits(value){ return String(value || '').replace(/\D/g, ''); }
function formatPaymentCardInput(value){
    return paymentDigits(value).slice(0,16).replace(/(.{4})/g, '$1 ').trim();
}
function renderPaymentMethods(){
    ensurePaymentMethodsState();
    const list = document.getElementById('paymentMethodsList');
    const summary = document.getElementById('settingsPaymentSummary');
    if(summary){
        summary.textContent = state.paymentMethods.length
            ? `${state.paymentMethods.length} ${state.paymentMethods.length === 1 ? 'карта добавлена' : 'карты добавлено'}`
            : 'Способы оплаты не добавлены';
    }
    if(!list) return;
    if(!state.paymentMethods.length){
        list.innerHTML = '<div class="settings-payment-empty">Способы оплаты не добавлены</div>';
        return;
    }
    list.innerHTML = state.paymentMethods.map((method, index) => `
        <div class="settings-payment-method">
            <span class="settings-payment-method-icon"><i class="fa-brands fa-cc-visa"></i></span>
            <div class="settings-payment-method-copy">
                <strong>Visa •• ${method.last4}</strong>
                <small>${index === 0 ? 'Основная' : 'Добавлена'} · ${method.expiry}</small>
            </div>
            <button class="settings-payment-delete" type="button" onclick="deletePaymentMethod('${method.id}')" aria-label="Удалить карту">
                <i class="fa-solid fa-trash"></i><span>Удалить</span>
            </button>
        </div>`).join('');
}
function openPaymentMethodsModal(){
    ensurePaymentMethodsState();
    renderPaymentMethods();
    hidePaymentAddForm();
    document.getElementById('paymentMethodsModal')?.classList.add('open');
}
function closePaymentMethodsModal(){
    document.getElementById('paymentMethodsModal')?.classList.remove('open');
    hidePaymentAddForm();
}
function showPaymentAddForm(){
    const form = document.getElementById('paymentAddForm');
    if(form) form.hidden = false;
    setTimeout(()=>document.getElementById('paymentCardNumber')?.focus(), 30);
}
function hidePaymentAddForm(){
    const form = document.getElementById('paymentAddForm');
    if(form) form.hidden = true;
    ['paymentCardNumber','paymentExpiry','paymentCvv','paymentHolder'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
}
function savePaymentMethod(){
    ensurePaymentMethodsState();
    const number = paymentDigits(document.getElementById('paymentCardNumber')?.value);
    const expiry = document.getElementById('paymentExpiry')?.value.trim() || '';
    const cvv = paymentDigits(document.getElementById('paymentCvv')?.value);
    const holder = document.getElementById('paymentHolder')?.value.trim().toUpperCase() || '';
    if(number.length !== 16){ toast('Введите 16 цифр номера карты'); return; }
    if(!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)){ toast('Введите срок в формате ММ/ГГ'); return; }
    if(cvv.length !== 3){ toast('Введите CVV из 3 цифр'); return; }
    if(holder.length < 3){ toast('Введите имя владельца карты'); return; }
    state.paymentMethods.push({ id: uid(), last4: number.slice(-4), expiry, holder });
    saveState();
    renderPaymentMethods();
    hidePaymentAddForm();
    toast('Способ оплаты добавлен');
}
function showConfirm(title, message, confirmLabel, onConfirm, isDestructive = true){
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const textEl = document.getElementById('confirmText');
    const btn = document.getElementById('confirmBtn');
    if(!modal || !titleEl || !textEl || !btn){
        if(window.confirm(`${title}\n\n${message}`)) onConfirm();
        return;
    }
    titleEl.textContent = title;
    textEl.textContent = message;
    btn.textContent = confirmLabel;
    btn.classList.toggle('danger', !!isDestructive);
    btn.onclick = () => {
        closeModal('confirmModal');
        onConfirm();
    };
    openModal('confirmModal');
}

function deletePaymentMethod(id){
    ensurePaymentMethodsState();
    const method = state.paymentMethods.find(item => item.id === id);
    if(!method) return;
    showConfirm('Удалить способ оплаты?', `Карта Visa •• ${method.last4} будет удалена.`, 'Удалить', () => {
        state.paymentMethods = state.paymentMethods.filter(item => item.id !== id);
        saveState();
        renderPaymentMethods();
        toast('Способ оплаты удалён');
    });
}
document.getElementById('paymentCardNumber')?.addEventListener('input', event => { event.target.value = formatPaymentCardInput(event.target.value); });
document.getElementById('paymentExpiry')?.addEventListener('input', event => {
    let value = paymentDigits(event.target.value).slice(0,4);
    if(value.length > 2) value = value.slice(0,2) + '/' + value.slice(2);
    event.target.value = value;
});
document.getElementById('paymentMethodsModal')?.addEventListener('click', event => {
    if(event.target.id === 'paymentMethodsModal') closePaymentMethodsModal();
});
document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && document.getElementById('paymentMethodsModal')?.classList.contains('open')) closePaymentMethodsModal();
});


// ================== SETTINGS MOBILE MENU ==================
function openAppearanceSettings(){
    const modal = document.getElementById('appearanceSettingsModal');
    if(!modal) return;
    modal.classList.add('open');
    setTimeout(initSettingsPersonalizationBottom, 60);
}
function closeAppearanceSettings(){
    document.getElementById('appearanceSettingsModal')?.classList.remove('open');
}
document.getElementById('appearanceSettingsModal')?.addEventListener('click', event => {
    if(event.target.id === 'appearanceSettingsModal') closeAppearanceSettings();
});
document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && document.getElementById('appearanceSettingsModal')?.classList.contains('open')){
        closeAppearanceSettings();
    }
});
function openNotificationPreferencesModal(){
    if(typeof renderNotificationSettings === 'function') renderNotificationSettings();
    document.getElementById('notificationPreferencesModal')?.classList.add('open');
}
function closeNotificationPreferencesModal(){
    document.getElementById('notificationPreferencesModal')?.classList.remove('open');
}
document.getElementById('notificationPreferencesModal')?.addEventListener('click', event => {
    if(event.target.id === 'notificationPreferencesModal') closeNotificationPreferencesModal();
});
document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && document.getElementById('notificationPreferencesModal')?.classList.contains('open')){
        closeNotificationPreferencesModal();
    }
});

// ================== NOTIFICATION REMINDERS ==================
function ensureNotificationSettings(){
    if(!state.notificationSettings || typeof state.notificationSettings !== 'object'){
        state.notificationSettings = { pushEnabled:true, emailEnabled:true, notify7Days:true, notify3Days:true, notify1Day:false, soundEnabled:true };
    }
    ['pushEnabled','emailEnabled','notify7Days','notify3Days','notify1Day','soundEnabled'].forEach((key) => {
        if(typeof state.notificationSettings[key] !== 'boolean'){
            state.notificationSettings[key] = key !== 'notify1Day';
        }
    });
}
function renderNotificationSettings(){
    ensureNotificationSettings();
    document.querySelectorAll('[data-notification-key]').forEach(row => {
        const key = row.dataset.notificationKey;
        row.setAttribute('aria-pressed', state.notificationSettings[key] ? 'true' : 'false');
    });
}
function toggleNotificationSetting(key){
    ensureNotificationSettings();
    if(!(key in state.notificationSettings)) return;
    state.notificationSettings[key] = !state.notificationSettings[key];
    saveState();
    renderNotificationSettings();
    const messages = {
        soundEnabled:['Звук включён','Звук выключен'],
        pushEnabled:['Push-уведомления включены','Push-уведомления выключены'],
        emailEnabled:['Email-рассылка включена','Email-рассылка выключена']
    };
    const pair = messages[key] || ['Напоминание включено','Напоминание выключено'];
    toast(state.notificationSettings[key] ? pair[0] : pair[1]);
}
document.querySelectorAll('[data-notification-key]').forEach(row => {
    row.addEventListener('click', () => toggleNotificationSetting(row.dataset.notificationKey));
});
document.addEventListener('DOMContentLoaded', renderNotificationSettings);

// ================== PRIVACY SETTINGS ==================
function ensurePrivacySettings(){
    if(!state.privacySettings || typeof state.privacySettings !== 'object'){
        state.privacySettings = {
            subscriptionsVisibility:'Друзья',
            achievementsVisibility:'Все',
            pointsVisibility:'Все',
            challengeVisibility:'Друзья'
        };
    }
    const allowed = ['Только я','Друзья','Все'];
    const defaults = {
        subscriptionsVisibility:'Друзья',
        achievementsVisibility:'Все',
        pointsVisibility:'Все',
        challengeVisibility:'Друзья'
    };
    Object.keys(defaults).forEach(key => {
        if(!allowed.includes(state.privacySettings[key])) state.privacySettings[key] = defaults[key];
    });
    if(typeof state.tariffPlan !== 'string') state.tariffPlan = 'base';
}
function canEditPrivacySettings(){
    ensurePrivacySettings();
    return ['pro','premium'].includes(String(state.tariffPlan).toLowerCase());
}
function privacyIcon(value){
    if(value === 'Только я') return 'fa-lock';
    if(value === 'Друзья') return 'fa-user-group';
    return 'fa-earth-europe';
}
function renderPrivacySettings(){
    ensurePrivacySettings();
    const editable = canEditPrivacySettings();
    const summary = document.getElementById('settingsPrivacySummary');
    if(summary) summary.textContent = `Подписки: ${state.privacySettings.subscriptionsVisibility.toLowerCase()}`;
    const note = document.getElementById('privacyTariffNote');
    if(note) note.hidden = editable;
    document.querySelectorAll('.settings-privacy-group').forEach(group => {
        const key = group.dataset.privacyKey;
        const container = group.querySelector('.settings-privacy-options');
        if(!container || !(key in state.privacySettings)) return;
        container.innerHTML = ['Только я','Друзья','Все'].map(value => `
            <button type="button" class="settings-privacy-option ${state.privacySettings[key] === value ? 'active' : ''}"
                aria-checked="${state.privacySettings[key] === value}" onclick="selectPrivacyOption('${key}','${value}')">
                <i class="fa-solid ${privacyIcon(value)}"></i><span>${value}</span>
            </button>`).join('');
        group.classList.toggle('locked', !editable);
    });
}
function openPrivacyModal(){
    renderPrivacySettings();
    document.getElementById('privacyModal')?.classList.add('open');
}
function closePrivacyModal(){
    document.getElementById('privacyModal')?.classList.remove('open');
}
function selectPrivacyOption(key, value){
    ensurePrivacySettings();
    if(!canEditPrivacySettings()){
        toast('Приватность редактируется на тарифах Pro и Premium.');
        return;
    }
    const allowed = ['Только я','Друзья','Все'];
    if(!(key in state.privacySettings) || !allowed.includes(value)) return;
    state.privacySettings[key] = value;
    saveState();
    renderPrivacySettings();
    toast('Настройки приватности сохранены');
}
document.getElementById('privacyModal')?.addEventListener('click', event => {
    if(event.target.id === 'privacyModal') closePrivacyModal();
});
document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && document.getElementById('privacyModal')?.classList.contains('open')) closePrivacyModal();
});
document.addEventListener('DOMContentLoaded', renderPrivacySettings);


// ================== TARIFF SETTINGS ==================
const settingsTariffs = [
    {
        id:'base', title:'Base', price:'Бесплатно', subtitle:'Для контроля личного бюджета',
        features:['Ручное добавление подписок','Напоминания о списаниях','Базовая статистика расходов','Базовые достижения','Светлая и тёмная темы']
    },
    {
        id:'pro', title:'Pro', price:'199 ₽ / мес.', subtitle:'Расширенное управление подписками',
        features:['Всё из тарифа «Base»','Аналитика','Настройка темы и акцентного цвета','Настройки приватности','Экспорт данных']
    },
    {
        id:'premium', title:'Premium', price:'799 ₽ / мес.', subtitle:'Максимальные возможности приложения',
        features:['Всё из тарифа «Pro»','Эксклюзивные достижения','Умные рекомендации по экономии','Расширенная аналитика','Публикации в общей ленте','Инструменты продвижения']
    }
];
function ensureTariffPlan(){
    const current = String(state.tariffPlan || '').toLowerCase();
    const migrations = {
        basic:'base',
        базовый:'base',
        business:'premium',
        author:'premium'
    };
    state.tariffPlan = migrations[current] || current || 'base';
    if(!settingsTariffs.some(item => item.id === state.tariffPlan)) state.tariffPlan='base';
}
function renderTariffSettings(){
    ensureTariffPlan();
    const current=settingsTariffs.find(item=>item.id===state.tariffPlan) || settingsTariffs[0];
    const summary=document.getElementById('settingsTariffSummary');
    if(summary) summary.textContent=`${current.title} — ${current.price.toLowerCase()}`;
    const list=document.getElementById('settingsTariffList');
    if(!list) return;
    list.innerHTML=settingsTariffs.map(item=>{
        const selected=item.id===state.tariffPlan;
        return `<article class="settings-tariff-card ${selected?'active':''}">
            <div class="settings-tariff-card-head">
                <div><h4>${item.title}</h4><strong>${item.price}</strong></div>
                ${selected?'<i class="fa-solid fa-circle-check" aria-label="Текущий тариф"></i>':''}
            </div>
            <p>${item.subtitle}</p>
            <ul>${item.features.map(feature=>`<li><i class="fa-solid fa-check"></i><span>${feature}</span></li>`).join('')}</ul>
            <button class="btn ${selected?'btn-ghost':'btn-primary'}" type="button" ${selected?'disabled':''} onclick="selectTariffPlan('${item.id}')">${selected?'Текущий тариф':'Выбрать тариф'}</button>
        </article>`;
    }).join('');
}
function openTariffsModal(){
    renderTariffSettings();
    document.getElementById('tariffsModal')?.classList.add('open');
}
function closeTariffsModal(){ document.getElementById('tariffsModal')?.classList.remove('open'); }
function selectTariffPlan(id){
    if(!settingsTariffs.some(item=>item.id===id)) return;
    state.tariffPlan=id;
    saveState();
    renderTariffSettings();
    if(typeof renderPrivacySettings==='function') renderPrivacySettings();
    const selected=settingsTariffs.find(item=>item.id===id);
    toast(`Выбран тариф «${selected.title}»`);
}
document.getElementById('tariffsModal')?.addEventListener('click',event=>{
    if(event.target.id==='tariffsModal') closeTariffsModal();
});
document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && document.getElementById('tariffsModal')?.classList.contains('open')) closeTariffsModal();
});
document.addEventListener('DOMContentLoaded',renderTariffSettings);

// ================== SECURITY SETTINGS ==================
function ensureSecuritySettings(){
    if(!state.securitySettings || typeof state.securitySettings !== 'object'){
        state.securitySettings = { passcode:'123456', twoFactorEnabled:false, biometricEnabled:false };
    }
    if(!/^\d{6}$/.test(String(state.securitySettings.passcode || ''))){
        state.securitySettings.passcode = '123456';
    }
    if(typeof state.securitySettings.twoFactorEnabled !== 'boolean') state.securitySettings.twoFactorEnabled = false;
    if(typeof state.securitySettings.biometricEnabled !== 'boolean') state.securitySettings.biometricEnabled = false;
}
function renderSecuritySettings(){
    ensureSecuritySettings();
    document.querySelectorAll('[data-security-key]').forEach(row => {
        const key = row.dataset.securityKey;
        row.setAttribute('aria-pressed', state.securitySettings[key] ? 'true' : 'false');
    });
}
function openSecurityModal(){
    ensureSecuritySettings();
    renderSecuritySettings();
    hidePasscodeForm();
    document.getElementById('securityModal')?.classList.add('open');
}
function closeSecurityModal(){
    document.getElementById('securityModal')?.classList.remove('open');
    hidePasscodeForm();
}
function showPasscodeForm(){
    const form = document.getElementById('securityPasscodeForm');
    if(form) form.hidden = false;
    setTimeout(()=>document.getElementById('securityCurrentPasscode')?.focus(),30);
}
function hidePasscodeForm(){
    const form = document.getElementById('securityPasscodeForm');
    if(form) form.hidden = true;
    ['securityCurrentPasscode','securityNewPasscode','securityConfirmPasscode'].forEach(id=>{
        const el=document.getElementById(id);
        if(el){ el.value=''; el.type='password'; }
    });
    document.querySelectorAll('#securityPasscodeForm .settings-password-input-wrap button i').forEach(i=>{
        i.className='fa-solid fa-eye';
    });
}
function toggleSecurityPassword(inputId, button){
    const input=document.getElementById(inputId);
    if(!input) return;
    const show=input.type==='password';
    input.type=show?'text':'password';
    const icon=button?.querySelector('i');
    if(icon) icon.className=show?'fa-solid fa-eye-slash':'fa-solid fa-eye';
}
function securityDigits(value){ return String(value||'').replace(/\D/g,'').slice(0,6); }
function saveSecurityPasscode(){
    ensureSecuritySettings();
    const current=securityDigits(document.getElementById('securityCurrentPasscode')?.value);
    const next=securityDigits(document.getElementById('securityNewPasscode')?.value);
    const confirmCode=securityDigits(document.getElementById('securityConfirmPasscode')?.value);
    if(current !== state.securitySettings.passcode){ toast('Неверный текущий код'); return; }
    if(next.length !== 6){ toast('Новый код должен состоять из 6 цифр'); return; }
    if(next === current){ toast('Новый код должен отличаться от текущего'); return; }
    if(next !== confirmCode){ toast('Новые коды не совпадают'); return; }
    state.securitySettings.passcode=next;
    saveState();
    hidePasscodeForm();
    toast('Код входа обновлён');
}
function toggleSecuritySetting(key){
    ensureSecuritySettings();
    if(!(key in state.securitySettings)) return;
    state.securitySettings[key]=!state.securitySettings[key];
    saveState();
    renderSecuritySettings();
    const labels={twoFactorEnabled:'Двухфакторная аутентификация',biometricEnabled:'Биометрия'};
    toast(`${labels[key] || 'Настройка'} ${state.securitySettings[key]?'включена':'выключена'}`);
}
document.querySelectorAll('[data-security-key]').forEach(row=>{
    row.addEventListener('click',()=>toggleSecuritySetting(row.dataset.securityKey));
});
['securityCurrentPasscode','securityNewPasscode','securityConfirmPasscode'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',e=>{e.target.value=securityDigits(e.target.value);});
});
document.getElementById('securityModal')?.addEventListener('click',e=>{
    if(e.target.id==='securityModal') closeSecurityModal();
});
document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && document.getElementById('securityModal')?.classList.contains('open')) closeSecurityModal();
});
document.addEventListener('DOMContentLoaded',renderSecuritySettings);


// ================== REGIONAL SETTINGS (isolated) ==================
(function initRegionalSettingsModule(){
    const STORAGE_KEY = 'subscriptionsWebTimezone';
    const allowed = new Set(['Europe/Moscow', 'Europe/Berlin', 'Asia/Almaty']);
    const labels = {
        'Europe/Moscow': 'Europe/Moscow (UTC+3)',
        'Europe/Berlin': 'Europe/Berlin',
        'Asia/Almaty': 'Asia/Almaty'
    };

    function readTimezone(){
        try{
            const saved = AccountStorage.getItem(STORAGE_KEY);
            return allowed.has(saved) ? saved : 'Europe/Moscow';
        }catch(error){
            return 'Europe/Moscow';
        }
    }

    function writeTimezone(value){
        try{ AccountStorage.setItem(STORAGE_KEY, value); }catch(error){}
    }

    function renderTimezone(){
        const value = readTimezone();
        const current = document.getElementById('settingsTimezoneValue');
        if(current) current.textContent = labels[value] || value;
        document.querySelectorAll('.settings-timezone-option').forEach(option => {
            const active = option.dataset.timezone === value;
            option.classList.toggle('active', active);
            option.setAttribute('aria-checked', active ? 'true' : 'false');
        });
    }

    window.openTimezoneModal = function(){
        renderTimezone();
        document.getElementById('timezoneModal')?.classList.add('open');
    };

    window.closeTimezoneModal = function(){
        document.getElementById('timezoneModal')?.classList.remove('open');
    };

    window.selectTimezone = function(value){
        if(!allowed.has(value)) return;
        writeTimezone(value);
        renderTimezone();
        window.closeTimezoneModal();
        if(typeof toast === 'function') toast('Часовой пояс обновлён');
    };

    function init(){
        renderTimezone();
        const modal = document.getElementById('timezoneModal');
        if(modal && modal.dataset.ready !== 'true'){
            modal.dataset.ready = 'true';
            modal.addEventListener('click', event => {
                if(event.target === modal) window.closeTimezoneModal();
            });
        }
    }

    document.addEventListener('keydown', event => {
        if(event.key === 'Escape' && document.getElementById('timezoneModal')?.classList.contains('open')){
            window.closeTimezoneModal();
        }
    });

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
    else init();
})();

// ================== LANGUAGE SETTINGS (isolated) ==================
(function initLanguageSettingsModule(){
    window.openLanguageModal = function(){
        document.getElementById('languageModal')?.classList.add('open');
    };

    window.closeLanguageModal = function(){
        document.getElementById('languageModal')?.classList.remove('open');
    };

    window.selectLanguage = function(value){
        if(value !== 'ru') return;
        window.closeLanguageModal();
        if(typeof toast === 'function') toast('Выбран русский язык');
    };

    function init(){
        const modal = document.getElementById('languageModal');
        if(modal && modal.dataset.ready !== 'true'){
            modal.dataset.ready = 'true';
            modal.addEventListener('click', event => {
                if(event.target === modal) window.closeLanguageModal();
            });
        }
    }

    document.addEventListener('keydown', event => {
        if(event.key === 'Escape' && document.getElementById('languageModal')?.classList.contains('open')){
            window.closeLanguageModal();
        }
    });

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
    else init();
})();


// ================== SYSTEM NOTIFICATIONS (isolated) ==================
(function initSystemNotificationsModule(){
    const STORAGE_KEY = 'subscriptionsWebSystemNotifications';
    const defaultValue = { enabled:false, permission:'default', scheduled:[], updatedAt:null };

    function readValue(){
        try{
            const raw = AccountStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return {
                ...defaultValue,
                ...parsed,
                scheduled: Array.isArray(parsed.scheduled) ? parsed.scheduled : []
            };
        }catch(error){
            return { ...defaultValue };
        }
    }

    function writeValue(value){
        try{ AccountStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }catch(error){}
    }

    function permissionValue(){
        if(!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    }

    function reminderDays(){
        if(typeof ensureNotificationSettings === 'function') ensureNotificationSettings();
        const value = state?.notificationSettings || {};
        const result = [];
        if(value.notify7Days) result.push(7);
        if(value.notify3Days) result.push(3);
        if(value.notify1Day) result.push(1);
        return result;
    }

    function buildSchedule(){
        const today = new Date();
        today.setHours(0,0,0,0);
        const items = [];
        const days = reminderDays();
        const subscriptions = Array.isArray(state?.subscriptions)
            ? state.subscriptions.filter(item => item && item.active !== false && item.next)
            : [];

        subscriptions.forEach(subscription => {
            const chargeDate = new Date(subscription.next);
            if(Number.isNaN(chargeDate.getTime())) return;
            chargeDate.setHours(0,0,0,0);

            days.forEach(daysBefore => {
                const notifyDate = new Date(chargeDate);
                notifyDate.setDate(notifyDate.getDate() - daysBefore);
                if(notifyDate < today) return;

                items.push({
                    id: `${subscription.id || subscription.name}-${daysBefore}-${subscription.next}`,
                    name: subscription.name || 'Подписка',
                    daysBefore,
                    notifyAt: notifyDate.toISOString(),
                    chargeAt: chargeDate.toISOString()
                });
            });
        });

        return items.sort((a,b) => new Date(a.notifyAt) - new Date(b.notifyAt));
    }

    function render(){
        const value = readValue();
        const permission = permissionValue();
        const summary = document.getElementById('settingsSystemNotificationsSummary');
        const title = document.getElementById('systemNotificationsPermissionTitle');
        const subtitle = document.getElementById('systemNotificationsPermissionSubtitle');

        if(summary){
            summary.textContent = value.enabled ? `Запланировано: ${value.scheduled.length}` : 'Не настроены';
        }

        if(!title || !subtitle) return;

        if(permission === 'unsupported'){
            title.textContent = 'Уведомления не поддерживаются';
            subtitle.textContent = 'Планирование останется доступным внутри сайта';
        }else if(permission === 'granted'){
            title.textContent = value.enabled ? 'Уведомления включены' : 'Разрешение получено';
            subtitle.textContent = value.enabled
                ? `Запланировано уведомлений: ${value.scheduled.length}`
                : 'Нажмите «Включить и запланировать»';
        }else if(permission === 'denied'){
            title.textContent = 'Уведомления заблокированы';
            subtitle.textContent = 'Разрешите их в настройках браузера';
        }else{
            title.textContent = 'Уведомления не включены';
            subtitle.textContent = 'Разрешение браузера ещё не запрошено';
        }
    }

    window.openSystemNotificationsModal = function(){
        render();
        document.getElementById('systemNotificationsModal')?.classList.add('open');
    };

    window.closeSystemNotificationsModal = function(){
        document.getElementById('systemNotificationsModal')?.classList.remove('open');
    };

    window.enableAndScheduleSystemNotifications = async function(){
        let permission = permissionValue();

        if(permission === 'default'){
            try{ permission = await Notification.requestPermission(); }
            catch(error){ permission = 'denied'; }
        }

        if(permission === 'denied'){
            if(typeof toast === 'function') toast('Уведомления запрещены в браузере');
            render();
            return;
        }

        const value = readValue();
        value.enabled = true;
        value.permission = permission;
        value.scheduled = buildSchedule();
        value.updatedAt = new Date().toISOString();
        writeValue(value);
        render();

        if(typeof toast === 'function') toast(`Запланировано уведомлений: ${value.scheduled.length}`);
    };

    window.sendSystemTestNotification = async function(){
        let permission = permissionValue();

        if(permission === 'default'){
            try{ permission = await Notification.requestPermission(); }
            catch(error){ permission = 'denied'; }
        }

        if(permission === 'granted'){
            try{
                new Notification('SubMart', { body:'Тестовое уведомление работает.' });
                if(typeof toast === 'function') toast('Тестовое уведомление отправлено');
            }catch(error){
                if(typeof toast === 'function') toast('Не удалось отправить уведомление');
            }
        }else if(permission === 'unsupported'){
            if(typeof toast === 'function') toast('Браузер не поддерживает уведомления');
        }else{
            if(typeof toast === 'function') toast('Разрешите уведомления в браузере');
        }

        render();
    };

    window.showScheduledSystemNotifications = function(){
        const value = readValue();
        if(!value.scheduled.length){
            if(typeof toast === 'function') toast('Нет запланированных уведомлений');
            return;
        }

        const nearest = value.scheduled[0];
        const date = new Date(nearest.notifyAt).toLocaleDateString('ru-RU');
        if(typeof toast === 'function'){
            toast(`Запланировано: ${value.scheduled.length}. Ближайшее — ${date}, ${nearest.name}`);
        }
    };

    window.refreshSystemNotificationsSummary = render;

    function init(){
        render();
        const modal = document.getElementById('systemNotificationsModal');
        if(modal && modal.dataset.ready !== 'true'){
            modal.dataset.ready = 'true';
            modal.addEventListener('click', event => {
                if(event.target === modal) window.closeSystemNotificationsModal();
            });
        }
    }

    document.addEventListener('keydown', event => {
        if(event.key === 'Escape' && document.getElementById('systemNotificationsModal')?.classList.contains('open')){
            window.closeSystemNotificationsModal();
        }
    });

    window.addEventListener('account-changed', () => {
        window.closeSystemNotificationsModal();
        render();
    });

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
    else init();
})();
