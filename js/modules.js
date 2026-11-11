/**
 * Module manifest — ORDER MATTERS.
 * Objects like window.app / window.chat are created by the first file of a group
 * and extended by the rest, so keep each group in this order.
 */

// Core state
import './core/firebase.js?v=fe39312af5';
import './core/api.js?v=fe39312af5';
import './core/state.js?v=fe39312af5';
import './core/verified.js?v=fe39312af5';
import './core/fx.js?v=fe39312af5';
import './core/sfx.js?v=fe39312af5';
import './core/walletfx.js?v=fe39312af5';
import './core/messages.js?v=fe39312af5';
import './core/timers.js?v=fe39312af5';

// Auth (creates window.auth, then extends it)
import '../pages/login/login.js?v=fe39312af5';
import '../pages/register/register.js?v=fe39312af5';
import '../pages/login/forgot.js?v=fe39312af5';
import '../components/session/session.js?v=fe39312af5';

// App core (creates window.app) + feature extensions
import './core/app.js?v=fe39312af5';
import './core/auth-state.js?v=fe39312af5';
import './core/geo.js?v=fe39312af5';
import '../components/faq/faq.js?v=fe39312af5';   // before refer.js (refer registers its FAQ topic)
import '../pages/setting/setting.js?v=fe39312af5';
import '../pages/refer/refer.js?v=fe39312af5';
import '../pages/setting/rules.js?v=fe39312af5';
import '../components/gift/gift.js?v=fe39312af5';
import '../components/roster/roster.js?v=fe39312af5';
import '../pages/game/ball.js?v=fe39312af5';
import '../components/notifications/notifications.js?v=fe39312af5';
import '../components/ban-overlay/ban-overlay.js?v=fe39312af5';
import '../pages/home/home.js?v=fe39312af5';
import '../components/join/join.js?v=fe39312af5';
import '../pages/match/match.js?v=fe39312af5';
import '../pages/rank/rank.js?v=fe39312af5';
import '../pages/wallet/wallet.js?v=fe39312af5';
import '../components/transfer/transfer.js?v=fe39312af5';
import '../components/deposit/deposit.js?v=fe39312af5';
import '../pages/loading/loading.js?v=fe39312af5';
import '../pages/withdrawal/withdrawal.js?v=fe39312af5';
import '../pages/history/history.js?v=fe39312af5';

// UI + navigation
import './core/ui.js?v=fe39312af5';
import './core/nav.js?v=fe39312af5';
import '../components/toast/notify.js?v=fe39312af5';
import './core/polish.js?v=fe39312af5';
import './core/live.js?v=fe39312af5';

// Chat (all data comes from Server-3 through the load balancer API)
import '../pages/chat/chat-ui.js?v=fe39312af5';
import '../pages/chat/chat-keep.js?v=fe39312af5';
import '../pages/chat/chat-pro.js?v=fe39312af5';
import './core/shortcuts.js?v=fe39312af5';

// Shell behaviour
import './core/history-manager.js?v=fe39312af5';
import '../components/header/header.js?v=fe39312af5';
import '../components/drawer/drawer.js?v=fe39312af5';
import '../components/trx-detail/trx-detail.js?v=fe39312af5';

// Background services
import './core/auto-refresh.js?v=fe39312af5';

// Boot
import './core/animate.js?v=fe39312af5';

import './core/start.js?v=fe39312af5';
