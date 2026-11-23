// The app is fully offline: everything below runs on this device (see localApi.js). No server needed.
import { api as local } from './localApi.js';

const KEY = 'cric365_token';
export const auth = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(KEY, t); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } local.signOut(); }
};
export const api = local;
