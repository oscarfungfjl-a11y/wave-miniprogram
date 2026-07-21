/**
 * 浪点详情页 — 集成推荐规则打分
 */
const { getSpotById } = require('../../data/spots');
const { fetchWaveData } = require('../../services/wave-fetcher');
const recommender = require('../../services/huizhou-recommender');
const { wgs84ToGcj02, wgs84ToBd09 } = require('../../utils/coord');

var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getWeekday(dateStr) {
  var d = new Date(dateStr.replace(/-/g, '/'));
  return WEEKDAYS[d.getDay()];
}

Page({
  data: {
    loading: true,
    errorMsg: '',
    spot: null,
    recSummary: null,
    hourlyList: [],
    futureDays: [],
  },

  onLoad(options) {
    var id = options.id;
    var spot = getSpotById(id);

    if (!spot) {
      wx.showToast({ title: '浪点不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }

    this.setData({ spot: spot });
    this.loadWaveData(spot.lat, spot.lon, spot.id);
  },

  loadWaveData: function (lat, lon, spotId) {
    var that = this;

    fetchWaveData(lat, lon).then(function (data) {
      var today = data.daily[0] || {};
      var todayDate = today.date;

      // 今日小时预报
      var todayHourly = data.hourly.filter(function (h) {
        return h.time.slice(0, 10) === todayDate;
      });

      // 检查该浪点是否有推荐规则
      var hasRules = recommender.SPOT_SCORING[spotId];
      var recSummary = null;
      var hourlyWithScores = todayHourly;

      if (hasRules) {
        // 计算当日海平面统计
        var seaLevels = [];
        for (var i = 0; i < todayHourly.length; i++) {
          if (todayHourly[i].sea_level_m != null) {
            seaLevels.push(todayHourly[i].sea_level_m);
          }
        }
        var dailySeaMean = seaLevels.length > 0
          ? seaLevels.reduce(function (a, b) { return a + b; }, 0) / seaLevels.length
          : null;
        var dailySeaMax = seaLevels.length > 0
          ? Math.max.apply(null, seaLevels)
          : null;
        var dailySeaMin = seaLevels.length > 0
          ? Math.min.apply(null, seaLevels)
          : null;

        // 逐小时打分
        var scored = recommender.scoreHourly(spotId, todayHourly, dailySeaMean, dailySeaMax, dailySeaMin);

        // 生成推荐汇总
        var sorted = scored.slice().sort(function (a, b) { return b.totalScore - a.totalScore; });
        var bestScore = sorted.length > 0 ? sorted[0].totalScore : 0;

        var stars = recommender.scoreToStars(bestScore);

        recSummary = {
          bestScore: bestScore,
          stars: stars,
          starLabel: recommender.STAR_LABELS[stars],
          starStr: recommender.starString(stars),
          starLevel: stars >= 4.5 ? 5 : stars >= 3.5 ? 4 : stars >= 2.5 ? 3 : stars >= 1.5 ? 2 : 1,
          starWidths: recommender.starWidths(stars),
          timeRange: recommender.mergeTimeRanges(
            scored.filter(function (s) { return s.stars >= 4; }).map(function (s) { return s.time; })
          ),
          avgWaveH: today.wave_height_avg_m ? today.wave_height_avg_m.toFixed(1) : '--',
          avgSwell: today.swell_period_avg_s ? today.swell_period_avg_s.toFixed(1) : '--',
          avgSeaLevel: today.sea_level_avg_m ? today.sea_level_avg_m.toFixed(2) : '--',
          waveDir: today.wave_direction_cn || '--',
        };

        // 构建评分查找表，合并到逐时数据
        var scoreMap = {};
        for (var j = 0; j < scored.length; j++) {
          scoreMap[scored[j].time] = scored[j];
        }
        hourlyWithScores = todayHourly.map(function (h) {
          var s = scoreMap[h.time_label];
          return {
            time: h.time,
            time_label: h.time_label,
            wave_height_m: h.wave_height_m,
            swell_period_s: h.swell_period_s,
            wave_direction_cn: h.wave_direction_cn,
            wind_direction_cn: h.wind_direction_cn,
            wind_speed_kmh: h.wind_speed_kmh,
            windType: s ? s.windType : '--',
            sea_level_m: h.sea_level_m,
            recScore: s ? s.totalScore : null,
            recStars: s ? s.stars : null,
          };
        });
      } else {
        // 无推荐规则，仅添加潮高原始数据
        hourlyWithScores = todayHourly.map(function (h) {
          return {
            time: h.time,
            time_label: h.time_label,
            wave_height_m: h.wave_height_m,
            swell_period_s: h.swell_period_s,
            wave_direction_cn: h.wave_direction_cn,
            wind_direction_cn: h.wind_direction_cn,
            wind_speed_kmh: h.wind_speed_kmh,
            windType: '--',
            sea_level_m: h.sea_level_m,
            recScore: null,
            recStars: null,
          };
        });
      }

      // 未来6天按天分组 + 逐日打分
      var dayMap = {};
      data.hourly.forEach(function (h) {
        var d = h.time.slice(0, 10);
        if (d === todayDate) return;
        if (!dayMap[d]) dayMap[d] = [];
        dayMap[d].push(h);
      });

      var days = Object.keys(dayMap).sort();
      var futureDays = days.map(function (d) {
        var rawHours = dayMap[d];
        var dayHours;

        if (hasRules) {
          // 计算该日海平面统计
          var sls = [];
          for (var k = 0; k < rawHours.length; k++) {
            if (rawHours[k].sea_level_m != null) sls.push(rawHours[k].sea_level_m);
          }
          var dm = sls.length > 0 ? sls.reduce(function (a, b) { return a + b; }, 0) / sls.length : null;
          var dx = sls.length > 0 ? Math.max.apply(null, sls) : null;
          var dn = sls.length > 0 ? Math.min.apply(null, sls) : null;

          var dayScored = recommender.scoreHourly(spotId, rawHours, dm, dx, dn);
          var dayScoreMap = {};
          for (var j = 0; j < dayScored.length; j++) {
            dayScoreMap[dayScored[j].time] = dayScored[j];
          }
          dayHours = rawHours.map(function (h) {
            var s = dayScoreMap[h.time_label];
            return {
              time: h.time,
              time_label: h.time_label,
              wave_height_m: h.wave_height_m,
              swell_period_s: h.swell_period_s,
              wave_direction_cn: h.wave_direction_cn,
            wind_direction_cn: h.wind_direction_cn,
            wind_speed_kmh: h.wind_speed_kmh,
            windType: s ? s.windType : '--',
            sea_level_m: h.sea_level_m,
            recScore: s ? s.totalScore : null,
            recStars: s ? Math.floor(s.stars) : null,
          };
        });
      } else {
        dayHours = rawHours.map(function (h) {
          return {
            time: h.time,
            time_label: h.time_label,
            wave_height_m: h.wave_height_m,
            swell_period_s: h.swell_period_s,
            wave_direction_cn: h.wave_direction_cn,
            wind_direction_cn: h.wind_direction_cn,
            wind_speed_kmh: h.wind_speed_kmh,
            windType: '--',
            sea_level_m: h.sea_level_m,
              recScore: null,
              recStars: null,
            };
          });
        }

        return { date: d, weekday: getWeekday(d), hours: dayHours };
      });

      that.setData({
        loading: false,
        errorMsg: '',
        recSummary: recSummary,
        hourlyList: hourlyWithScores,
        futureDays: futureDays,
      });
    }).catch(function (err) {
      console.error('[detail] Wave data error:', err);
      that.setData({
        loading: false,
        errorMsg: err.message || '浪况加载失败',
      });
    });
  },

  onRetryLoad() {
    this.setData({ loading: true, errorMsg: '' });
    var s = this.data.spot;
    this.loadWaveData(s.lat, s.lon, s.id);
  },

  /**
   * 拉起第三方导航 App
   * 1) 优先 wx.openLocation（系统地图选择器，唤起已安装的地图App）
   * 2) 失败时弹出操作表：选择高德/百度/腾讯地图，复制对应 URL 到剪贴板并提示
   */
  onOpenNavigation: function () {
    var spot = this.data.spot;
    if (!spot) return;

    var name = spot.name;
    var address = spot.region || '';

    // spots.js 中的坐标是 WGS-84（Open-Meteo API 返回）
    // 需要转换为国内地图支持的坐标系：
    // - wx.openLocation / 高德地图 / 腾讯地图 → GCJ-02（火星坐标）
    // - 百度地图 → BD-09（百度坐标）
    var gcj = wgs84ToGcj02(spot.lat, spot.lon);
    var bd = wgs84ToBd09(spot.lat, spot.lon);

    var mapUrls = {
      gaode: 'https://uri.amap.com/marker?position=' + gcj.lon + ',' + gcj.lat
        + '&name=' + encodeURIComponent(name)
        + '&src=mavis&coordinate=gaode&callnative=1',
      baidu: 'https://api.map.baidu.com/marker?location=' + bd.lat + ',' + bd.lon
        + '&title=' + encodeURIComponent(name)
        + '&content=' + encodeURIComponent(address)
        + '&coord_type=bd09ll&output=html&src=mavis',
      tencent: 'https://apis.map.qq.com/uri/v1/marker?marker=coord:' + gcj.lat + ',' + gcj.lon
        + ';title:' + encodeURIComponent(name)
        + ';addr:' + encodeURIComponent(address)
        + '&referer=mavis'
    };

    var that = this;

    wx.openLocation({
      latitude: gcj.lat,
      longitude: gcj.lon,
      name: name,
      address: address,
      scale: 16,
      fail: function () {
        that._showMapActionSheet(mapUrls, gcj.lat, gcj.lon, name);
      }
    });
  },

  _showMapActionSheet: function (mapUrls, lat, lon, name) {
    var that = this;
    wx.showActionSheet({
      itemList: ['高德地图', '百度地图', '腾讯地图', '复制坐标'],
      success: function (res) {
        var idx = res.tapIndex;
        if (idx === 0) return that._copyAndOpen(mapUrls.gaode, lat, lon, name);
        if (idx === 1) return that._copyAndOpen(mapUrls.baidu, lat, lon, name);
        if (idx === 2) return that._copyAndOpen(mapUrls.tencent, lat, lon, name);
        // 复制坐标（提供两种：WGS-84 用于 API，GCJ-02 用于地图搜索）
        wx.setClipboardData({
          data: lat + ', ' + lon + ' (' + name + ')',
          success: function () { wx.showToast({ title: '坐标已复制', icon: 'success' }); }
        });
      }
    });
  },

  _copyAndOpen: function (url, lat, lon, name) {
    wx.setClipboardData({
      data: url,
      success: function () {
        wx.showModal({
          title: '打开 ' + name,
          content: '导航链接已复制到剪贴板。\n坐标：' + lat + ', ' + lon
            + '\n\n请在手机浏览器粘贴打开，将自动唤起地图 App。',
          confirmText: '我知道了',
          showCancel: false
        });
      }
    });
  },
});
