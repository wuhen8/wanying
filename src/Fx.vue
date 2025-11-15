<!-- src/views/SpiderTest.vue (直接使用 localStorage) -->
<template>
  <v-container>
    <v-card max-width="800" class="mx-auto">
      <v-card-title class="text-h5">
        云盘配置与测试
      </v-card-title>
      <v-divider></v-divider>

      <!-- 配置区域 -->
      <v-card-text>
        <h3 class="text-h6 mb-3">夸克网盘配置</h3>
        <v-textarea
          v-model="quarkCookie"
          label="夸克 Cookie"
          placeholder="在此处粘贴完整的夸克 Cookie 字符串"
          variant="outlined"
          rows="3"
          auto-grow
          @update:model-value="handleCookieInput"
        >
          <template v-slot:append-inner>
            <v-fade-transition leave-absolute>
              <v-progress-circular
                v-if="isSaving"
                size="24"
                color="info"
                indeterminate
              ></v-progress-circular>
              <v-icon v-else-if="isSaved" color="success">mdi-check-circle</v-icon>
            </v-fade-transition>
          </template>
        </v-textarea>
        <v-card-subtitle class="pt-2">
          编辑后将自动保存到浏览器缓存 (localStorage)
        </v-card-subtitle>
      </v-card-text>
      <v-divider></v-divider>

      <!-- 测试区域 -->
      <v-card-text>
        <h3 class="text-h6 mb-3">功能测试</h3>
        <v-row align="center">
          <v-col cols="12">
            <v-text-field
              v-model="quarkShareLink"
              label="夸克分享链接"
              placeholder="https://pan.quark.cn/s/xxxxxxxxxxxx"
              variant="outlined"
              hide-details
            ></v-text-field>
          </v-col>
          <v-col cols="12">
            <v-btn
              @click="runQuarkTest"
              color="deep-purple"
              :loading="isLoading"
              :disabled="!quarkCookie || !quarkShareLink"
              block
              size="large"
            >
              运行夸克链接解析测试
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider></v-divider>

      <!-- 结果显示区域 -->
      <v-card-text v-if="testResult || error || isLoading">
        <h3 class="text-h6 mb-2">测试结果:</h3>
        <v-progress-circular v-if="isLoading" indeterminate color="primary"></v-progress-circular>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
          {{ error }}
        </v-alert>
        <v-sheet
          v-if="testResult"
          color="grey-darken-3"
          class="pa-4 rounded"
          style="max-height: 500px; overflow-y: auto;"
        >
          <pre><code>{{ JSON.stringify(testResult, null, 2) }}</code></pre>
        </v-sheet>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { QuarkDrive } from './utils/quark-drive.js';

// --- 状态定义 ---
const isLoading = ref(false);
const isSaving = ref(false);
const isSaved = ref(false);
const testResult = ref(null);
const error = ref(null);
let saveTimeout = null;

const quarkCookie = ref('');
const quarkShareLink = ref('https://pan.quark.cn/s/064365ae9a07'); // 默认测试链接

// --- 直接操作 localStorage 的逻辑 ---

const QUARK_COOKIE_KEY = 'quark_cookie'; // 定义存储键

// 组件挂载时，自动从 localStorage 加载 Cookie
onMounted(() => {
  const savedCookie = localStorage.getItem(QUARK_COOKIE_KEY);
  if (savedCookie) {
    quarkCookie.value = savedCookie;
    isSaved.value = true; // 标记为已保存状态
  }
});

// 当用户输入 Cookie 时，触发自动保存
function handleCookieInput(newCookieValue) {
  isSaving.value = true;
  isSaved.value = false;
  
  // 使用防抖 (debounce)
  if (saveTimeout) clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(() => {
    if (newCookieValue) {
      localStorage.setItem(QUARK_COOKIE_KEY, newCookieValue);
    } else {
      // 如果输入框清空，也从 localStorage 中移除
      localStorage.removeItem(QUARK_COOKIE_KEY);
    }
    isSaving.value = false;
    isSaved.value = true;
    console.log("Quark cookie saved to localStorage.");
  }, 1000); // 延迟1秒保存
}

// --- 测试函数 ---
async function runQuarkTest() {
  isLoading.value = true;
  testResult.value = null;
  error.value = null;

  try {
    // 确保 QuarkDrive 使用的是最新的 Cookie
    QuarkDrive.init(quarkCookie.value);

    const resultString = await QuarkDrive.detailContentVodPlayUrl([quarkShareLink.value]);

    testResult.value = {
      description: "成功获取待解析的播放列表字符串 (vod_play_url)",
      result: resultString
    };

  } catch (e) {
    console.error("夸克测试失败:", e);
    error.value = e.message || "发生未知错误，请检查控制台。";
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #fff;
}
</style>