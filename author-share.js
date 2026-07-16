(function(){
    'use strict';

    function currentAuthorData(){
        const name = document.getElementById('authorProfileName')?.textContent?.trim() || 'Автор';
        const handle = document.getElementById('authorProfileHandle')?.textContent?.trim() || '';
        const bio = document.getElementById('authorProfileBio')?.textContent?.trim() || '';
        return { name, handle, bio };
    }

    function authorShareUrl(author){
        const base = `${window.location.origin}${window.location.pathname}`;
        const slug = (author.handle || author.name)
            .replace(/^@/, '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9а-яё_-]+/gi, '-');
        return `${base}#author-${encodeURIComponent(slug)}`;
    }

    async function copyAuthorLink(url){
        try{
            await navigator.clipboard.writeText(url);
            if(typeof window.toast === 'function') window.toast('Ссылка на автора скопирована');
            return true;
        }catch(error){
            const field = document.createElement('textarea');
            field.value = url;
            field.setAttribute('readonly', '');
            field.style.position = 'fixed';
            field.style.opacity = '0';
            document.body.appendChild(field);
            field.select();
            const copied = document.execCommand('copy');
            field.remove();
            if(copied && typeof window.toast === 'function') window.toast('Ссылка на автора скопирована');
            return copied;
        }
    }

    window.shareCurrentAuthorProfile = async function(){
        const author = currentAuthorData();
        const url = authorShareUrl(author);
        const text = `${author.name}${author.handle ? ` (${author.handle})` : ''}${author.bio ? ` — ${author.bio}` : ''}`;

        if(navigator.share){
            try{
                await navigator.share({
                    title: `Профиль автора — ${author.name}`,
                    text,
                    url
                });
                return;
            }catch(error){
                if(error && error.name === 'AbortError') return;
            }
        }
        await copyAuthorLink(url);
    };
})();
