/**
 * State payment ban - UI side. The SERVER decides (current IP + declared state); this file only shows the result:
 *   geo.paymentAllowed === false  ->  every [data-payment] element is hidden and the safety message is shown in .geo-note
 *   geo.needsState                ->  asks the user to choose his state once (POST /user/state)
 * Free matches and free games keep working. The server also refuses paid actions, so hiding the button is only the polite part.
 */
import { api } from './api.js?v=2d72097ddc';

const DEFAULT_MSG = 'Aapki safety ke liye aapke state me payment system hide hai. Aap free matches join kar sakte ho.';

Object.assign(window.app, {
    applyGeo: (geo) => {
        if (!geo) return;
        window.db.geo = geo;
        const blocked = geo.paymentAllowed === false;
        document.body.classList.toggle('pay-blocked', blocked);
        document.querySelectorAll('[data-payment]').forEach((el) => { el.hidden = blocked; el.style.display = blocked ? 'none' : ''; });
        document.querySelectorAll('.geo-note').forEach((el) => { el.textContent = blocked ? (geo.message || DEFAULT_MSG) : ''; el.style.display = blocked ? 'block' : 'none'; });
        if (blocked) { const m = document.getElementById('modal-deposit'); if (m && m.classList.contains('active') && window.ui && window.ui.closeModal) window.ui.closeModal(); }
        if (geo.needsState && window.db.user_uid) window.app.askState();
    },
    // server said "payment_blocked_state" -> show its message (and refresh the geo info)
    geoBlocked: (e) => {
        if (!e || e.code !== 'payment_blocked_state') return false;
        if (e.data && e.data.geo) window.app.applyGeo(e.data.geo);
        window.ui.toast(e.message || DEFAULT_MSG);
        return true;
    },
    showGeoMsg: () => window.ui.toast((window.db.geo && window.db.geo.message) || DEFAULT_MSG),

    askState: async () => {
        if (document.getElementById('state-picker') || sessionStorage.getItem('ffcb_state_later') === '1') return;
        let states = [];
        try { states = (await api.pub('/public/states')).states || []; } catch (e) { return; }
        const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const wrap = document.createElement('div');
        wrap.id = 'state-picker';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.6);display:flex;align-items:flex-end;justify-content:center;';
        wrap.innerHTML = `<div style="width:100%;max-width:480px;background:var(--card,#fff);color:var(--text,#0f172a);border-radius:20px 20px 0 0;padding:20px 18px 26px;box-shadow:0 -8px 30px rgba(0,0,0,.25);">
            <div style="font-weight:800;font-size:1.05rem;margin-bottom:6px;"><i class="fa-solid fa-location-dot"></i> Select your state</div>
            <div style="font-size:.8rem;opacity:.75;margin-bottom:12px;">Safety rules differ by state. Your state decides which payment features can be shown to you. You can change it only once in a while.</div>
            <select id="sp-select" style="width:100%;padding:12px;border-radius:12px;border:1.5px solid #cbd5e1;font-size:.95rem;background:transparent;color:inherit;"><option value="">Choose state…</option>${states.map((s) => `<option>${esc(s)}</option>`).join('')}</select>
            <div id="sp-err" style="color:#dc2626;font-size:.78rem;min-height:18px;margin-top:6px;"></div>
            <div style="display:flex;gap:10px;margin-top:6px;"><button id="sp-later" type="button" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #cbd5e1;background:transparent;color:inherit;font-weight:700;">Later</button>
            <button id="sp-save" type="button" style="flex:2;padding:12px;border-radius:12px;border:0;background:var(--primary,#4f46e5);color:#fff;font-weight:800;">Save</button></div></div>`;
        document.body.appendChild(wrap);
        const close = () => wrap.remove();
        wrap.querySelector('#sp-later').onclick = () => { try { sessionStorage.setItem('ffcb_state_later', '1'); } catch (e) {} close(); };
        wrap.querySelector('#sp-save').onclick = async () => {
            const v = wrap.querySelector('#sp-select').value, err = wrap.querySelector('#sp-err');
            if (!v) { err.textContent = 'Please choose your state.'; return; }
            const b = wrap.querySelector('#sp-save'); b.disabled = true; b.textContent = 'Saving…';
            try { const r = await api.post('/user/state', { state: v }); close(); window.app.applyGeo(r.geo); window.ui.toast('State saved: ' + v); }
            catch (e) { err.textContent = e.message; b.disabled = false; b.textContent = 'Save'; }
        };
    },
});
