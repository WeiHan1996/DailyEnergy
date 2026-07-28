export interface WechatFailure {
  readonly errMsg?: string;
}

export interface WechatLoginSuccess {
  readonly code: string;
}

export interface WechatStorageSuccess {
  readonly data: unknown;
}

export interface WechatRequestSuccess {
  readonly data: unknown;
  readonly header?: Readonly<Record<string, string>>;
  readonly statusCode: number;
}

export interface WechatSubscriptionSuccess {
  readonly errMsg?: string;
  readonly [templateId: string]: string | undefined;
}

export interface WechatRuntime {
  getStorage(options: {
    readonly fail: (failure: WechatFailure) => void;
    readonly key: string;
    readonly success: (result: WechatStorageSuccess) => void;
  }): void;
  login(options: {
    readonly fail: (failure: WechatFailure) => void;
    readonly success: (result: WechatLoginSuccess) => void;
    readonly timeout: number;
  }): void;
  removeStorage(options: {
    readonly fail: (failure: WechatFailure) => void;
    readonly key: string;
    readonly success: () => void;
  }): void;
  request(options: {
    readonly data?: unknown;
    readonly fail: (failure: WechatFailure) => void;
    readonly header?: Readonly<Record<string, string>>;
    readonly method: string;
    readonly success: (result: WechatRequestSuccess) => void;
    readonly timeout: number;
    readonly url: string;
  }): void;
  requestSubscribeMessage(options: {
    readonly fail: (failure: WechatFailure) => void;
    readonly success: (result: WechatSubscriptionSuccess) => void;
    readonly tmplIds: readonly string[];
  }): void;
  setStorage(options: {
    readonly data: unknown;
    readonly fail: (failure: WechatFailure) => void;
    readonly key: string;
    readonly success: () => void;
  }): void;
}
