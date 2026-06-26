/**
 * 首页 - 浪点发现
 * 展示所有浪点列表，点击进入详情查看浪况
 */
const { getAllSpots } = require('../../data/spots');

Page({
  data: {
    spots: [],
    greeting: '',
    todayDate: '',
    weekday: '',
  },

  onLoad() {
    this.initDateInfo();
    var spots = getAllSpots();
    this.setData({ spots: spots });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  initDateInfo() {
    var now = new Date();
    var hour = now.getHours();
    var greeting = '早上好';
    if (hour >= 12 && hour < 18) greeting = '下午好';
    else if (hour >= 18) greeting = '晚上好';

    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    var m = now.getMonth() + 1;
    var d = now.getDate();
    var w = weekdays[now.getDay()];

    this.setData({
      greeting: greeting + '，冲浪人',
      todayDate: m + '月' + d + '日',
      weekday: '星期' + w,
    });
  },

  onSpotTap(e) {
    var spot = e.detail.spot;
    wx.navigateTo({
      url: '/pages/detail/detail?id=' + spot.id,
    });
  },

  onShareAppMessage() {
    return {
      title: '浪报 - 查看今日浪况',
      path: '/pages/index/index',
    };
  },

  onShareTimeline() {
    return {
      title: '浪报 - 每日浪况预报，找到最佳浪点',
      query: '',
    };
  },
});
