/**
 * Module manifest — ORDER MATTERS.
 * Objects like window.app / window.chat are created by the first file of a group
 * and extended by the rest, so keep each group in this order.
 */

// Core state
import './core/firebase.js?v=41f223a8d8';
import './core/api.js?v=41f223a8d8';
import './core/state.js?v=41f223a8d8';
import './core/verified.js?v=41f223a8d8';
import './core/fx.js?v=41f223a8d8';
import './core/sfx.js?v=41f223a8d8';
import './core/walletfx.js?v=41f223a8d8';
import './core/messages.js?v=41f223a8d8';
import './core/timers.js?v=41f223a8d8';

// Auth (creates window.auth, then extends it)
import '../pages/login/login.js?v=41f223a8d8';
import '../pages/register/register.js?v=41f223a8d8';
import '../pages/login/forgot.js?v=41f223a8d8';
import '../components/session/session.js?v=41f223a8d8';

// App core (creates window.app) + feature extensions
import './core/app.js?v=41f223a8d8';
import './core/auth-state.js?v=41f223a8d8';
import './core/geo.js?v=41f223a8d8';
import '../components/faq/faq.js?v=41f223a8d8';   // before refer.js (refer registers its FAQ topic)
import '../pages/setting/setting.js?v=41f223a8d8';
import '../pages/refer/refer.js?v=41f223a8d8';
import '../pages/setting/rules.js?v=41f223a8d8';
import '../components/gift/gift.js?v=41f223a8d8';
import '../components/roster/roster.js?v=41f223a8d8';
import '../pages/game/ball.js?v=41f223a8d8';
import '../components/notifications/notifications.js?v=41f223a8d8';
import '../components/ban-overlay/ban-overlay.js?v=41f223a8d8';
import '../pages/home/home.js?v=41f223a8d8';
import '../components/join/join.js?v=41f223a8d8';
import '../pages/match/match.js?v=41f223a8d8';
import '../pages/rank/rank.js?v=41f223a8d8';
import '../pages/wallet/wallet.js?v=41f223a8d8';
import '../components/transfer/transfer.js?v=41f223a8d8';
import '../components/deposit/deposit.js?v=41f223a8d8';
import '../pages/loading/loading.js?v=41f223a8d8';
import '../pages/withdrawal/withdrawal.js?v=41f223a8d8';
import '../pages/history/history.js?v=41f223a8d8';

// UI + navigation
import './core/ui.js?v=41f223a8d8';
import './core/nav.js?v=41f223a8d8';
import '../components/toast/notify.js?v=41f223a8d8';
import './core/polish.js?v=41f223a8d8';
import './core/live.js?v=41f223a8d8';

// Chat (all data comes from Server-3 through the load balancer API)
import '../pages/chat/chat-ui.js?v=41f223a8d8';
import '../pages/chat/chat-keep.js?v=41f223a8d8';
import '../pages/chat/chat-pro.js?v=41f223a8d8';
import './core/shortcuts.js?v=41f223a8d8';

// Shell behaviour
import './core/history-manager.js?v=41f223a8d8';
import '../components/header/header.js?v=41f223a8d8';
import '../components/drawer/drawer.js?v=41f223a8d8';
import '../components/trx-detail/trx-detail.js?v=41f223a8d8';

// Background services
import './core/auto-refresh.js?v=41f223a8d8';

// Boot
import './core/animate.js?v=41f223a8d8';

import './core/start.js?v=41f223a8d8';
