#!/usr/bin/env bash
set -euo pipefail

# Keep the exact visual-test font. First try Ubuntu's signed apt metadata;
# when the security mirror is transiently unreachable, use an official Ubuntu
# archive mirror with the pinned SHA256 from packages.ubuntu.com.
if ! sudo apt-get \
    -o Acquire::Retries=1 \
    -o Acquire::http::Timeout=18 \
    -o Acquire::https::Timeout=18 \
    install -y --no-install-recommends fonts-wqy-microhei; then
  echo "[cjk-font] apt mirror unavailable; downloading the same pinned Ubuntu package" >&2
  versioned="fonts-wqy-microhei_0.2.0-beta-4_all.deb"
  expected="608b93d1acca135f422dca8efed4960a381de0142fd6b81f8a33aa37180e59f1"
  path="pool/universe/f/fonts-wqy-microhei/${versioned}"
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' EXIT
  installed=0
  for mirror in \
    "https://cz.archive.ubuntu.com/ubuntu" \
    "https://mirrors.kernel.org/ubuntu"; do
    if curl --fail --location --silent --show-error \
      --retry 1 --connect-timeout 10 --max-time 45 \
      --output "$temp_dir/$versioned" "$mirror/$path"; then
      echo "$expected  $temp_dir/$versioned" | sha256sum --check --status
      sudo dpkg -i "$temp_dir/$versioned"
      installed=1
      break
    fi
  done
  if [ "$installed" -ne 1 ]; then
    echo "[cjk-font] required font could not be downloaded from official mirrors" >&2
    exit 1
  fi
fi
dpkg-query -W -f='${Status}' fonts-wqy-microhei | grep -Fx 'install ok installed'
echo "[cjk-font] required font installed; visual tests remain unchanged"
