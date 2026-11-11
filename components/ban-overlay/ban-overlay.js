/**
 * Ban screen.
 * Reads from the user doc: isBanned, bannedUntil ('permanent' | date), banDays (optional, days set by admin),
 * bannedAt (optional), banReason (optional), playerId.
 */
(function(){
    const DAY = 864e5;
    let tick = null, embers = false;

    const ms = (v) => {
        if(v===undefined || v===null || v==='' || v==='permanent') return 0;
        if(typeof v==='object'){
            if(typeof v.toMillis==='function') return v.toMillis();
            if(v.seconds!==undefined) return v.seconds*1000;
        }
        const t = new Date(v).getTime();
        return isNaN(t) ? 0 : t;
    };
    const pad = (n) => String(n).padStart(2,'0');
    const $ = (id) => document.getElementById(id);
    const pidOf = (d) => String((d && d.playerId) || (window.db.user_uid||'').slice(0,7) || '-');

    const left = (until) => {
        const s = Math.max(0, Math.floor((until - Date.now())/1000));
        return Math.floor(s/86400)+'d '+pad(Math.floor(s%86400/3600))+'h '+pad(Math.floor(s%3600/60))+'m '+pad(s%60)+'s';
    };

    const makeEmbers = () => {
        if(embers) return; embers = true;
        const ov = $('ban-overlay');
        for(let i=0;i<12;i++){
            const e = document.createElement('span'); e.className='bo-ember';
            const sz = 3+Math.random()*4;
            e.style.cssText = `left:${Math.random()*100}%;width:${sz}px;height:${sz}px;--dx:${Math.random()*60-30}px;animation-duration:${7+Math.random()*7}s;animation-delay:${1.5+Math.random()*6}s`;
            ov.appendChild(e);
        }
    };

    const stop = () => { if(tick){ clearInterval(tick); tick=null; } };

    Object.assign(window.app, {
        checkBan: (d) => {
            const ov = $('ban-overlay');
            const until = ms(d.bannedUntil);
            let banned = d.isBanned===true;
            if(banned && until && until < Date.now()) banned = false;   // auto-expire
            if(!banned){ ov.style.display='none'; stop(); return false; }

            const perm = !until;
            // days exactly as the admin set them
            let days = Number(d.banDays || d.bannedDays || 0);
            if(!perm && !days){
                const start = ms(d.bannedAt || d.bannedOn || d.banStart);
                days = start ? Math.round((until-start)/DAY) : Math.ceil((until-Date.now())/DAY);
            }
            if(!perm && days<1) days = 1;

            $('bo-pid').textContent = pidOf(d);
            $('bo-status').textContent = perm ? 'Account banned' : 'Temporarily banned';
            $('bo-title').textContent = perm ? 'You can’t play right now' : 'Take a break for now';
            $('bo-sub').textContent = perm
                ? 'Your account broke our fair play rules, so it has been removed from all tournaments.'
                : 'Your account is paused. You can join tournaments again when the timer ends.';
            $('bo-len').textContent = perm ? 'Permanent' : days+(days===1?' Day':' Days');
            $('bo-left-row').style.display = perm ? 'none' : 'flex';
            const reason = String(d.banReason || d.bannedReason || '').trim();
            $('bo-reason-row').style.display = reason ? 'flex' : 'none';
            $('bo-reason').textContent = reason;
            const tg = window.db.telegramSupport || {};
            $('bo-tg').style.display = (tg.link||'').trim() ? 'flex' : 'none';

            stop();
            if(!perm){
                $('bo-left').textContent = left(until);
                tick = setInterval(() => {
                    if($('ban-overlay').style.display==='none'){ stop(); return; }
                    if(until <= Date.now()){ window.app.checkBan(d); return; }   // timer finished -> unlock
                    $('bo-left').textContent = left(until);
                }, 1000);
            }
            makeEmbers();
            ov.style.display = 'flex';
            return true;
        },

        banCopy: () => {
            const b = $('bo-copy'), txt = $('bo-pid').textContent;
            try{ navigator.clipboard.writeText(txt); }catch(e){
                try{ const t=document.createElement('textarea'); t.value=txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }catch(_){}
            }
            b.classList.add('ok'); b.textContent='Copied';
            setTimeout(()=>{ b.classList.remove('ok'); b.textContent='Copy'; }, 1500);
        },

        banSupport: (kind) => {
            if(kind==='tg') return window.app.openTelegram();
            const text = encodeURIComponent('Hello, my account is banned. Player ID: '+$('bo-pid').textContent);
            const w = window.db.whatsappSupport || {};
            let link = (w.link||'').trim() || String(window.db.supportNumber||'').trim();
            if(!link) return window.app.openWhatsApp();
            if(!/^https?:\/\//i.test(link)){
                const n = link.replace(/[^0-9]/g,'');
                if(!n) return window.app.openWhatsApp();
                link = 'https://wa.me/'+n+'?text='+text;
            } else if(/wa\.me|whatsapp\.com/i.test(link) && !/[?&]text=/.test(link)){
                link += (link.indexOf('?')>-1 ? '&' : '?') + 'text=' + text;
            }
            window.open(link,'_blank');
        },
    });
})();
