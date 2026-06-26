/**
 * 浪况数据服务 — 直接调用 Open-Meteo Marine API
 * 无需后端，前端直接获取全球浪况预报
 */

const API_BASE = 'https://marine-api.open-meteo.com/v1/marine';
const FORECAST_DAYS = 7;
const HOURLY_PARAMS = [
  'wave_height',
  'swell_wave_height',
  'swell_wave_period',
  'wind_wave_height',
  'wave_period',
  'wave_direction',
  'sea_surface_temperature',
  'sea_level_height_msl',
];

/**
 * 角度转中文波向
 */
function degreeToDirection(deg) {
  if (deg == null) return '--';
  const dirs = [
    [0, '北'], [22.5, '北东北'], [45, '东北'], [67.5, '东东北'],
    [90, '东'], [112.5, '东东南'], [135, '东南'], [157.5, '南东南'],
    [180, '南'], [202.5, '南西南'], [225, '西南'], [247.5, '西西南'],
    [270, '西'], [292.5, '西西北'], [315, '西北'], [337.5, '北西北'],
    [360, '北'],
  ];
  for (var i = 0; i < dirs.length; i++) {
    if (deg <= dirs[i][0]) return dirs[i][1];
  }
  return '北';
}

/**
 * 安全平均值
 */
function safeAvg(values) {
  var valid = values.filter(function (v) { return v != null; });
  if (valid.length === 0) return null;
  var sum = valid.reduce(function (a, b) { return a + b; }, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

/**
 * 安全最大值
 */
function safeMax(values) {
  var valid = values.filter(function (v) { return v != null; });
  if (valid.length === 0) return null;
  return Math.round(Math.max.apply(null, valid) * 100) / 100;
}

/**
 * 主导波向
 */
function dominantDirection(dirs) {
  var valid = dirs.filter(function (d) { return d != null; });
  if (valid.length === 0) return { degree: null, direction: '--' };
  // 分组统计
  var buckets = {};
  valid.forEach(function (d) {
    var key = Math.round(d / 22.5) * 22.5;
    buckets[key] = (buckets[key] || 0) + 1;
  });
  var maxCount = 0, maxKey = 0;
  for (var k in buckets) {
    if (buckets[k] > maxCount) { maxCount = buckets[k]; maxKey = Number(k); }
  }
  return { degree: Math.round(maxKey * 10) / 10, direction: degreeToDirection(maxKey) };
}

/**
 * 获取单个浪点的浪况数据
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @returns {Promise<Object>} { hourly, daily }
 */
function fetchWaveData(lat, lon) {
  return new Promise(function (resolve, reject) {
    var params = HOURLY_PARAMS.join(',');
    var url = API_BASE +
      '?latitude=' + lat +
      '&longitude=' + lon +
      '&hourly=' + params +
      '&timezone=Asia/Shanghai' +
      '&forecast_days=' + FORECAST_DAYS +
      '&length_unit=metric';

    console.log('[wave-fetcher] Requesting:', url);

    wx.request({
      url: url,
      method: 'GET',
      timeout: 30000,
      success: function (res) {
        console.log('[wave-fetcher] Response status:', res.statusCode);
        if (res.statusCode === 200 && res.data && res.data.hourly) {
          try {
            var parsed = parseWaveData(res.data);
            console.log('[wave-fetcher] Parsed:', parsed.hourly.length, 'hours,', parsed.daily.length, 'days');
            resolve(parsed);
          } catch (e) {
            console.error('[wave-fetcher] Parse error:', e);
            reject(new Error('浪况数据解析失败: ' + e.message));
          }
        } else {
          console.error('[wave-fetcher] Bad response:', res.statusCode);
          reject(new Error('浪况数据获取失败 (status: ' + res.statusCode + ')'));
        }
      },
      fail: function (err) {
        console.error('[wave-fetcher] Request failed:', err);
        reject(new Error('网络请求失败: ' + (err.errMsg || 'unknown')));
      },
    });
  });
}

/**
 * 解析 Open-Meteo 返回的原始数据
 */
function parseWaveData(raw) {
  var hourly = raw.hourly;
  var times = hourly.time;

  // 解析小时级数据
  var hourlyList = [];
  for (var i = 0; i < times.length; i++) {
    var deg = hourly.wave_direction[i];
    var timeStr = times[i];
    var timeLabel = timeStr.slice(11, 16); // HH:MM

    hourlyList.push({
      time: timeStr,
      time_label: timeLabel,
      wave_height_m: hourly.wave_height[i],
      swell_height_m: hourly.swell_wave_height[i],
      swell_period_s: hourly.swell_wave_period[i],
      wind_wave_height_m: hourly.wind_wave_height[i],
      wave_period_s: hourly.wave_period[i],
      wave_direction_deg: deg,
      wave_direction_cn: degreeToDirection(deg),
      sea_temp_c: hourly.sea_surface_temperature[i],
      sea_level_m: hourly.sea_level_height_msl[i],
    });
  }

  // 按天聚合
  var dailyMap = {};
  hourlyList.forEach(function (entry) {
    var dateStr = entry.time.slice(0, 10);
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = {
        wave_height: [], swell_wave_height: [], swell_wave_period: [],
        wind_wave_height: [], wave_period: [], wave_direction: [],
        sea_surface_temperature: [], sea_level: [],
      };
    }
    dailyMap[dateStr].wave_height.push(entry.wave_height_m);
    dailyMap[dateStr].swell_wave_height.push(entry.swell_height_m);
    dailyMap[dateStr].swell_wave_period.push(entry.swell_period_s);
    dailyMap[dateStr].wind_wave_height.push(entry.wind_wave_height_m);
    dailyMap[dateStr].wave_period.push(entry.wave_period_s);
    dailyMap[dateStr].wave_direction.push(entry.wave_direction_deg);
    dailyMap[dateStr].sea_surface_temperature.push(entry.sea_temp_c);
    dailyMap[dateStr].sea_level.push(entry.sea_level_m);
  });

  // 构建每日摘要
  var dailyList = [];
  var dates = Object.keys(dailyMap).sort();
  dates.forEach(function (dateStr) {
    var d = dailyMap[dateStr];
    var dir = dominantDirection(d.wave_direction);
    var surfScore = calcSurfScore(
      safeAvg(d.wave_height),
      safeAvg(d.swell_wave_period),
      safeAvg(d.swell_wave_height),
      safeAvg(d.wind_wave_height),
      safeAvg(d.sea_surface_temperature)
    );

    dailyList.push({
      date: dateStr,
      wave_height_avg_m: safeAvg(d.wave_height),
      wave_height_max_m: safeMax(d.wave_height),
      swell_height_avg_m: safeAvg(d.swell_wave_height),
      swell_period_avg_s: safeAvg(d.swell_wave_period),
      wind_wave_height_avg_m: safeAvg(d.wind_wave_height),
      wave_period_avg_s: safeAvg(d.wave_period),
      wave_direction_cn: dir.direction,
      sea_temp_avg_c: safeAvg(d.sea_surface_temperature),
      sea_level_avg_m: safeAvg(d.sea_level),
      sea_level_max_m: safeMax(d.sea_level),
      rating_score: surfScore.score,
      rating_label: surfScore.label,
    });
  });

  // 完整的7天趋势
  dailyList.forEach(function (day) {
    day.trend = buildTrendText(dailyList);
  });

  return {
    hourly: hourlyList,
    daily: dailyList,
  };
}

/**
 * 冲浪评分模型 (0-10分)
 */
function calcSurfScore(waveH, period, swellH, windH, temp) {
  var score = 0;

  // 浪高适配 (0-4分): 最佳 0.5-2.5m
  if (waveH != null) {
    if (waveH >= 0.5 && waveH <= 2.5) {
      var dist = Math.abs(waveH - 1.5) / 1.0;
      score += 4.0 * Math.max(0, 1 - dist);
    } else if (waveH < 0.5) {
      score += 4.0 * (waveH / 0.5) * 0.5;
    } else {
      score += 4.0 * Math.max(0, 1 - (waveH - 2.5) / 2.0);
    }
  }

  // 涌浪周期 (0-3分)
  if (period != null) {
    if (period >= 10) score += 3.0;
    else if (period >= 7) score += 2.0 + (period - 7) / 3.0;
    else if (period >= 4) score += 1.0 + (period - 4) / 3.0;
    else score += Math.max(0, period / 4.0);
  }

  // 涌浪占比 (0-2分)
  if (swellH != null && windH != null) {
    var total = swellH + windH;
    if (total > 0) {
      var ratio = swellH / total;
      if (ratio >= 0.7) score += 2.0;
      else if (ratio >= 0.5) score += 1.0 + (ratio - 0.5) * 5.0;
      else score += ratio * 2.0;
    }
  }

  // 水温 (0-1分)
  if (temp != null) {
    if (temp >= 20 && temp <= 30) score += 1.0;
    else if ((temp >= 15 && temp < 20) || (temp > 30 && temp <= 33)) score += 0.5;
  }

  score = Math.min(10, Math.round(score * 10) / 10);

  var label = 'poor';
  if (score >= 8) label = 'excellent';
  else if (score >= 6) label = 'good';
  else if (score >= 4) label = 'fair';

  return { score: score, label: label };
}

/**
 * 7天趋势文本
 */
function buildTrendText(dailyList) {
  if (dailyList.length < 2) return '数据不足';
  var h0 = dailyList[0].wave_height_avg_m || 0;
  var hEnd = dailyList[dailyList.length - 1].wave_height_avg_m || 0;
  var parts = [];

  if (hEnd > h0 + 0.3) parts.push('浪高上升 (' + h0.toFixed(1) + ' → ' + hEnd.toFixed(1) + 'm)');
  else if (hEnd < h0 - 0.3) parts.push('浪高下降 (' + h0.toFixed(1) + ' → ' + hEnd.toFixed(1) + 'm)');
  else parts.push('浪高平稳 (~' + h0.toFixed(1) + 'm)');

  var maxDay = dailyList.reduce(function (a, b) {
    return (a.wave_height_max_m || 0) > (b.wave_height_max_m || 0) ? a : b;
  });
  parts.push('最大浪高 ' + maxDay.date.slice(5) + ' (' + (maxDay.wave_height_max_m || 0).toFixed(1) + 'm)');

  return parts.join('；');
}

module.exports = { fetchWaveData };
