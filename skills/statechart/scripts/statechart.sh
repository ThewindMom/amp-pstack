#!/usr/bin/env bash
set -euo pipefail
exec sh "$(dirname "$0")/statechart" "$@"
