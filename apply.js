const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  // Load domain first so cookie domains resolve, then set cookies
  await page.goto("https://www.instahyre.com/", { waitUntil: "domcontentloaded" }); // [web:12][web:21]
  const cookies = JSON.parse(process.env.INSTAHYRE_COOKIES || "[]"); // [web:12]
  if (cookies.length) await page.setCookie(...cookies); // [web:12]

  // Open opportunities page
  await page.goto("https://www.instahyre.com/candidate/opportunities/?matching=true", {
    waitUntil: "networkidle2",
  }); // [web:12][web:21]

  // Small helpers using the new xpath/ selector support
  const waitForXPath = (xp, opts = { timeout: 15000 }) =>
    page.waitForSelector(`xpath/${xp}`, opts); // [web:6][web:18]
  const firstByXPath = async (xp) => {
    const els = await page.$$(`xpath/${xp}`);
    return els[0] || null;
  }; // [web:23][web:6]
  const clickXPath = async (xp) => {
    await waitForXPath(xp);
    const el = await firstByXPath(xp);
    if (el) await el.click({ delay: 50 });
  }; // [web:6][web:23]

  // 1) Click the first "View" on the recommendations list
  const viewFirst =
    "(//a[contains(normalize-space(.),'View')] | //button[contains(normalize-space(.),'View')])[1]";
  await clickXPath(viewFirst); // [web:6][web:18]

  // 2) Click the first Apply in the job drawer/panel
  const applyBtn = "//button[contains(normalize-space(.),'Apply') and not(@disabled)]";
  await clickXPath(applyBtn); // [web:6][web:18]

  // 3) Post-apply flows:
  //    A) Modal appears with similar job(s) -> click Apply inside modal
  //    B) Drawer reloads another job inline -> click Apply again
  try {
    const modalApply =
      "(//div[@role='dialog' or contains(@class,'modal')]//button[contains(normalize-space(.),'Apply')])[1]";
    await clickXPath(modalApply); // [web:6][web:18]
  } catch {
    try {
      await clickXPath(applyBtn); // [web:6][web:18]
    } catch {}
  }

  await page.waitForTimeout(1500); // optional settle time [web:12]
  await browser.close(); // [web:12]
})();
