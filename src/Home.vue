<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6">
        <div class="text-center mb-6">
          <v-icon size="64" color="primary">mdi-magnify</v-icon>
          <h1 class="text-h4 font-weight-bold mt-2">搜索资源</h1>
        </div>

        <v-card elevation="4" class="pa-2">
          <v-text-field
            v-model="searchQuery"
            label="输入关键词开始搜索..."
            variant="solo-filled"
            append-inner-icon="mdi-magnify"
            single-line
            hide-details
            autofocus
            @keydown.enter="performSearch"
            @click:append-inner="performSearch"
          ></v-text-field>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const searchQuery = ref('');
const router = useRouter();

const performSearch = () => {
  if (searchQuery.value.trim() === '') {
    return; // 如果输入为空，则不执行搜索
  }
  
  // 跳转到搜索结果页，并带上查询参数
  router.push({ 
    name: 'List', 
    query: { q: searchQuery.value } 
  });
};
</script>

<style scoped>
.fill-height {
  min-height: 90vh; /* 使容器至少占据90%的视口高度，确保内容居中 */
}
</style>