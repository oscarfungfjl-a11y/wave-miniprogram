/**
 * 双月湾浪点推荐引擎 v2
 * 基于「双月湾冲浪浪点分档推荐打分规则」
 * 四维加权百分制：浪向适配30 + 浪高匹配30 + 涌浪周期25 + 潮汐水位15
 * 挡位：高推荐80-100 / 中推荐60-79 / 低推荐0-59
 */

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
 * 三点线性插值打分
 * @param {number} value - 实际值
 * @param {Array} ranges - [[threshold, score], [threshold, score], ...] 按threshold升序
 * @returns {number}
 */
function linearScore(value, ranges) {
  if (value == null) return 0;
  if (value <= ranges[0][0]) return ranges[0][1];
  if (value >= ranges[ranges.length - 1][0]) return ranges[ranges.length - 1][1];
  for (var i = 0; i < ranges.length - 1; i++) {
    if (value >= ranges[i][0] && value <= ranges[i + 1][0]) {
      var t = (value - ranges[i][0]) / (ranges[i + 1][0] - ranges[i][0]);
      return ranges[i][1] + t * (ranges[i + 1][1] - ranges[i][1]);
    }
  }
  return 0;
}

/**
 * 浪向得分 — 字符串匹配
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

// ── 各浪点评分规则表 ──

var SPOT_SCORING = {
  'huizhou-loop': {
    name: 'LOOP浪点',
    area: '东岸',
    level: '全水平通用', bottom: '纯沙底安全浪点',
    dirRules: [
      { dirs: ['东', '东南'], score: 28 },
      { dirs: ['东北'], score: 20 },
      { dirs: ['南', '北'], score: 10 },
      { dirs: ['西', '西南', '西北'], score: 0 },
    ],
    waveRanges: [[0.6, 28], [1.5, 28], [2.0, 10], [3.0, 0]],
    swellRanges: [[10, 23], [7, 15], [5, 5]],
    tideNote: '涨潮/高潮最佳',
  },
  'huizhou-qingrendao': {
    name: '情人岛浪点',
    area: '东岸',
    level: '新手入门', bottom: '平缓沙底',
    dirRules: [
      { dirs: ['东', '东南'], score: 28 },
      { dirs: ['东北', '南'], score: 20 },
      { dirs: ['西', '西南', '西北'], score: 0 },
    ],
    waveRanges: [[0.3, 28], [0.8, 28], [1.2, 10], [1.5, 0]],
    swellRanges: [[8, 23], [6, 15], [4, 5]],
    tideNote: '中潮-高潮段最佳',
  },
  'huizhou-honghaiwan': {
    name: '虹海湾主沙滩浪点',
    area: '东岸',
    level: '入门-进阶', bottom: '牛奶浪特色',
    dirRules: [
      { dirs: ['东', '东南'], score: 28 },
      { dirs: ['东北', '南'], score: 18 },
      { dirs: ['西', '西南', '西北', '北'], score: 0 },
    ],
    waveRanges: [[0.8, 28], [1.8, 28], [2.2, 10], [3.0, 0]],
    swellRanges: [[10, 23], [7, 15], [5, 5]],
    tideNote: '涨潮期-高潮最佳',
  },
  'huizhou-gaoyangwei': {
    name: '高洋尾浪点',
    area: '东岸',
    level: '进阶-资深', bottom: '礁石旁强力浪点',
    dirRules: [
      { dirs: ['东南', '南'], score: 28 },
      { dirs: ['东', '西南'], score: 18 },
      { dirs: ['北', '西', '西北'], score: 0 },
    ],
    waveRanges: [[1.0, 28], [2.2, 28], [2.8, 10], [3.5, 0]],
    swellRanges: [[12, 23], [9, 15], [7, 5]],
    tideNote: '中潮-高潮（礁石淹没无风险）',
  },
  'huizhou-wanke': {
    name: '万科沙滩浪点',
    area: '西岸',
    level: '纯新手·亲子', bottom: '内湾平缓浪点',
    dirRules: [
      { dirs: ['西南', '南'], score: 28 },
      { dirs: ['西'], score: 20 },
      { dirs: ['东', '东北', '北'], score: 0 },
    ],
    waveRanges: [[0.3, 28], [0.8, 28], [1.2, 10], [1.5, 0]],
    swellRanges: [[8, 23], [6, 15], [4, 5]],
    tideNote: '中潮-高潮最佳',
  },
  'huizhou-shizidao': {
    name: '狮子岛浪点',
    area: '西岸',
    level: '入门-进阶', bottom: '西岸优质浪点',
    dirRules: [
      { dirs: ['西南', '南'], score: 28 },
      { dirs: ['西'], score: 18 },
      { dirs: ['东', '北', '东北'], score: 0 },
    ],
    waveRanges: [[0.6, 28], [1.5, 28], [2.0, 10], [3.0, 0]],
    swellRanges: [[10, 23], [7, 15], [5, 5]],
    tideNote: '涨潮-高潮段最佳',
  },
};

/**
 * 潮汐水位得分 — 基于海平面高度偏离日均值
 * 高于日均值 = 涨潮/高潮段 → 高分
 * @param {number} seaLevel - 当前小时海平面高度 (m)
 * @param {number} dailyMean - 当日海平面均值 (m)
 * @param {number} dailyMax - 当日海平面最大值 (m)
 * @param {number} dailyMin - 当日海平面最小值 (m)
 * @returns {number} 0-15
 */
