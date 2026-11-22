#!/usr/bin/env bash
# Build the Owen-frame probe against a pinned Swiss Ephemeris commit.
# Usage: bash scripts/build-owen-frame-probe.sh <output-binary>
set -euo pipefail
out="${1:?output path required}"
commit="${SWISS_COMMIT:-9083a12d59e98034fb2337061481ac8800c16e64}"
src="tmp/swisseph"
mkdir -p "$src"
git -C "$src" init -q
git -C "$src" remote add origin https://github.com/aloistr/swisseph.git 2>/dev/null || true
git -C "$src" fetch -q --depth=1 origin "$commit"
git -C "$src" checkout -q --detach FETCH_HEAD
test "$(git -C "$src" rev-parse HEAD)" = "$commit"
grep -q 'SEMOD_PREC_OWEN_1990' "$src/swephlib.c"
grep -q 'psia += -0.000018560' "$src/swephlib.c"
make -s -C "$src" libswe.a
cc -O2 -Wall -Wextra -I "$src" scripts/research-swiss-owen-frame-probe.c "$src/libswe.a" -lm -ldl -o "$out"
