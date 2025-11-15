// src/utils/ali-drive.js (修正版)

export const AliDrive = {
    pattern: /aliyundrive\.com|alipan\.com/,

    init(token) {
        console.log("AliDrive initialized.");
    },

    /**
     * [占位符] 获取待解析的播放列表字符串
     * @param {Array<string>} shareLinks
     * @returns {Promise<string>}
     */
    async detailContentVodPlayUrl(shareLinks) {
        console.warn("AliDrive.detailContentVodPlayUrl is not implemented.");
        return shareLinks.map(link => `阿里待开发$${link}`).join('$$$');
    },

    /**
     * [占位符] 获取播放源名称
     * @param {Array<string>} shareLinks
     * @returns {string}
     */
    detailContentVodPlayFrom(shareLinks) {
        console.warn("AliDrive.detailContentVodPlayFrom is not implemented.");
        return shareLinks.map(() => `阿里待开发`).join('$$$');
    },

    /**
     * [占位符] 获取真实播放链接
     * @param {string} id
     * @param {string} flag
     * @returns {Promise<object>}
     */
    async playerContent(id, flag) {
        console.warn("AliDrive.playerContent is not implemented.");
        throw new Error("阿里云盘功能待开发");
    }
};