/**
 * API client for the LOAD BALANCER (all data goes through it - the app no longer reads/writes Firestore).
 *
 * Login:  Firebase Auth (email / Google) gives an ID token  ->  POST /auth/login  ->  our session token (valid 1 hour).
 * Every call sends:  X-Site-Key (your domain's key) + Authorization: Bearer <session token> + X-Device-FP (device fingerprint).
 * When the 1-hour token ends the client silently logs in again with a fresh Firebase ID token and repeats the call once.
 */
import { authService } from './firebase.js?v=fe39312af5';
import { LB_URL, SITE_KEY } from './app-config.js?v=fe39312af5';

export class ApiError extends Error {
    constructor(status, code, message, data) { super(message || 'Something went wrong'); this.status = status; this.code = code || ''; this.data = data || {}; }
}

const SKEY = 'ffcb_sess';
let sess = null;          // { token, exp (ms), uid }
let loginP = null;

// ---------------------------------------------------------------- device fingerprint (sent to the fraud server)
const hash = (s) => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16); };
export const deviceFp = () => {
    try {
        let id = localStorage.getItem('ffcb_dev');
        if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('ffcb_dev', id); }
        const n = navigator, s = screen;
        const traits = [n.userAgent, n.language, n.platform, n.hardwareConcurrency, n.maxTouchPoints, s.width + 'x' + s.height + 'x' + s.colorDepth, (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone].join('|');
        return 'fp_' + hash(traits) + hash(id + traits);
    } catch (e) { return 'fp_unknown_' + Date.now(); }
};

const loadSess = () => { if (sess) return sess; try { const j = JSON.parse(sessionStorage.getItem(SKEY) || 'null'); if (j && j.token && j.exp > Date.now() + 30000) sess = j; } catch (e) {} return sess; };
const saveSess = (s) => { sess = s; try { if (s) sessionStorage.setItem(SKEY, JSON.stringify(s)); else sessionStorage.removeItem(SKEY); } catch (e) {} };

const base = () => String(LB_URL || '').trim().replace(/\/+$/, '');

// Render free servers sleep: wake the load balancer as soon as the app opens (no CORS needed, response ignored)
try { if (base()) fetch(base() + '/health', { mode: 'no-cors', cache: 'no-store', keepalive: true }).catch(() => {}); } catch (e) {}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function raw(method, path, body, { token, timeout = 70000 } = {}) {
    if (!base()) throw new ApiError(0, 'no_config', 'App is not configured (LB_URL missing).');
    const headers = { 'Content-Type': 'application/json', 'X-Site-Key': SITE_KEY, 'X-Device-FP': deviceFp() };
    if (token) headers.Authorization = 'Bearer ' + token;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    let res;
    try {
        res = await fetch(base() + path, { method, headers, body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body), signal: ctl.signal });
    } catch (e) {
        throw new ApiError(0, 'network', e && e.name === 'AbortError' ? 'The server is taking too long. Please try again.' : 'Network error. Please check your internet connection and try again.');
    } finally { clearTimeout(t); }
    let data = null; try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok || (data && data.ok === false)) throw new ApiError(res.status, data && data.code, (data && data.error) || ('Server error (' + res.status + ')'), data || {});
    return data || {};
}

// ---------------------------------------------------------------- session
async function login(extra) {
    if (loginP) return loginP;
    loginP = (async () => {
        const u = authService.currentUser;
        if (!u) throw new ApiError(401, 'no_user', 'Please login first.');
        const idToken = await u.getIdToken();
        const r = await raw('POST', '/auth/login', Object.assign({ idToken }, extra || {}));
        saveSess({ token: r.token, exp: r.expiresAt, uid: u.uid });
        return r;
    })().finally(() => { loginP = null; });
    return loginP;
}

async function ensure() {
    const s = loadSess();
    if (s && authService.currentUser && s.uid === authService.currentUser.uid && s.exp > Date.now() + 30000) return s.token;
    if (!authService.currentUser) throw new ApiError(401, 'no_user', 'Please login first.');
    await login();
    return sess.token;
}

// what the ban screen needs, from the server's 403 'banned' error
export const banData = (d) => { d = d || {}; return { isBanned: true, bannedUntil: d.bannedUntil || 'permanent', banReason: d.reason || '', banDays: d.banDays, bannedAt: d.bannedAt, playerId: d.playerId || '' }; };
const onBanned = (e) => { try { if (e.code === 'banned' && window.app && window.app.checkBan) window.app.checkBan(banData(e.data)); } catch (x) {} };

async function request(method, path, body, opts = {}) {
    const auth = opts.auth !== false;
    let token = auth ? await ensure() : null;
    try {
        try {
            return await raw(method, path, body, { token, timeout: opts.timeout });
        } catch (e) {
            // reads are safe to repeat: one quiet retry on network error / bad gateway / unavailable (server waking up, failover)
            if (method === 'GET' && (e.code === 'network' || e.status === 502 || e.status === 503 || e.status === 504)) { await sleep(1500); return await raw(method, path, body, { token, timeout: opts.timeout }); }
            throw e;
        }
    } catch (e) {
        if (auth && e.status === 401 && (e.code === 'token_expired' || e.code === 'token_revoked') && !opts._retried) {
            saveSess(null);
            token = await ensure();                                   // silent re-login with a fresh Firebase ID token
            return request(method, path, body, Object.assign({}, opts, { _retried: true }));
        }
        onBanned(e);
        throw e;
    }
}

const qs = (p) => { if (!p) return ''; const s = new URLSearchParams(); Object.keys(p).forEach(k => { if (p[k] !== undefined && p[k] !== null && p[k] !== '') s.set(k, p[k]); }); const t = s.toString(); return t ? '?' + t : ''; };

export const api = {
    ApiError, login, deviceFp,
    get: (path, params, opts) => request('GET', path + qs(params), undefined, opts),
    post: (path, body, opts) => request('POST', path, body || {}, opts),
    patch: (path, body, opts) => request('PATCH', path, body || {}, opts),
    del: (path, opts) => request('DELETE', path, undefined, opts),
    any: (path, params) => (authService.currentUser ? request('GET', path + qs(params), undefined, {}) : request('GET', path + qs(params), undefined, { auth: false })),
    pub: (path, params) => request('GET', path + qs(params), undefined, { auth: false }),      // public data (banner, categories ...) - no login needed
    logout: async () => { const had = !!loadSess(); try { if (had) await request('POST', '/auth/logout', {}, { _retried: true }); } catch (e) {} saveSess(null); },
    hasSession: () => !!loadSess(),
    clear: () => saveSess(null),
};
window.api = api;
window.ApiError = ApiError;
