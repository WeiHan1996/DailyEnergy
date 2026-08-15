Component({
  options: {
    multipleSlots: true,
  },
  properties: {
    disabled: {
      type: Boolean,
      value: false,
    },
    heading: {
      type: String,
      value: "",
    },
    loading: {
      type: Boolean,
      value: false,
    },
    variant: {
      type: String,
      value: "default",
    },
  },
});
