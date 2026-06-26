/**
 * 浪况评级标识组件
 */
Component({
  properties: {
    score: {
      type: Number,
      value: 0,
    },
    label: {
      type: String,
      value: '',
      observer: 'updateDisplay',
    },
  },

  data: {
    displayLabel: '',
    levelClass: '',
  },

  lifetimes: {
    attached() {
      this.updateDisplay();
    },
  },

  methods: {
    updateDisplay() {
      var label = this.properties.label;
      var level = '';

      if (label === 'excellent') { level = 'rating-excellent'; label = label || '极佳'; }
      else if (label === 'good') { level = 'rating-good'; label = label || '良好'; }
      else if (label === 'fair') { level = 'rating-fair'; label = label || '一般'; }
      else { level = 'rating-poor'; label = label || '较差'; }

      this.setData({ displayLabel: label, levelClass: level });
    },
  },
});
