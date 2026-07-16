(function(){
    'use strict';

    let activeFilter = 'all';

    function normalize(value){
        return String(value || '').toLocaleLowerCase('ru-RU').trim();
    }

    function elements(){
        return {
            view: document.getElementById('view-feed'),
            toggle: document.getElementById('feedSearchToggle'),
            panel: document.getElementById('feedSearchPanel'),
            input: document.getElementById('feedSearchInput'),
            clear: document.getElementById('feedSearchClear'),
            empty: document.getElementById('feedEmptyState'),
            cards: Array.from(document.querySelectorAll('#feedWebGrid .feed-web-card')),
            tabs: Array.from(document.querySelectorAll('#feedTabs .feed-web-tab'))
        };
    }

    function cardMatches(card, query){
        const category = card.dataset.feedCategory || '';
        const categoryMatches = activeFilter === 'all' || category === activeFilter;
        if(!categoryMatches) return false;
        if(!query) return true;
        const searchable = normalize([
            card.querySelector('.feed-web-name-row strong')?.textContent,
            card.querySelector('.feed-web-meta')?.textContent,
            card.querySelector('h2')?.textContent,
            card.querySelector('p')?.textContent,
            card.querySelector('.feed-web-quote')?.textContent
        ].filter(Boolean).join(' '));
        return searchable.includes(query);
    }

    function applyFilter(){
        const {input, cards, empty} = elements();
        const query = normalize(input?.value);
        let visibleCount = 0;
        cards.forEach(card => {
            const visible = cardMatches(card, query);
            card.hidden = !visible;
            card.setAttribute('aria-hidden', visible ? 'false' : 'true');
            if(visible) visibleCount += 1;
        });
        if(empty) empty.hidden = visibleCount !== 0;
    }

    function setFilter(value, tab){
        activeFilter = value || 'all';
        const {tabs} = elements();
        tabs.forEach(button => button.classList.toggle('active', button === tab));
        applyFilter();
    }

    function openSearch(){
        const {panel, toggle, input} = elements();
        if(!panel) return;
        panel.hidden = false;
        toggle?.setAttribute('aria-expanded','true');
        requestAnimationFrame(() => input?.focus());
    }

    function closeSearch(){
        const {panel, toggle, input} = elements();
        if(!panel) return;
        if(input) input.value = '';
        panel.hidden = true;
        toggle?.setAttribute('aria-expanded','false');
        applyFilter();
    }

    function init(){
        const {view, toggle, panel, input, clear, tabs} = elements();
        if(!view || !toggle || !panel || !input) return;

        toggle.addEventListener('click', function(event){
            event.preventDefault();
            event.stopPropagation();
            if(panel.hidden) openSearch(); else closeSearch();
        });

        input.addEventListener('input', applyFilter);
        input.addEventListener('keydown', function(event){
            if(event.key === 'Escape') closeSearch();
        });
        clear?.addEventListener('click', function(){
            if(input.value){
                input.value = '';
                applyFilter();
                input.focus();
            }else{
                closeSearch();
            }
        });

        tabs.forEach(tab => {
            tab.addEventListener('click', function(){
                setFilter(tab.dataset.feedFilter || 'all', tab);
            });
        });

        applyFilter();
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
