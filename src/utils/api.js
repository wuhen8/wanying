// src/utils/api.js
import { fetch } from '@tauri-apps/plugin-http';
import { useApiConfigStore } from '../stores/apiConfig'; 
import { searchContent as searchWoGG, detailContent as detailWoGG} from './wogg-spider.js';

/**
 * 通用的 Tauri Fetch 封装，适配 Tauri v2 API
 * @param {string} url - 完整的请求 URL
 * @param {object} options - 配置对象
 * @param {string} [options.method='GET'] - 请求方法 (GET, POST, etc.)
 * @param {object} [options.headers={}] - 请求头
 * @param {object} [options.query] - GET 请求的查询参数 (会被附加到URL上)
 * @param {object} [options.body] - POST 请求的 body 数据 (会被自动序列化为JSON)
 * @param {number} [options.timeout=20] - 超时时间 (秒)
 * @returns {Promise<object>} - Tauri fetch 的原始响应对象
 */
export async function universalFetch(url, options = {}) {
  const {
      method = 'GET',
      headers = {},
      query,
      body,
      timeout = 20
  } = options;

  const requestUrl = new URL(url);
  if (query) {
      Object.entries(query).forEach(([key, value]) => {
          requestUrl.searchParams.append(key, value);
      });
  }

  const requestOptions = {
      method: method.toUpperCase(),
      headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          ...headers,
      },
      timeout: timeout,
  };
  
  // *** 核心改动在这里 ***
  // 在 Tauri v2 中，你直接将 JS 对象赋给 body 即可，插件会自动处理
  if (method.toUpperCase() === 'POST' && body) {
      // console.log(JSON.stringify(body));
      requestOptions.body = JSON.stringify(body);
      // requestOptions.body = body; 
  }
  
  try {
      const response = await fetch(requestUrl.toString(), requestOptions);
      if (!response.ok) {
          console.error('Fetch error response:', response);
          console.log(await response.json());
          throw new Error(`请求失败，状态码: ${response.status}`);
      }
      return response;
  } catch (error) {
      // Tauri v2 的错误对象更规范
      if (error && error.message && error.message.includes('timeout')) {
          throw new Error(`请求超时 (${timeout}秒)`);
      }
      throw error;
  }
}

// src/utils/api.js -> searchAllSitesConcurrently

// 假设我们为不同 type 定义了不同的搜索处理器
// 将 searchSingleSite 重命名并作为 type 1 的处理器
async function searchByApiType1(site, keyword) {
  const url = `${site.api}?ac=detail&wd=${encodeURIComponent(keyword)}`;
  const response = await universalFetch(url, {}, 15000);

  if (!response.ok) {
    throw new Error(`请求 ${site.api} 失败，状态码: ${response.status}`);
  }
  
  return await response.json();
}

// 为其他 type 创建占位符 (placeholder) 函数
async function searchByType2(site, keyword) {
  console.log(`[搜索处理器] 正在使用 Type 2 处理器搜索 "${site.name}"，关键词: "${keyword}"`);
  // 这里未来将是 Type 2 的搜索逻辑，例如解析网页
  // 目前，我们让它返回一个空结果，并 resolve
  return Promise.resolve({ list: [] }); 
}

async function searchByType3(site, keyword) {
  console.log(`[搜索处理器] 正在使用 Type 3 处理器 for "${site.name}"`);
  // 根据 site.api 的值进行二次分发
  if (site.api === 'csp_WoGGGuard') {
    return searchWoGG(keyword, '1');
  }
  // 在这里可以为其他 type=3 的爬虫添加 else if
  throw new Error(`不支持的 Type 3 API: ${site.api}`);
}

/**
 * [核心函数] 并发搜索所有可用站点（可扩展版本）
 * @param {string} keyword - 搜索关键词
 * @param {Function} onResultFound - 每当一个站点返回结果时调用的回调函数
 * @param {Function} onProgress - 每当一个搜索任务完成时调用的回调函数
 * @returns {Promise<void>}
 */
