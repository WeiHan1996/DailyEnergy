Component({
  options: {
    multipleSlots: true,
  },
  properties: {
    labelledBy: {
      type: String,
      value: "",
    },
    reducedMotion: {
      type: Boolean,
      value: false,
    },
    theme: {
      type: String,
      value: "default",
    },
  },
});
