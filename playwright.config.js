// =============================================================================
// PLAYWRIGHT.CONFIG.JS - Browser-testsetup for T1D Simulator
// =============================================================================
//
// Appen er en statisk HTML/CSS/JS-app uden build-trin. Playwright starter derfor
// en lille lokal HTTP-server og tester via http://127.0.0.1:8765 i stedet for
// file://. Det matcher Codex/Playwright MCP bedre, fordi file:// ofte blokeres.
// =============================================================================

const { defineConfig } = require('@playwright/test');

const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome';

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    expect: {
        timeout: 5_000,
    },
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [
        ['list'],
        ['html', { outputFolder: 'tests/playwright-report', open: 'never' }],
    ],
    outputDir: 'tests/playwright-results',
    use: {
        baseURL: 'http://127.0.0.1:8765',
        channel: browserChannel,
        viewport: { width: 1280, height: 800 },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        command: 'python -m http.server 8765 --bind 127.0.0.1',
        url: 'http://127.0.0.1:8765/index.html',
        reuseExistingServer: true,
        timeout: 15_000,
    },
});
