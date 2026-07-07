Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/huizhou/huizhou', icon: 'home' },
      { pagePath: '/pages/spots/spots', icon: 'search' },
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
