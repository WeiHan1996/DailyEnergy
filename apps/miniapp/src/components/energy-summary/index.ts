Component({
  properties: {
    context: {
      type: String,
      value: "娱乐与行动参考",
    },
    detail: {
      type: String,
      value: "",
    },
    label: {
      type: String,
      value: "整体能量",
    },
    level: {
      type: String,
      value: "",
    },
    loading: {
      type: Boolean,
      value: false,
    },
    offline: {
      type: Boolean,
      value: false,
    },
    score: {
      type: Number,
      value: 0,
    },
    showScore: {
      type: Boolean,
      value: true,
    },
  },
});
