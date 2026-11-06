#!/bin/sh
set -eu
if [ "$#" -ne 3 ] || [ -z "${ZXP_PASSWORD:-}" ]; then
    echo 'Usage: set ZXP_PASSWORD, then run package.sh /path/to/ZXPSignCmd identity.p12 output.zxp' >&2
    exit 2
fi
project_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
"$1" -sign "$project_dir/extension" "$3" "$2" "$ZXP_PASSWORD"
"$1" -verify "$3"
