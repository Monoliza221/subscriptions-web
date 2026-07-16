(function(){
  'use strict';

  const ACTIVE_ACCOUNT_KEY = 'mysubs_active_account_v1';
  const ACCOUNT_PREFIX = 'mysubs_account_v1:';

  function normalizeAccountId(value){
    const digits = String(value || '').replace(/\D/g, '');
    return digits || String(value || '').trim().toLowerCase();
  }

  function getActiveAccount(){
    try{ return localStorage.getItem(ACTIVE_ACCOUNT_KEY) || ''; }
    catch(error){ return ''; }
  }

  function setActiveAccount(value){
    const id = normalizeAccountId(value);
    if(!id) return '';
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
    return id;
  }

  function clearActiveAccount(){
    try{ localStorage.removeItem(ACTIVE_ACCOUNT_KEY); }catch(error){}
  }

  function scopedKey(key, accountId){
    const id = normalizeAccountId(accountId || getActiveAccount());
    return id ? `${ACCOUNT_PREFIX}${id}:${key}` : '';
  }

  function getItem(key){
    const fullKey = scopedKey(key);
    if(!fullKey) return null;
    try{ return localStorage.getItem(fullKey); }
    catch(error){ return null; }
  }

  function setItem(key, value){
    const fullKey = scopedKey(key);
    if(!fullKey) return false;
    try{ localStorage.setItem(fullKey, value); return true; }
    catch(error){ return false; }
  }

  function removeItem(key){
    const fullKey = scopedKey(key);
    if(!fullKey) return;
    try{ localStorage.removeItem(fullKey); }catch(error){}
  }


  function migrateLegacyAccount(accountId, stateKey, extraKeys){
    const id = normalizeAccountId(accountId);
    if(!id) return false;
    const targetStateKey = scopedKey(stateKey, id);
    try{
      if(localStorage.getItem(targetStateKey)) return false;
      const legacyRaw = localStorage.getItem(stateKey);
      if(!legacyRaw) return false;
      const legacyState = JSON.parse(legacyRaw);
      const legacyPhone = normalizeAccountId(legacyState?.user?.phone || '');
      if(!legacyPhone || legacyPhone !== id) return false;

      localStorage.setItem(targetStateKey, legacyRaw);
      (extraKeys || []).forEach(key => {
        const value = localStorage.getItem(key);
        if(value !== null) localStorage.setItem(scopedKey(key, id), value);
      });
      return true;
    }catch(error){
      return false;
    }
  }

  function removeAccount(accountId){
    const id = normalizeAccountId(accountId || getActiveAccount());
    if(!id) return;
    const prefix = `${ACCOUNT_PREFIX}${id}:`;
    try{
      for(let index = localStorage.length - 1; index >= 0; index -= 1){
        const key = localStorage.key(index);
        if(key && key.startsWith(prefix)) localStorage.removeItem(key);
      }
    }catch(error){}
  }

  window.AccountStorage = {
    normalizeAccountId,
    getActiveAccount,
    setActiveAccount,
    clearActiveAccount,
    getItem,
    setItem,
    removeItem,
    migrateLegacyAccount,
    removeAccount
  };
})();
