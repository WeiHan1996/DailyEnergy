Component({
  properties: {
    cancelLabel: {
      type: String,
      value: "取消",
    },
    confirmLabel: {
      type: String,
      value: "确认",
    },
    danger: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    impact: {
      type: String,
      value: "",
    },
    loading: {
      type: Boolean,
      value: false,
    },
    open: {
      type: Boolean,
      value: false,
    },
    title: {
      type: String,
      value: "",
    },
  },
  methods: {
    handleCancel() {
      if (this.properties.loading) {
        return;
      }
      this.triggerEvent("cancel");
    },
    handleConfirm() {
      if (this.properties.disabled || this.properties.loading) {
        return;
      }
      this.triggerEvent("confirm");
    },
  },
});
