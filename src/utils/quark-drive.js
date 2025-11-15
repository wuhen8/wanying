// src/utils/quark-drive.js

import { computed } from 'vue';
import { universalFetch } from './api.js';


/**
 * 内部工具函数，用于创建本地代理 URL
 * @param {string} realUrl - 真实的媒体文件 URL
 * @param {object} headers - 请求真实 URL 所需的 Headers
 * @returns {string} - 格式化后的代理 URL
 */
function createProxyUrl(realUrl, headers) {
    const cookieToEncode = headers['Cookie'] || '';
    if (!realUrl || !cookieToEncode) {
        console.error("无法创建代理 URL：缺少 realUrl 或 Cookie。");
        return '';
    }

    try {
        const encodedUrl = btoa(realUrl)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        
        const encodedCookie = btoa(cookieToEncode)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        // 返回指向本地 warp 代理服务器的 URL
        return `http://127.0.0.1:7878/proxy?url=${encodedUrl}&cookie=${encodedCookie}`;
    } catch (error) {
        console.error("创建代理 URL 时编码失败:", error);
        return '';
    }
}
// ---------------------------------------------------------------------------
// QuarkDrive 的 JavaScript 实现
// ---------------------------------------------------------------------------
export class QuarkDrive {
    static pattern = /pan\.quark\.cn\/s\//;
    constructor(cookie) {
        this.apiUrl = "https://drive-pc.quark.cn/1/clouddrive/";
        // this.pattern = /pan\.quark\.cn\/s\//;
        if (!cookie) throw new Error("API requires a cookie.");
        
        // --- 实例属性 ---
        // cookie 属于这个实例
        this.cookie = cookie;

        // 缓存也必须属于这个实例！
        // 每个 new QuarkApi() 都会得到一个全新的、干净的 cache。
        this.shareTokenCache = new Map();
        this.isVip = false; // VIP 状态也与具体用户有关
        
        this.saveDirName = 'temptv1';
        this.saveDirFidCache = null;
        this.saveFileIdCaches = new Map();
        this.isCookieUpdated = false;
    }

