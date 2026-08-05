#!/usr/bin/env bash
set -euo pipefail

readonly NODE_VERSION="24.18.0"
readonly NODE_ARCHIVE="node-v${NODE_VERSION}-linux-x64.tar.xz"
readonly NODE_SHA256="55aa7153f9d88f28d765fcdad5ae6945b5c0f98a36881703817e4c450fa76742"
readonly RUNTIME_ROOT="/opt/dailyenergy/runtime"
readonly INSTALL_ROOT="${RUNTIME_ROOT}/node-v${NODE_VERSION}"
readonly COMMAND_LINK="/usr/local/bin/dailyenergy-node"

fail() {
  printf '%s\n' "E012_HOST_BOOTSTRAP_FAILED:$1" >&2
  exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
  fail "root-required"
fi
if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  fail "platform"
fi
if ! grep -qx 'ID=ubuntu' /etc/os-release; then
  fail "ubuntu-required"
fi

if [[ -x "${INSTALL_ROOT}/bin/node" ]]; then
  if [[ "$(${INSTALL_ROOT}/bin/node --version)" != "v${NODE_VERSION}" ]]; then
    fail "existing-runtime-drift"
  fi
else
  if [[ -e "${INSTALL_ROOT}" ]]; then
    fail "existing-runtime-invalid"
  fi
  for command in curl sha256sum tar mktemp; do
    command -v "${command}" >/dev/null 2>&1 || fail "missing-${command}"
  done
  temporary_root="$(mktemp -d /tmp/dailyenergy-node-bootstrap.XXXXXX)"
  trap 'rm -rf -- "${temporary_root}"' EXIT
  archive_path="${temporary_root}/${NODE_ARCHIVE}"
  extract_root="${temporary_root}/extract"
  install -d -m 0755 "${extract_root}" "${RUNTIME_ROOT}"
  curl --fail --location --proto '=https' --tlsv1.2 --silent --show-error \
    --output "${archive_path}" \
    "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}"
  printf '%s  %s\n' "${NODE_SHA256}" "${archive_path}" | sha256sum --check --status || \
    fail "checksum"
  tar --extract --xz --file "${archive_path}" --directory "${extract_root}" \
    --strip-components=1 --no-same-owner
  [[ "$(${extract_root}/bin/node --version)" == "v${NODE_VERSION}" ]] || \
    fail "archive-version"
  chown -R root:root "${extract_root}"
  chmod -R go-w "${extract_root}"
  mv "${extract_root}" "${INSTALL_ROOT}"
fi

temporary_link="${COMMAND_LINK}.tmp.$$"
ln -s "${INSTALL_ROOT}/bin/node" "${temporary_link}"
mv -f "${temporary_link}" "${COMMAND_LINK}"
[[ "$(${COMMAND_LINK} --version)" == "v${NODE_VERSION}" ]] || \
  fail "command-link"

printf '%s\n' "E012_HOST_BOOTSTRAP_OK:node=${NODE_VERSION}:runtime=isolated"
