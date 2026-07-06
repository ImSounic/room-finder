// One-time Facebook login → saves a reusable session to .auth/fb.json (git-ignored).
// Run on YOUR machine:  node scripts/fb-login.mjs
// A real Chrome window opens; log in (handle 2FA), then press Enter here to save.
// We never see or store your password — only the resulting session cookies, locally.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { createInterface } from "node:readline";

const OUT = ".auth/fb.json";

function waitForEnter(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(prompt, () => { rl.close(); res(); }));
}

const browser = await chromium.launch({
  headless: false, // you need to see it to log in
  args: ["--disable-blink-features=AutomationControlled"],
});
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  locale: "nl-NL",
  viewport: { width: 1366, height: 900 },
});
const page = await ctx.newPage();
await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });

console.log("\n→ A browser window opened. Log into Facebook there (complete any 2FA).");
console.log("→ Once you see your normal Facebook home feed, come back here.\n");
await waitForEnter("Press Enter AFTER you are fully logged in… ");

mkdirSync(".auth", { recursive: true });
await ctx.storageState({ path: OUT });
await browser.close();
console.log(`\n✓ Session saved to ${OUT} (git-ignored). You won't need to do this again unless it expires.`);
