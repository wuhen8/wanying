<template>
    <v-container>
      <!-- 返回首页的链接 -->
      <v-btn @click="goBack" prepend-icon="mdi-arrow-left" variant="text" class="mb-4">
        返回
      </v-btn>
      <!-- 3. 内容区域 -->
      
        <!-- 播放器区域 -->
      <v-card class="mb-5" elevation="4">
          <div class="artplayer-app"></div>
      </v-card>
      <div v-if="videoInfo">
        <!-- 影片信息 -->
        <v-card>
          <v-card-text>
            <v-row no-gutters>
              <!-- 详细信息 -->
              <v-col cols="12" md="9">
                <h1 class="text-h4 font-weight-bold mb-2">{{ videoInfo.vod_name }}</h1>
                <p class="text-subtitle-1 text-grey-darken-1">{{ videoInfo.vod_remarks }}</p>
  
                <v-list density="compact" class="bg-transparent mt-2">
                  <v-list-item class="px-0">
                    <v-list-item-title>
                      <span class="font-weight-bold">年份: </span>
                      <span>{{ videoInfo.vod_year }}</span>
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item class="px-0">
                    <v-list-item-title>
                      <span class="font-weight-bold">地区: </span>
                      <span>{{ videoInfo.vod_area }}</span>
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item class="px-0">
                    <v-list-item-title>
                      <span class="font-weight-bold">语言: </span>
                      <span>{{ videoInfo.vod_lang }}</span>
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item class="px-0">
                    <v-list-item-title>
                      <span class="font-weight-bold">视频地址: </span>
                      <span>{{ currentEpisode?.url }}</span>
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item class="px-0">
                    <v-list-item-title>
                      <span class="font-weight-bold">播放地址: </span>
                      <v-btn v-if="playInfo" @click="copyToClipboard(playInfo?.url)">点击复制</v-btn>
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
                
                <p v-if="videoInfo.vod_content" class="text-body-2 mt-4" style="line-height: 1.75;">
                  {{ videoInfo.vod_content.replace(/<[^>]*>/g, '') }}
                </p>
                 <p v-else class="text-body-2 mt-4 text-grey">
                  暂无简介
                </p>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
  
        <!-- 选集区域 -->
        <v-card class="mt-5">
          <v-card-title class="text-h6">播放列表</v-card-title>
          <v-divider></v-divider>
          <v-card-text>
            <!-- 1. 播放源切换 -->
            <div class="mb-4">
              <span class="text-subtitle-1 mr-3">播放源:</span>
              <v-chip-group
                v-model="selectedSourceIndex"
                mandatory
                color="primary"
              >
                <v-chip
                  v-for="(source, index) in playSources"
                  :key="index"
                  :value="index"
                  filter
                >
                  {{ source.name }}
                </v-chip>
              </v-chip-group>
            </div>

            <!-- 2. 剧集列表 (根据当前播放源显示) -->
            <v-chip-group column>
              <v-chip
                v-for="(episode, index) in currentEpisodeList"
                :key="index"
                @click="selectEpisode(episode)"
                :color="currentEpisode?.url === episode.url ? 'primary' : ''"
                variant="flat"
                size="large"
              >
                {{ episode.name }}
              </v-chip>
            </v-chip-group>
          </v-card-text>
        </v-card>
      </div>
    </v-container>
  </template>
  
  <script setup>
  import { ref, onMounted, watch, nextTick, shallowRef, onBeforeUnmount, computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import Artplayer from 'artplayer';
  import { getVideoDetails } from './utils/api'; // 假设路径是 './utils/api'
  import { Cloud } from './utils/cloud-dispatcher.js'; 
  import Hls from 'hls.js';
  import { playVideo } from 'tauri-plugin-videoplayer-api';

  // --- 响应式状态定义 ---
  const route = useRoute();
  const router = useRouter();
  const vod_id = ref(route.query.vod_id || '');
  const sourceKey = ref(route.query.source || ''); // 从路由获取的站点key

  const isLoading = ref(true);
  const error = ref(null);
  const videoInfo = ref(null);
  const playInfo = ref(null);

  // --- 核心改造：新的播放列表数据结构 ---
  const playSources = ref([]); // 存储所有解析出的播放源，格式: [{ name: 'feifan', episodes: [...] }, ...]
  const selectedSourceIndex = ref(0); // 当前选中的播放源索引
  const currentEpisode = ref(null); // 当前正在播放的剧集对象 { name, url }
  const art = shallowRef(null);
  const cloud= shallowRef(null);

  const goBack = () => router.back();

  // --- 计算属性 ---
  // 计算属性：根据选中的播放源索引，动态返回对应的剧集列表
  const currentEpisodeList = computed(() => {
    if (playSources.value.length > 0 && playSources.value[selectedSourceIndex.value]) {
      return playSources.value[selectedSourceIndex.value].episodes;
    }
    return [];
  });

  // --- 方法定义 ---
  const fetchVideoDetails = async () => {
    if (!vod_id.value) {
      error.value = "错误：页面链接缺少视频ID。";
      isLoading.value = false;
      return;
    }
    
    isLoading.value = true;
    error.value = null;

    try {
      const jsonRes = await getVideoDetails(vod_id.value, sourceKey.value);
      let vod_play_url = await cloud.value.detailContentVodPlayUrl(jsonRes.vod_play_url);
      let vod_play_from = await cloud.value.detailContentVodPlayFrom(jsonRes.vod_play_url);
      
      if (jsonRes && vod_play_url) {
        videoInfo.value = jsonRes;
        parsePlaySources(vod_play_from, vod_play_url);

        // 初始化播放第一源的第一集
        if (currentEpisodeList.value.length > 0) {
          selectEpisode(currentEpisodeList.value[0]);
        } else {
          throw new Error("该视频没有可播放的剧集。");
        }
      } else {
        throw new Error("未能从API获取到有效的视频信息。");
      }
    } catch (err) {
      console.error("获取视频详情失败:", err);
      error.value = err.message;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * *** 核心改造：解析多源播放列表 (已增强兼容性) ***
   * @param {string} fromString - "feifan$$$ffm3u8"
   * @param {string} urlString - "剧集列表1$$$剧集列表2"
   */
  const parsePlaySources = (fromString, urlString) => {
    if (!fromString || !urlString) {
      playSources.value = [];
      return;
    }
    const froms = fromString.split('$$$');
    const urls = urlString.split('$$$');
    const sources = [];
    
    froms.forEach((fromName, index) => {
      if (urls[index]) {
        // 计数器，用于为没有名称的剧集生成默认名称
        let episodeCounter = 1; 

        const episodes = urls[index].split('#').map(item => {
          if (!item) return null; // 跳过空字符串

          const parts = item.split('$');
          
          // --- *** 增强的逻辑判断 *** ---
          if (parts.length === 2 && parts[0] && parts[1]) {
            // 标准情况: "第1集$url"
            return { name: parts[0], url: parts[1] };
          } else if (parts.length === 1 && parts[0]) {
            // 兼容情况 1: 只有 URL，没有"$" -> "url"
            const url = parts[0];
            // 检查 URL 是否看起来像一个有效的链接
            if (url.startsWith('http') || url.startsWith('/')) {
                // 为它生成一个默认的名字
                const name = `第${episodeCounter++}集`;
                return { name: name, url: url };
            }
          }
          // 如果不符合以上两种情况，则视为无效数据
          return null;

        }).filter(Boolean); // 过滤掉所有解析失败的 null 项
        
        if (episodes.length > 0) {
            sources.push({ name: fromName, episodes: episodes });
        }
      }
    });

    playSources.value = sources;
    selectedSourceIndex.value = 0; // 默认选中第一个源
  };

  /**
   * 选中一集进行播放
   */
  const selectEpisode = (episode) => {
    currentEpisode.value = episode;
  };

  /**
   * 使用现代的 Clipboard API 异步复制文本
   */
  async function copyToClipboard(text) {
    // 检查 Clipboard API 是否可用
    if (!navigator.clipboard) {
      // copyStatusMessage.value = '浏览器不支持复制功能！';
      // isSuccess.value = false;
      console.log('浏览器不支持复制功能！')
      return;
    }

    try {
      // 核心：调用 API 写入文本到剪贴板
      await navigator.clipboard.writeText(text);
      console.log('复制成功！')
      
      // 更新反馈信息为成功状态
      // copyStatusMessage.value = '已复制！';
      // isSuccess.value = true;

    } catch (error) {
      console.error('复制失败:', error);
      // 更新反馈信息为失败状态
      // copyStatusMessage.value = '复制失败！';
      // isSuccess.value = false;

    } finally {
      // 无论成功或失败，2秒后清除反馈信息
      // setTimeout(() => {
      //   copyStatusMessage.value = '';
      // }, 2000);
    }
  }

  function playM3u8(video, url, art) {
    if (Hls.isSupported()) {
      if (art.hls)
        art.hls.destroy()
      const hls = new Hls()
      
      hls.loadSource(url)
      hls.attachMedia(video)
      art.hls = hls
      art.on('destroy', () => hls.destroy())
    }
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
    }
    else {
      art.notice.show = 'Unsupported playback format: m3u8'
    }
  }

  // --- Vue 生命周期钩子 ---
  onMounted(async () => {
    if (!art.value) {
        art.value = new Artplayer({
          container: '.artplayer-app',
          autoPlayback: true,
          lock: true,
          airplay: true,
          fastForward: true,
          autoMini: false,
          pip: true,
          fullscreen: true,
          fullscreenWeb: true,
          autoOrientation: true,
          flip: true,
          playbackRate: true,
          aspectRatio: true,
          setting: true,
          theme: '#23ade5',
          autoOrientation: true,
          customType: {
            m3u8: playM3u8
          },
        });

        art.value.on('error', (error, reconnect) => {
          console.error('Artplayer Error:', error);
          art.value.notice.show = `播放器错误: ${error.message}`;
      });
    }
    cloud.value = new Cloud();
    await fetchVideoDetails();
  });

  onBeforeUnmount(() => {
    if (art.value) {
      art.value.destroy();
    }
  });

  watch(currentEpisode, async (newEpisode) => {
    // 确保有新选中的剧集、有剧集ID、并且播放器实例已准备好
    if (newEpisode) {
      try {
        // 1. 获取当前选中的播放源名称 (flag)
        const currentFlag = playSources.value[selectedSourceIndex.value].name;
        console.log(`[Player] Parsing with flag: "${currentFlag}", name: "${newEpisode.name}", id: "${newEpisode.url}"`);
        
        // 2. 显示加载提示
        // art.value.notice.show = '正在解析链接，请稍候...';
        isLoading.value = true; // 也可以用一个独立的加载状态 for parsing

        // 3. **调用统一的 Cloud 分发器来获取真实播放信息**
        //    这一步将所有复杂性都抽离了出去
        playInfo.value = await cloud.value.playerContent(currentFlag, newEpisode.url);
        
        // 4. 检查返回结果是否有效
        if (!playInfo.value || !playInfo.value.url) {
          throw new Error("解析成功，但未能获取到有效的播放链接。");
        }

        console.log(`[Player] Got real URL: ${playInfo.value.url} Type: ${playInfo.value.type}`);
        
        // 5. 将最终的 URL 和 Headers 交给 Artplayer
        // art.value.switchUrl(playInfo.url, {
        //   name: newEpisode.name,
        //   headers: playInfo.headers || {}, // 确保 headers 是一个对象
        // });

        // art.value.switchUrl(playInfo.url, {
        //   type: 'm3u8',
        //   customType: {
        //     m3u8: playM3u8,
        //   },
        // });

        art.value.type = playInfo.value.type;
        art.value.switch = playInfo.value.url;
        // playVideo(playInfo.value.url);
        // art.value.switchUrl(playInfo.url, { type: playInfo.type});

        // art.value.notice.show = `开始播放: ${newEpisode.name}`;

      } catch (e) {
        console.error("[Player] Failed to parse and play link:", e);
        // art.value.notice.show = `播放失败: ${e.message}`;
        error.value = `播放 ${newEpisode.name} 时出错: ${e.message}`;
      } finally {
        isLoading.value = false;
      }
    }
  });
  
  </script>
  
  <style scoped>
    .artplayer-app {
        width: 100%;
        height: 300px;
    }

    /* 
    媒体查询：当屏幕宽度大于等于 960px (md 断点) 时，
    应用这里的样式，覆盖上面的默认样式。
    */
    @media (min-width: 960px) {
        .artplayer-app {
            /* 这是电脑屏幕下的高度 */
            height: 450px;
        }
    }
  
    /* 调整 v-list 的默认 padding */
    .v-list-item {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
  </style>