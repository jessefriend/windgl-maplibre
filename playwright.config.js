const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "test/browser",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    }
  },
  webServer: {
    command: "node node_modules/st/bin/server.js -H 127.0.0.1 -p 4173 -nc",
    url: "http://127.0.0.1:4173/test/browser/map.html",
    reuseExistingServer: false
  }
});
