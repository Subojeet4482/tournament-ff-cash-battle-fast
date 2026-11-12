/**
 * Withdrawal: UPI (details can be saved in this browser) + Google Play gift card, coin animation, success popup.
 */
import { api } from '../../js/core/api.js?v=41f223a8d8';

Object.assign(window.app, {
    // ===== WITHDRAWAL SUCCESS MODAL =====
    showWithdrawSuccess: (amount, opts) => {
        try {
            opts = opts || {};
            const M = window.msg, amt = Number(amount), net = opts.net != null ? opts.net : Math.max(0, amt - 2);
            window.ui.closeModal();
            let name = (window.db.user_data && (window.db.user_data.appName||window.db.user_name)) || 'Player';
            // Force English-only display (strip non-ASCII characters from the user's name)
            name = String(name).replace(/[^\x20-\x7E]/g,'').trim() || 'Player';
            const set = (id, v) => { const el=document.getElementById(id); if(el) el.innerText=v; };
            set('wd-success-title', M.withdraw.popupTitle());
            set('wd-success-hello', `Hi ${name}, you're all set!`);
            set('wd-success-amt', amt.toFixed(2));
            set('wd-success-net', net.toFixed(2));
            const gp = opts.method === 'GIFTCARD';
            set('wd-success-method', gp ? 'Google Play Gift Card' : 'UPI');
            set('wd-success-ref', opts.ref || '--');
            const now = new Date();
            const eta = new Date(now.getTime() + (gp ? 0 : 3*24*60*60*1000)); // UPI ~3 working days, gift code usually minutes
            const f = d => d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
            set('wd-success-date', f(now));
            set('wd-success-eta', gp ? 'Within 15 – 20 min' : `${f(now)} - ${f(eta)}`);
            set('wd-success-msg', gp ? M.withdraw.gpPopupBody(amt) : M.withdraw.popupBody(amt, net, { method: opts.method }));
            set('wd-success-foot', gp ? M.withdraw.gpPopupFoot() : M.withdraw.popupFoot());
            window.ui.openModal('modal-wd-success');
            // Auto-close after 8 seconds (more text to read now)
            if(window._wdSuccessTimer) clearTimeout(window._wdSuccessTimer);
            window._wdSuccessTimer = setTimeout(()=>{
                const m=document.getElementById('modal-wd-success');
                if(m && m.classList.contains('active')){ try{ window.ui.closeModal(); }catch(e){} }
            }, 8000);
        } catch(e){ window.ui.toast(window.msg.withdraw.toastFallback()); }
    },
    // ===== WITHDRAW METHOD SELECT =====
    selectWdMethod: (method) => {
        window.app.selectedWdMethod = method;
        document.querySelectorAll('.wd-method-card').forEach(c=>c.classList.remove('selected'));
        document.querySelectorAll('.wd-section').forEach(s=>s.classList.remove('active'));
        document.getElementById('wd-card-'+method).classList.add('selected');
        document.getElementById('wd-'+method+'-section').classList.add('active');
    },
    updateNet: (kind, val) => {
        const amt = parseFloat(val)||0, el = document.getElementById('wd-'+kind+'-net');
        if(amt >= window.app.minWd()){ el.style.display='block'; document.getElementById('wd-'+kind+'-net-val').innerText=(kind==='gp' ? amt : amt-2).toFixed(2); }
        else el.style.display='none';
    },
    // limits set by the admin (config/banner): withdraw default Rs 10, deposit default Rs 5
    minWd: () => Math.max(3, Number(window.db && window.db.minWithdraw) || 10),
    minDep: () => Math.max(1, Number(window.db && window.db.minDeposit) || 5),
    applyMins: () => {
        const w = window.app.minWd(), d = window.app.minDep();
        document.querySelectorAll('.js-min-wd').forEach(e => { e.textContent = w; });
        document.querySelectorAll('[data-min-ph="wd"]').forEach(e => { e.placeholder = 'Min ₹' + w; });
        document.querySelectorAll('.wd-gp-chips button').forEach(b => { b.style.display = Number(b.dataset.v) < w ? 'none' : ''; });
        const di = document.getElementById('dep-amount');
        if (di) { di.placeholder = 'Amount Sent (Min ₹' + d + ')'; di.min = d; }
    },
    // admin ON/OFF switches (config/banner): k = 'dep' (Add Money) | 'wd' (ALL withdrawals) | 'upi' | 'gp'
    flagOff: (k) => { const f = (window.db && window.db.flags || {})[k]; return !!f && f.on === false; },
    flagMsg: (k) => {
        const f = (window.db && window.db.flags || {})[k] || {};
        if (f.note) return f.note;
        return ({
            dep: 'Deposit is temporarily disabled. Please try again later.',
            wd:  'Withdrawals are temporarily disabled. Please try again later.',
            upi: 'UPI withdrawal is temporarily disabled. Please try again later.'
        })[k] || 'Google Play gift card is temporarily disabled. Please try again later.';
    },
    applyConfig: (d) => {
        d = d || {};
        window.db.minWithdraw = Number(d.minWithdraw) >= 1 ? Number(d.minWithdraw) : 10;
        window.db.minDeposit = Number(d.minDeposit) >= 1 ? Number(d.minDeposit) : 5;
        if (window.app.applyMins) window.app.applyMins();
        window.app.readFlags(d);
    },
    // config/banner -> window.db.flags (one place, used by first load AND by refreshFlags)
    readFlags: (d) => {
        d = d || {};
        window.db.flags = {
            dep:  { on: d.depositEnabled !== false,  note: d.depositNote || '' },
            wd:   { on: d.withdrawEnabled !== false, note: d.withdrawNote || '' },
            upi:  { on: d.wdUpiEnabled !== false,    note: d.wdUpiNote || '' },
            gp:   { on: d.wdGpEnabled !== false,     note: d.wdGpNote || '' }
        };
        if (window.app.applyFlags) window.app.applyFlags();
    },
    // Re-read the switches when Add Money / Withdraw is tapped, so an admin change shows up without reopening the app.
    refreshFlags: (force) => {
        const A = window.app;
        if (A._flagsP) return A._flagsP;
        if (!force && Date.now() - (A._flagsAt || 0) < 3000) return Promise.resolve();
        A._flagsP = api.pub('/public/config')
            .then(r => { A.applyConfig(r.config || {}); A._flagsAt = Date.now(); })
            .catch(() => {})
            .finally(() => { A._flagsP = null; });
        return A._flagsP;
    },
    applyFlags: () => {
        const A = window.app, $ = (id) => document.getElementById(id);
        const dm = $('modal-deposit'); if (dm) { dm.classList.toggle('dep-off', A.flagOff('dep')); const m = $('dep-off-msg'); if (m) m.textContent = A.flagMsg('dep'); }
        const wm = $('modal-withdraw'); if (wm) { wm.classList.toggle('wd-all-off', A.flagOff('wd')); const m = $('wd-all-off-msg'); if (m) m.textContent = A.flagMsg('wd'); }
        ['upi', 'gp'].forEach(k => {
            const off = A.flagOff(k), sec = $('wd-' + k + '-section'), card = $('wd-card-' + k), m = $('wd-' + k + '-off-msg');
            if (sec) sec.classList.toggle('wd-off', off);
            if (card) card.classList.toggle('is-off', off);
            if (m) m.textContent = A.flagMsg(k);
        });
    },
    pickGpAmt: (v) => { const i=document.getElementById('wd-gp-amount'); if(i){ i.value=v; window.app.updateNet('gp', v); } },
    // ===== SAVED DETAILS (kept only in this browser's localStorage, per user) =====
    _wdKey: () => 'ff_wd_' + (window.db.user_uid || 'guest'),
    _wdLoad: () => { try { return JSON.parse(localStorage.getItem(window.app._wdKey()) || '{}') || {}; } catch(e){ return {}; } },
    _wdSave: (o) => { try { localStorage.setItem(window.app._wdKey(), JSON.stringify(o)); } catch(e){} },
    initWithdraw: () => {
        window.app.applyMins(); window.app.applyFlags();
        const sv = window.app._wdLoad(), $ = (id)=>document.getElementById(id);
                if(sv.upi){
            $('wd-upi-name').value = sv.upi.name||''; $('wd-upi-id').value = sv.upi.id||''; window.app.wdFmtUpi($('wd-upi-id'));
            $('wd-upi-saved-txt').innerText = (sv.upi.name?sv.upi.name+' · ':'')+sv.upi.id; $('wd-upi-saved').style.display='flex';
        } else $('wd-upi-saved').style.display='none';
        if(sv.last && document.getElementById('wd-card-'+sv.last)) window.app.selectWdMethod(sv.last);
    },
    removeSavedWd: (kind) => {
        const sv = window.app._wdLoad(); delete sv[kind]; if(sv.last===kind) delete sv.last; window.app._wdSave(sv);
        const $ = (id) => document.getElementById(id);
        $('wd-'+kind+'-saved').style.display='none';
        $('wd-upi-name').value=''; $('wd-upi-id').value=''; window.app.wdFmtUpi($('wd-upi-id'));
        window.ui.toast('Saved UPI details removed from this device.');
    },
    // ===== FORM HELPERS =====
    wdFmtUpi: (el) => {
        el.value = el.value.replace(/\s/g,'').toLowerCase();
        const hint = document.getElementById('wd-upi-hint'), v = el.value;
        el.classList.remove('valid','invalid'); hint.className='wd-hint';
        if(!v){ hint.innerText='Format: name@bank'; }
        else if(/^[a-z0-9.\-_]{2,64}@[a-z][a-z0-9]{1,30}$/.test(v)){ el.classList.add('valid'); hint.classList.add('ok'); hint.innerText='Valid UPI ID'; }
        else { el.classList.add('invalid'); hint.classList.add('err'); hint.innerText='Enter a valid UPI ID, e.g. name@okhdfcbank'; }
    },
    // ===== SUBMIT (shared by UPI + Bank) =====
    _submitWithdraw: async (kind, amt, btnId, build) => {
        const A = window.app;
        if(A.flagOff('wd')) return window.ui.toast(A.flagMsg('wd'));
        if(A.flagOff(kind)) return window.ui.toast(A.flagMsg(kind));
        if(amt<A.minWd()) return window.ui.toast(window.msg.withdraw.minAmount());
        if(amt>window.db.withdrawBalance) return window.ui.toast(window.msg.withdraw.insufficient(window.db.withdrawBalance));
        if(!A.rateLimit('withdraw',60000)) return;
        const btn=document.getElementById(btnId); if(btn) btn.disabled=true;
        window.ui.toast(window.msg.withdraw.processing());
        try {
            const b = build();
            // ONE server call: the server re-checks switches, limits and balance, takes the money and saves the request in a single atomic step
            const f = b.fields || {};
            const res = await api.post('/wallet/withdraw', { method: b.method, amount: amt, name: f.accountName, upiId: f.upiId });
            const curWd = Number(res.withdrawBalance) || 0, curDep = Number(res.depositBalance) || 0;
            // remember details on this device (if ticked)
            if(b.save){ const sv=A._wdLoad(); sv[kind]=b.save; sv.last=kind; A._wdSave(sv); }
            else if(kind==='gp'){ const sv=A._wdLoad(); sv.last='gp'; A._wdSave(sv); }
            window.ui.closeModal();
            A.endAction('withdraw',true);
            A.fetchUserData(); A.fetchTransactions();
            // 3-second coin animation (balance goes down, coin sound) -> success sheet
            await window.walletfx.withdraw(amt, curDep + (curWd-amt));
            A.showWithdrawSuccess(amt,{method:b.method,net:Number(res.net)||(b.noFee?amt:amt-2),ref:String(res.ref||'').toUpperCase()});
        } catch(e){
            A.endAction('withdraw',false);
            // Admin switched withdrawals OFF after this screen was opened -> the server refused it; show the admin's note
            if(A.geoBlocked && A.geoBlocked(e)) return;
            if(e && e.code==='disabled'){
                await A.refreshFlags(true);
                return window.ui.toast(e.message || A.flagMsg(A.flagOff('wd') ? 'wd' : kind));
            }
            window.ui.toast(e.message || ("Error: "+e));
        }
        finally { if(btn) btn.disabled=false; }
    },
    withdrawUPI: async () => {
        const name=document.getElementById('wd-upi-name').value.trim();
        const upi=document.getElementById('wd-upi-id').value.trim().toLowerCase();
        const amt=parseFloat(document.getElementById('wd-upi-amount').value);
        if(!name||!upi||!amt) return window.ui.toast(window.msg.withdraw.fillAll());
        if(name.length<3) return window.ui.toast(window.msg.withdraw.shortName());
        if(!/^[a-z0-9.\-_]{2,64}@[a-z][a-z0-9]{1,30}$/.test(upi)) return window.ui.toast(window.msg.withdraw.badUpi());
        const keep=document.getElementById('wd-upi-save').checked;
        return window.app._submitWithdraw('upi',amt,'wd-upi-btn',()=>({
            method:'UPI', masked:'UPI '+(upi.length>6?upi.slice(0,2)+'xxxx'+upi.slice(upi.indexOf('@')):upi),
            fields:{accountName:name, upiId:upi}, save: keep ? {name,id:upi} : null
        }));
    },
    // Google Play gift card: user only says how much; admin sends the redeem code later (shown in Wallet / Notifications)
    withdrawGP: async () => {
        const amt=parseFloat(document.getElementById('wd-gp-amount').value);
        if(!amt) return window.ui.toast('Enter how much gift code you want.');
        return window.app._submitWithdraw('gp',amt,'wd-gp-btn',()=>({
            method:'GIFTCARD', masked:'Google Play Gift Card', noFee:true,
            fields:{giftCard:'Google Play', giftValue:amt}, save:null
        }));
    },
});
