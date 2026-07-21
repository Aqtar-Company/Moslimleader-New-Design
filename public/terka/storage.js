/* storage.js — حفظ واستعادة حالة المباراة عبر localStorage */

const STORAGE_KEY = 'tarika_game_save_v1';

const GameStorage = {
  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('تعذّر حفظ المباراة:', e);
      return false;
    }
  },
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('تعذّر استرجاع المباراة:', e);
      return null;
    }
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
  hasSavedGame() {
    return !!localStorage.getItem(STORAGE_KEY);
  }
};
