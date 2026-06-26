/**
 * 微信登录认证模块
 * 静默登录 → 获取 code → 服务端换取 token
 */
const { api } = require('./request');

/**
 * 微信静默登录
 * 获取 openid，服务端签发 JWT
 */
const login = async () => {
  // Step 1: 获取微信登录 code
  const { code } = await new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject,
    });
  });

  // Step 2: 发送 code 到后端，换取 JWT
  const res = await api.post('/auth/wechat-login', { code });

  const app = getApp();
  app.globalData.token = res.access_token;

  // 存储 refresh token（httpOnly 做不到的话，加密存储）
  wx.setStorageSync('refresh_token', res.refresh_token);

  return {
    ...res.user,
    token: res.access_token,
  };
};

/**
 * 检查登录态是否有效
 */
const checkSession = async () => {
  try {
    await api.get('/auth/check');
    return true;
  } catch {
    return false;
  }
};

/**
 * 获取用户手机号（需用户点击授权按钮触发）
 */
const getPhoneNumber = async (e) => {
  const { code } = e.detail;
  if (!code) {
    throw new Error('用户取消手机号授权');
  }
  const res = await api.post('/auth/phone', { code });
  return res.phone;
};

/**
 * 退出登录
 */
const logout = () => {
  const app = getApp();
  app.globalData.token = null;
  app.globalData.userInfo = null;
  wx.removeStorageSync('refresh_token');
};

module.exports = { login, checkSession, getPhoneNumber, logout };
