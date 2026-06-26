/**
 * 统一网络请求封装
 *
 * 本地调试：开发时将此处的 BASE_URL 改为你的后端地址
 *   const BASE_URL = 'http://192.168.x.x:8000/v1';  // 真机调试用局域网IP
 *   const BASE_URL = 'http://localhost:8000/v1';     // 模拟器调试
 *
 * 生产部署：改为你的正式域名
 *   const BASE_URL = 'https://api.your-domain.com/v1';
 */
const BASE_URL = 'http://localhost:8000/v1';

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

const request = (options) => {
  return new Promise((resolve, reject) => {
    const app = getApp();
    const token = app.globalData.token;

    const doRequest = (authToken) => {
      wx.request({
        url: `${BASE_URL}${options.url}`,
        method: options.method || 'GET',
        data: options.data || {},
        header: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
          ...options.header,
        },
        timeout: options.timeout || 15000,
        success: (res) => {
          if (res.statusCode === 401) {
            // Token 过期，尝试刷新
            if (!isRefreshing) {
              handleTokenRefresh(options, resolve, reject);
            } else {
              addRefreshSubscriber((newToken) => {
                doRequestWithNewToken(options, newToken, resolve, reject);
              });
            }
            return;
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject({
              code: res.statusCode,
              message: res.data?.message || res.data?.detail || '请求失败',
              data: res.data,
            });
          }
        },
        fail: (err) => {
          wx.getNetworkType({
            success: (netRes) => {
              if (netRes.networkType === 'none') {
                reject({
                  code: -1,
                  message: '网络连接已断开，请检查网络设置',
                });
              } else {
                reject({
                  code: -1,
                  message: '网络请求失败，请稍后重试',
                  detail: err,
                });
              }
            },
          });
        },
      });
    };

    doRequest(token);
  });
};

function doRequestWithNewToken(options, newToken, resolve, reject) {
  wx.request({
    url: `${BASE_URL}${options.url}`,
    method: options.method || 'GET',
    data: options.data || {},
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${newToken}`,
      ...options.header,
    },
    success: (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve(res.data);
      } else {
        reject({
          code: res.statusCode,
          message: res.data?.message || '请求失败',
        });
      }
    },
    fail: (err) => {
      reject({ code: -1, message: '网络请求失败', detail: err });
    },
  });
}

async function handleTokenRefresh(originalOptions, resolve, reject) {
  isRefreshing = true;
  try {
    const app = getApp();
    const { login } = require('./auth');
    const user = await login();
    app.globalData.token = user.token;
    app.globalData.userInfo = user;
    onRefreshed(user.token);

    doRequestWithNewToken(originalOptions, user.token, resolve, reject);
  } catch (err) {
    refreshSubscribers = [];
    reject({ code: 401, message: '登录已过期，请重新打开小程序' });
  } finally {
    isRefreshing = false;
  }
}

const api = {
  get: (url, data) => request({ url, method: 'GET', data }),
  post: (url, data) => request({ url, method: 'POST', data }),
  put: (url, data) => request({ url, method: 'PUT', data }),
  delete: (url, data) => request({ url, method: 'DELETE', data }),
};

module.exports = { request, api };
