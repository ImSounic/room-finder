import { chromium, type Browser, type Page } from "playwright";

export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser: Browser = await chromium.launch({
    args: ["--disable-blink-features=AutomationControlled"],
  });
  try {
    const ctx = await browser.newContext({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
      locale: "nl-NL",
      viewport: { width: 1366, height: 900 },
    });
    return await fn(await ctx.newPage());
  } finally {
    await browser.close();
  }
}