    getHeaders() {
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36 Channel/pckk_other_ch',
            'Referer': 'https://pan.quark.cn/',
            'Origin': 'https://pan.quark.cn',
            'Content-Type': 'application/json',
            'Cookie': this.cookie,
        };
    }

    async _request(urlPath, params = null, data = null, method = 'POST') {
        const url = this.apiUrl + urlPath;
        const options = {
            method: method,
            headers: this.getHeaders(),
            query: { ...params, pr: 'ucpro', fr: 'pc' },
            body: data,
        };
        try {
            const response = await universalFetch(url, options);
            // console.log(response.headers.get('Set-Cookie'));
            const setCookieHeader = response.headers.get('Set-Cookie');
            this.updateCookie(setCookieHeader); // This returns { updated: boolean, cookie: string }
            return await response.json();
        } catch (error) {
            console.error(`[QuarkApi] Request to ${urlPath} failed:`, error.message);
            throw error;
        }
    }
    
    /**
     * [辅助方法] 从 cookie 字符串中提取指定 key 的值。
     * @param {string} key - 要查找的 cookie 名称 (例如 '__puus').
     * @param {string} cookieString - 完整的 cookie 或 Set-Cookie 字符串.
     * @returns {string|null} - 返回找到的值，如果未找到则返回 null.
     * @private
     */
    _getCookieValue(key, cookieString) {
        if (!cookieString) {
            return null;
        }
        // 使用正则表达式来精确匹配 'key=' 直到下一个分号或字符串结尾
        // new RegExp() 允许我们动态构建正则表达式
        const regex = new RegExp(`${key}=([^;]*)`);
        const match = cookieString.match(regex);
        
        // match[0] 是整个匹配项 (e.g., "__puus=..."), match[1] 是捕获组的内容
        return match ? match[1] : null;
    }

    /**
     * 根据 Set-Cookie 响应头更新实例的 cookie。
     * 核心逻辑：提取、比较、替换。
     * @param {string | null | undefined} setCookieHeader - 从 response.headers.get('Set-Cookie') 获取的字符串.
     * @returns {{updated: boolean, cookie: string}} - 返回一个对象，
     *   - `updated`: (boolean) 指示 cookie 是否被实际更新。
     *   - `cookie`: (string) 返回当前（可能已更新）的 cookie 字符串。
     */
    updateCookie(setCookieHeader) {
        // 1. 如果响应头为空或不存在，则不进行任何操作
        if (!setCookieHeader) {
            return { updated: false, cookie: this.cookie };
        }

        // 2. 从响应头中提取新的 __puus 值
        const newPuusValue = this._getCookieValue('__puus', setCookieHeader);

        // 3. 如果响应头中没有 __puus，则不进行任何操作
        if (!newPuusValue) {
            return { updated: false, cookie: this.cookie };
        }

        // 4. 获取当前存储的旧 __puus 值
        const oldPuusValue = this._getCookieValue('__puus', this.cookie);

        // 5. 验证新旧值是否一致
        if (newPuusValue === oldPuusValue) {
            return { updated: false, cookie: this.cookie };
        }
        
        // 如果旧值存在，用新值替换；否则（虽然不太可能），在末尾添加
        if (oldPuusValue) {
            // 使用 String.prototype.replace 进行替换
            this.cookie = this.cookie.replace(`__puus=${oldPuusValue}`, `__puus=${newPuusValue}`);
        } else {
            // 如果原始cookie中没有__puus，则在末尾追加
            this.cookie = `${this.cookie}; __puus=${newPuusValue}`;
        }
        this.isCookieUpdated = true;
        
        // 7. 返回更新成功状态和新的 cookie
        // return { updated: true, cookie: this.cookie };
    }

    getShareData(url) {
        const match = url.match(/https:\/\/pan\.quark\.cn\/s\/([^\/|#]+)/);
        if (match) return { shareId: match[1], folderId: '0', sharePwd: '' };
        return null;
    }
    
    async getShareToken(shareData) {
        if (this.shareTokenCache.has(shareData.shareId)) return;
        
        const responseJson = await this._request('share/sharepage/token', null, { pwd_id: shareData.shareId, passcode: shareData.sharePwd }, 'POST');

        if (responseJson.data && responseJson.data.stoken) {
            this.shareTokenCache.set(shareData.shareId, responseJson.data);
        } else {
            throw new Error(`获取 stoken 失败: ${responseJson.message || '未知错误'}`);
        }
    }

    /** *** 递归函数，用于深度遍历文件夹 ***
     * item.file === true && item.obj_category === 'video' && item.size > 1024 * 1024 * 5
     */
    async _listFileRecursive(shareData, stokenData, folderId) {
        const params = {
            pwd_id: shareData.shareId,
            stoken: stokenData.stoken,
            pdir_fid: folderId,
            _page: 1,
            _size: 200, // 假设单页足够，简化分页逻辑
        };
        
        const responseJson = await this._request('share/sharepage/detail', params, null, 'GET');
        
        let videos = [];
        const subDirFids = [];

        if (responseJson.data && Array.isArray(responseJson.data.list)) {
            for (const item of responseJson.data.list) {
                if (item.dir === true) {
                    subDirFids.push(item.fid);
                } else if (item.file === true && item.obj_category === 'video' && item.size > 1024 * 1024 * 5) {
                    videos.push({
                        ...item,
                        stoken: stokenData.stoken,
                        share_id: shareData.shareId,
                    });
                }
            }
        }

        // 并发地递归请求所有子文件夹
        const subFolderPromises = subDirFids.map(subFid => 
            this._listFileRecursive(shareData, stokenData, subFid)
        );
        
        const subFolderResults = await Promise.all(subFolderPromises);
        
        // 将所有递归结果合并到当前结果中
        // subFolderResults 是一个数组的数组，例如 [[video1], [video2, video3]]
        // 使用 .flat() 将其展平
        const flattenedSubFolderVideos = subFolderResults.flat();
        
        return videos.concat(flattenedSubFolderVideos);
    }

    /**
     * [最终修正] 清空指定目录
     * 严格遵循Java代码的实现逻辑，使用 'file/sort' 端点
     */
    async _clearSaveDir() {
        if (!this.saveDirFidCache) {
            return;
        }
        
        try {
            // 1. 列出目录下的所有文件和文件夹
            // 严格使用Java代码中的 'file/sort' 端点
            const listResponse = await this._request(
                'file/sort', 
                { 
                    pdir_fid: this.saveDirFidCache, 
                    _page: 1, 
                    _size: 200, 
                    _sort: 'file_type:asc,updated_at:desc' 
                },
                null, 
                'GET'
            );
            
            if (listResponse.data?.list && listResponse.data.list.length > 0) {
                // 2. 收集所有fid
                const fids = listResponse.data.list.map(item => item.fid);

                // 3. 调用删除API，精确模拟Java代码的请求体
                await this._request(
                    'file/delete',
                    null,
                    {
                        "action_type": 2,
                        "filelist": fids, 
                        "exclude_fids": []
                    },
                    'POST'
                );
                
                // console.log(`[QuarkApi] 已发送清空目录 '${this.saveDirName}' 的请求。`);
            } else {
                // console.log(`[QuarkApi] 目录 '${this.saveDirName}' 为空，无需清空。`);
            }
        } catch (e) {
            console.error('[QuarkApi] 清空目录时发生错误:', e);
        }
    }


    /**
     * [已修正] 查找或创建保存目录
     * 对应 Java 的 createSaveDir
     */
    async _getOrCreateSaveDirFid(clean) {
        if (this.saveDirFidCache) {
            if (clean) await this._clearSaveDir();
            return this.saveDirFidCache;
        }

        try {
            // 1. 查找目录，使用与Java代码一致的 'file/sort' 端点
            const listResponse = await this._request(
                'file/sort', 
                { pdir_fid: "0", _page: 1, _size: 200, _sort: 'file_type:asc,updated_at:desc' }, 
                null, 
                'GET'
            );
            
            if (listResponse.data?.list) {
                const tempDir = listResponse.data.list.find(item => item.dir === true && item.file_name === this.saveDirName);
                if (tempDir) {
                    this.saveDirFidCache = tempDir.fid;
                    if (clean) await this._clearSaveDir();
                    return this.saveDirFidCache;
                }
            }
            const createResponse = await this._request(
                'file', // 端点是 'file?'
                null, 
                {
                    pdir_fid: "0",
                    file_name: this.saveDirName,
                    dir_path: "",
                    dir_init_lock: "false"
                }, 
                'POST'
            );

            if (createResponse.data?.fid) {
                this.saveDirFidCache = createResponse.data.fid;
                return this.saveDirFidCache;
            } else {
                 throw new Error(`创建目录 '${this.saveDirName}' 失败: ${createResponse.message}`);
            }
        } catch (error) {
            console.error(`[QuarkApi] 获取或创建保存目录时出错:`, error);
            return "0"; // 错误时回退到根目录
        }
    }

    /**
     * listFile 的入口函数，负责启动递归
     */
    async listFile(shareData) {
        await this.getShareToken(shareData);
        const stokenData = this.shareTokenCache.get(shareData.shareId);
        if (!stokenData) throw new Error("获取 stoken 失败，无法列出文件。");

        // 从根目录 (folderId: '0') 开始递归
        const allVideos = await this._listFileRecursive(shareData, stokenData, shareData.folderId);
        
        return { videos: allVideos, subtitles: [] };
    }
    
    async getVod(shareData) {
        const { videos } = await this.listFile(shareData);
        if (videos.length === 0) return { vod_play_url: '' };
        const playUrl = videos.map(video => `${video.file_name}$${video.fid}++${video.share_fid_token || ''}++${video.share_id}++${video.stoken}`).join('#');
        return { vod_play_url: playUrl };
    }

    /**
     * 转存文件到自己的网盘，对应 Java 的 save()
     */
    async _saveFile(shareId, stoken, fileId, fileToken, clean) {
        // ... (需要实现 createSaveDir 逻辑，这里简化)
        // const to_pdir_fid = "a80daf11efd34a1d9eadf8c3aedfb126";
        const to_pdir_fid = await this._getOrCreateSaveDirFid(clean);

        const responseJson = await this._request(
            'share/sharepage/save', null, 
            {
                fid_list: [fileId],
                fid_token_list: [fileToken],
                to_pdir_fid: to_pdir_fid,
                pwd_id: shareId,
                stoken: stoken,
            }, 'POST'
        );

        if (responseJson.data?.task_id) {
            // Java 代码中有轮询检查任务状态的逻辑，这里简化为等待固定时间
            await new Promise(resolve => setTimeout(resolve, 1500)); // 等待1.5秒
            const taskResponse = await this._request('task', { task_id: responseJson.data.task_id }, null, 'GET');
            if (taskResponse.data?.save_as?.save_as_top_fids?.[0]) {
                return taskResponse.data.save_as.save_as_top_fids[0];
            }
        }
        throw new Error("转存文件失败");
    }

    /**
     * 获取转码流，对应 getLiveTranscoding()
     */
    async getLiveTranscoding(saveFileId) {
        const responseJson = await this._request(
            'file/v2/play', null,
            { fid: saveFileId, resolutions: "normal,low,high,super,2k,4k" },
            'POST'
        );
        if (responseJson.data?.video_list?.[0]?.video_info?.url) {
            // 简化：直接返回第一个可用的播放链接
            return responseJson.data.video_list[0].video_info.url;
        }
        throw new Error("获取转码链接失败");
    }

    // 这个方法现在只处理一个链接，职责非常清晰
    async detailContentVodPlayUrl(shareLink) { // <--- 参数从 shareLinks 数组变为 shareLink 字符串
        const shareData = this.getShareData(shareLink);
        if (shareData) {
            try {
                const vod = await this.getVod(shareData);
                return vod.vod_play_url; // <--- 直接返回处理结果字符串
            } catch (error) {
                console.error(`处理夸克链接 ${shareLink} 失败:`, error);
                return `处理失败$${shareLink}`; // <--- 返回失败结果字符串
            }
        }
        // 如果 getShareData 失败，可以返回一个空字符串或错误提示
        return `无效夸克链接$${shareLink}`;
    }

    detailContentVodPlayFrom(shareLinks) {
        const playFrom = [];
        console.log(shareLinks)
        for (let i = 1; i <= shareLinks.length; i++) {
            const formats = this.isVip ? ["4K", "超清", "高清", "普画"] : ["普画"];
            for (const format of formats) {
                 const iStr = i.toString().padStart(2, '0');
                 playFrom.push(`quark${format}#${iStr}`);
            }
        }
        return playFrom.join('$$$');
    }

    // *** 修改：playerContent 函数，让它返回 saveFileId ***
    async playerContent(id, flag) {
        // 4. 在业务流程开始时，重置状态标记
        this.isCookieUpdated = false;
        const parts = id.split('++');
        const [fileId, fileToken, shareId, stoken] = parts;

        // 1. 检查文件ID缓存，避免重复转存
        let saveFileId = this.saveFileIdCaches.get(fileId);
        if (!saveFileId) {
            // Java代码逻辑是在播放新内容时清空目录
            const cleanDir = true; 
            saveFileId = await this._saveFile(shareId, stoken, fileId, fileToken, cleanDir);
            if (!saveFileId) throw new Error("转存文件失败，无法获取 saveFileId");
            this.saveFileIdCaches.set(fileId, saveFileId);
        }
        
        console.log(`[QuarkApi] 文件转存ID (来自缓存或新建): ${saveFileId}`);

        const playUrl = await this.getLiveTranscoding(saveFileId);
        if (!playUrl) {
            // 如果获取播放链接失败，最好也把刚刚转存的文件删掉
            await this.deleteFile([saveFileId]); 
            throw new Error("从夸克获取播放链接失败，已清理转存文件");
        }

        let videoType = 'mp4';
        if (playUrl.includes('.m3u8')) {
            videoType = 'm3u8';
        }

        // console.log(playUrl,this.getHeaders());
        
        const proxyUrl = createProxyUrl(playUrl, this.getHeaders());

        // 2. 在返回的对象中，增加 saveFileId 和 来源标识 (drive)
        const playerInfo = {
            url: proxyUrl,
            type: videoType,
            // --- 关键新增字段 ---
            drive: 'quark',    // 标识这是哪个云盘，方便Dispatcher和上层调用
            saveFileId: saveFileId // 将转存后的文件ID传出去
        };

        return {
            playerInfo: playerInfo,
            updateResult: {
                updated: this.isCookieUpdated,
                cookie: this.cookie // 总是返回最新的 cookie
            }
        };
    }

};