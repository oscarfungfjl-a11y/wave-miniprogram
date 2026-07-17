/**
 * 双月湾浪点推荐引擎 v5
 * 当日综合浪况五维评分：周期(40) + 浪高(30) + 风向(10) + 潮汐(10) + 浪向(10) = 满分100
 * 星级映射：5★高推荐 ≥80 / 4★推荐 ≥60 / 3★一般 ≥40 / 2★较差 ≥20 / 1★不推荐 <20
 *
 * 注意：浪向和风向为全局10分项，浪高/周期仍按各浪点适配区间打分
 */

var SWELL_MAX = 40;     // 涌浪周期满分
var WAVE_MAX = 30;      // 浪高满分
var WIND_MAX = 10;      // 风向满分（全局）
var TIDE_MAX = 10;      // 潮汐满分
var DIR_MAX = 10;       // 浪向满分（全局）

/**
 * 波向 → 方向组归类
 */
function classifyDir(cn) {
  if (!cn) return '未知';
  if (cn.indexOf('东北') !== -1) return '东北';
  if (cn.indexOf('东南') !== -1) return '东南';
  if (cn.indexOf('西北') !== -1) return '西北';
  if (cn.indexOf('西南') !== -1) return '西南';
  if (cn.indexOf('北') !== -1) return '北';
  if (cn.indexOf('南') !== -1) return '南';
  if (cn.indexOf('东') !== -1) return '东';
  if (cn.indexOf('西') !== -1) return '西';
  return cn;
}

/**
 * 多点线性插值打分
 * @param {number} value - 实际值
 * @param {Array} ranges - [[threshold, score], [threshold, score], ...] 支持升序、降序、峰值模式
 * @returns {number}
 */
function linearScore(value, ranges) {
  if (value == null) return 0;
  
  for (var i = 0; i < ranges.length; i++) {
    if (value === ranges[i][0]) {
      return ranges[i][1];
    }
  }
  
  for (var i = 0; i < ranges.length - 1; i++) {
    var t0 = ranges[i][0], s0 = ranges[i][1];
    var t1 = ranges[i+1][0], s1 = ranges[i+1][1];
    
    if (t0 === t1) {
      if (value >= t0) continue;
      return s0;
    }
    
    if (t0 < t1) {
      if (value > t0 && value < t1) {
        var t = (value - t0) / (t1 - t0);
        return s0 + t * (s1 - s0);
      }
    } else {
      if (value < t0 && value > t1) {
        var t = (t0 - value) / (t0 - t1);
        return s0 + t * (s1 - s0);
      }
    }
  }
  
  return ranges[ranges.length - 1][1];
}

/**
 * 浪向得分 — 字符串匹配（浪点适配的浪向）
 * @param {Array} rules - [{dirs: [...], score: number}, ...]
 */
function dirScore(actualDir, rules) {
  var dir = classifyDir(actualDir);
  for (var i = 0; i < rules.length; i++) {
    for (var j = 0; j < rules[i].dirs.length; j++) {
      if (rules[i].dirs[j] === dir) return rules[i].score;
    }
  }
  return rules[rules.length - 1].score || 0;
}

// ── 各浪点评分规则表（满分 100 分） ──

