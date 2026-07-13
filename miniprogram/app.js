/**
 * 浪报小程序 - App入口
 * 全局生命周期、用户登录态管理、全局数据
 */
const { login, checkSession } = require('./utils/auth');

App({
  globalData: {
    userInfo: null,
    token: null,
    systemInfo: null,
    // 用户关注的浪点ID集合（快速查找用）
    favoriteSpotIds: [],
    // 开发模式开关：设为 true 可跳过登录（用于无后端预览）
    skipAuth: true,
  },

  onLaunch(options) {
    // 获取系统信息（用于响应式适配）
    this.globalData.systemInfo = wx.getSystemInfoSync();
    const { statusBarHeight } = this.globalData.systemInfo;
    this.globalData.navBarHeight = statusBarHeight + 44;

    // 检查登录态
    // 开发模式：未配置后端时跳过登录，避免请求 localhost:8000 报错
    if (!this.globalData.skipAuth) {
      this.initAuth();
    }

    // 获取用户信息（需用户授权）
    this.getUserProfile();
  },

  onShow(options) {
    // 从后台切回前台时刷新登录态
    if (!this.globalData.skipAuth && this.globalData.token) {
      checkSession().catch(() => {
        this.initAuth();
      });
    }
  },

  /**
   * 初始化登录态
   * 静默登录，获取 openid 和 session_key
   */
  async initAuth() {
    try {
      const user = await login();
      this.globalData.userInfo = user;
      this.globalData.favoriteSpotIds = user.favorite_spot_ids || [];
      this.triggerAuthReady();
    } catch (err) {
      console.error('Login failed:', err);
      // 登录失败不阻塞页面渲染，后续操作时再重试
      this.globalData.authError = err;
    }
  },

  /**
   * 获取用户头像昵称（微信新版头像昵称填写能力）
   */
  getUserProfile() {
    // 在需要的页面通过 <button open-type="chooseAvatar"> 触发
  },

  /**
   * 登录完成回调
   */
  triggerAuthReady() {
    if (this.authReadyCallback) {
      this.authReadyCallback(this.globalData.userInfo);
    }
  },

  /**
   * 注册登录完成监听
   */
  onAuthReady(callback) {
    if (this.globalData.userInfo) {
      callback(this.globalData.userInfo);
    } else {
      this.authReadyCallback = callback;
    }
  },

  /**
   * 更新收藏浪点（同步到全局状态）
   */
  updateFavoriteSpots(spotIds) {
    this.globalData.favoriteSpotIds = spotIds;
  },
});