export function searchAllSitesConcurrently(keyword, onResultFound, onProgress) {
  return new Promise((resolve) => {
    const apiStore = useApiConfigStore();
    
    // 步骤 1: 筛选出所有可搜索的站点
    const searchableSites = [...apiStore.sites].filter(site => site.searchable);

    const concurrencyLimit = apiStore.concurrencyLimit;
    let running = 0;
    let completed = 0;
    const total = searchableSites.length; // 总任务数是所有可搜索站点的数量

    if (total === 0) {
      if (onProgress) onProgress(0, 0);
      resolve();
      return;
    }
    if (onProgress) onProgress(completed, total);


    const runNext = () => {
      if (completed === total) {
        resolve();
        return;
      }
      
      while (running < concurrencyLimit && searchableSites.length > 0) {
        running++;
        const site = searchableSites.shift();
        
        // 步骤 2: 根据 site.type 选择合适的搜索任务 (Promise)
        let searchTask;
        switch (site.type) {
          case 1:
            if (site.api) {
              console.log(`[任务分发] 站点 "${site.name}" 使用 Type 1 处理器`);
              searchTask = searchByApiType1(site, keyword);
            } else {
              searchTask = Promise.reject(new Error(`Type 1 站点 "${site.name}" 缺少 api 地址`));
            }
            break;
          case 2:
            console.log(`[任务分发] 站点 "${site.name}" 使用 Type 2 处理器 (开发中)`);
            searchTask = searchByType2(site, keyword); // 调用占位符函数
            break;
          case 3:
            console.log(`[任务分发] 站点 "${site.name}" 使用 Type 3 处理器 (开发中)`);
            searchTask = searchByType3(site, keyword); // 调用占位符函数
            break;
          // ...可以继续添加 case 4, case 5...
          default:
            console.warn(`[任务分发] 站点 "${site.name}" 的 type 为 ${site.type}，没有对应的处理器。`);
            // 创建一个立即失败的 Promise，让流程继续
            searchTask = Promise.reject(new Error(`不支持的搜索类型: ${site.type}`));
        }

        // 步骤 3: 执行选择好的任务
        searchTask
          .then(response => {
            if (response && Array.isArray(response.list) && response.list.length > 0) {
              const resultsWithSource = response.list.map(item => ({
                ...item,
                sourceSite: site.name,
                sourceKey: site.key,
              }));
              onResultFound(resultsWithSource, site);
            }
          })
          .catch(error => {
            console.error(`[并发搜索] 处理 "${site.name}" 时出错:`, error.message);
          })
          .finally(() => {
            running--;
            completed++;
            if (onProgress) {
              onProgress(completed, total);
            }
            console.log(`[并发搜索] 进度: ${completed}/${total}`);
            runNext();
          });
      }
    };
    runNext();
  });
}

// ---------------------------------------------------------------------------
// 各种 Type 的详情处理器
// ---------------------------------------------------------------------------

async function getDetailByType1(site, videoId) {
  const url = `${site.api}?ac=detail&ids=${videoId}`;
  const response = await universalFetch(url);
  const data = await response.json();
  if (data && data.list && data.list.length > 0) {
      return data.list[0];
  }
  throw new Error('Type 1 API 返回的数据中没有找到视频详情。');
}

async function getDetailByType3(site, videoId) {
  console.log(`[详情处理器] 正在使用 Type 3 处理器 for "${site.name}"`);
  if (site.api === 'csp_WoGGGuard') {
      const result = await detailWoGG([videoId]);
      return result.list[0];
  }
  throw new Error(`不支持的 Type 3 API for details: ${site.api}`);
}

// ---------------------------------------------------------------------------
// 获取视频详情的统一入口
// ---------------------------------------------------------------------------

/**
* 根据指定的源和视频ID获取视频详情（统一分发）
* @param {string} videoId - 视频的 ID
* @param {string} sourceKey - 视频来源站点的 key
* @returns {Promise<object>} - 包含视频详情的 Promise
*/
export async function getVideoDetails(videoId, sourceKey) {
  const apiStore = useApiConfigStore();
  await apiStore.ensureReady();
  const targetSite = apiStore.sites.find(site => site.key === sourceKey);

  if (!targetSite) {
    throw new Error(`无法找到 key 为 "${sourceKey}" 的数据源。`);
  }

  console.log(`[详情分发] 获取 "${targetSite.name}" 的详情, Type: ${targetSite.type}`);

  // 使用 switch 进行分发
  switch (targetSite.type) {
      case 1:
          return getDetailByType1(targetSite, videoId);
      case 3:
          return getDetailByType3(targetSite, videoId);
      // 在这里可以为其他 type 添加 case
      default:
          throw new Error(`不支持为 Type ${targetSite.type} 的源获取详情。`);
  }
}

// 你可以在这里添加更多的 API 调用函数，例如获取分类、首页推荐等
export async function getConfigList(url) {
  const response = await universalFetch(url);
  if (!response.ok) {
    throw new Error(`网络错误: ${response.status} ${response.statusText}`);
  }
  return response.json();
}