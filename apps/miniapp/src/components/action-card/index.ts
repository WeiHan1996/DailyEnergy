Component({
  properties: {
    action: {
      type: String,
      value: "",
    },
    buttonLabel: {
      type: String,
      value: "我想试试",
    },
    completed: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    label: {
      type: String,
      value: "今天可以这样做",
    },
    reason: {
      type: String,
      value: "",
    },
  },
  methods: {
    handlePress() {
      if (this.properties.disabled || this.properties.completed) {
        return;
      }
      this.triggerEvent("press");
    },
  },
});
