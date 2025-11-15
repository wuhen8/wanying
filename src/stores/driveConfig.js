// src/stores/apiConfig.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { readTextFile, writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appConfigDir, join } from '@tauri-apps/api/path';

const QUARK_CONFIG_FILE = 'quark.json';
const ALI_CONFIG_FILE = 'ali.json'; // 预留
const UC_CONFIG_FILE = 'uc.json';   // 预留

// 辅助函数：确保配置目录存在 (使用新的 API，但逻辑不变)
const ensureConfigDir = async () => {
  try {
      const configPath = await appConfigDir();
      
      // 检查目录是否存在
      const dirExists = await exists(configPath);
      
      if (!dirExists) {
          await mkdir(configPath, { recursive: true });
          console.log('配置目录已创建:', configPath);
      }
  } catch (e) {
      console.error("无法创建应用配置目录:", e);
      throw e;
  }
};

export const useDriveConfigStore = defineStore('driveConfig', () => {
  // --- State ---
  const configs = ref({
    quark: null,
    ali: null,
    uc: null,
  });

  /**
   * 【推荐】智能的统一配置获取入口 (Smart Getter)
   * @description 如果配置已在内存中，则立即返回；否则，从文件加载并缓存。
   * @param {string} provider - 'quark', 'ali', 'uc'
   * @returns {Promise<object|null>} - 返回配置对象，如果不存在或失败则返回 null
   */
  async function getConfig(provider) {
    // 1. 检查内存缓存
    if (configs.value[provider]) {
      console.log(`[Store] Returning cached config for '${provider}'.`);
      return configs.value[provider];
    }

    // 2. 缓存未命中，调用内部加载函数
    console.log(`[Store] Cache miss for '${provider}'. Loading from file...`);
    return await _loadConfig(provider);
  }

  /**
   * 【新增】统一的读取配置入口（使用 Tauri v2 API）
   * @param {string} provider - 'quark', 'ali', 'uc'
   * @returns {Promise<object|null>} - 返回配置对象，如果不存在或失败则返回 null
   */
  async function _loadConfig(provider) {
      let fileName;
      if (provider === 'quark') fileName = QUARK_CONFIG_FILE;
      else if (provider === 'ali') fileName = ALI_CONFIG_FILE;
      else if (provider === 'uc') fileName = UC_CONFIG_FILE;
      else {
          console.error('未知的提供商:', provider);
          return null;
      }

      try {
          // 获取配置目录路径
        //   const configDir = await appConfigDir();
          
        //   // 拼接完整文件路径
        //   const filePath = await join(configDir, fileName);
          
        //   // 检查文件是否存在
        //   const fileExists = await exists(filePath);
        //   if (!fileExists) {
        //       console.log(`${provider} 配置文件不存在`);
        //       return null;
        //   }
          
        //   // 读取文件内容
        //   const content = await readTextFile(filePath);
          
          const content = localStorage.getItem(provider);
          const configData = JSON.parse(content);
          configs.value[provider] = configData; // 更新缓存
          return configData;
      } catch (e) {
          // 文件不存在或解析失败是正常情况（用户还未配置）
          console.log(`未能加载 ${provider} 配置文件:`, e.message || e);
          return null;
      }
  }

  /**
   * 【全新】只更新内存中的配置
   * @description 这是一个轻量级的同步或异步操作，用于在运行时频繁更新状态。
   * @param {string} provider - 'quark', 'ali', 'uc'
   * @param {string} newCookie - 新的 cookie 字符串
   */
  async function updateConfig(provider, newCookie) {
    // 确保配置对象已从文件加载，如果还没有的话
    let config = configs.value[provider];
    if (!config) {
      config = await getConfig(provider);
      // 如果文件不存在，创建一个基础对象
      if (!config) {
        configs.value[provider] = {};
      }
    }
    
    // 更新内存中的 cookie
    configs.value[provider].cookie = newCookie;
    // console.log(`[Store] In-memory cookie for '${provider}' has been updated.`);
  }

  /**
   * 【新增】统一的保存配置入口（使用 Tauri v2 API）
   * @param {string} provider - 'quark', 'ali', 'uc'
   * @param {object} config - 要保存的配置对象, e.g., { cookie: "..." }
   */
  async function saveConfig(provider, config='') {
      // 确保配置目录存在
      await ensureConfigDir();
      
      let fileName;
      if (provider === 'quark') {
          fileName = QUARK_CONFIG_FILE;
          // 【重要】保存新配置后，重置初始化状态
          this._isQuarkInitialized = false;
      } else if (provider === 'ali') {
          fileName = ALI_CONFIG_FILE;
      } else if (provider === 'uc') {
          fileName = UC_CONFIG_FILE;
      } else {
          throw new Error('未知的提供商');
      }

      try {
          // 获取配置目录路径
        //   const configDir = await appConfigDir();
          
        //   // 拼接完整文件路径
        //   const filePath = await join(configDir, fileName);
        console.log(config)

          if(!config){
            config = this.configs.value[provider];
          }
          
        //   // 写入文件（Tauri v2 API：第一个参数是路径字符串，第二个参数是内容）
        //   await writeTextFile(filePath, JSON.stringify(config, null, 2));

          localStorage.setItem(provider, JSON.stringify(config));
          
          // console.log(`${provider} 配置已保存到 ${filePath}`);

          // 通知对应的驱动重新加载配置
          // this._reloadDriverConfig(provider);
      } catch (e) {
          console.error(`保存 ${provider} 配置失败:`, e);
          throw e;
      }
      configs.value[provider] = config;
  }

  return {
    saveConfig,
    updateConfig,
    getConfig,
  };
});