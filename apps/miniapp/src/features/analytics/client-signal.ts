import type {
  C015Api,
  ClientAnalyticsSignalRequest,
} from "../../services/miniapp-api.js";

export class BestEffortClientSignalSender {
  readonly #sentInPage = new Set<string>();
  #pageSequence = 0;

  public constructor(
    private readonly api: C015Api,
    private readonly appVersion: string,
  ) {}

  public beginPage(surface: string): string {
    this.#pageSequence += 1;
    return `${surface}:${this.#pageSequence}`;
  }

  public landingViewed(pageLifecycleKey: string): Promise<boolean> {
    return this.sendOncePerPage(pageLifecycleKey, {
      app_version: this.appVersion,
      event_name: "landing_viewed",
      event_schema_version: 1,
      locale: "zh-CN",
      scene_code: "DIRECT",
      surface_version_bucket: "LANDING_V1",
    });
  }

  public landingPrimaryActionClicked(
    pageLifecycleKey: string,
  ): Promise<boolean> {
    return this.sendOncePerPage(pageLifecycleKey, {
      app_version: this.appVersion,
      event_name: "landing_primary_action_clicked",
      event_schema_version: 1,
      locale: "zh-CN",
      scene_code: "DIRECT",
      surface_version_bucket: "LANDING_V1",
    });
  }

  public mainActionReached(pageLifecycleKey: string): Promise<boolean> {
    return this.#simple(pageLifecycleKey, "main_action_reached");
  }

  public dimensionsExpanded(pageLifecycleKey: string): Promise<boolean> {
    return this.#simple(pageLifecycleKey, "dimensions_expanded");
  }

  public weeklySummaryRead(pageLifecycleKey: string): Promise<boolean> {
    return this.#simple(pageLifecycleKey, "weekly_summary_read");
  }

  public dataRightsEntryViewed(pageLifecycleKey: string): Promise<boolean> {
    return this.#simple(pageLifecycleKey, "data_rights_entry_viewed");
  }

  async #simple(
    pageLifecycleKey: string,
    eventName:
      | "main_action_reached"
      | "dimensions_expanded"
      | "weekly_summary_read"
      | "data_rights_entry_viewed",
  ): Promise<boolean> {
    return this.sendOncePerPage(pageLifecycleKey, {
      app_version: this.appVersion,
      event_name: eventName,
      event_schema_version: 1,
      locale: "zh-CN",
    });
  }

  public async sendOncePerPage(
    pageLifecycleKey: string,
    signal: ClientAnalyticsSignalRequest,
  ): Promise<boolean> {
    const key = `${pageLifecycleKey}:${signal.event_name}`;
    if (this.#sentInPage.has(key)) {
      return true;
    }
    this.#sentInPage.add(key);
    try {
      await this.api.submitAnalyticsSignal(signal);
      return true;
    } catch {
      return false;
    }
  }
}
