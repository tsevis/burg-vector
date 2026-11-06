#!/bin/sh
set -eu
if [ "$#" -ne 3 ] || [ -z "${ZXP_PASSWORD:-}" ]; then
    echo 'Usage: set ZXP_PASSWORD, then run package.sh /path/to/ZXPSignCmd identity.p12 output.zxp' >&2
    exit 2
fi
project_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
# Set ZXP_TSA to a timestamp server URL so the signature outlives the certificate.
if [ -n "${ZXP_TSA:-}" ]; then
    "$1" -sign "$project_dir/extension" "$3" "$2" "$ZXP_PASSWORD" -tsa "$ZXP_TSA"
else
    "$1" -sign "$project_dir/extension" "$3" "$2" "$ZXP_PASSWORD"
fi
"$1" -verify "$3"
