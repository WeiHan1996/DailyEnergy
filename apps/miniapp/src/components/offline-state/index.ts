Component({
  properties: {
    cachedAt: {
      type: String,
      value: "",
    },
    message: {
      type: String,
      value: "你仍可以阅读已经保存的内容，写入操作需要恢复网络。",
    },
    retrying: {
      type: Boolean,
      value: false,
    },
    variant: {
      type: String,
      value: "inline",
    },
  },
  methods: {
    handleRetry() {
      if (this.properties.retrying) {
        return;
      }
      this.triggerEvent("retry");
    },
  },
});
