Component({
  properties: {
    accessibleLabel: {
      type: String,
      value: "",
    },
    actionLoadingLabel: {
      type: String,
      value: "",
    },
    emergencyActionLabel: {
      type: String,
      value: "",
    },
    emergencyActionAccessibleLabel: {
      type: String,
      value: "",
    },
    eyebrow: {
      type: String,
      value: "",
    },
    immediateLabel: {
      type: String,
      value: "",
    },
    message: {
      type: String,
      value: "",
    },
    resources: {
      type: Array,
      value: [] as string[],
    },
    resourcesLoading: {
      type: Boolean,
      value: false,
    },
    resourcesUnavailable: {
      type: Boolean,
      value: false,
    },
    resourcesLoadingLabel: {
      type: String,
      value: "",
    },
    resourcesTitle: {
      type: String,
      value: "",
    },
    resourcesUnavailableLabel: {
      type: String,
      value: "",
    },
    title: {
      type: String,
      value: "",
    },
    trustedPersonLabel: {
      type: String,
      value: "",
    },
    trustedPersonAccessibleLabel: {
      type: String,
      value: "",
    },
  },
  methods: {
    handleEmergency() {
      this.triggerEvent("emergency");
    },
    handleTrustedPerson() {
      this.triggerEvent("trustedperson");
    },
  },
});