var SPOT_SCORING = {
  'huizhou-loop': {
    name: 'LOOP浪点',
    area: '东岸',
    level: '全水平通用', bottom: '纯沙底安全浪点',
    videoCid: 3,
    dirRules: [
      { dirs: ['东', '东南'], score: 10 },
      { dirs: ['东北'], score: 7 },
      { dirs: ['南', '北'], score: 4 },
      { dirs: ['西', '西南', '西北'], score: 0 },
    ],
    waveRanges: [[0.6, 0], [0.6, 30], [1.5, 30], [2.0, 10], [3.0, 0]],
    swellRanges: [[10, 40], [7, 25], [5, 10]],
    windRules: {
      offshore: ['西', '西北', '西南'],
      onshore: ['东', '东南', '东北'],
    },
    tideNote: '涨潮/高潮最佳',
  },
  'huizhou-qingrendao': {
    name: '情人岛浪点',
    area: '东岸',
    level: '新手入门', bottom: '平缓沙底',
    videoCid: 67,
    dirRules: [
      { dirs: ['东', '东南'], score: 10 },
      { dirs: ['东北', '南'], score: 7 },
      { dirs: ['西', '西南', '西北'], score: 0 },
    ],
    waveRanges: [[0.3, 0], [0.3, 30], [0.8, 30], [1.2, 10], [1.5, 0]],
    swellRanges: [[8, 40], [6, 25], [4, 10]],
    windRules: {
      offshore: ['西', '西北', '西南'],
      onshore: ['东', '东南', '东北'],
    },
    tideNote: '中潮-高潮段最佳',
  },
  'huizhou-honghaiwan': {
    name: '虹海湾（山海里）浪点',
    area: '东岸',
    level: '入门-进阶', bottom: '牛奶浪特色',
    videoCid: 54,
    dirRules: [
      { dirs: ['东', '东南'], score: 10 },
      { dirs: ['东北', '南'], score: 6 },
      { dirs: ['西', '西南', '西北', '北'], score: 0 },
    ],
    waveRanges: [[0.8, 0], [0.8, 30], [1.8, 30], [2.2, 10], [3.0, 0]],
    swellRanges: [[10, 40], [7, 25], [5, 10]],
    windRules: {
      offshore: ['西', '西北', '北西北'],
      onshore: ['东', '东南', '南东南'],
    },
    tideNote: '涨潮期-高潮最佳',
  },
  'huizhou-gaoyangwei': {
    name: '高洋尾浪点',
    area: '东岸',
    level: '进阶-资深', bottom: '礁石旁强力浪点',
    videoCid: 1,
    dirRules: [
      { dirs: ['东南', '南'], score: 10 },
      { dirs: ['东', '西南'], score: 6 },
      { dirs: ['北', '西', '西北'], score: 0 },
    ],
    waveRanges: [[1.0, 0], [1.0, 30], [2.2, 30], [2.8, 10], [3.5, 0]],
    swellRanges: [[12, 40], [9, 25], [7, 10]],
    windRules: {
      offshore: ['西', '西北', '西南'],
      onshore: ['东', '东南', '东北'],
    },
    tideNote: '中潮-高潮（礁石淹没无风险）',
  },
  'huizhou-wanke': {
    name: '万科沙滩浪点',
    area: '西岸',
    level: '纯新手·亲子', bottom: '内湾平缓浪点',
    videoCid: 53,
    dirRules: [
      { dirs: ['西南', '南'], score: 10 },
      { dirs: ['西'], score: 7 },
      { dirs: ['东', '东北', '北'], score: 0 },
    ],
    waveRanges: [[0.3, 0], [0.3, 30], [0.8, 30], [1.2, 10], [1.5, 0]],
    swellRanges: [[8, 40], [6, 25], [4, 10]],
    windRules: {
      offshore: ['东', '东北', '北'],
      onshore: ['西', '西南', '南'],
    },
    tideNote: '中潮-高潮最佳',
  },
  'huizhou-shizidao': {
    name: '狮子岛浪点',
    area: '西岸',
    level: '入门-进阶', bottom: '西岸优质浪点',
    videoCid: 2,
    dirRules: [
      { dirs: ['西南', '南'], score: 10 },
      { dirs: ['西'], score: 6 },
      { dirs: ['东', '北', '东北'], score: 0 },
    ],
    waveRanges: [[0.6, 0], [0.6, 30], [1.5, 30], [2.0, 10], [3.0, 0]],
    swellRanges: [[10, 40], [7, 25], [5, 10]],
    windRules: {
      offshore: ['东', '东北', '北'],
      onshore: ['西', '西南', '南'],
    },
    tideNote: '涨潮-高潮段最佳',
  },
};

/**
 * 潮汐水位得分 — 基于海平面高度偏离日均值
 * 高于日均值 = 涨潮/高潮段 → 高分
 * @returns {number} 0-10
 */
function tideScore(seaLevel, dailyMean, dailyMax, dailyMin) {
  if (seaLevel == null || dailyMean == null) return 5;

  var range = dailyMax - dailyMin;
  if (range < 0.05) return 5;

  var normalized = (seaLevel - dailyMean) / (range / 2);
  normalized = Math.max(-1, Math.min(1, normalized));

  var score = 5 + normalized * 5;
  return Math.round(Math.max(0, Math.min(10, score)));
}

/**
 * 判断风向类型
 */
function getWindType(windDir, windRules) {
  if (!windRules) return '侧风';
  var dir = classifyDir(windDir);
  for (var i = 0; i < windRules.offshore.length; i++) {
    if (classifyDir(windRules.offshore[i]) === dir) return '离岸风';
  }
  for (var j = 0; j < windRules.onshore.length; j++) {
    if (classifyDir(windRules.onshore[j]) === dir) return '迎岸风';
  }
  return '侧风';
}

