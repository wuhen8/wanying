<!-- src/views/MyPage.vue -->
<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">

        <!-- 1. 接口配置卡片 -->
        <v-card class="mb-6">
          <v-card-title class="text-h5">接口配置</v-card-title>
          <v-card-subtitle>设置并加载接口列表的来源地址</v-card-subtitle>
          <v-divider></v-divider>
          <v-card-text>
            <v-text-field
              v-model="inputConfigUrl"
              label="配置接口地址"
              variant="outlined"
              prepend-inner-icon="mdi-cloud-download"
              clearable
              :loading="apiStore.loading"
              :disabled="apiStore.loading"
            ></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              variant="flat"
              :loading="apiStore.loading"
              @click="applyConfigUrl"
            >
              加载/应用配置
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- 2. 搜索设置卡片 -->
        <v-card class="mb-6">
          <v-card-title class="text-h5">搜索设置</v-card-title>
          <v-card-subtitle>调整并发搜索的性能参数</v-card-subtitle>
          <v-divider></v-divider>
          <v-card-text>
            <v-slider
              v-model="concurrencyValue"
              @update:model-value="updateConcurrencyLimit"
              label="并发搜索数"
              :min="1"
              :max="10"
              :step="1"
              thumb-label
              show-ticks="always"
              color="primary"
            >
              <template v-slot:append>
                <v-chip size="small">{{ concurrencyValue }}</v-chip>
              </template>
            </v-slider>
          </v-card-text>
        </v-card>

        <!-- 3. 云盘配置卡片 -->
        <v-card class="mb-6">
          <v-card-title class="text-h5">云盘配置</v-card-title>
          <v-card-subtitle>设置云盘服务的认证信息</v-card-subtitle>
          <v-divider></v-divider>
          <v-card-text>
            <v-textarea
              v-model="quarkCookie"
              label="夸克 Cookie"
              placeholder="在此处粘贴完整的夸克 Cookie 字符串"
              variant="outlined"
              rows="3"
              auto-grow
              @update:model-value="handleCookieInput('quark', $event)"
              persistent-hint
              hint="编辑后将自动保存"
            >
              <template v-slot:append-inner>
                <v-fade-transition leave-absolute>
                  <v-progress-circular v-if="savingStatus.quark" size="24" color="info" indeterminate />
                  <v-icon v-else-if="savedStatus.quark" color="success">mdi-check-circle</v-icon>
                </v-fade-transition>
              </template>
            </v-textarea>
            
            <v-text-field
              v-model="aliToken"
              label="阿里云盘 Token (Refresh Token)"
              variant="outlined"
              class="mt-4"
              disabled
              hint="功能待开发"
            ></v-text-field>

          </v-card-text>
        </v-card>

        <!-- 4. 数据源选择卡片 -->
        <v-card v-if="apiStore.sites.length > 0 && !apiStore.loading">
          <v-card-title class="text-h5">数据源选择</v-card-title>
          <v-card-subtitle>选择默认的单个数据源</v-card-subtitle>
          <v-divider></v-divider>
          <v-card-text>
            <v-select
              v-model="selectedSiteKey"
              :items="apiStore.sites"
              item-title="name"
              item-value="key"
              label="选择接口源"
              variant="outlined"
              prepend-inner-icon="mdi-dns"
              @update:modelValue="handleSiteSelection"
            ></v-select>
          </v-card-text>
        </v-card>

      </v-col>
    </v-row>

    <!-- 消息提示条 -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbar.show = false">
          关闭
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, watch, onMounted, reactive } from 'vue';
import { useApiConfigStore } from './stores/apiConfig'; // 确保你的 store 路径正确
import { useDriveConfigStore } from './stores/driveConfig'; // 确保你的 store 路径正确

// --- 状态管理 ---
const apiStore = useApiConfigStore();
const driveStore = useDriveConfigStore();

// --- 本地响应式状态 ---
// 接口配置
const inputConfigUrl = ref(apiStore.configUrl);
// 数据源选择
const selectedSiteKey = ref(apiStore.currentSiteKey);
// 搜索设置
const concurrencyValue = ref(apiStore.concurrencyLimit); 
// 云盘配置
const quarkCookie = ref(''); 
const aliToken = ref(''); // 预留
const savingStatus = reactive({ quark: false, ali: false });
const savedStatus = reactive({ quark: false, ali: false });
// 消息提示
const snackbar = ref({ show: false, text: '', color: 'success' });
// 防抖计时器
let saveTimeout = null;


/**
 * 组件挂载时，从 Cloud 服务加载已保存的配置
 */
onMounted(async () => {
  // 请求 Cloud 加载夸克配置，组件不关心其实现细节
  // const config = await Cloud.loadConfig('quark');
  // if (config && config.cookie) {
  //   quarkCookie.value = config.cookie;
  //   savedStatus.quark = true; // 初始状态标记为已保存
  // }
});

/**
 * 处理用户在夸克 Cookie 输入框中的输入，并实现延迟自动保存
 * @param {string} type - 'quark'
 * @param {string} value - 输入框的最新值
 */
function handleCookieInput(type, value) {
  if (type === 'quark') {
    // 立即更新 UI 状态为“正在保存”
    savingStatus.quark = true;
    savedStatus.quark = false;

    // 清除上一个延迟计时器，实现输入防抖
    if (saveTimeout) clearTimeout(saveTimeout);

    // 设置一个新的计时器，在用户停止输入1秒后执行保存
    saveTimeout = setTimeout(async () => {
      try {
        await driveStore.saveConfig('quark', { cookie: value });
        // 调用 Cloud 服务来保存配置
        // await Cloud.saveConfig('quark', { cookie: value });
        
        // 更新 UI 状态为“保存成功”
        savingStatus.quark = false;
        savedStatus.quark = true;
        console.log("夸克配置已通过 Cloud 服务保存。");
      } catch (e) {
        console.error("通过 Cloud 保存夸克配置失败:", e);
        // 保存失败，更新 UI 状态并显示错误消息
        savingStatus.quark = false;
        snackbar.value = { show: true, text: '保存失败，请检查应用权限', color: 'error' };
      }
    }, 1000); // 延迟 1 秒保存
  }
}

/**
 * 应用新的接口配置地址
 */
function applyConfigUrl() {
  apiStore.setConfigUrlAndReload(inputConfigUrl.value);
}

/**
 * 处理用户选择新的数据源
 */
function handleSiteSelection(newKey) {
  apiStore.setCurrentSite(newKey);
}

/**
 * 更新并发搜索数限制
 */
function updateConcurrencyLimit(value) {
  apiStore.setConcurrencyLimit(value);
}

// 监听 Pinia store 的变化，以同步 UI
watch(() => apiStore.configUrl, (newVal) => { inputConfigUrl.value = newVal; });
watch(() => apiStore.currentSiteKey, (newVal) => { selectedSiteKey.value = newVal; });
watch(() => apiStore.concurrencyLimit, (newVal) => { concurrencyValue.value = newVal; });
</script>

<style scoped>
/* 可选：添加一些样式 */
.v-card {
  transition: box-shadow 0.3s ease-in-out;
}
.v-card:hover {
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}
</style>