function tideScore(seaLevel, dailyMean, dailyMax, dailyMin) {
  if (seaLevel == null || dailyMean == null) return 8; // 无数据默认中档

  // 归一化到 [-1, 1] 范围
  var range = dailyMax - dailyMin;
  if (range < 0.05) return 8; // 潮差极小，默认中档

  var normalized = (seaLevel - dailyMean) / (range / 2);
  normalized = Math.max(-1, Math.min(1, normalized));

  // 映射到 0-15：高于均值 → 高分
  var score = 7.5 + normalized * 7.5;
  return Math.round(Math.max(0, Math.min(15, score)));
}

/**
 * 对单个浪点逐小时打分
 * @param {Array} hourlyData - 包含 sea_level_m 的小时数据
 * @param {number} dailySeaMean - 当日海平面均值
 * @param {number} dailySeaMax - 当日海平面最大值
 * @param {number} dailySeaMin - 当日海平面最小值
 * @returns {Array} 每小时评分结果
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

    // 四维打分
    var dirS = dirScore(waveDir, rules.dirRules);
    var waveS = linearScore(waveH, rules.waveRanges);
    var swellS = linearScore(swellPeriod, rules.swellRanges);
    var tideS = tideScore(h.sea_level_m, dailySeaMean, dailySeaMax, dailySeaMin);

    var total = Math.round(dirS + waveS + swellS + tideS);

    var tier = 'low';
    if (total >= 80) tier = 'high';
    else if (total >= 60) tier = 'mid';

    results.push({
      time: h.time_label,
      waveH: waveH,
      swellPeriod: swellPeriod,
      waveDir: waveDir,
      seaLevel: h.sea_level_m,
      totalScore: total,
      tier: tier,
      dirScore: Math.round(dirS),
      waveScore: Math.round(waveS),
      swellScore: Math.round(swellS),
      tideScore: Math.round(tideS),
    });
  }
  return results;
}

/**
 * 合并连续时间标签（如 ["08:00","09:00","12:00"] → "08:00~09:00、12:00"）
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
  var highHours = [];
  var midHours = [];
  var bestScore = 0;

  for (var i = 0; i < scores.length; i++) {
    var s = scores[i];
    if (s.totalScore > bestScore) bestScore = s.totalScore;
    if (s.tier === 'high') highHours.push(s.time);
    else if (s.tier === 'mid') midHours.push(s.time);
  }

  // 取最佳3小时的浪况均值
  var sorted = scores.slice().sort(function (a, b) { return b.totalScore - a.totalScore; });
  var top3 = sorted.slice(0, 3);
  var avgWaveH = 0, avgSwell = 0, avgSeaLevel = 0;
  if (top3.length > 0) {
    avgWaveH = top3.reduce(function (sum, s) { return sum + (s.waveH || 0); }, 0) / top3.length;
    avgSwell = top3.reduce(function (sum, s) { return sum + (s.swellPeriod || 0); }, 0) / top3.length;
    avgSeaLevel = top3.reduce(function (sum, s) { return sum + (s.seaLevel || 0); }, 0) / top3.length;
  }

  var overallTier = 'low';
  if (bestScore >= 80) overallTier = 'high';
  else if (bestScore >= 60) overallTier = 'mid';

  var timeText = '';
  var targetHours = highHours.length > 0 ? highHours : midHours;
  timeText = mergeTimeRanges(targetHours);

  var bestHourScores = sorted.length > 0 ? {
    dirScore: sorted[0].dirScore,
    waveScore: sorted[0].waveScore,
    swellScore: sorted[0].swellScore,
    tideScore: sorted[0].tideScore,
  } : null;

  return {
    spotId: spotId,
    name: rules.name,
    area: rules.area,
    level: rules.level,
    bottom: rules.bottom,
    tideNote: rules.tideNote,
    bestScore: bestScore,
    overallTier: overallTier,
    timeRange: timeText,
    highHours: highHours.length,
    midHours: midHours.length,
    avgWaveH: avgWaveH.toFixed(1),
    avgSwell: avgSwell.toFixed(1),
    avgSeaLevel: avgSeaLevel.toFixed(2),
    dimScores: bestHourScores,
    scores: sorted.slice(0, 5),
  };
}

/**
 * 评估所有浪点，返回排序后的汇总
 */
