/**
 * 双月湾页 — 浪点推荐 + 日期筛选 + 日历弹窗
 */
var recommender = require('../../services/huizhou-recommender');
var waveFetcher = require('../../services/wave-fetcher');

var HUIZHOU_LAT = 22.57;
var HUIZHOU_LON = 114.88;

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
    loading: true, errorMsg: '', advice: '',
    todayWaveH: '', todaySwell: '', todayTemp: '',
    topSpots: [], lastUpdate: '',
    dateChips: [], selectedDate: '', dateLabel: '', pickerEnd: '',
    // 日历弹窗
    showCalendar: false,
    calYear: 0, calMonth: 0,
    calMinDate: '', calMaxDate: '',
    calMatrix: [],
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

  /* ── 快捷日期 ── */
  onTapChip: function (e) {
    var index = e.currentTarget.dataset.index;
    var chips = this.data.dateChips;
    for (var i = 0; i < chips.length; i++) chips[i].active = (i === index);
    var sel = chips[index];
    this.setData({ dateChips: chips, selectedDate: sel.date, dateLabel: sel.label });
    this.loadData(sel.date);
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
    // 清除chip选中
    var chips = this.data.dateChips;
    for (var i = 0; i < chips.length; i++) chips[i].active = false;
    this.setData({
      selectedDate: dateStr, dateLabel: dateStr,
      dateChips: chips, showCalendar: false,
    });
    this.loadData(dateStr);
  },

  /* ── 数据加载 ── */
  loadData: function (targetDate) {
    var that = this;
    targetDate = targetDate || this.data.selectedDate;
    this.setData({ loading: true, errorMsg: '' });

    waveFetcher.fetchWaveData(HUIZHOU_LAT, HUIZHOU_LON).then(function (data) {
      var targetHourly = data.hourly.filter(function (h) { return h.time.slice(0, 10) === targetDate; });
      var targetDaily = null;
      for (var i = 0; i < data.daily.length; i++) {
        if (data.daily[i].date === targetDate) { targetDaily = data.daily[i]; break; }
      }
      if (!targetDaily) targetDaily = {};

      var dayWaveH = targetDaily.wave_height_avg_m || 0;
      var daySwell = targetDaily.swell_period_avg_s || 0;
      var dayTemp = targetDaily.sea_temp_avg_c || 0;

      var summaries = recommender.evaluateAll(targetHourly, dayTemp);
      var advice = recommender.buildAdvice(summaries, dayWaveH, daySwell, dayTemp);

      var wMin = null, wMax = null, sMin = null, sMax = null;
      for (var i = 0; i < targetHourly.length; i++) {
        var wh = targetHourly[i].wave_height_m;
        var sp = targetHourly[i].swell_period_s;
        if (wh != null) { if (wMin === null || wh < wMin) wMin = wh; if (wMax === null || wh > wMax) wMax = wh; }
        if (sp != null) { if (sMin === null || sp < sMin) sMin = sp; if (sMax === null || sp > sMax) sMax = sp; }
      }
      var waveRange = (wMin != null && wMax != null) ? wMin.toFixed(1) + 'm-' + wMax.toFixed(1) + 'm' : '--';
      var waveRangeVal = (wMin != null && wMax != null) ? wMin.toFixed(1) + '-' + wMax.toFixed(1) : '--';
      var swellRange = (sMin != null && sMax != null) ? sMin.toFixed(1) + 's-' + sMax.toFixed(1) + 's' : '--';
      var swellRangeVal = (sMin != null && sMax != null) ? sMin.toFixed(1) + '-' + sMax.toFixed(1) : '--';

      var topSpots = summaries.slice(0, 3).map(function (r) {
        return {
          spotId: r.spotId, name: r.name, area: r.area, level: r.level,
          bottom: r.bottom, tideNote: r.tideNote,
          stars: r.stars, starLabel: r.starLabel, starStr: r.starStr,
          bestScore: r.bestScore, timeRange: r.timeRange,
          waveRange: waveRange, waveRangeVal: waveRangeVal,
          swellRange: swellRange, swellRangeVal: swellRangeVal,
          avgSeaLevel: r.avgSeaLevel,
          dimScores: r.dimScores, videoCid: r.videoCid,
        };
      });

      var now = new Date();
      that.setData({
        loading: false, advice: advice,
        todayWaveH: dayWaveH.toFixed(1), todaySwell: daySwell.toFixed(1), todayTemp: dayTemp.toFixed(0),
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
