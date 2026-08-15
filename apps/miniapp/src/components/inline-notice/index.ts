Component({
  properties: {
    actionLabel: {
      type: String,
      value: "",
    },
    message: {
      type: String,
      value: "",
    },
    title: {
      type: String,
      value: "",
    },
    tone: {
      type: String,
      value: "info",
    },
  },
  methods: {
    handleAction() {
      this.triggerEvent("action");
    },
  },
});
