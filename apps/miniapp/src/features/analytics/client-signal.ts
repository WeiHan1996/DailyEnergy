import type {
  C015Api,
  ClientAnalyticsSignalRequest,
} from "../../services/miniapp-api.js";

export class BestEffortClientSignalSender {
  readonly #sentInPage = new Set<string>();

  public constructor(private readonly api: C015Api) {}

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
