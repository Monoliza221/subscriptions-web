(() => {
    const STORAGE_KEY = 'subscriptions_web_author_plans_v1';
    const SUBSCRIPTION_STATE_KEY = 'author_subscription_state_v1';
    const PLANS = [
        {
            id: 'base',
            name: 'Base',
            price: 199,
            description: 'Доступ к основным материалам автора',
            features: ['Базовые публикации', 'Комментарии', 'Уведомления о новых материалах']
        },
        {
            id: 'pro',
            name: 'Pro',
            price: 490,
            description: 'Полный доступ к материалам автора',
            features: ['Все публикации', 'Видео и аудио', 'Эксклюзивные материалы']
        },
        {
            id: 'premium',
            name: 'Premium',
            price: 799,
            description: 'Расширенный доступ и поддержка автора',
            features: ['Все возможности Pro', 'Закрытые материалы', 'Приоритетные ответы автора']
        }
    ];

    const LEGACY_PLAN_IDS = {
        basic: 'base',
        business: 'premium',
        author: 'premium'
    };

    let selectedPlanId = 'pro';

    function readStore() {
        try {
            const raw = window.AccountStorage ? window.AccountStorage.getItem(STORAGE_KEY) : localStorage.getItem(STORAGE_KEY);
            const value = JSON.parse(raw || '{}');
            return value && typeof value === 'object' ? value : {};
        } catch (_) {
            return {};
        }
    }

    function writeStore(value) {
        const raw = JSON.stringify(value);
        if (window.AccountStorage) window.AccountStorage.setItem(STORAGE_KEY, raw);
        else localStorage.setItem(STORAGE_KEY, raw);
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

    function normalizePlanId(planId) {
        const normalized = LEGACY_PLAN_IDS[planId] || planId;
        return PLANS.some(plan => plan.id === normalized) ? normalized : 'pro';
    }

    function currentPlanId() {
        const store = readStore();
        const authorKey = currentAuthorKey();
        const storedPlanId = store[authorKey];
        const normalizedPlanId = normalizePlanId(storedPlanId);

        if (storedPlanId && storedPlanId !== normalizedPlanId) {
            store[authorKey] = normalizedPlanId;
            writeStore(store);
        }

        return normalizedPlanId;
    }

    function formatNextCharge() {
        const next = new Date();
        next.setMonth(next.getMonth() + 1);
        return next.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function renderCurrentPlan() {
        const plan = PLANS.find(item => item.id === currentPlanId()) || PLANS[1];
        const title = document.querySelector('#view-author-profile .author-plan-card h3');
        const description = document.querySelector('#view-author-profile .author-plan-card p');
        if (title) title.innerHTML = `${plan.name} <i class="fa-solid fa-star"></i>`;
        if (description) description.textContent = `${plan.price} ₽/мес · Следующее списание: ${formatNextCharge()}`;
    }

    function renderOptions() {
        const root = document.getElementById('authorPlanOptions');
        if (!root) return;
        root.innerHTML = PLANS.map(plan => `
            <button class="author-plan-option${selectedPlanId === plan.id ? ' is-selected' : ''}" type="button" data-plan-id="${plan.id}">
                <span class="author-plan-option-radio" aria-hidden="true"></span>
                <span class="author-plan-option-main">
                    <span class="author-plan-option-head">
                        <strong>${plan.name}</strong>
                        <b>${plan.price} ₽/мес</b>
                    </span>
                    <span class="author-plan-option-description">${plan.description}</span>
                    <span class="author-plan-option-features">${plan.features.map(feature => `<span><i class="fa-solid fa-check"></i>${feature}</span>`).join('')}</span>
                </span>
            </button>
        `).join('');
    }

    function open() {
        const overlay = document.getElementById('authorPlanOverlay');
        if (!overlay) return;
        selectedPlanId = currentPlanId();
        renderOptions();
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('author-plan-modal-open');
    }

    function close() {
        const overlay = document.getElementById('authorPlanOverlay');
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('author-plan-modal-open');
    }

    function save() {
        const store = readStore();
        store[currentAuthorKey()] = selectedPlanId;
        writeStore(store);

        writeScoped(scopedAuthorKey(SUBSCRIPTION_STATE_KEY), 'subscribed');
        if (typeof window.authorButtonState === 'object') {
            window.authorButtonState.subscribed = true;
        } else if (typeof authorButtonState === 'object') {
            authorButtonState.subscribed = true;
        }

        renderCurrentPlan();
        if (typeof window.refreshAuthorSubscribeButton === 'function') {
            window.refreshAuthorSubscribeButton();
        } else if (typeof refreshAuthorSubscribeButton === 'function') {
            refreshAuthorSubscribeButton();
        }
        if (window.AuthorCancelSubscription?.sync) {
            window.AuthorCancelSubscription.sync();
        }

        close();
        const plan = PLANS.find(item => item.id === selectedPlanId);
        if (typeof window.toast === 'function') window.toast(`Подписка оформлена: ${plan?.name || ''}`);
    }

    document.addEventListener('click', event => {
        const option = event.target.closest('.author-plan-option');
        if (option) {
            selectedPlanId = option.dataset.planId || selectedPlanId;
            renderOptions();
            return;
        }

        if (event.target.closest('#authorPlanClose') || event.target === document.getElementById('authorPlanOverlay')) {
            close();
            return;
        }

        if (event.target.closest('#authorPlanSave')) save();
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
    });

    window.AuthorPlanPicker = { open, close, sync: renderCurrentPlan };

    document.addEventListener('DOMContentLoaded', renderCurrentPlan);
    window.addEventListener('account-changed', ()=>{ close(); renderCurrentPlan(); });
})();
