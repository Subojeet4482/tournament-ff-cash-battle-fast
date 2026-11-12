/**
 * Module manifest — ORDER MATTERS.
 * Objects like window.app / window.chat are created by the first file of a group
 * and extended by the rest, so keep each group in this order.
 */

// Core state
import './core/firebase.js?v=2d72097ddc';
import './core/api.js?v=2d72097ddc';
import './core/state.js?v=2d72097ddc';
import './core/verified.js?v=2d72097ddc';
import './core/fx.js?v=2d72097ddc';
import './core/sfx.js?v=2d72097ddc';
import './core/walletfx.js?v=2d72097ddc';
import './core/messages.js?v=2d72097ddc';
import './core/timers.js?v=2d72097ddc';

// Auth (creates window.auth, then extends it)
import '../pages/login/login.js?v=2d72097ddc';
import '../pages/register/register.js?v=2d72097ddc';
import '../pages/login/forgot.js?v=2d72097ddc';
import '../components/session/session.js?v=2d72097ddc';

// App core (creates window.app) + feature extensions
import './core/app.js?v=2d72097ddc';
import './core/auth-state.js?v=2d72097ddc';
import './core/geo.js?v=2d72097ddc';
import '../components/faq/faq.js?v=2d72097ddc';   // before refer.js (refer registers its FAQ topic)
import '../pages/setting/setting.js?v=2d72097ddc';
import '../pages/refer/refer.js?v=2d72097ddc';
import '../pages/setting/rules.js?v=2d72097ddc';
import '../components/gift/gift.js?v=2d72097ddc';
import '../components/roster/roster.js?v=2d72097ddc';
import '../pages/game/ball.js?v=2d72097ddc';
import '../components/notifications/notifications.js?v=2d72097ddc';
import '../components/ban-overlay/ban-overlay.js?v=2d72097ddc';
import '../pages/home/home.js?v=2d72097ddc';
import '../components/join/join.js?v=2d72097ddc';
import '../pages/match/match.js?v=2d72097ddc';
import '../pages/rank/rank.js?v=2d72097ddc';
import '../pages/wallet/wallet.js?v=2d72097ddc';
import '../components/transfer/transfer.js?v=2d72097ddc';
import '../components/deposit/deposit.js?v=2d72097ddc';
import '../pages/loading/loading.js?v=2d72097ddc';
import '../pages/withdrawal/withdrawal.js?v=2d72097ddc';
import '../pages/history/history.js?v=2d72097ddc';

// UI + navigation
import './core/ui.js?v=2d72097ddc';
import './core/nav.js?v=2d72097ddc';
import '../components/toast/notify.js?v=2d72097ddc';
import './core/polish.js?v=2d72097ddc';
import './core/live.js?v=2d72097ddc';

// Chat (all data comes from Server-3 through the load balancer API)
import '../pages/chat/chat-ui.js?v=2d72097ddc';
import '../pages/chat/chat-keep.js?v=2d72097ddc';
import '../pages/chat/chat-pro.js?v=2d72097ddc';
import './core/shortcuts.js?v=2d72097ddc';

// Shell behaviour
import './core/history-manager.js?v=2d72097ddc';
import '../components/header/header.js?v=2d72097ddc';
import '../components/drawer/drawer.js?v=2d72097ddc';
import '../components/trx-detail/trx-detail.js?v=2d72097ddc';

// Background services
import './core/auto-refresh.js?v=2d72097ddc';

// Boot
import './core/animate.js?v=2d72097ddc';

import './core/start.js?v=2d72097ddc';
