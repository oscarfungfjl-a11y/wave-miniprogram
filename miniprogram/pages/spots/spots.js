/**
 * 浪点列表页
 * 浏览和搜索所有浪点，按区域筛选
 * 数据来源：本地 data/spots.js（无需后端）
 */
const { getAllSpots, searchSpots, getRegions } = require('../../data/spots');

Page({
  data: {
    loading: false,
    refreshing: false,
    spots: [],
    keyword: '',
    activeRegion: '',
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  loadData() {
    let spots;
    if (this.data.keyword) {
      spots = searchSpots(this.data.keyword);
    } else if (this.data.activeRegion) {
      spots = getAllSpots().filter((s) => s.region === this.data.activeRegion);
    } else {
      spots = getAllSpots();
    }

    // 提取所有区域用于筛选标签
    const regions = getRegions();

    this.setData({ spots, regions });
  },

  onRefresh() {
    this.setData({ refreshing: true, keyword: '', activeRegion: '' });
    setTimeout(() => {
      this.loadData();
      this.setData({ refreshing: false });
    }, 300);
  },

  onSearchChange(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearchSubmit(e) {
    this.setData({ keyword: e.detail.value, activeRegion: '' });
    this.loadData();
  },

  onSearchClear() {
    this.setData({ keyword: '', activeRegion: '' });
    this.loadData();
  },

  onRegionChange(e) {
    const region = e.currentTarget.dataset.region;
    this.setData({ activeRegion: region, keyword: '' });
    this.loadData();
  },

  onSpotTap(e) {
    const { spot } = e.detail;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${spot.id}`,
    });
  },

  onShareAppMessage() {
    return {
      title: '浪报 - 发现最佳浪点',
      path: '/pages/spots/spots',
    };
  },
});
