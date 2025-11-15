// src/utils/cloud-dispatcher.js

import { useDriveConfigStore } from '../stores/driveConfig'; 
// 1. 导入所有需要支持的云盘驱动
import { AliDrive } from './ali-drive.js';
import { UCDrive } from './uc-drive.js';
import { QuarkDrive } from './quark-drive.js';



// 3. 创建并导出 Cloud 对象
export class Cloud {

    // 1. 私有字段，用来“记住”已经创建的实例 (备忘录)
    #quarkDriveInstance = null;
    #aliDriveInstance = null; // 为未来准备
    #driveStore = null;

    /**
     * 【全新】统一的初始化检查函数
     * 任何需要夸克 Cookie 的操作前都应调用此方法
     * @private
     */
    constructor() {

    }

    // 3. 【核心】智能的“Getter”方法，取代你的 _getAndValidateQuarkConfig
    async #getQuarkDrive() {
        // a. 如果实例已存在（已被“记住”），直接返回
        if (this.#quarkDriveInstance) {
            return this.#quarkDriveInstance;
        }

        // b. 首次调用，开始创建流程
        console.log("Lazy Instantiation: Creating QuarkDrive instance for the first time...");
        if (!this.#driveStore) {
            this.#driveStore = useDriveConfigStore();
        }
        
        const config = await this.#driveStore.getConfig('quark');

        // c. 【关键修复】如果配置无效，抛出错误，中断执行！
        if (!config || !config.cookie) {
            console.log(config);
            throw new Error("夸克 Cookie 未配置或无效，请在设置页面配置。");
        }

        // d. 创建实例，并把它“记住”在私有字段中
        this.#quarkDriveInstance = new QuarkDrive(config.cookie);
        return this.#quarkDriveInstance;
    }

    /**
     * 统一的播放内容获取入口
     * @param {string} flag - 播放源标识, e.g., "quark高清#01"
     * @param {string} id - 待解析的 ID, e.g., "文件ID++..." 或一个普通的 URL
     * @returns {Promise<{url: string>} - 一个包含可直接播放的 URL
     */
    async playerContent(flag, id) {

        // b. 根据 flag 将任务分发到正确的驱动
        if (flag.startsWith('quark')) {
            
            const drive = await this.#getQuarkDrive(); 
            const result = await drive.playerContent(id, flag);
            console.log(result)
            // 2. 检查 cookie 更新结果 (即使业务失败也要检查)
            if (result.updateResult && result.updateResult.updated) {
                console.log("Dispatcher detected cookie update. Syncing with Pinia store.");
                this.#driveStore.updateConfig('quark', result.updateResult.cookie);
            }
            return result.playerInfo;
        } else if (flag.startsWith('ali')) {
            return AliDrive.playerContent(id, flag);
        } else if (flag.startsWith('uc')) {
            return UCDrive.playerContent(id, flag);
        } else {
            // c. 如果是直链，我们需要自己判断类型并包装成统一格式
            let videoType = '';
            try {
                // 使用 new URL() 来安全地解析并检查路径名的扩展名
                const urlPath = new URL(id).pathname.toLowerCase();
                if (urlPath.endsWith('.m3u8')) {
                    videoType = 'm3u8';
                } else if (urlPath.endsWith('.mp4')) {
                    videoType = 'mp4';
                }
            } catch (e) {
                // 如果 id 是一个相对路径或无效的URL，回退到简单的字符串检查
                const lowerId = id.toLowerCase();
                if (lowerId.includes('.m3u8')) {
                    videoType = 'm3u8';
                } else if (lowerId.includes('.mp4')) {
                    videoType = 'mp4';
                }
            }
            
            // 确保返回的格式与云盘驱动的格式完全一致
            return {
                url: id,
                type: videoType
            };
        }
    }

    /**
     * 统一的详情页链接处理入口 (获取待解析的播放列表)
     * @param {Array<string>} shareLinks - 从爬虫（如 Wogg）获取的原始分享链接数组
     * @returns {Promise<string>} - 返回 '$$$' 分隔的、包含待解析 ID 的播放 URL 字符串
     */
    async detailContentVodPlayUrl(shareLinks) {
        if (typeof shareLinks === 'string') {
            return shareLinks;
        }
        const urls = [];
        for (const shareLink of shareLinks) {
            if (AliDrive.pattern.test(shareLink)) {
                // console.log("阿里",shareLink)
                // urls.push(await AliDrive.detailContentVodPlayUrl([shareLink]));
            } else if (QuarkDrive.pattern.test(shareLink)) {
                // console.log("夸克",shareLink);
                const drive = await this.#getQuarkDrive(); 
                urls.push(await drive.detailContentVodPlayUrl(shareLink));
                // console.log("夸克",shareLink)
                // urls.push(await this.quarkdrive.detailContentVodPlayUrl([shareLink]));
            } else if (UCDrive.pattern.test(shareLink)) {
                // console.log("UC",shareLink)
                // urls.push(await UCDrive.detailContentVodPlayUrl([shareLink]));
            } else {
                // 如果链接不匹配任何云盘，则认为它本身就是一个可播放的 URL
                urls.push(`原始链接$${shareLink}`);
            }
        }
        return urls.join('$$$');
    }
    
    /**
     * 统一的详情页播放源名称处理入口
     * @param {Array<string>} shareLinks - 原始分享链接数组
     * @returns {string} - 返回 '$$$' 分隔的播放源名称字符串
     */
    async detailContentVodPlayFrom(shareLinks) {
        // if (typeof shareLinks === 'string') {
        //     return shareLinks;
        // }
        const froms = [];
        let indexInWoggList = 0;
        for (const shareLink of shareLinks) {
            indexInWoggList++;
             if (AliDrive.pattern.test(shareLink)) {
                // froms.push(AliDrive.detailContentVodPlayFrom([shareLink]));
            } else if (QuarkDrive.pattern.test(shareLink)) {
                const drive = await this.#getQuarkDrive(); 
                froms.push(drive.detailContentVodPlayFrom(shareLink));
                // froms.push(this.quarkdrive.detailContentVodPlayFrom([shareLink]));
            } else if (UCDrive.pattern.test(shareLink)) {
                // froms.push(UCDrive.detailContentVodPlayFrom([shareLink], indexInWoggList));
            } else {
                froms.push('直链'); // 对于未知链接，给一个通用名称
            }
        }
        return froms.join('$$$');
    }
};