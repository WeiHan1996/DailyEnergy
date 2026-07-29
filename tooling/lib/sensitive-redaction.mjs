const sensitiveAssignmentRules = [
  {
    expression:
      /((?:"|')?[A-Za-z0-9_-]*(?:authorization|cookie|password|secret|token|api[-_]?key|access[-_]?key(?:[-_]?id)?|client[-_]?secret|database[-_]?url|connection[-_]?string|prompt|user[-_]?content|provider[-_]?body|request[-_]?body|response[-_]?body)[A-Za-z0-9_-]*(?:"|')?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n,;]+)/giu,
    replacement: "$1[REDACTED]",
  },
  {
    expression: /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu,
    replacement: "Bearer [REDACTED]",
  },
  {
    expression:
      /\b([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^/\s:@]+):([^@\s/]+)@/gu,
    replacement: "$1[REDACTED]@",
  },
  {
    expression:
      /-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/gu,
    replacement: "[REDACTED PRIVATE KEY]",
  },
];

export function redactSensitiveDiagnosticOutput(value) {
  return sensitiveAssignmentRules.reduce(
    (redacted, { expression, replacement }) =>
      redacted.replace(expression, replacement),
    value,
  );
}