/**
 * 风向得分 — 离岸风高分，迎岸风低分（满分10）
 */
function windScore(windDir, windSpeed, windRules) {
  if (!windRules) return 5;

  var dir = classifyDir(windDir);
  var isOffshore = false;
  var isOnshore = false;

  for (var i = 0; i < windRules.offshore.length; i++) {
    if (classifyDir(windRules.offshore[i]) === dir) { isOffshore = true; break; }
  }
  if (!isOffshore) {
    for (var j = 0; j < windRules.onshore.length; j++) {
      if (classifyDir(windRules.onshore[j]) === dir) { isOnshore = true; break; }
    }
  }

  var dirBase;
  if (isOffshore) dirBase = 10;
  else if (isOnshore) dirBase = 2;
  else dirBase = 6;

  if (windSpeed == null) return 5;

  if (windSpeed <= 10) return dirBase;
  else if (windSpeed <= 20) {
    if (isOffshore) return Math.round(dirBase * 0.9);
    if (isOnshore) return Math.round(dirBase * 0.7);
    return Math.round(dirBase * 0.85);
  } else if (windSpeed <= 30) {
    if (isOffshore) return Math.round(dirBase * 0.7);
    if (isOnshore) return Math.round(dirBase * 0.4);
    return Math.round(dirBase * 0.6);
  } else {
    if (isOffshore) return Math.round(dirBase * 0.5);
    if (isOnshore) return Math.round(dirBase * 0.2);
    return Math.round(dirBase * 0.4);
  }
}

/**
 * 分数 → 星级映射（支持半星）
 * 5.0★高推荐 ≥90 | 4.5★ ≥80 | 4.0★推荐 ≥70 | 3.5★ ≥60 | 3.0★一般 ≥50 | 2.5★ ≥40 | 2.0★较差 ≥30 | 1.5★ ≥20 | 1.0★不推荐 <20
 */
function scoreToStars(score) {
  if (score >= 90) return 5.0;
  if (score >= 80) return 4.5;
  if (score >= 70) return 4.0;
  if (score >= 60) return 3.5;
  if (score >= 50) return 3.0;
  if (score >= 40) return 2.5;
  if (score >= 30) return 2.0;
  if (score >= 20) return 1.5;
  return 1.0;
}

var STAR_LABELS = {
  '5': '高推荐',
  '4.5': '高推荐',
  '4': '推荐',
  '3.5': '推荐',
  '3': '一般',
  '2.5': '一般',
  '2': '较差',
  '1.5': '较差',
  '1': '不推荐',
};

/** 生成星形字符串，如 3.5 → "★★★½☆" */
function starString(stars) {
  var fullStars = Math.floor(stars);
  var hasHalf = stars % 1 >= 0.5;
  var emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  return '★'.repeat(fullStars) + (hasHalf ? '½' : '') + '☆'.repeat(emptyStars);
}

/** 生成半星宽度数组，避免WXML中使用嵌套三元运算 */
function starWidths(stars) {
  var widths = [];
  for (var i = 1; i <= 5; i++) {
    if (i <= stars) {
      widths.push('100%');
    } else if (i - 0.5 <= stars) {
      widths.push('50%');
    } else {
      widths.push('0%');
    }
  }
  return widths;
}

/**
 * 对单个浪点逐小时打分
 */
function scoreHourly(spotId, hourlyData, dailySeaMean, dailySeaMax, dailySeaMin) {
  var rules = SPOT_SCORING[spotId];
  if (!rules) return [];

  var results = [];
  for (var i = 0; i < hourlyData.length; i++) {
    var h = hourlyData[i];
    var waveH = h.wave_height_m;
    var swellPeriod = h.swell_period_s;
    var waveDir = h.wave_direction_cn;

    var dirS = dirScore(waveDir, rules.dirRules);            // 满分10
    var waveS = linearScore(waveH, rules.waveRanges);        // 满分30
    var swellS = linearScore(swellPeriod, rules.swellRanges); // 满分40
    var windS = windScore(h.wind_direction_cn, h.wind_speed_kmh, rules.windRules); // 满分10
    var tideS = tideScore(h.sea_level_m, dailySeaMean, dailySeaMax, dailySeaMin);  // 满分10
    var windT = getWindType(h.wind_direction_cn, rules.windRules);

    var total = Math.round(dirS + waveS + swellS + windS + tideS);
    var stars = scoreToStars(total);

    results.push({
      time: h.time_label,
      waveH: waveH,
      swellPeriod: swellPeriod,
      waveDir: waveDir,
      windDir: h.wind_direction_cn,
      windSpeed: h.wind_speed_kmh,
      windType: windT,
      seaLevel: h.sea_level_m,
      totalScore: total,
      stars: stars,
      dirScore: Math.round(dirS),
      waveScore: Math.round(waveS),
      swellScore: Math.round(swellS),
      windScore: Math.round(windS),
      tideScore: Math.round(tideS),
    });
  }
  return results;
}

