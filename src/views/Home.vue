<template>
  <div class="home">
    <div class="top-tabs">
      <div class="tabs-scroll" ref="tabsScrollRef">
        <div
          v-for="tab in topTabs"
          :key="tab"
          class="tab-chip"
          :class="{ active: activeTab === tab }"
          @click="activeTab = tab"
        >{{ tab }}</div>
      </div>
    </div>

    <div v-if="activeTab === '日照'" class="tab-content">
      <div class="building-bar">
        <div class="building-scroll" ref="buildingScrollRef">
          <div
            v-for="b in buildings"
            :key="b"
            class="building-chip"
            :class="{ active: activeBuilding === b }"
            @click="activeBuilding = b"
          >{{ b }}</div>
        </div>
        <div class="dropdown-trigger" @click="showDropdown = !showDropdown">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#999">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </div>
      </div>

      <div v-if="showDropdown" class="dropdown-panel">
        <div
          v-for="b in buildings"
          :key="'d-' + b"
          class="dropdown-item"
          :class="{ active: activeBuilding === b }"
          @click="activeBuilding = b; showDropdown = false"
        >{{ b }}</div>
      </div>

      <div class="card-row">
        <div class="sun-card" @click="$router.push('/three-view')">
          <div class="card-bg card-bg-inner"></div>
          <div class="card-label">立面日照</div>
        </div>
        <div class="sun-card" @click="$router.push('/community-three')">
          <div class="card-bg card-bg-outer"></div>
          <div class="card-label">小区日照</div>
        </div>
      </div>
    </div>

    <div v-else class="tab-content empty-tab">
      <div class="empty-text">{{ activeTab }} — 暂无内容</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const topTabs = ['价格', '日照', '噪声', '选房', '楼栋', '景观']
const buildings = Array.from({ length: 16 }, (_, i) => (i + 1) + '#')

const activeTab = ref('日照')
const activeBuilding = ref('1#')
const showDropdown = ref(false)
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #f5f5f5;
}

.top-tabs {
  padding: 12px 0;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.tabs-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 16px;
}

.tab-chip {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 13px;
  color: #666;
  background: #f0f0f0;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-chip.active {
  color: #fff;
  background: #07c160;
}

.tab-content {
  padding: 12px 16px;
  padding-bottom: 24px;
}

.building-bar {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 10px;
  padding: 8px 4px 8px 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}

.building-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  flex: 1;
}

.building-chip {
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: 14px;
  font-size: 13px;
  color: #666;
  background: #f5f5f5;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.building-chip.active {
  color: #07c160;
  background: #e8f8ef;
  font-weight: 500;
}

.dropdown-trigger {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: 4px;
}

.dropdown-panel {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 4px 0;
  margin-bottom: 16px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
}

.dropdown-item {
  padding: 8px;
  text-align: center;
  font-size: 13px;
  color: #666;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.dropdown-item.active {
  color: #07c160;
  background: #e8f8ef;
}

.card-row {
  display: flex;
  gap: 12px;
}

.sun-card {
  flex: 1;
  position: relative;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  transition: transform 0.2s;
}

.sun-card:active {
  transform: scale(0.97);
}

.card-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}

.card-bg-inner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.card-bg-outer {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.card-label {
  position: absolute;
  bottom: 12px;
  left: 12px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.empty-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.empty-text {
  font-size: 14px;
  color: #bbb;
}
</style>
