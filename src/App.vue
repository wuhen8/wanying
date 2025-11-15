<!-- src/App.vue -->
<template>
  <v-app>
    <!-- 主要内容区域，路由对应的组件会在这里渲染 -->
    <v-main>
      <router-view v-slot="{ Component }">
        <v-fade-transition>
          <component :is="Component" />
        </v-fade-transition>
      </router-view>
    </v-main>

    <!-- 底部导航栏 -->
    <v-bottom-navigation
      v-model="activeTab"
      color="primary"
      app
      grow
    >
      <v-btn
        v-for="item in navItems"
        :key="item.value"
        :value="item.value"
        :to="item.to"
      >
        <v-icon>{{ item.icon }}</v-icon>
        <span>{{ item.text }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApiConfigStore } from './stores/apiConfig';

const apiConfigStore = useApiConfigStore();
// 1. 定义导航项
const navItems = [
  { text: '首页', icon: 'mdi-home', value: 'home', to: '/' },
  { text: '发现', icon: 'mdi-heart', value: 'favorites', to: '/fx' },
  { text: '我的', icon: 'mdi-account', value: 'nearby', to: '/my' },
]

// 2. activeTab 用于 v-model，控制哪个按钮是激活状态
const activeTab = ref('home') // 默认值

// 3. 监听路由变化，同步 activeTab 的状态
const route = useRoute()

// 在应用根组件挂载时，触发一次配置加载流程
onMounted(() => {
  apiConfigStore.ensureReady();
});

watch(
  () => route.path,
  (newPath) => {
    // 根据当前路径找到对应的导航项
    const currentItem = navItems.find(item => item.to === newPath)
    if (currentItem) {
      activeTab.value = currentItem.value
    }
  },
  { immediate: true } // immediate: true 确保组件加载时立即执行一次
)
</script>

<style>
/* 添加一些过渡效果，让页面切换更平滑 */
.v-fade-transition-leave-active {
  position: absolute; /* 防止页面切换时布局跳动 */
}
</style>