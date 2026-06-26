/**
 * 浪高趋势图表组件 (V1.1 迭代)
 * MVP 阶段仅展示简化文字摘要
 */
Component({
  properties: {
    label: {
      type: String,
      value: '',
    },
    value: {
      type: Number,
      value: 0,
    },
    unit: {
      type: String,
      value: 'm',
    },
    color: {
      type: String,
      value: '#0F6E56',
    },
  },
});
