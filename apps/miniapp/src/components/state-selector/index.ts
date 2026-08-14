interface StateSelectorOption {
  description?: string;
  label: string;
  value: string;
}

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
    error: {
      type: String,
      value: "",
    },
    label: {
      type: String,
      value: "",
    },
    options: {
      type: Array,
      value: [] as StateSelectorOption[],
    },
    selectedValue: {
      type: String,
      value: "",
    },
    supportingText: {
      type: String,
      value: "",
    },
  },
  methods: {
    handleSelect(event: WechatMiniprogram.TouchEvent) {
      if (this.properties.disabled) {
        return;
      }
      const value = String(event.currentTarget.dataset.value ?? "");
      this.triggerEvent("change", { value });
    },
  },
});
