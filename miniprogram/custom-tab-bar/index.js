Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/huizhou/huizhou', text: '首页', icon: 'location' },
      { pagePath: '/pages/spots/spots', text: '浪点', icon: 'search' },
    ],
  },

  methods: {
    switchTab(e) {
      var index = e.currentTarget.dataset.index;
      var path = e.currentTarget.dataset.path;
      if (this.data.selected === index) return;
      wx.switchTab({ url: path });
      this.setData({ selected: index });
    },
  },
});
