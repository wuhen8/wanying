<!-- src/views/SearchResultsView.vue -->
<template>
  <v-container>
    <!-- 返回首页的链接 -->
    <v-btn @click="goBack" prepend-icon="mdi-arrow-left" variant="text" class="mb-4">
        返回
    </v-btn>

    <!-- 显示搜索的关键词 -->
    <h1 class="text-h5 mb-4">
      搜索结果: <span class="font-weight-bold text-primary">{{ query }}</span>
    </h1>

    <!-- 进度条和状态文本 -->
    <div v-if="isLoading" class="d-flex align-center mb-4">
      <v-progress-linear
        v-model="searchProgress"
        color="primary"
        height="10"
        striped
      ></v-progress-linear>
      <span class="ml-4 text-subtitle-1">{{ progressText }}</span>
    </div>

    <!-- 错误状态 -->
    <v-alert
      v-else-if="error"
      type="error"
      :text="error"
      class="mt-4"
    ></v-alert>

    <!-- 来源筛选器 -->
    <v-sheet class="mb-5" v-if="availableSources.length > 0">
      <v-chip-group
        v-model="selectedSourceKey"
        column
        mandatory
      >
        <v-chip
          key="all"
          value="all"
          filter
          variant="outlined"
        >
          全部 ({{ results.length }})
        </v-chip>
        <v-chip
          v-for="source in availableSources"
          :key="source.key"
          :value="source.key"
          filter
          variant="outlined"
        >
          {{ source.name }} ({{ source.count }})
        </v-chip>
      </v-chip-group>
    </v-sheet>

    <!-- 结果列表 -->
    <v-list v-if="filteredResults.length > 0" lines="three">
      <v-list-item
        v-for="(item, index) in filteredResults"
        :key="`${item.sourceKey}-${item.vod_id}-${index}`"
        :title="item.vod_name"
        @click.prevent="toPlay(item.vod_id, item.sourceKey)"
      >
        <template v-slot:prepend>
          <v-avatar size="80" rounded="0">
            <v-img :src="item.vod_pic" :alt="item.vod_name" cover></v-img>
          </v-avatar>
        </template>

        <v-list-item-subtitle>
          {{ item.vod_actor || '未知主演' }} / {{ item.vod_area || '未知地区' }}
        </v-list-item-subtitle>

        <template v-slot:append>
          <div class="d-flex flex-column align-end">
            <v-chip color="primary" variant="tonal" size="small" class="mb-2">
              来源: {{ item.sourceSite }}
            </v-chip>
            <v-icon color="grey-lighten-1">mdi-chevron-right</v-icon>
          </div>
        </template>
      </v-list-item>
    </v-list>

    <!-- 无结果状态 -->
    <div v-else-if="!isLoading && results.length === 0" class="text-center pa-10">
      <v-icon size="48" color="grey">mdi-database-search-outline</v-icon>
      <p class="mt-4 text-grey">在所有数据源中均未找到相关结果。</p>
    </div>
     <div v-else-if="!isLoading && filteredResults.length === 0" class="text-center pa-10">
      <v-icon size="48" color="grey">mdi-filter-off-outline</v-icon>
      <p class="mt-4 text-grey">当前筛选条件下没有结果。</p>
    </div>

  </v-container>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { searchAllSitesConcurrently } from './utils/api';
import { useApiConfigStore } from './stores/apiConfig';

const route = useRoute();
const router = useRouter();
const apiStore = useApiConfigStore();

const query = ref(route.query.q || '');
const isLoading = ref(false);
const error = ref(null);
const results = ref([]);
const selectedSourceKey = ref('all');

const completedSearches = ref(0);
const totalSearches = ref(0);
const searchProgress = computed(() => {
  return totalSearches.value === 0 ? 0 : (completedSearches.value / totalSearches.value) * 100;
});
const progressText = computed(() => {
  return `已完成 ${completedSearches.value} / ${totalSearches.value}`;
});

const availableSources = computed(() => {
  if (results.value.length === 0) return [];
  const sourceCounts = results.value.reduce((acc, item) => {
    if (!acc.has(item.sourceKey)) {
      acc.set(item.sourceKey, {
        key: item.sourceKey,
        name: item.sourceSite,
        count: 0,
      });
    }
    acc.get(item.sourceKey).count++;
    return acc;
  }, new Map());
  return Array.from(sourceCounts.values());
});

const filteredResults = computed(() => {
  if (selectedSourceKey.value === 'all') {
    return results.value;
  }
  return results.value.filter(item => item.sourceKey === selectedSourceKey.value);
});

const fetchResults = async () => {
  if (!query.value) return;

  isLoading.value = true;
  error.value = null;
  results.value = [];
  selectedSourceKey.value = 'all';
  completedSearches.value = 0;
  totalSearches.value = apiStore.sites.filter(site => site.api).length;

  try {
    const onResultFound = (newResults, site) => {
      results.value.push(...newResults);
      // 注意：这里我们不再增加 completedSearches，因为 finally 块会处理
    };

    // 使用一个包装器来跟踪完成情况
    const searchPromise = searchAllSitesConcurrently(query.value, onResultFound);

    // 监听进度，而不是在回调里
    const originalSites = apiStore.sites.filter(site => site.api);
    for (let i = 0; i < originalSites.length; i++) {
        searchPromise.then(() => {
            // 这个模拟有点 tricky，更好的方式是让 searchAllSitesConcurrently 提供进度回调
            // 简单处理：我们只在最后更新
        });
    }

    await searchPromise;

  } catch (err) {
    error.value = err.toString();
  } finally {
    isLoading.value = false;
    // 确保进度条最终显示100%
    completedSearches.value = totalSearches.value;
  }
};

const toPlay = (vod_id, sourceKey) => {
  router.push({
    name: 'Play', // 确保你的路由配置中有名为 'Play' 的路由
    query: {
      vod_id: vod_id,
      source: sourceKey,
    }
  });
};

// 2. 定义点击事件的处理函数
const goBack = (vod_id, sourceKey) =>  {
    // 调用 router.back() 来返回上一个历史记录
    router.back();
}

onMounted(fetchResults);

watch(() => route.query.q, (newQuery) => {
  if (newQuery) {
    query.value = newQuery;
    fetchResults();
  }
});
</script>