/**
 * Kept only so older code calling window.autoRefresh does not break.
 * The 15 s refresh of the user data is now done by js/core/live.js (GET /user/sync every 8 s).
 */
window.autoRefresh = { start() {}, stop() {}, tick() { if (window.live && window.live.tick) window.live.tick(); } };
