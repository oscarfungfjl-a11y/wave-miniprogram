/**
 * 浪点详情页 — 集成推荐规则打分
 */
const { getSpotById } = require('../../data/spots');
const { fetchWaveData } = require('../../services/wave-fetcher');
const recommender = require('../../services/huizhou-recommender');

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

        var tier = '低推荐';
        var tierClass = 'low';
        if (bestScore >= 80) { tier = '高推荐'; tierClass = 'high'; }
        else if (bestScore >= 60) { tier = '中推荐'; tierClass = 'mid'; }

        recSummary = {
          bestScore: bestScore,
          tier: tier,
          tierClass: tierClass,
          timeRange: recommender.mergeTimeRanges(
            scored.filter(function (s) { return s.tier === 'high'; }).map(function (s) { return s.time; })
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
            sea_temp_c: h.sea_temp_c,
            sea_level_m: h.sea_level_m,
            recScore: s ? s.totalScore : null,
            recTier: s ? s.tier : null,
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
            sea_temp_c: h.sea_temp_c,
            sea_level_m: h.sea_level_m,
            recScore: null,
            recTier: null,
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
              sea_temp_c: h.sea_temp_c,
              sea_level_m: h.sea_level_m,
              recScore: s ? s.totalScore : null,
              recTier: s ? s.tier : null,
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
              sea_temp_c: h.sea_temp_c,
              sea_level_m: h.sea_level_m,
              recScore: null,
              recTier: null,
            };
          });
        }

        return { date: d, hours: dayHours };
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
});
