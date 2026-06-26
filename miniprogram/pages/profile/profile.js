/**
 * 个人中心页
 * 用户信息、设置、订阅管理
 */
const { logout } = require('../../utils/auth');

Page({
  data: {
    userInfo: {},
    favoriteCount: 0,
    subscribed: false,
    editing: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.loadUserInfo();
    this.loadFavoriteCount();
  },

  loadUserInfo() {
    const app = getApp();
    const userInfo = app.globalData.userInfo || {};
    this.setData({ userInfo });
  },

  loadFavoriteCount() {
    const app = getApp();
    const count = (app.globalData.favoriteSpotIds || []).length;
    this.setData({ favoriteCount: count });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      'userInfo.avatarUrl': avatarUrl,
    });
  },

  onToggleEdit() {
    this.setData({ editing: true });
  },

  onNicknameBlur(e) {
    const nickName = e.detail.value;
    this.setData({
      'userInfo.nickName': nickName,
      editing: false,
    });
  },

  async onSubscribe() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.requestSubscribeMessage({
          tmplIds: [
            // 替换为实际的订阅消息模板ID
            'TEMPLATE_ID_DAILY_RECOMMEND',
            'TEMPLATE_ID_WAVE_ALERT',
          ],
          success: resolve,
          fail: reject,
        });
      });

      const accepted = Object.values(res).filter((v) => v === 'accept');
      if (accepted.length > 0) {
        this.setData({ subscribed: true });
        wx.showToast({ title: '订阅成功', icon: 'success' });
      }
    } catch (err) {
      console.error('Subscribe failed:', err);
      // 用户拒绝也静默处理，不强制
    }
  },

  goToFavorites() {
    wx.switchTab({ url: '/pages/favorites/favorites' });
  },

  goToAbout() {
    wx.showModal({
      title: '关于浪报',
      content: '浪报是一款冲浪浪况预报小程序，基于 Open-Meteo Marine API 提供全球海洋气象数据。数据仅供趋势参考，不用于航海导航。',
      showCancel: false,
    });
  },

  goToDataSource() {
    wx.showModal({
      title: '数据来源',
      content: 'Open-Meteo Marine API\nGlobal Wave Model (GWAM / GFS Wave)\n分辨率: ~0.5 degree (~50 km grid)\n近岸分辨率有限，仅供趋势参考',
      showCancel: false,
    });
  },

  goToFeedback() {
    // 打开客服会话
    wx.openCustomerServiceChat
      ? wx.openCustomerServiceChat({})
      : wx.showToast({ title: '请升级微信版本', icon: 'none' });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新授权登录',
      success: (res) => {
        if (res.confirm) {
          logout();
          wx.reLaunch({ url: '/pages/index/index' });
        }
      },
    });
  },
});
