/**
 * LIVE sync by short polling (the app no longer listens to Firestore).
 *   /user/sync        every 10 s -> balance, stats, drawer, header, unread count       (+ "Deposit Credited" toast)
 *   /history/wallet   every 30 s -> wallet + history list                               (+ "Withdrawal Successful" toast)
 *   /matches          every 15 s -> room id / password, result, kills, player count    (+ room / winner toasts)
 * Polling pauses while the tab is hidden and runs at once when the user comes back. Errors slow it down (max 60 s).
 */
import { api } from './api.js?v=2d72097ddc';

window.live = (function () {
    let uid = null, stopped = true, loops = [];
    const visible = () => document.visibilityState === 'visible';

    function makeLoop(ms, fn) {
        let t = null, fails = 0, running = false;
        const schedule = (d) => { clearTimeout(t); if (!stopped) t = setTimeout(run, d); };
        async function run() {
            if (stopped) return;
            if (!visible() || running) return schedule(ms);
            running = true;
            try { await fn(); fails = 0; } catch (e) { fails++; }
            running = false;
            schedule(Math.min(ms * Math.pow(2, fails), 60000));
        }
        return { kick: () => { clearTimeout(t); if (!stopped) run(); }, stop: () => clearTimeout(t) };
    }

    // ------------------------------------------------------------ user: balance / stats
    let prevBal = null, userReady = false, lastUnread = null;
    async function pollUser() {
        const id = uid;
        const r = await api.get('/user/sync');
        if (uid !== id) return;
        const d = r.user || {};
        const dep = Number(d.depositBalance) || 0, wd = Number(d.withdrawBalance) || 0;
        window.app.applyUserDoc(d);
        if (r.geo && window.app.applyGeo) window.app.applyGeo(r.geo);
        if (r.unread != null && r.unread !== lastUnread) { if (lastUnread !== null && r.unread > lastUnread && window.app.fetchNotifications) window.app.fetchNotifications(); lastUnread = r.unread; }
        if (!userReady) { prevBal = { dep, wd }; userReady = true; return; }
        const dDep = +(dep - prevBal.dep).toFixed(2), dWd = +(wd - prevBal.wd).toFixed(2);
        prevBal = { dep, wd };
        if (dDep !== 0 || dWd !== 0) setTimeout(() => window.live && window.live.refreshTrx(), 300);      // balance moved -> refresh the wallet list now
        if (dDep + dWd <= 0) return;                                  // toast only when the total balance increased
        const L = window.msg.live;
        if (dDep > 0 && dWd <= 0) { const m = L.depositCredited(dDep); window.ui.notify({ type: 'success', title: m.title, message: m.body, sound: 'notification' }); }
        else if (dWd > 0 && dDep <= 0) { const m = L.balanceCredited(dWd); window.ui.notify({ type: 'success', title: m.title, message: m.body, sound: 'notification' }); }
        else { const m = L.depositCredited(dDep + dWd); window.ui.notify({ type: 'success', title: m.title, message: m.body, sound: 'notification' }); }
    }

    // ------------------------------------------------------------ transactions: wallet + history
    const seen = new Map(); let trxFirst = true;
    async function loadTrx() {
        const id = uid; if (!id) return;
        const r = await api.get('/history/wallet', { limit: 120 });
        if (uid !== id) return;
        const list = (r.items || []).map((t) => { t._id = t._id || t.id; t._ms = window.trxMs(t); return t; });
        window.db.trx = window.trxSort(list);
        window.db.trx.forEach((t) => {                                // withdrawal paid -> toast
            const st = window.msg.normStatus(t.status), was = seen.get(t._id);
            seen.set(t._id, st);
            if (trxFirst || (was === undefined && st !== 'success')) return;
            if (String(t.type).toLowerCase() === 'withdraw' && st === 'success' && was !== 'success') {
                const m = window.msg.live.withdrawPaid(t);
                window.ui.notify({ type: 'success', title: m.title, message: m.body, sound: 'withdrawal' });
            }
        });
        trxFirst = false;
        try { window.app.renderWallet(); } catch (e) {}
        const wh = document.getElementById('modal-wallet-history');
        if (wh && wh.classList.contains('active')) { try { window.app.renderWH(); } catch (e) {} }
    }

    // ------------------------------------------------------------ matches: room id / result / players
    const known = new Map(); let matchFirst = true, renderT = null;
    async function pollMatches() {
        const id = uid;
        const r = await api.get('/matches');
        if (uid !== id) return;
        const list = r.matches || [];
        window.db.matches = list; window.app._matchesLoaded = true;
        if (r.geo && window.app.applyGeo) window.app.applyGeo(r.geo);
        const joinedIds = window.db.joined_ids || [];
        const fresh = [];
        list.forEach((m) => {
            const room = !!(m.roomId && m.roomPass);
            const prev = known.get(m.id);
            known.set(m.id, { room, status: m.status });
            if (matchFirst || !prev || !joinedIds.includes(m.id)) return;
            if (room && !prev.room && m.status !== 'completed' && m.status !== 'live') {
                fresh.push(m.id);
                window.ui.notify({ type: 'info', title: 'Room ID & Password Ready', message: (m.title || 'Your match') + ' — open My Matches to copy.', sound: 'notification' });
            }
            if (m.status === 'completed' && prev.status !== 'completed') {
                const me = (m.participants || []).find((p) => p.uid === id) || {};
                const won = m.winnerUid === id;
                const amt = me.winAmount != null ? Number(me.winAmount) : (won ? Number(m.prize) || 0 : 0);
                if (won) window.ui.notify({ type: 'success', title: 'Winner Winner! 🏆', message: `You won ${'₹' + amt} in ${m.title || 'the match'}.`, sound: 'notification' });
                else if (amt > 0) window.ui.notify({ type: 'success', title: 'Match Result', message: `You earned ${'₹' + amt} (${Number(me.kills) || 0} kills) in ${m.title || 'the match'}.`, sound: 'notification' });
                else window.ui.notify({ type: 'info', title: 'Match Finished', message: (m.title || 'Match') + ' result is in History.' });
            }
        });
        matchFirst = false;
        clearTimeout(renderT);
        renderT = setTimeout(() => {
            try { if (window.app.renderMatches) window.app.renderMatches(); } catch (e) {}
            const pg = document.getElementById('page-matches');
            if (pg && !pg.classList.contains('hidden')) {
                try { window.app.renderMyMatches(); } catch (e) {}
                fresh.forEach((mid) => { const idx = (window.db.matches || []).filter((m) => joinedIds.includes(m.id) && m.status !== 'completed').findIndex((m) => m.id === mid); const el = document.querySelectorAll('#my-matches-list .mx-card')[idx]; if (el) el.classList.add('flash'); });
            }
        }, 200);
    }

    const stop = () => { stopped = true; loops.forEach((l) => l.stop()); loops = []; uid = null; prevBal = null; userReady = false; lastUnread = null; trxFirst = true; seen.clear(); known.clear(); matchFirst = true; };

    function start(id) {
        if (!id) return;
        if (uid === id && !stopped) return;
        stop(); uid = id; stopped = false;
        const lu = makeLoop(10000, pollUser), lt = makeLoop(30000, loadTrx), lm = makeLoop(15000, pollMatches);
        loops = [lu, lt, lm];
        lu.kick(); lt.kick(); lm.kick();
    }

    document.addEventListener('visibilitychange', () => { if (visible() && !stopped) loops.forEach((l) => l.kick()); });
    return { start, stop, tick: () => loops[0] && loops[0].kick(), refreshTrx: () => loadTrx().catch(() => {}), loadTrx, refreshMatches: () => pollMatches().catch(() => {}) };
})();
