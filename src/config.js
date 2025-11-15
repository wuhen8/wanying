// src/config.js

// 是否启用了 Tauri 环境？Tauri 会在 window 对象上注入 __TAURI__
export const IS_TAURI = !!window.__TAURI__;

// 跨域代理服务器地址 (仅在 Web 环境下调试时使用)
export const CORS_PROXY_URL = 'https://cors.686870.xyz/p/';

// API 的基础 URL
export const API_BASE_URL = CORS_PROXY_URL + 'https://www.mtvod.cc/api.php/provide/vod';