function evaluateAll(hourlyData, waterTemp) {
  // 计算当日海平面统计值
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

  // 按最佳得分降序排列
  summaries.sort(function (a, b) { return b.bestScore - a.bestScore; });
  return summaries;
}

/**
 * 生成自然语言建议
 */
function buildAdvice(summaries, todayWaveH, todaySwell, todayTemp) {
  if (summaries.length === 0) return '暂无数据';

  var best = summaries[0];
  if (best.bestScore < 60) {
    // 无推荐
    var reasons = [];
    if (todaySwell < 6) reasons.push('涌浪周期过低（' + todaySwell.toFixed(1) + 's）');
    if (todayWaveH < 0.3) reasons.push('浪高偏低（' + todayWaveH.toFixed(1) + 'm）');
    else if (todayWaveH > 2.8) reasons.push('浪高偏大（' + todayWaveH.toFixed(1) + 'm）');
    if (reasons.length === 0) reasons.push('浪向与各浪点适配方向不匹配');
    return '今日不推荐：' + reasons.join('；') + '。建议改日再来。';
  }

  var parts = [];
  var highs = summaries.filter(function (s) { return s.overallTier === 'high'; });
  var mids = summaries.filter(function (s) { return s.overallTier === 'mid'; });

  if (highs.length > 0) {
    var hNames = highs.slice(0, 3).map(function (s) { return s.name; });
    parts.push('高推荐浪点：' + hNames.join('、'));
  }
  if (mids.length > 0 && highs.length < 2) {
    var mNames = mids.slice(0, 2).map(function (s) { return s.name; });
    parts.push('中推荐浪点：' + mNames.join('、'));
  }

  if (todaySwell >= 10) parts.push('涌浪周期优秀（' + todaySwell.toFixed(1) + 's）');
  else if (todaySwell >= 7) parts.push('涌浪周期良好（' + todaySwell.toFixed(1) + 's）');

  // 安全提示
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
  evaluateAll: evaluateAll,
  scoreHourly: scoreHourly,
  mergeTimeRanges: mergeTimeRanges,
  buildAdvice: buildAdvice,
};
