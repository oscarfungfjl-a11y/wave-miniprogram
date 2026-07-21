/**
 * 坐标转换工具
 * WGS-84 ↔ GCJ-02 ↔ BD-09 坐标系转换
 * 
 * WGS-84：国际标准坐标系（GPS、Open-Meteo API 返回）
 * GCJ-02：中国国家测绘局坐标系（高德地图、腾讯地图、微信 wx.openLocation）
 * BD-09：百度地图坐标系
 */

var PI = Math.PI;
var A = 6378245.0;
var EE = 0.00669342162296594323;

function outOfChina(lat, lon) {
  if (lon < 73.66 || lon > 135.05) return true;
  if (lat < 3.86 || lat > 53.55) return true;
  return false;
}

function transformLat(x, y) {
  var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLon(x, y) {
  var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

/**
 * WGS-84 转 GCJ-02（火星坐标）
 */
function wgs84ToGcj02(wgsLat, wgsLon) {
  if (outOfChina(wgsLat, wgsLon)) {
    return { lat: wgsLat, lon: wgsLon };
  }

  var dLat = transformLat(wgsLon - 105.0, wgsLat - 35.0);
  var dLon = transformLon(wgsLon - 105.0, wgsLat - 35.0);
  var radLat = wgsLat / 180.0 * PI;
  var magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  var sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLon = (dLon * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

  return {
    lat: wgsLat + dLat,
    lon: wgsLon + dLon
  };
}

/**
 * GCJ-02 转 BD-09（百度坐标）
 */
function gcj02ToBd09(gcjLat, gcjLon) {
  var x = gcjLon, y = gcjLat;
  var z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * PI * 3000.0 / 180.0);
  var theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * PI * 3000.0 / 180.0);
  return {
    lat: z * Math.sin(theta) + 0.006,
    lon: z * Math.cos(theta) + 0.0065
  };
}

/**
 * WGS-84 转 BD-09（百度坐标）
 */
function wgs84ToBd09(wgsLat, wgsLon) {
  var gcj = wgs84ToGcj02(wgsLat, wgsLon);
  return gcj02ToBd09(gcj.lat, gcj.lon);
}

/**
 * GCJ-02 转 WGS-84（精度约 1m）
 */
function gcj02ToWgs84(gcjLat, gcjLon) {
  if (outOfChina(gcjLat, gcjLon)) {
    return { lat: gcjLat, lon: gcjLon };
  }

  var dLat = transformLat(gcjLon - 105.0, gcjLat - 35.0);
  var dLon = transformLon(gcjLon - 105.0, gcjLat - 35.0);
  var radLat = gcjLat / 180.0 * PI;
  var magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  var sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLon = (dLon * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

  return {
    lat: gcjLat - dLat,
    lon: gcjLon - dLon
  };
}

module.exports = {
  wgs84ToGcj02: wgs84ToGcj02,
  gcj02ToBd09: gcj02ToBd09,
  wgs84ToBd09: wgs84ToBd09,
  gcj02ToWgs84: gcj02ToWgs84,
};
