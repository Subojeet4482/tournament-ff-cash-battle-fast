/**
 * Emoji -> PNG. Replaces every colourful emoji in the page with a PNG picture (assets/emoji/<codepoints>.png),
 * so emoji look the same on every phone. Works on static HTML, on text set later by JS (toasts, chat, lists) and
 * keeps the real emoji in alt="" so copy/paste still gives the emoji. Inputs / textareas / <option> stay text.
 * Emoji that have no PNG in assets/emoji (or fail to load) simply stay normal text. Classic script (also used by the game iframes).
 */
(function () {
    if (window.__emojiPng) return;
    var cs = document.currentScript;
    var BASE = ((cs && cs.src) || '').replace(/js\/core\/emoji-png\.js.*$/, '') + 'assets/emoji/';
    var HAVE = {}; ('1f193 1f195 1f1ee-1f1f3 1f308 1f30a 1f30d 1f319 1f31f 1f32d 1f32e 1f32f 1f347 1f349 1f34c 1f34d 1f34e 1f351 1f352 1f353 1f354 1f355 1f356 1f357 1f35c 1f35d 1f35f 1f363 1f369 1f36a 1f36b 1f370 1f375 1f37a 1f37f 1f381 1f382 1f389 1f38a 1f396 1f39f 1f3a7 1f3ab 1f3ae 1f3af 1f3b0 1f3b2 1f3b3 1f3b5 1f3b6 1f3c0 1f3c1 1f3c5 1f3c6 1f3cf 1f3e0 1f3e6 1f3f8 1f40d 1f414 1f417 1f419 1f41d 1f422 1f426 1f427 1f428 1f42c 1f42d 1f42e 1f42f 1f430 1f431 1f433 1f434 1f435 1f436 1f437 1f438 1f439 1f43a 1f43b 1f43c 1f440 1f441 1f444 1f445 1f446 1f447 1f448 1f449 1f44a 1f44b 1f44c 1f44d 1f44e 1f44f 1f450 1f451 1f464 1f465 1f479 1f47a 1f47b 1f47d 1f47e 1f47f 1f480 1f485 1f48e 1f493 1f494 1f495 1f496 1f497 1f498 1f499 1f49a 1f49b 1f49c 1f49d 1f49e 1f4a1 1f4a2 1f4a3 1f4a4 1f4a5 1f4a6 1f4a7 1f4a8 1f4a9 1f4aa 1f4ab 1f4ac 1f4ad 1f4af 1f4b0 1f4b3 1f4b5 1f4b8 1f4bb 1f4c8 1f4c9 1f4cc 1f4de 1f4e2 1f4e3 1f4f1 1f501 1f504 1f50a 1f511 1f512 1f513 1f514 1f519 1f51d 1f525 1f52b 1f534 1f535 1f550 1f579 1f590 1f596 1f5a4 1f5e1 1f600 1f601 1f602 1f603 1f604 1f605 1f606 1f607 1f608 1f609 1f60a 1f60b 1f60c 1f60d 1f60e 1f60f 1f610 1f611 1f612 1f613 1f614 1f615 1f616 1f617 1f618 1f619 1f61a 1f61b 1f61c 1f61d 1f61e 1f61f 1f620 1f621 1f622 1f623 1f624 1f625 1f626 1f627 1f628 1f629 1f62a 1f62b 1f62c 1f62d 1f62e 1f62e-200d-1f4a8 1f62f 1f630 1f631 1f632 1f633 1f634 1f635 1f636 1f637 1f641 1f642 1f643 1f644 1f645 1f648 1f649 1f64a 1f64b 1f64c 1f64f 1f680 1f6a9 1f6e1 1f7e1 1f7e2 1f90c 1f90d 1f90e 1f90f 1f910 1f911 1f912 1f913 1f914 1f915 1f916 1f917 1f918 1f919 1f91a 1f91b 1f91c 1f91d 1f91e 1f91f 1f920 1f921 1f922 1f923 1f924 1f925 1f927 1f928 1f929 1f92a 1f92b 1f92c 1f92d 1f92e 1f92f 1f932 1f933 1f937 1f947 1f948 1f949 1f94a 1f964 1f965 1f96d 1f970 1f971 1f972 1f973 1f974 1f975 1f976 1f978 1f97a 1f981 1f984 1f985 1f988 1f989 1f98a 1f98b 1f996 1f9be 1f9d0 1f9e0 1f9e1 1f9e8 1f9e9 1f9fe 1f9ff 1fa96 1fa99 1fae1 1faf0 1faf6 23f0 23f3 2600 2615 261d 2620 2639 263a 265f 2694 26a0 26a1 26bd 2705 2709 270a 270b 270c 270d 2714 2716 2728 2744 274c 2753 2757 2763 2764 2795 2796 27a1 2b05 2b06 2b07 2b50 2b55').split(' ').forEach(function (n) { HAVE[n] = 1; });
    var BAD = {};
    var RX = /(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)\p{Emoji_Modifier}?(?:\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F?)\p{Emoji_Modifier}?)*)/gu;
    var QUICK = /[\u20E3\u2190-\u3299\uD83C-\uD83E]/;
    var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, NOSCRIPT: 1, TITLE: 1, HEAD: 1, CANVAS: 1 };

    function fname(e) {
        return Array.from(e).filter(function (c) { return c !== '\uFE0F'; })
            .map(function (c) { return c.codePointAt(0).toString(16); }).join('-');
    }
    function ok(el) {
        for (; el && el.nodeType === 1; el = el.parentNode) {
            if (SKIP[el.tagName] || el.isContentEditable || el.hasAttribute('data-emoji-raw')) return false;
        }
        return true;
    }
    function mk(e, n) {
        var i = document.createElement('img');
        i.className = 'emj'; i.alt = e; i.draggable = false; i.decoding = 'async'; i.src = BASE + n + '.png';
        i.onerror = function () { BAD[n] = 1; if (this.parentNode) this.parentNode.replaceChild(document.createTextNode(this.alt), this); };
        return i;
    }
    function convert(t) {
        var s = t.nodeValue;
        if (!s || !QUICK.test(s) || !t.parentNode || !ok(t.parentNode)) return;
        RX.lastIndex = 0;
        var m, last = 0, frag = null;
        while ((m = RX.exec(s))) {
            var n = fname(m[0]);
            if (!HAVE[n] || BAD[n]) continue;
            if (!frag) frag = document.createDocumentFragment();
            if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
            frag.appendChild(mk(m[0], n));
            last = m.index + m[0].length;
        }
        if (!frag) return;
        if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
        t.parentNode.replaceChild(frag, t);
    }
    function scan(root) {
        if (!root) return;
        if (root.nodeType === 3) { convert(root); return; }
        if (root.nodeType !== 1 && root.nodeType !== 11) return;
        if (root.nodeType === 1 && (SKIP[root.tagName] || root.tagName === 'IMG')) return;
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], n;
        while ((n = w.nextNode())) { if (QUICK.test(n.nodeValue)) list.push(n); }
        list.forEach(convert);
    }

    var queue = new Set(), pending = false;
    function flush() { pending = false; var q = Array.from(queue); queue.clear(); q.forEach(function (n) { if (n.isConnected !== false) scan(n); }); }
    function push(n) { queue.add(n); if (!pending) { pending = true; Promise.resolve().then(flush); } }

    window.__emojiPng = { scan: scan };
    function start() {
        scan(document.body);
        new MutationObserver(function (list) {
            for (var i = 0; i < list.length; i++) {
                var r = list[i];
                if (r.type === 'characterData') push(r.target);
                else for (var j = 0; j < r.addedNodes.length; j++) push(r.addedNodes[j]);
            }
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
