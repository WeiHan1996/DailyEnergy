export interface AdminBrowserExposureFile {
  readonly content: string;
  readonly path: string;
}

export interface AdminBrowserExposureDiagnostic {
  readonly message: string;
  readonly path: string;
  readonly ruleId: (typeof ADMIN_BUNDLE_RULE_IDS)[number];
}

export interface AdminBrowserExposureInput {
  readonly files: readonly AdminBrowserExposureFile[];
  readonly secretValues?: readonly string[];
  readonly userBodyCanaries?: readonly string[];
}

export declare const ADMIN_BUNDLE_RULE_IDS: readonly [
  "ADMIN_BUNDLE_RESTRICTED_FIELD",
  "ADMIN_BUNDLE_SECRET_IDENTIFIER",
  "ADMIN_BUNDLE_SECRET_VALUE",
  "ADMIN_BUNDLE_SERVER_ONLY_DEPENDENCY",
  "ADMIN_BUNDLE_USER_BODY_FIXTURE",
];

export declare const ADMIN_USER_BODY_FIXTURE_CANARY: string;

export declare function scanAdminBrowserExposure(
  input: AdminBrowserExposureInput,
): AdminBrowserExposureDiagnostic[];

export declare const scanAdminBrowserBundle: typeof scanAdminBrowserExposure;
