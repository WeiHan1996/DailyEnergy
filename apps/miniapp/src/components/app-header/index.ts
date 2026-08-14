Component({
  options: {
    multipleSlots: true,
  },
  properties: {
    backLabel: {
      type: String,
      value: "返回",
    },
    showBack: {
      type: Boolean,
      value: false,
    },
    subtitle: {
      type: String,
      value: "",
    },
    title: {
      type: String,
      value: "",
    },
  },
  methods: {
    handleBack() {
      this.triggerEvent("back");
    },
  },
});
