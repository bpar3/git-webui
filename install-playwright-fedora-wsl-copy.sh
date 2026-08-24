#!/bin/bash
set -e

echo "=== 1. Adding Google Chrome Repository ==="
# We use the manual file creation approach since dnf config-manager failed in the log
sudo bash -c "cat << 'EOF' > /etc/yum.repos.d/google-chrome.repo
[google-chrome]
name=google-chrome
baseurl=https://dl.google.com/linux/chrome/rpm/stable/x86_64
enabled=1
gpgcheck=1
gpgkey=https://dl.google.com/linux/linux_signing_key.pub
EOF"


echo "=== 2. Installing Google Chrome and GUI Dependencies ==="
# Install Chrome and liberation fonts (which succeeded previously)
sudo dnf install -y google-chrome-stable \
    liberation-fonts-all liberation-mono-fonts liberation-sans-fonts liberation-serif-fonts
# Install standard X11/Wayland dependencies required for headless Chromium in WSL
sudo dnf install -y alsa-lib atk at-spi2-atk at-spi2-core cairo cups-libs \
    gtk3 libXcomposite libXcursor libXdamage libXext libXi libXrandr \
    libXScrnSaver libXtst pango libxshmfence nss mesa-libgbm


echo "=== 3. Installing Missing System Packages ==="
# Add fontconfig (missing in previous log) and ca-certificates (to help with SSL errors)
sudo dnf install -y fontconfig ca-certificates


echo "=== 4. Forcing Playwright Chrome Installation ==="
# Use --force to overwrite any existing broken/partial playwright chrome installations
npx playwright install --force chrome


echo "=== 5. Verifying Chrome Installation ==="
# Test the headless browser locally first to avoid network/SSL timeouts
# The MESA DXCore warnings are harmless in WSL and can be ignored.
google-chrome-stable --headless --disable-gpu --dump-dom "data:text/html,<html><body>Success!</body></html>" > /dev/null
echo "✅ Playwright dependencies installed successfully!"