/**
 * 合并连续时间标签
 */
function mergeTimeRanges(hours) {
  if (!hours || hours.length === 0) return '暂无推荐时段';
  var ranges = [];
  var start = hours[0];
  for (var i = 1; i <= hours.length; i++) {
    var prevHour = parseInt(hours[i - 1].split(':')[0]);
    var curHour = i < hours.length ? parseInt(hours[i].split(':')[0]) : -1;
    if (curHour !== prevHour + 1 || i === hours.length) {
      if (start === hours[i - 1]) {
        ranges.push(start);
      } else {
        ranges.push(start + '~' + hours[i - 1]);
      }
      if (i < hours.length) start = hours[i];
    }
  }
  return ranges.join('、');
}

/**
 * 汇总每个浪点的最佳时段
 */
function summarizeSpot(spotId, scores) {
  var rules = SPOT_SCORING[spotId];
  var recHours = [];   // 4★及以上
  var avgHours = [];   // 3★
  var bestScore = 0;

  for (var i = 0; i < scores.length; i++) {
    var s = scores[i];
    if (s.totalScore > bestScore) bestScore = s.totalScore;
    if (s.stars >= 4) recHours.push(s.time);
    else if (s.stars === 3) avgHours.push(s.time);
  }

  var sorted = scores.slice().sort(function (a, b) { return b.totalScore - a.totalScore; });
  var top3 = sorted.slice(0, 3);
  var avgWaveH = 0, avgSwell = 0, avgSeaLevel = 0;
  var windSpeedMin = null, windSpeedMax = null;
  if (top3.length > 0) {
    avgWaveH = top3.reduce(function (sum, s) { return sum + (s.waveH || 0); }, 0) / top3.length;
    avgSwell = top3.reduce(function (sum, s) { return sum + (s.swellPeriod || 0); }, 0) / top3.length;
    avgSeaLevel = top3.reduce(function (sum, s) { return sum + (s.seaLevel || 0); }, 0) / top3.length;
    var windSpeeds = top3.filter(function (s) { return s.windSpeed != null; }).map(function (s) { return s.windSpeed; });
    if (windSpeeds.length > 0) {
      windSpeedMin = Math.min.apply(null, windSpeeds);
      windSpeedMax = Math.max.apply(null, windSpeeds);
    }
  }

  var stars = scoreToStars(bestScore);

  var timeText = '';
  var targetHours = recHours.length > 0 ? recHours : avgHours;
  timeText = mergeTimeRanges(targetHours);

  var bestHourScores = sorted.length > 0 ? {
    dirScore: sorted[0].dirScore,
    waveScore: sorted[0].waveScore,
    swellScore: sorted[0].swellScore,
    windScore: sorted[0].windScore,
    tideScore: sorted[0].tideScore,
  } : null;

  return {
    spotId: spotId,
    name: rules.name,
    area: rules.area,
    level: rules.level,
    bottom: rules.bottom,
    tideNote: rules.tideNote,
    videoCid: rules.videoCid,
    bestScore: bestScore,
    stars: stars,
    starLabel: STAR_LABELS[stars],
    starStr: starString(stars),
    starLevel: stars >= 4.5 ? 5 : stars >= 3.5 ? 4 : stars >= 2.5 ? 3 : stars >= 1.5 ? 2 : 1,
    timeRange: timeText,
    recHours: recHours.length,
    avgHours: avgHours.length,
    avgWaveH: avgWaveH.toFixed(1),
    avgSwell: avgSwell.toFixed(1),
    avgSeaLevel: avgSeaLevel.toFixed(2),
    windSpeedRange: (windSpeedMin != null && windSpeedMax != null)
      ? windSpeedMin.toFixed(1) + '-' + windSpeedMax.toFixed(1)
      : '--',
    dimScores: bestHourScores,
    scores: sorted.slice(0, 5),
  };
}

/**
 * 评估所有浪点，返回排序后的汇总
 */
