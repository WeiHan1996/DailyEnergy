const sensitiveAssignmentRules = [
  {
    expression:
      /((?:"|')?[A-Za-z0-9_-]*(?:connection[-_]?string|prompt|user[-_]?content|provider[-_]?body|request[-_]?body|response[-_]?body)[A-Za-z0-9_-]*(?:"|')?\s*[:=]\s*)[^\r\n]*/giu,
    replacement: "$1[REDACTED]",
  },
  {
    expression:
      /((?:"|')?[A-Za-z0-9_-]*(?:authorization|cookie|password|secret|token|api[-_]?key|access[-_]?key(?:[-_]?id)?|client[-_]?secret|database[-_]?url)[A-Za-z0-9_-]*(?:"|')?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n,;]+)/giu,
    replacement: "$1[REDACTED]",
  },
  {
    expression: /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu,
    replacement: "Bearer [REDACTED]",
  },
  {
    expression: /\b([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^/\s:@]+):([^@\s/]+)@/gu,
    replacement: "$1[REDACTED]@",
  },
  {
    expression:
      /-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/gu,
    replacement: "[REDACTED PRIVATE KEY]",
  },
];

function redactPostgreSqlUrls(value) {
  return value.replace(/\bpostgres(?:ql)?:\/\/[^\s"'<>]+/giu, (candidate) => {
    let urlText = candidate;
    let trailing = "";
    while (/[),.;\]}]$/u.test(urlText)) {
      trailing = `${urlText.at(-1)}${trailing}`;
      urlText = urlText.slice(0, -1);
    }
    try {
      const url = new URL(urlText);
      if (url.protocol === "postgres:" || url.protocol === "postgresql:") {
        return `[REDACTED_DATABASE_URL]${trailing}`;
      }
    } catch {
      // A malformed PostgreSQL URL is still sensitive and must fail closed.
    }
    return `[REDACTED_DATABASE_URL]${trailing}`;
  });
}

export function redactSensitiveDiagnosticOutput(value) {
  return sensitiveAssignmentRules.reduce(
    (redacted, { expression, replacement }) =>
      redacted.replace(expression, replacement),
    redactPostgreSqlUrls(value),
  );
}
