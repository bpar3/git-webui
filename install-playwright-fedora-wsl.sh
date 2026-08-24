#!/bin/bash
set -euo pipefail

OPENCODE_DIR="${OPENCODE_DIR:-$HOME/.config/opencode}"

echo "=== 1. Installing Fedora runtime dependencies for Playwright ==="
sudo dnf install -y \
    alsa-lib \
    atk \
    at-spi2-atk \
    at-spi2-core \
    cairo \
    ca-certificates \
    cups-libs \
    fontconfig \
    gtk3 \
    liberation-fonts-all \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXrandr \
    libXScrnSaver \
    libXtst \
    libxshmfence \
    mesa-libgbm \
    nss \
    pango

echo "=== 2. Ensuring local Playwright MCP package exists in $OPENCODE_DIR ==="
mkdir -p "$OPENCODE_DIR"
if [ ! -f "$OPENCODE_DIR/package.json" ]; then
    printf '{\n  "name": "opencode-local",\n  "private": true\n}\n' > "$OPENCODE_DIR/package.json"
fi
npm install --prefix "$OPENCODE_DIR" --save-exact @playwright/mcp

echo "=== 3. Installing Playwright Chromium for unsupported Fedora/WSL ==="
export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1
npx --prefix "$OPENCODE_DIR" playwright install chromium

echo "=== 4. Verifying MCP CLI ==="
"$OPENCODE_DIR/node_modules/.bin/playwright-mcp" --version

echo "=== 5. Verifying Chromium launch ==="
OPENCODE_DIR="$OPENCODE_DIR" node <<'NODE'
const path = require('path');
const { chromium } = require(path.join(process.env.OPENCODE_DIR, 'node_modules', 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('data:text/html,<title>playwright-ok</title><h1>ok</h1>');
  console.log(await page.title());
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

echo
echo "Playwright MCP is installed for OpenCode."
echo "Current OpenCode config should continue to work:"
echo '  "command": ["npx", "-y", "@playwright/mcp", "--headless"]'
echo
echo "For a fully local/offline-friendly OpenCode config, switch it to:"
echo '  "command": ["/home/binu/.config/opencode/node_modules/.bin/playwright-mcp", "--headless"]'
