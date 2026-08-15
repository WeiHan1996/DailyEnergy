Component({
  options: {
    multipleSlots: true,
  },
  properties: {
    accessibleLabel: {
      type: String,
      value: "",
    },
    block: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    label: {
      type: String,
      value: "",
    },
    loading: {
      type: Boolean,
      value: false,
    },
    loadingLabel: {
      type: String,
      value: "正在处理",
    },
    variant: {
      type: String,
      value: "primary",
    },
  },
  methods: {
    handlePress() {
      if (this.properties.disabled || this.properties.loading) {
        return;
      }
      this.triggerEvent("press");
    },
  },
});
