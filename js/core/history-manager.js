/**
 * Browser back-button handling (modals, drawer, pages).
 */
window.historyManager = {
    init: () => {
        history.replaceState({page:'home'},null,window.location.pathname+window.location.search);   // clean address: ffcashbattle.in (no #home)
        window.addEventListener('popstate',(event)=>{
            const state=event.state;
            if(window.__scBack){ window.__scBack=false; return; }          // the back we triggered ourselves when the scratch card was closed with its own button
            const sc=document.getElementById('sc-wrap');
            if(sc&&sc.classList.contains('on')){ window.refer.closeCard(true); return; }     // scratch card open -> back closes just the card
            const activeModal=document.querySelector('.modal-wrap.active');
            if(activeModal){ ui.closeModal(true); return; }
            const drawer=document.getElementById('drawer-wrapper');
            if(drawer.classList.contains('drawer-active')){ ui.toggleDrawer(true); return; }
            if(state&&state.drawer) return;      // came back from a sheet opened via the drawer: stay on the same page (do not jump to Home)
            if(state&&state.page) window.nav.renderPage(state.page); else window.nav.renderPage('home');
        });
    }
};
