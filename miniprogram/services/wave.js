/**
 * 浪况数据服务
 * 封装所有浪况相关 API 调用
 */
const { api } = require('../utils/request');

/**
 * 获取首页推荐
 * 基于用户关注的浪点，返回今日最佳推荐
 */
const getRecommendations = (params = {}) => {
  return api.get('/recommendations', {
    lat: params.lat,
    lon: params.lon,
    limit: params.limit || 5,
  });
};

/**
 * 获取浪点列表
 */
const getSpots = (params = {}) => {
  return api.get('/spots', {
    page: params.page || 1,
    page_size: params.page_size || 20,
    region: params.region,
    keyword: params.keyword,
  });
};

/**
 * 获取浪点详情（含7天预报）
 */
const getSpotDetail = (spotId) => {
  return api.get(`/spots/${spotId}`);
};

/**
 * 获取浪点今日小时级浪况
 */
const getHourlyForecast = (spotId, date) => {
  return api.get(`/spots/${spotId}/hourly`, {
    date: date, // YYYY-MM-DD
  });
};

/**
 * 获取浪点每日摘要（多日趋势）
 */
const getDailySummary = (spotId, days = 7) => {
  return api.get(`/spots/${spotId}/daily-summary`, {
    days: days,
  });
};

/**
 * 关注/取消关注浪点
 */
const toggleFavorite = (spotId, action) => {
  return api.post('/user/favorites', {
    spot_id: spotId,
    action: action, // 'add' | 'remove'
  });
};

/**
 * 获取用户关注的浪点列表
 */
const getFavorites = () => {
  return api.get('/user/favorites');
};

/**
 * 获取用户关注的浪点浪况（用于关注页面）
 */
const getFavoriteWaveData = () => {
  return api.get('/user/favorites/wave-data');
};

/**
 * 搜索浪点
 */
const searchSpots = (keyword) => {
  return api.get('/spots/search', { q: keyword });
};

module.exports = {
  getRecommendations,
  getSpots,
  getSpotDetail,
  getHourlyForecast,
  getDailySummary,
  toggleFavorite,
  getFavorites,
  getFavoriteWaveData,
  searchSpots,
};
