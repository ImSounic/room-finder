import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

async function newContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    locale: "nl-NL",
    viewport: { width: 1366, height: 900 },
  });
}

export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser: Browser = await chromium.launch({
    args: ["--disable-blink-features=AutomationControlled"],
  });
  try {
    const ctx = await newContext(browser);
    return await fn(await ctx.newPage());
  } finally {
    await browser.close();
  }
}

/** Launch one browser/context and let the caller open multiple pages sequentially
 *  against it (e.g. enrichment loops over several detail-page URLs). */
export async function withBrowserPages<T>(fn: (newPage: () => Promise<Page>) => Promise<T>): Promise<T> {
  const browser: Browser = await chromium.launch({
    args: ["--disable-blink-features=AutomationControlled"],
  });
  try {
    const ctx = await newContext(browser);
    return await fn(() => ctx.newPage());
  } finally {
    await browser.close();
  }
}
