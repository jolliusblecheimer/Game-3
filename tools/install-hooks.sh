#!/bin/sh
# Installs the pre-commit hook that stamps version.json (run once per fresh clone).
cp tools/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit && echo "pre-commit hook installed"
