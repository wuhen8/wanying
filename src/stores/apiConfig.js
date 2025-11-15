// src/stores/apiConfig.js
import { getConfigList } from '../utils/api';
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const CONFIG_URL_STORAGE_KEY = 'my-app-config-url';
const CURRENT_SITE_KEY_STORAGE_KEY = 'current-api-site-key';
const CONCURRENCY_LIMIT_KEY = 'my-app-concurrency-limit'; // 新增 Key for 并发数
const DEFAULT_CONFIG_URL = ''; // <<-- 替换成你的默认配置URL

export const useApiConfigStore = defineStore('apiConfig', () => {
  // --- State ---
  const configUrl = ref('');
  const sites = ref([]);
  const currentSiteKey = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const concurrencyLimit = ref(3); // 默认并发数为 3

  // --- Getters (Computed) ---
  const currentSite = computed(() => sites.value.find(site => site.key === currentSiteKey.value));
  const apiBaseUrl = computed(() => currentSite.value?.api || null);

  const isReady = ref(false); // 标志配置是否已加载
  let loadingPromise = null;  // 用于存储正在进行的加载 Promise


  // --- Actions ---

  /**
   * 从 configUrl 异步加载配置
   */
  async function _loadConfigurationLogic() {
    const savedUrl = localStorage.getItem(CONFIG_URL_STORAGE_KEY);
    configUrl.value = savedUrl || DEFAULT_CONFIG_URL;

    // 加载并发数设置
    const savedLimit = localStorage.getItem(CONCURRENCY_LIMIT_KEY);
    if (savedLimit) {
      concurrencyLimit.value = parseInt(savedLimit, 10);
    }

    if (!configUrl.value) {
      error.value = '未设置配置接口地址。';
      return;
    }

    loading.value = true;
    error.value = null;
    sites.value = [];

    try {
      
      const data = await getConfigList(configUrl.value);

      if (!data.sites || !Array.isArray(data.sites)) {
        throw new Error('获取到的配置格式不正确，缺少 "sites" 数组。');
      }

      sites.value = data.sites;

      const savedSiteKey = localStorage.getItem(CURRENT_SITE_KEY_STORAGE_KEY);
      if (savedSiteKey && sites.value.some(site => site.key === savedSiteKey)) {
        currentSiteKey.value = savedSiteKey;
      } else if (sites.value.length > 0) {
        currentSiteKey.value = sites.value[0].key;
      } else {
        currentSiteKey.value = null;
      }

    } catch (e) {
      console.error('加载配置失败:', e);
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 确保配置已加载的“守卫”方法
   * @public
   */
  function ensureReady() {
    // 如果已经就绪，直接返回一个已解决的 Promise
    if (isReady.value) {
      return Promise.resolve();
    }
    // 如果正在加载中，返回正在进行的 Promise，让调用者可以等待它完成
    if (loadingPromise) {
      return loadingPromise;
    }
    // 如果从未加载，则启动加载过程
    loadingPromise = new Promise(async (resolve, reject) => {
      try {
        await _loadConfigurationLogic();
        isReady.value = true;
        resolve();
      } catch (e) {
        error.value = e.message;
        reject(e);
      } finally {
        // 加载结束后，清空 promise 变量
        loadingPromise = null;
      }
    });
    return loadingPromise;
  }

  /**
   * 设置新的配置 URL，并触发重新加载
   * @param {string} newUrl
   */
  function setConfigUrlAndReload(newUrl) {
    configUrl.value = newUrl;
    localStorage.setItem(CONFIG_URL_STORAGE_KEY, newUrl);
    localStorage.removeItem(CURRENT_SITE_KEY_STORAGE_KEY);
    _loadConfigurationLogic()
  }

  /**
   * 在当前已加载的站点列表中切换站点
   * @param {string} siteKey
   */
  function setCurrentSite(siteKey) {
    currentSiteKey.value = siteKey;
    localStorage.setItem(CURRENT_SITE_KEY_STORAGE_KEY, siteKey);
  }
  
  /**
   * 设置并发数并保存
   * @param {number} limit
   */
  function setConcurrencyLimit(limit) {
    const newLimit = Math.max(1, limit);
    concurrencyLimit.value = newLimit;
    localStorage.setItem(CONCURRENCY_LIMIT_KEY, newLimit.toString());
  }

  return {
    configUrl,
    sites,
    currentSiteKey,
    loading,
    error,
    currentSite,
    apiBaseUrl,
    concurrencyLimit,
    isReady,
    ensureReady,
    setConfigUrlAndReload,
    setCurrentSite,
    setConcurrencyLimit,
  };
});