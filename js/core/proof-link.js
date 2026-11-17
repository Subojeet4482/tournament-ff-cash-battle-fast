/**
 * Entry points to the standalone Proofs page (/proof):
 *  - proof.open()                -> opens the public feed
 *  - Share button in the transaction sheet -> /proof?share=<transactionId>
 */
const eligible = (t) => {
    const D = window.msg.describe(t), type = String(t.type || '').toLowerCase(), kind = String(t.kind || '');
    if (D.status === 'pending' || D.status === 'processing') return false;
    if (type === 'game' && kind !== 'game_win' && kind !== 'prize' && !/^Match win/i.test(String(t.title || ''))) return false;
    return true;
};
window.proof = { open: () => { location.href = '/proof'; } };
const _open = window.app.openTrx;
window.app.openTrx = (id) => {
    _open(id);
    const t = (window.db.trx || []).find(x => x._id === id), b = document.getElementById('td-share'); if (!b) return;
    if (!t || !eligible(t)) { b.style.display = 'none'; return; }
    b.style.display = ''; b.innerHTML = t.isShared ? '<i class="fa-solid fa-pen"></i> Edit Proof' : '<img src="assets/img/proof/share.png" alt=""> Share as Proof';
    b.onclick = () => { location.href = '/proof?share=' + encodeURIComponent(id); };
};
