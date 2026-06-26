/**
 * 浪点卡片组件
 */
Component({
  properties: {
    spot: {
      type: Object,
      value: {},
    },
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { spot: this.properties.spot });
    },
  },
});
