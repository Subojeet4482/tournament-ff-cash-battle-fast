/**
 * Module manifest — ORDER MATTERS.
 * Objects like window.app / window.chat are created by the first file of a group
 * and extended by the rest, so keep each group in this order.
 */

// Core state
import './core/firebase.js?v=684982f88b';
import './core/api.js?v=684982f88b';
import './core/state.js?v=684982f88b';
import './core/verified.js?v=684982f88b';
import './core/badwords.js?v=684982f88b';
import './core/fx.js?v=684982f88b';
import './core/sfx.js?v=684982f88b';
import './core/walletfx.js?v=684982f88b';
import './core/messages.js?v=684982f88b';
import './core/timers.js?v=684982f88b';

// Auth (creates window.auth, then extends it)
import '../pages/login/login.js?v=684982f88b';
import '../pages/register/register.js?v=684982f88b';
import '../pages/login/forgot.js?v=684982f88b';
import '../components/session/session.js?v=684982f88b';

// App core (creates window.app) + feature extensions
import './core/app.js?v=684982f88b';
import './core/auth-state.js?v=684982f88b';
import './core/geo.js?v=684982f88b';
import '../components/faq/faq.js?v=684982f88b';   // before refer.js (refer registers its FAQ topic)
import '../pages/setting/setting.js?v=684982f88b';
import '../pages/refer/refer.js?v=684982f88b';
import '../pages/setting/rules.js?v=684982f88b';
import '../components/gift/gift.js?v=684982f88b';
import '../components/roster/roster.js?v=684982f88b';
import '../pages/game/ball.js?v=684982f88b';
import '../components/notifications/notifications.js?v=684982f88b';
import '../components/ban-overlay/ban-overlay.js?v=684982f88b';
import '../pages/home/home.js?v=684982f88b';
import '../components/join/join.js?v=684982f88b';
import '../pages/match/match.js?v=684982f88b';
import '../pages/rank/rank.js?v=684982f88b';
import '../pages/wallet/wallet.js?v=684982f88b';
import '../components/transfer/transfer.js?v=684982f88b';
import '../components/deposit/deposit.js?v=684982f88b';
import '../pages/loading/loading.js?v=684982f88b';
import '../pages/withdrawal/withdrawal.js?v=684982f88b';
import '../pages/history/history.js?v=684982f88b';

// UI + navigation
import './core/ui.js?v=684982f88b';
import './core/nav.js?v=684982f88b';
import '../components/toast/notify.js?v=684982f88b';
import './core/polish.js?v=684982f88b';
import './core/live.js?v=684982f88b';

// Chat (all data comes from Server-3 through the load balancer API)
import '../pages/chat/chat-ui.js?v=684982f88b';
import '../pages/chat/chat-keep.js?v=684982f88b';
import '../pages/chat/chat-pro.js?v=684982f88b';
import './core/shortcuts.js?v=684982f88b';

// Shell behaviour
import './core/history-manager.js?v=684982f88b';
import '../components/header/header.js?v=684982f88b';
import '../components/drawer/drawer.js?v=684982f88b';
import '../components/trx-detail/trx-detail.js?v=684982f88b';
import './core/proof-link.js?v=684982f88b';   // Proofs entry points (must come after trx-detail)

// Background services
import './core/auto-refresh.js?v=684982f88b';

// Boot
import './core/animate.js?v=684982f88b';

import './core/start.js?v=684982f88b';
