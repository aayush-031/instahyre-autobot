// Run with: INSTAHYRE_COOKIES='[{"name":"...","value":"..."}]' node instahyre-apply.js
const puppeteer = require("puppeteer");

// Small helper to wait in all Puppeteer versions
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const INSTAHYRE = "https://www.instahyre.com";
  const OPPS_URL = `${INSTAHYRE}/candidate/opportunities/?matching=true`;

  // 1) Launch
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }); // [web:18]
  const page = await browser.newPage(); // [web:5]

  // 2) Load cookies BEFORE going to the target page (or reload after setting)
  const raw = process.env.INSTAHYRE_COOKIES;
  if (!raw) throw new Error("INSTAHYRE_COOKIES env var missing"); // [web:6][web:10]
  let cookies = JSON.parse(raw);
  // Normalize minimal fields for cross-version compatibility
  cookies = cookies.map(c => {
    const copy = { ...c };
    if (!copy.domain && !copy.url) copy.domain = ".instahyre.com";
    if (!copy.path) copy.path = "/";
    return copy;
  }); // [web:6][web:10]

  // Navigate to base domain so page.setCookie has context if domain/url missing
  await page.goto(INSTAHYRE, { waitUntil: "domcontentloaded" }); // [web:8][web:11]
  await page.setCookie(...cookies); // Page API works, though deprecated in latest docs [web:3][web:7][web:16]
  await page.goto(OPPS_URL, { waitUntil: "networkidle2" }); // [web:8][web:11]

  // 3) Wait for the job list to render
  await page.waitForSelector("main, body", { timeout: 30000 }); // [web:8][web:11]
  await sleep(1500);

  // 4) Auto-scroll to load all cards (incremental scroll with idle pauses)
  async function autoScroll() {
    let prev = 0;
    for (let i = 0; i < 40; i++) {
      const loaded = await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 0.9);
        return document.body.scrollHeight;
      });
      if (loaded === prev) break;
      prev = loaded;
      await sleep(900);
    }
  } // [web:11][web:18]
  await autoScroll();

  // 5) Iterate over all "View" buttons using text-based XPath
  const VIEW_XPATH = "//button[contains(normalize-space(.), 'View')]";
  const APPLY_XPATH = "//button[contains(normalize-space(.), 'Apply')]";
  const CLOSE_XPATH =
    "//button[contains(normalize-space(.), 'Close') or contains(normalize-space(.), 'Cancel') or contains(normalize-space(.), 'Back')]";

  let index = 0;
  let applied = 0;

  // Helper to re-query all current "View" buttons
  async function getViewButtons() {
    return await page.$x(VIEW_XPATH);
  } // [web:12][web:9]

  for (;;) {
    // Ensure the page has all currently visible cards
    await autoScroll(); // [web:11][web:18]

    const viewButtons = await getViewButtons(); // [web:12][web:9]
    if (index >= viewButtons.length) break;

    console.log(`Opening job ${index + 1} / ${viewButtons.length}`);
    const btn = viewButtons[index];
    await btn.click(); // [web:18]
    index++;
    await sleep(1200);

    // Wait briefly for the side panel/modal and try to click Apply
    const applyButtons = await page.$x(APPLY_XPATH); // [web:12][web:9]
    if (applyButtons.length) {
      await applyButtons[0].click(); // [web:18]
      applied++;
      await sleep(1200);
    }

    // Try closing the panel gracefully, else press Escape
    const closeButtons = await page.$x(CLOSE_XPATH); // [web:12][web:9]
    if (closeButtons.length) {
      await closeButtons[0].click(); // [web:18]
      await sleep(600);
    } else {
      await page.keyboard.press("Escape"); // [web:18]
      await sleep(600);
    }
  }

  console.log(`Done. Applied on ${applied} jobs.`);
  await browser.close(); // [web:18]
})();
