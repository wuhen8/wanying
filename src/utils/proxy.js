// src/utils/proxy.js

/**
 * 为云盘链接创建一个 Tauri 代理 URL
 * @param {string} driverType - 驱动类型, e.g., 'quark', 'ali', 'uc'
 * @param {string} realUrl - 真实的媒体文件 URL
 * @param {object} headers - 请求真实 URL 所需的 Headers
 * @returns {string} - 格式化后的代理 URL, e.g., "stream://quark?url=..."
 */
export function createProxyUrl(driverType, realUrl, headers) {
    console.log(realUrl , headers,headers['Cookie'])
    if (!realUrl || !headers || !headers['Cookie']) {
        console.error("无法创建代理 URL：缺少 realUrl 或 cookie。");
        return '';
    }

    try {
        // 使用 btoa 进行 Base64 编码，并进行 URL Safe 转换
        const encodedUrl = btoa(realUrl)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        
        const encodedCookie = btoa(headers['Cookie'])
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        // 我们可以设计一个更通用的协议，比如 stream://{driverType}?params...
        return `http://${driverType}.proxy?url=${encodedUrl}&cookie=${encodedCookie}`;
        // return `stream://${driverType}?url=${encodedUrl}&cookie=${encodedCookie}`;

    } catch (error) {
        console.error("创建代理 URL 时编码失败:", error);
        return '';
    }
}