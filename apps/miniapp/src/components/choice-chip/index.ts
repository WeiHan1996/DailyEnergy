Component({
  properties: {
    accessibleLabel: {
      type: String,
      value: "",
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    label: {
      type: String,
      value: "",
    },
    selected: {
      type: Boolean,
      value: false,
    },
    value: {
      type: String,
      value: "",
    },
  },
  methods: {
    handleSelect() {
      if (this.properties.disabled) {
        return;
      }
      this.triggerEvent("select", { value: this.properties.value });
    },
  },
});