function evaluateAll(hourlyData, waterTemp) {
  var seaLevels = [];
  for (var i = 0; i < hourlyData.length; i++) {
    if (hourlyData[i].sea_level_m != null) {
      seaLevels.push(hourlyData[i].sea_level_m);
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

  var spotIds = Object.keys(SPOT_SCORING);
  var summaries = [];

  for (var i = 0; i < spotIds.length; i++) {
    var id = spotIds[i];
    var scores = scoreHourly(id, hourlyData, dailySeaMean, dailySeaMax, dailySeaMin);
    var summary = summarizeSpot(id, scores);
    summary.waterTemp = waterTemp;
    summaries.push(summary);
  }

  summaries.sort(function (a, b) { return b.bestScore - a.bestScore; });
  return summaries;
}

/**
 * 生成自然语言建议
 */
function buildAdvice(summaries, todayWaveH, todaySwell, todayTemp, todayWindSpeed, todayWindDir) {
  if (summaries.length === 0) return '暂无数据';

  var best = summaries[0];
  if (best.stars < 3) {
    var reasons = [];
    if (todaySwell < 6) reasons.push('涌浪周期过低（' + todaySwell.toFixed(1) + 's）');
    if (todayWaveH < 0.3) reasons.push('浪高偏低（' + todayWaveH.toFixed(1) + 'm）');
    else if (todayWaveH > 2.8) reasons.push('浪高偏大（' + todayWaveH.toFixed(1) + 'm）');
    if (todayWindSpeed != null && todayWindSpeed > 25) reasons.push('风力偏大（' + todayWindSpeed.toFixed(0) + 'km/h）');
    if (reasons.length === 0) reasons.push('浪向与各浪点适配方向不匹配');
    return '今日不推荐：' + reasons.join('；') + '。建议改日再来。';
  }

  var parts = [];
  var great = summaries.filter(function (s) { return s.stars === 5; });
  var good = summaries.filter(function (s) { return s.stars === 4; });

  if (great.length > 0) {
    var gNames = great.slice(0, 3).map(function (s) { return s.name; });
    parts.push('高推荐浪点（5★）：' + gNames.join('、'));
  }
  if (good.length > 0 && great.length < 2) {
    var goNames = good.slice(0, 2).map(function (s) { return s.name; });
    parts.push('推荐浪点（4★）：' + goNames.join('、'));
  }

  if (todaySwell >= 10) parts.push('涌浪周期优秀（' + todaySwell.toFixed(1) + 's）');
  else if (todaySwell >= 7) parts.push('涌浪周期良好（' + todaySwell.toFixed(1) + 's）');

  if (todayWindSpeed != null) {
    var bestSpot = great.length > 0 ? great[0] : good.length > 0 ? good[0] : best;
    var windRules = SPOT_SCORING[bestSpot.spotId] ? SPOT_SCORING[bestSpot.spotId].windRules : null;
    if (windRules) {
      var wDir = classifyDir(todayWindDir);
      var isOff = windRules.offshore.some(function (d) { return classifyDir(d) === wDir; });
      if (isOff && todayWindSpeed <= 15) {
        parts.push('离岸风（' + todayWindDir + ' ' + todayWindSpeed.toFixed(0) + 'km/h），浪面干净');
      } else if (todayWindSpeed > 25) {
        parts.push('注意：风力较大（' + todayWindSpeed.toFixed(0) + 'km/h），浪面可能杂乱');
      } else if (!isOff && todayWindSpeed > 15) {
        parts.push('迎岸风（' + todayWindDir + ' ' + todayWindSpeed.toFixed(0) + 'km/h），浪面可能受影响');
      }
    }
  }

  if (todayTemp < 16) parts.push('注意：水温偏低（' + todayTemp.toFixed(0) + '°C），需配备湿衣');
  var evals = best.scores || [];
  if (evals.length > 0) {
    var bestHour = evals[0];
    if (bestHour && bestHour.waveH > 2.0) parts.push('提示：浪高偏大，新手请量力而行');
  }

  return parts.join('。') + '。';
}

module.exports = {
  SPOT_SCORING: SPOT_SCORING,
  SWELL_MAX: SWELL_MAX,
  WAVE_MAX: WAVE_MAX,
  WIND_MAX: WIND_MAX,
  TIDE_MAX: TIDE_MAX,
  DIR_MAX: DIR_MAX,
  evaluateAll: evaluateAll,
  scoreHourly: scoreHourly,
  summarizeSpot: summarizeSpot,
  scoreToStars: scoreToStars,
  starString: starString,
  starWidths: starWidths,
  STAR_LABELS: STAR_LABELS,
  mergeTimeRanges: mergeTimeRanges,
  buildAdvice: buildAdvice,
};
