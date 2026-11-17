/**
 * Bad-word filter. The admin edits the list in Admin -> Chat Manager -> Banned Words (config/chat_words, read through the load balancer: GET /public/chatwords).
 *   { words: [...], enabled: true|false, msg: "custom text" }
 * window.badwords.find(text)    -> the blocked word found in the text, or '' if clean
 * window.badwords.blocked(text) -> true (and shows "<word> word block hai") when the text must not be sent
 * Used by Proofs (post + comments) and chat. Catches simple tricks: CAPITALS, f.u.c.k, f u c k, fuuuck, leet (a=@, o=0 ...).
 */
import { api } from './api.js?v=684982f88b';

let CFG = { words: [], enabled: true, msg: '' }, unsub = null;
try { const c = JSON.parse(localStorage.getItem('ffcb_bw') || 'null'); if (c && Array.isArray(c.words)) CFG = c; } catch (e) {}

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[01345 7@$!]/g, (c) => c === ' ' ? ' ' : LEET[c] || c);
const squash = (s) => s.replace(/(.)\1{1,}/g, '$1');                       // fuuuck -> fuck, baaad -> bad
const letters = (s) => s.replace(/[^a-z\u0900-\u097f]+/g, '');
const tokens = (s) => s.split(/[^a-z\u0900-\u097f]+/).filter(Boolean);

function find(text) {
    if (!CFG.enabled || !CFG.words.length) return '';
    const n = norm(text); if (!n.trim()) return '';
    const toks = tokens(n), tokSq = toks.map(squash);
    const joinedSingles = (() => {                                          // "f u c k" -> "fuck"
        let out = [], run = '';
        toks.forEach(t => { if (t.length === 1) run += t; else { if (run.length > 2) out.push(run); run = ''; } });
        if (run.length > 2) out.push(run); return out.map(squash);
    })();
    const flat = squash(letters(n));
    for (const raw of CFG.words) {
        const w = norm(raw).trim(); if (!w) continue;
        const wl = letters(w), wsq = squash(wl); if (!wl) continue;
        if (/\s/.test(w)) {                                                  // phrase: match on letters only
            if (flat.includes(wsq)) return raw;
            continue;
        }
        if (toks.includes(wl) || tokSq.includes(wsq) || joinedSingles.includes(wsq)) return raw;
    }
    return '';
}

window.badwords = {
    find,
    blocked(text) {
        const w = find(text); if (!w) return false;
        const m = (CFG.msg || '').trim();
        const out = m ? m.replace(/\{word\}/gi, w) : `"${w}" word block hai — isko hata kar likho`;
        try { window.ui.toast(out); } catch (e) { alert(out); }
        return true;
    },
    async ready() { if (CFG._fresh) return; try { await load(); } catch (e) {} },
    start() {
        if (unsub) return;
        const id = setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 60000);     // admin edits the list -> picked up within a minute
        unsub = () => clearInterval(id); load().catch(() => {});
    },
    stop() { if (unsub) { try { unsub(); } catch (e) {} unsub = null; } }
};
function apply(d) {
    CFG = { words: (d.words || []).map(String), enabled: d.enabled !== false, msg: String(d.msg || ''), _fresh: true };
    try { localStorage.setItem('ffcb_bw', JSON.stringify(CFG)); } catch (e) {}
}
async function load() { const r = await api.pub('/public/chatwords'); apply(r.words ? r : {}); }
