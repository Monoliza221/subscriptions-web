(function () {
    'use strict';

    const OVERLAY_ID = 'achievementDetailsOverlay';

    function ensureModal() {
        let overlay = document.getElementById(OVERLAY_ID);
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'achievement-details-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <section class="achievement-details-modal" role="dialog" aria-modal="true" aria-labelledby="achievementDetailsTitle">
                <button class="achievement-details-close" type="button" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
                <div class="achievement-details-icon"><i class="fa-solid fa-trophy"></i></div>
                <h2 id="achievementDetailsTitle">Достижение</h2>
                <div class="achievement-details-rarity">ОБЫЧНОЕ</div>
                <p class="achievement-details-description"></p>
                <div class="achievement-details-progress"><span></span></div>
                <div class="achievement-details-progress-row">
                    <span class="achievement-details-progress-label">Статус</span>
                    <strong class="achievement-details-progress-value">Выполнено</strong>
                </div>
                <div class="achievement-details-info-grid">
                    <div class="achievement-details-info-card">
                        <span>НАГРАДА</span>
                        <strong class="achievement-details-reward">—</strong>
                    </div>
                    <div class="achievement-details-info-card">
                        <span>БОНУС</span>
                        <strong class="achievement-details-bonus">—</strong>
                    </div>
                </div>
                <button class="achievement-details-share" type="button"><i class="fa-solid fa-share-nodes"></i><span>Поделиться</span></button>
            </section>`;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (event) {
            if (event.target === overlay || event.target.closest('.achievement-details-close')) {
                closeAchievementDetails();
            }
        });
        const modal = overlay.querySelector('.achievement-details-modal');
        const closeButton = overlay.querySelector('.achievement-details-close');

        modal.addEventListener('click', function (event) {
            event.stopPropagation();
        });
        closeButton.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            closeAchievementDetails();
        });
        overlay.querySelector('.achievement-details-share').addEventListener('click', shareCurrentAchievement);
        return overlay;
    }

    let currentShareText = '';

    function openAchievementDetails(card) {
        const overlay = ensureModal();
        const locked = card.classList.contains('locked');
        const title = card.querySelector('h3')?.textContent?.trim() || 'Достижение';
        const description = card.querySelector('p')?.textContent?.trim() || '';
        const rarity = card.querySelector('.achievements-web-foot > span:first-child')?.textContent?.trim() || 'Обычное';
        const points = card.querySelector('.achievements-web-points')?.textContent?.trim() || '—';
        const sourceIcon = card.querySelector('.achievements-web-icon');
        const sourceIconClass = sourceIcon?.querySelector('i')?.className || 'fa-solid fa-trophy';
        const icon = overlay.querySelector('.achievement-details-icon');
        const progress = locked ? 62 : 100;

        overlay.querySelector('#achievementDetailsTitle').textContent = title;
        overlay.querySelector('.achievement-details-description').textContent = description;
        overlay.querySelector('.achievement-details-rarity').textContent = rarity.toUpperCase();
        overlay.querySelector('.achievement-details-reward').textContent = locked ? '—' : `${points.replace('+', '')} баллов`;
        overlay.querySelector('.achievement-details-bonus').textContent = locked ? 'Подсказка скрыта' : '—';
        overlay.querySelector('.achievement-details-progress-label').textContent = locked ? 'Прогресс' : 'Статус';
        overlay.querySelector('.achievement-details-progress-value').textContent = locked ? `${progress}%` : 'Выполнено';
        overlay.querySelector('.achievement-details-progress > span').style.width = `${progress}%`;
        overlay.classList.toggle('is-locked', locked);

        icon.innerHTML = `<i class="${sourceIconClass}"></i>`;
        if (sourceIcon) {
            icon.style.background = sourceIcon.style.background || '';
            icon.style.color = sourceIcon.style.color || '';
        }

        const isFriendView = typeof achievementsViewMode !== 'undefined' && achievementsViewMode === 'friend';
        const shareButton = overlay.querySelector('.achievement-details-share');
        shareButton.hidden = isFriendView;
        currentShareText = `${locked ? 'Хочу открыть достижение' : 'Я получил достижение'} «${title}» в «SubMart». ${description} Награда: ${points.replace('+', '')} баллов.`;

        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('achievement-details-open');
    }

    function closeAchievementDetails() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('achievement-details-open');
    }

    async function shareCurrentAchievement() {
        if (!currentShareText) return;
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Достижение', text: currentShareText });
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(currentShareText);
                if (typeof toast === 'function') toast('Текст достижения скопирован');
            }
        } catch (error) {
            if (error?.name !== 'AbortError' && typeof toast === 'function') {
                toast('Не удалось поделиться');
            }
        }
    }

    document.addEventListener('click', function (event) {
        const card = event.target.closest('#view-achievements .achievements-web-card');
        if (!card) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openAchievementDetails(card);
    }, true);

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeAchievementDetails();
    });

    window.closeAchievementDetails = closeAchievementDetails;
})();
