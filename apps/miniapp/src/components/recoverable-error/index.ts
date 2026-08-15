Component({
  properties: {
    message: {
      type: String,
      value: "这一部分暂时没有加载好，已经保存的内容仍然保留。",
    },
    reference: {
      type: String,
      value: "",
    },
    retrying: {
      type: Boolean,
      value: false,
    },
    title: {
      type: String,
      value: "可以再试一次",
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
