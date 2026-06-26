/**
 * 双月湾页 — 浪点推荐（v2 分档打分规则）
 */
var recommender = require('../../services/huizhou-recommender');
var waveFetcher = require('../../services/wave-fetcher');

var HUIZHOU_LAT = 22.57;
var HUIZHOU_LON = 114.88;

/**
 * 判断当前小时数是否落在时间范围字符串内
 * @param {number} nowHour - 当前小时 (0-23)
 * @param {string} rangeStr - "08:00~10:00、14:00" 或 "08:00" 或 "暂无推荐时段"
 * @returns {boolean}
 */
function isInTimeRange(nowHour, rangeStr) {
  if (!rangeStr || rangeStr === '暂无推荐时段') return false;
  var parts = rangeStr.split('、');
  for (var i = 0; i < parts.length; i++) {
    var seg = parts[i].trim();
    var tilde = seg.indexOf('~');
    if (tilde === -1) {
      // 单小时 "08:00"
      var h = parseInt(seg.split(':')[0]);
      if (h === nowHour) return true;
    } else {
      // 范围 "08:00~10:00"
      var startH = parseInt(seg.substring(0, tilde).split(':')[0]);
      var endH = parseInt(seg.substring(tilde + 1).split(':')[0]);
      if (nowHour >= startH && nowHour <= endH) return true;
    }
  }
  return false;
}

Page({
  data: {
    loading: true,
    errorMsg: '',
    advice: '',
    todayWaveH: '',
    todaySwell: '',
    todayTemp: '',
    topSpots: [],
    lastUpdate: '',
  },

  onLoad: function () {
    this.loadData();
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  onPullDownRefresh: function () {
    this.loadData();
  },

  loadData: function () {
    var that = this;
    this.setData({ loading: true, errorMsg: '' });

    waveFetcher.fetchWaveData(HUIZHOU_LAT, HUIZHOU_LON).then(function (data) {
      var today = data.daily[0] || {};
      var todayDate = today.date;

      var todayHourly = data.hourly.filter(function (h) {
        return h.time.slice(0, 10) === todayDate;
      });

      var todayWaveH = today.wave_height_avg_m || 0;
      var todaySwell = today.swell_period_avg_s || 0;
      var todayTemp = today.sea_temp_avg_c || 0;

      var summaries = recommender.evaluateAll(todayHourly, todayTemp);
      var advice = recommender.buildAdvice(summaries, todayWaveH, todaySwell, todayTemp);

      var nowHour = new Date().getHours();

      // 前3个推荐浪点（仅保留当前在最佳时段内的）
      var topSpots = summaries
        .filter(function (r) { return isInTimeRange(nowHour, r.timeRange); })
        .slice(0, 3)
        .map(function (r) {
          return {
            spotId: r.spotId,
            name: r.name,
            area: r.area,
            level: r.level,
            bottom: r.bottom,
            tideNote: r.tideNote,
            overallTier: r.overallTier,
            bestScore: r.bestScore,
            timeRange: r.timeRange,
            highHours: r.highHours,
            midHours: r.midHours,
            avgWaveH: r.avgWaveH,
            avgSwell: r.avgSwell,
            avgSeaLevel: r.avgSeaLevel,
            dimScores: r.dimScores,
          };
        });

      var now = new Date();
      that.setData({
        loading: false,
        advice: advice,
        todayWaveH: todayWaveH.toFixed(1),
        todaySwell: todaySwell.toFixed(1),
        todayTemp: todayTemp.toFixed(0),
        topSpots: topSpots,
        lastUpdate: now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0'),
      });
      wx.stopPullDownRefresh();
    }).catch(function (err) {
      console.error('[shuangyuewan] Error:', err);
      that.setData({ loading: false, errorMsg: err.message || '浪况加载失败' });
      wx.stopPullDownRefresh();
    });
  },

  onRetryLoad: function () {
    this.loadData();
  },

  onShowRules: function () {
    wx.navigateTo({
      url: '/pages/rules/rules',
    });
  },

  onTopSpotTap: function (e) {
    var spotId = e.currentTarget.dataset.spotId;
    wx.navigateTo({
      url: '/pages/detail/detail?id=' + spotId,
    });
  },

  onShareAppMessage: function () {
    return {
      title: '双月湾今日浪点推荐',
      path: '/pages/huizhou/huizhou',
    };
  },
});
