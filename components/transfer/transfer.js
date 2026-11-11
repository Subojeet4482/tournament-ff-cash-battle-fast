/**
 * Transfer money: recipient verify + send.
 */
import { api } from '../../js/core/api.js?v=fe39312af5';

Object.assign(window.app, {
    verifyRecipient: async (pid) => {
        const statusEl=document.getElementById('recipient-status'); window.app.recipientVerified=false; window.app.recipientUid=null;
        if(pid.length<5){ statusEl.innerHTML=""; return; }
        if(pid===(window.db.user_data.playerId||'')){ statusEl.innerHTML="<span class='text-danger'>Cannot send to self</span>"; return; }
        statusEl.innerHTML="<span class='text-muted'>Searching...</span>";
        try {
            const r=await api.get('/user/lookup',{playerId:pid});
            const esc=(x)=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
            if(r.found){ statusEl.innerHTML=`<span class="text-success"><i class="fa-solid fa-circle-check"></i> Found: <b>${esc(r.name||"User")}</b></span>`; window.app.recipientVerified=true; window.app.recipientUid=pid; }
            else { statusEl.innerHTML="<span class='text-danger'>Not found!</span>"; }
        } catch(e){ statusEl.innerHTML="<span class='text-danger'>Error</span>"; }
    },
    transfer: async () => {
        // SECURITY: one user cannot increase another user's balance (admin only).
        // A client-side P2P transfer cannot be made secure, so it is disabled.
        // (If needed, it must be done by an admin or a server-side function.)
        return window.ui.toast("Transfers are currently unavailable. Please contact support for help.");
        // eslint-disable-next-line no-unreachable
        try {
            const targetUid=window.app.recipientUid; const amount=parseFloat(document.getElementById('tr-amount').value);
            const note=document.getElementById('tr-note').value.trim(); const pass=document.getElementById('tr-pass').value;
            if(!targetUid||!amount||!pass) return window.ui.toast("Fill all fields");
        } catch(e){ window.ui.toast("Failed: "+e.message); }

    },
});
