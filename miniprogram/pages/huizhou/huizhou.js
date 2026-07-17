/**
 * 双月湾页 — 浪点推荐 + 日期筛选 + 日历弹窗
 */
var recommender = require('../../services/huizhou-recommender');
var waveFetcher = require('../../services/wave-fetcher');
var spotsData = require('../../data/spots');

/* 构建浪点坐标映射（仅包含评分规则中的浪点） */
var SPOT_COORDS = {};
var SPOT_IDS = Object.keys(recommender.SPOT_SCORING);
for (var i = 0; i < SPOT_IDS.length; i++) {
  var sid = SPOT_IDS[i];
  var spot = spotsData.getSpotById(sid);
  if (spot) {
    SPOT_COORDS[sid] = { lat: spot.lat, lon: spot.lon };
  }
}

var WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function fmtDate(d) {
  var y = d.getFullYear();
  var m = (d.getMonth() + 1).toString().padStart(2, '0');
  var day = d.getDate().toString().padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function buildChips() {
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  var nextSat = new Date(today);
  var dow = today.getDay();
  var daysToSat = dow === 6 ? 0 : (6 - dow + 7) % 7;
  if (daysToSat === 0 && now.getDay() === 6) daysToSat = 0;
  nextSat.setDate(nextSat.getDate() + daysToSat);
  var nextSun = new Date(today);
  var daysToSun = dow === 0 ? 0 : 7 - dow;
  nextSun.setDate(nextSun.getDate() + daysToSun);
  return [
    { label: '今天', date: fmtDate(today), active: true },
    { label: '明天', date: fmtDate(tomorrow), active: false },
    { label: '周六', date: fmtDate(nextSat), active: false },
    { label: '周日', date: fmtDate(nextSun), active: false },
  ];
}

/** 生成日历月矩阵 */
function buildCalendarMatrix(year, month) {
  var firstDay = new Date(year, month, 1);
  var startDow = firstDay.getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();

  var today = new Date();
  var todayStr = fmtDate(today);

  var rows = [];
  var week = [];
  for (var i = 0; i < startDow; i++) { week.push(null); }

  for (var d = 1; d <= daysInMonth; d++) {
    var dateObj = new Date(year, month, d);
    var dateStr = fmtDate(dateObj);
    week.push({
      day: d,
      date: dateStr,
      isToday: dateStr === todayStr,
    });
    if (week.length === 7) {
      rows.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    rows.push(week);
  }
  return rows;
}

Page({
  data: {
    loading: true, errorMsg: '',
    todayAdvice: '',
    weekRecommendations: [],
    todayWaveH: '', todaySwell: '', todayTemp: '',
    topSpots: [], lastUpdate: '',
    dateChips: [], selectedDate: '', dateLabel: '', pickerEnd: '',
    showCalendar: false,
    calYear: 0, calMonth: 0,
    calMinDate: '', calMaxDate: '',
    calMatrix: [],
    _spotData: {},
  },

  onLoad: function () {
    var chips = buildChips();
    var todayDate = chips[0].date;
    var maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 6);

    var today = new Date();
    var cy = today.getFullYear();
    var cm = today.getMonth();

    this.setData({
      dateChips: chips, selectedDate: todayDate, dateLabel: '今天',
      pickerEnd: fmtDate(maxDate),
      calYear: cy, calMonth: cm,
      calMinDate: todayDate, calMaxDate: fmtDate(maxDate),
      calMatrix: buildCalendarMatrix(cy, cm),
    });
    this.loadData(todayDate);
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  onPullDownRefresh: function () { this.loadData(this.data.selectedDate); },

  /* ── 点击未来7天推荐项 ── */
  onWeekRecTap: function (e) {
    var dateStr = e.currentTarget.dataset.date;
    if (!dateStr) return;
    var chips = this.data.dateChips;
    for (var i = 0; i < chips.length; i++) chips[i].active = false;
    this.setData({ dateChips: chips, selectedDate: dateStr, dateLabel: dateStr });
    this.switchDate(dateStr);
  },

  /* ── 快捷日期 ── */
  onTapChip: function (e) {
    var index = e.currentTarget.dataset.index;
    var chips = this.data.dateChips;
    for (var i = 0; i < chips.length; i++) chips[i].active = (i === index);
    var sel = chips[index];
    this.setData({ dateChips: chips, selectedDate: sel.date, dateLabel: sel.label });
    this.switchDate(sel.date);
  },

  /* ── 日历弹窗 ── */
  onOpenCalendar: function () {
    this.setData({ showCalendar: true });
  },

  onCloseCalendar: function () {
    this.setData({ showCalendar: false });
  },

  onPrevMonth: function () {
    var cm = this.data.calMonth;
    var cy = this.data.calYear;
    if (cm === 0) { cy--; cm = 11; } else { cm--; }
    this.setData({ calYear: cy, calMonth: cm, calMatrix: buildCalendarMatrix(cy, cm) });
  },

  onNextMonth: function () {
    var cm = this.data.calMonth;
    var cy = this.data.calYear;
    if (cm === 11) { cy++; cm = 0; } else { cm++; }
    this.setData({ calYear: cy, calMonth: cm, calMatrix: buildCalendarMatrix(cy, cm) });
  },

  onTapCalDay: function (e) {
    var dateStr = e.currentTarget.dataset.date;
    if (!dateStr) return;
    if (dateStr < this.data.calMinDate || dateStr > this.data.calMaxDate) return;
    var chips = this.data.dateChips;
    for (var i = 0; i < chips.length; i++) chips[i].active = false;
    this.setData({
      selectedDate: dateStr, dateLabel: dateStr,
      dateChips: chips, showCalendar: false,
    });
    this.switchDate(dateStr);
  },

  /* ── 日期切换（使用缓存数据）── */
  switchDate: function (targetDate) {
    var spotData = this.data._spotData;
    if (!spotData || Object.keys(spotData).length === 0) {
      this.loadData(targetDate);
      return;
    }
    var spotIds = Object.keys(spotData);
    var targetDaily = null;
    for (var i = 0; i < spotIds.length; i++) {
      var d = spotData[spotIds[i]].daily;
      for (var j = 0; j < d.length; j++) {
        if (d[j].date === targetDate) { targetDaily = d[j]; break; }
      }
      if (targetDaily) break;
    }
    if (!targetDaily) {
      this.loadData(targetDate);
      return;
    }
    var dayTemp = targetDaily.sea_temp_avg_c || 0;
    var summaries = this.evaluateAllSpots(spotData, targetDate, dayTemp);
    var topSpots = summaries.slice(0, 5).map(function (r) {
      var sd = spotData[r.spotId];
      var targetHourly = sd ? sd.hourly.filter(function (h) { return h.time.slice(0, 10) === targetDate; }) : [];
      var ranges = this.calcSpotRanges(targetHourly);
      return {
        spotId: r.spotId, name: r.name, area: r.area, level: r.level,
        bottom: r.bottom, tideNote: r.tideNote,
        stars: r.stars, starLabel: r.starLabel, starStr: r.starStr,
        starLevel: r.starLevel, starWidths: recommender.starWidths(r.stars),
        bestScore: r.bestScore, timeRange: r.timeRange,
        waveRangeVal: ranges.waveRangeVal, swellRangeVal: ranges.swellRangeVal,
        windSpeedRange: r.windSpeedRange,
        dimScores: r.dimScores, videoCid: r.videoCid,
      };
    }.bind(this));
    this.setData({ topSpots: topSpots });
  },

  /* ── 数据加载 ── */
  loadData: function (targetDate) {
    var that = this;
    targetDate = targetDate || this.data.selectedDate;
    this.setData({ loading: true, errorMsg: '' });

    /* 并行请求所有浪点数据 */
    var spotIds = Object.keys(SPOT_COORDS);
    var promises = spotIds.map(function (sid) {
      var c = SPOT_COORDS[sid];
      return waveFetcher.fetchWaveData(c.lat, c.lon).then(function (data) {
        return { spotId: sid, daily: data.daily, hourly: data.hourly };
      });
    });

    Promise.all(promises).then(function (results) {
      var spotData = {};
      for (var i = 0; i < results.length; i++) {
        spotData[results[i].spotId] = { daily: results[i].daily, hourly: results[i].hourly };
      }
      that.setData({ _spotData: spotData });

      var todayDate = fmtDate(new Date());

      /* 今天冲浪建议：用各浪点今天数据的平均值 */
      var allTodayHourly = [];
      var allTodayDaily = [];
      for (var j = 0; j < results.length; j++) {
        var d = results[j].daily;
        var h = results[j].hourly;
        for (var k = 0; k < d.length; k++) {
          if (d[k].date === todayDate) { allTodayDaily.push(d[k]); break; }
        }
        allTodayHourly = allTodayHourly.concat(h.filter(function (item) { return item.time.slice(0, 10) === todayDate; }));
      }
      /* 取今天第一个有数据的浪点作为代表生成建议 */
      var refDaily = allTodayDaily.length > 0 ? allTodayDaily[0] : {};
      var todayWaveH = refDaily.wave_height_avg_m || 0;
      var todaySwell = refDaily.swell_period_avg_s || 0;
      var todayTemp = refDaily.sea_temp_avg_c || 0;
      var todayWindSpeed = refDaily.wind_speed_avg_kmh || null;
      var todayWindDir = refDaily.wind_direction_cn || null;

      var todaySummaries = that.evaluateAllSpots(spotData, todayDate, todayTemp);
      var todayAdvice = recommender.buildAdvice(todaySummaries, todayWaveH, todaySwell, todayTemp, todayWindSpeed, todayWindDir);

      var weekRecs = that.buildWeekRecommendations(spotData);

      that.renderDateData(spotData, targetDate);

      var now = new Date();
      that.setData({
        todayAdvice: todayAdvice,
        weekRecommendations: weekRecs,
        lastUpdate: now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0'),
      });
      wx.stopPullDownRefresh();
    }).catch(function (err) {
      console.error('[shuangyuewan] Error:', err);
      that.setData({ loading: false, errorMsg: err.message || '浪况加载失败' });
      wx.stopPullDownRefresh();
    });
  },

  /* ── 对各浪点分别用自己的数据评分并汇总 ── */
  evaluateAllSpots: function (spotData, targetDate, dayTemp) {
    var allSummaries = [];
    var spotIds = Object.keys(spotData);
    for (var i = 0; i < spotIds.length; i++) {
      var sid = spotIds[i];
      var sd = spotData[sid];
      var targetHourly = sd.hourly.filter(function (h) { return h.time.slice(0, 10) === targetDate; });

      /* 计算该浪点当日潮汐统计 */
      var seaLevels = [];
      for (var k = 0; k < targetHourly.length; k++) {
        if (targetHourly[k].sea_level_m != null) seaLevels.push(targetHourly[k].sea_level_m);
      }
      var dailySeaMean = seaLevels.length > 0 ? seaLevels.reduce(function (a, b) { return a + b; }, 0) / seaLevels.length : null;
      var dailySeaMax = seaLevels.length > 0 ? Math.max.apply(null, seaLevels) : null;
      var dailySeaMin = seaLevels.length > 0 ? Math.min.apply(null, seaLevels) : null;

      var scores = recommender.scoreHourly(sid, targetHourly, dailySeaMean, dailySeaMax, dailySeaMin);
      var summary = recommender.summarizeSpot(sid, scores);
      summary.waterTemp = dayTemp;
      allSummaries.push(summary);
    }
    allSummaries.sort(function (a, b) { return b.bestScore - a.bestScore; });
    return allSummaries;
  },

  /* ── 计算单个浪点的浪高/周期范围 ── */
  calcSpotRanges: function (hourlyData) {
    var wMin = null, wMax = null, sMin = null, sMax = null;
    for (var i = 0; i < hourlyData.length; i++) {
      var wh = hourlyData[i].wave_height_m;
      var sp = hourlyData[i].swell_period_s;
      if (wh != null) { if (wMin === null || wh < wMin) wMin = wh; if (wMax === null || wh > wMax) wMax = wh; }
      if (sp != null) { if (sMin === null || sp < sMin) sMin = sp; if (sMax === null || sp > sMax) sMax = sp; }
    }
    return {
      waveRange: (wMin != null && wMax != null) ? wMin.toFixed(1) + 'm-' + wMax.toFixed(1) + 'm' : '--',
      waveRangeVal: (wMin != null && wMax != null) ? wMin.toFixed(1) + '-' + wMax.toFixed(1) : '--',
      swellRange: (sMin != null && sMax != null) ? sMin.toFixed(1) + 's-' + sMax.toFixed(1) + 's' : '--',
      swellRangeVal: (sMin != null && sMax != null) ? sMin.toFixed(1) + '-' + sMax.toFixed(1) : '--',
    };
  },

  renderDateData: function (spotData, targetDate) {
    var that = this;
    var spotIds = Object.keys(spotData);

    /* 取第一个浪点的 daily 作为代表展示 */
    var targetDaily = null;
    for (var i = 0; i < spotIds.length; i++) {
      var d = spotData[spotIds[i]].daily;
      for (var j = 0; j < d.length; j++) {
        if (d[j].date === targetDate) { targetDaily = d[j]; break; }
      }
      if (targetDaily) break;
    }
    if (!targetDaily) targetDaily = {};

    var dayWaveH = targetDaily.wave_height_avg_m || 0;
    var daySwell = targetDaily.swell_period_avg_s || 0;
    var dayTemp = targetDaily.sea_temp_avg_c || 0;

    var summaries = that.evaluateAllSpots(spotData, targetDate, dayTemp);

    var topSpots = summaries.slice(0, 5).map(function (r) {
      /* 各浪点用自己的小时数据计算范围 */
      var sd = spotData[r.spotId];
      var targetHourly = sd ? sd.hourly.filter(function (h) { return h.time.slice(0, 10) === targetDate; }) : [];
      var ranges = that.calcSpotRanges(targetHourly);
      return {
        spotId: r.spotId, name: r.name, area: r.area, level: r.level,
        bottom: r.bottom, tideNote: r.tideNote,
        stars: r.stars, starLabel: r.starLabel, starStr: r.starStr,
        starLevel: r.starLevel, starWidths: recommender.starWidths(r.stars),
        bestScore: r.bestScore, timeRange: r.timeRange,
        waveRange: ranges.waveRange, waveRangeVal: ranges.waveRangeVal,
        swellRange: ranges.swellRange, swellRangeVal: ranges.swellRangeVal,
        windSpeedRange: r.windSpeedRange,
        dimScores: r.dimScores, videoCid: r.videoCid,
      };
    });

    that.setData({
      loading: false,
      todayWaveH: dayWaveH.toFixed(1), todaySwell: daySwell.toFixed(1), todayTemp: dayTemp.toFixed(0),
      topSpots: topSpots,
    });
  },

  buildWeekRecommendations: function (spotData) {
    var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    var dayScores = [];

    /* 从第一个浪点获取日期列表 */
    var firstId = Object.keys(spotData)[0];
    var dailyData = spotData[firstId] ? spotData[firstId].daily : [];

    for (var i = 0; i < dailyData.length; i++) {
      var dateStr = dailyData[i].date;
      var dayTemp = dailyData[i].sea_temp_avg_c || 0;

      var summaries = this.evaluateAllSpots(spotData, dateStr, dayTemp);
      var best = summaries.length > 0 ? summaries[0] : null;
      var scoreVal = best ? best.bestScore : 0;
      var stars = best ? best.stars : 1;

      dayScores.push({
        date: dateStr,
        weekday: weekdays[new Date(dateStr).getDay()],
        dateLabel: dateStr.slice(5),
        score: scoreVal,
        scoreLabel: scoreVal.toFixed(0) + '分',
        waveH: (dailyData[i].wave_height_avg_m || 0).toFixed(1),
        period: (dailyData[i].swell_period_avg_s || 0).toFixed(1),
        stars: stars,
        starLabel: best ? best.starLabel : '不推荐',
        bestSpot: best ? best.name : '--',
      });
    }

    dayScores.sort(function (a, b) { return b.score - a.score; });
    return dayScores.slice(0, 3);
  },

  onRetryLoad: function () { this.loadData(this.data.selectedDate); },
  onShowRules: function () { wx.navigateTo({ url: '/pages/rules/rules' }); },
  onTopSpotTap: function (e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.spotId });
  },
  onHeaderJump: function (e) {
    var cid = e.currentTarget.dataset.cid;
    wx.navigateToMiniProgram({
      appId: 'wxef080ceb52a9699f',
      path: 'pages/webview/index?cid=' + cid,
    });
  },
  onShareAppMessage: function () { return { title: '双月湾浪点推荐', path: '/pages/huizhou/huizhou' }; },
});
