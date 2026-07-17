var recommender = require('../../services/huizhou-recommender');

Page({
  data: {
    spots: [],
  },

  onLoad: function () {
    this.buildSpotList();
  },

  buildSpotList: function () {
    var scoring = recommender.SPOT_SCORING;
    var spots = [];
    var spotIds = Object.keys(scoring);

    for (var i = 0; i < spotIds.length; i++) {
      var id = spotIds[i];
      var s = scoring[id];
      spots.push({
        name: s.name,
        area: s.area,
        level: s.level,
        bottom: s.bottom,
        tideNote: s.tideNote,
        dirRules: this.formatDirRules(s.dirRules),
        waveRanges: this.formatRanges(s.waveRanges, 'm'),
        swellRanges: this.formatRanges(s.swellRanges, 's'),
        windRules: this.formatWindRules(s.windRules),
      });
    }

    this.setData({ spots: spots });
  },

  formatDirRules: function (rules) {
    return rules.map(function (r) {
      return r.dirs.join('/') + '：' + r.score + '分';
    }).join('，');
  },

  formatRanges: function (ranges, unit) {
    var parts = [];
    for (var i = 0; i < ranges.length; i++) {
      var label = '';
      if (i === 0) label = '优质段';
      else if (i === ranges.length - 1) label = '差档';
      else if (i === 1 && ranges.length === 4) label = '可接受段';
      var val = ranges[i][0];
      var score = ranges[i][1];
      if (i === 0) label = '≥' + val + unit + ' → ' + score + '分';
      else if (i < ranges.length - 1) label = val + unit + ' → ' + score + '分';
      else label = '≥' + val + unit + ' → ' + score + '分';
      parts.push(label);
    }
    return parts.join('，');
  },

  formatWindRules: function (rules) {
    if (!rules) return '--';
    return '离岸风（10分）：' + rules.offshore.join('/') + ' | 迎岸风（2分）：' + rules.onshore.join('/');
  },
});
