#!/bin/sh

# Copyright 2015 Eric ALBER
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -e

# The built app isn't committed, so this clones the source and builds it.
# That needs Node alongside git and Python - check before touching
# anything, rather than cloning and failing halfway.
missing=""
for tool in git node npm; do
    command -v "$tool" > /dev/null 2>&1 || missing="$missing $tool"
done
if [ -n "$missing" ]; then
    echo "Missing required tool(s):$missing" >&2
    echo >&2
    echo "GitPar is built from source on install, which needs git and Node.js" >&2
    echo "(node and npm). Install them and re-run this script." >&2
    exit 1
fi

if [ "$OS" = "Windows_NT" ]; then
    # We are on windows, check if Python is installed
    python -V > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        PYTHON=python
    else
        reg query "HKLM\SOFTWARE\Python\PythonCore" > /dev/null 2>&1
        if [ $? -ne 0 ]; then
            echo "Please install Python first"
            echo "You can download it from http://python.org/downloads/"
            exit 1
        fi
        PYTHON_REG_PATH=`reg query "HKLM\SOFTWARE\Python\PythonCore" | grep HKEY | sort | tail -n 1`
        PYTHON_ROOT=/`reg query "${PYTHON_REG_PATH}\InstallPath" -ve | grep REG_SZ | sed -e "s/.*REG_SZ\s\+\(.*\)/\1/" | sed -e "s/://" | sed -e "s/\\\\\/\//g"`
        PYTHON=${PYTHON_ROOT}python.exe
    fi
fi

cd $HOME
rm -rf .gitpar > /dev/null 2>&1
echo "Cloning GitPar repository"
GITPAR_REPO="${GITPAR_REPO:-https://github.com/bpar3/git-webui.git}"
# Not --depth 1: auto-update pulls in this clone later, and a shallow
# one makes that fail once the remote has moved on.
git clone "$GITPAR_REPO" .gitpar

cd "$HOME/.gitpar"
echo "Building GitPar (this takes a minute)"
npm install --no-audit --no-fund
npx --yes bower install --allow-root
npx --yes grunt-cli

if [ ! -x "$HOME/.gitpar/dist/bin/gitpar" ]; then
    echo "Build finished but dist/bin/gitpar is missing - not installing." >&2
    exit 1
fi

echo "Enabling auto update"
git config --global --replace-all gitpar.autoupdate true
echo "Linking the 'gitpar' command"
mkdir -p "$HOME/.local/bin"
ln -sf "$HOME/.gitpar/dist/bin/gitpar" "$HOME/.local/bin/gitpar"
echo
echo "Installed to \$HOME/.local/bin/gitpar - make sure it is on your PATH."
