const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Set realistic headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Upgrade-Insecure-Requests": "1",
  });

  page.on("console", (msg) => console.log("PAGE:", msg.text()));

  // Navigate to home first to load domain
  await page.goto("https://www.instahyre.com/", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  // Set cookies
  const cookiesRaw = process.env.INSTAHYRE_COOKIES || "[]";
  const cookies = JSON.parse(cookiesRaw);
  if (cookies.length) {
    await page.setCookie(...cookies);
    console.log(`✅ Set ${cookies.length} cookies`);
  } else {
    console.log("⚠️ No INSTAHYRE_COOKIES found");
  }

  // Navigate to opportunities
  await page.goto("https://www.instahyre.com/candidate/opportunities/?matching=true", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  // Wait a bit for any lazy-loaded content
  await page.waitForTimeout(3000);

  // Screenshot for debugging
  await page.screenshot({ path: "debug-after-login.png", fullPage: true });
  console.log("📸 Screenshot: debug-after-login.png");

  // Save HTML
  const html = await page.content();
  fs.writeFileSync("debug-page.html", html);
  console.log("📄 HTML: debug-page.html");

  // Find View buttons
  const viewButtons = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a, button")];
    return all
      .filter((el) => el.textContent && el.textContent.toLowerCase().includes("view"))
      .map((el) => ({
        tag: el.tagName,
        text: el.textContent.trim().slice(0, 60),
        visible: el.offsetParent !== null,
      }));
  });

  console.log("View buttons found:", JSON.stringify(viewButtons, null, 2));

  if (viewButtons.length === 0) {
    console.log("❌ No View buttons. Check cookies or bot detection.");
    await browser.close();
    return;
  }

  // Click first visible View
  const clickedView = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a, button")];
    const view = all.find(
      (el) =>
        el.offsetParent !== null &&
        el.textContent &&
        el.textContent.toLowerCase().includes("view")
    );
    if (view) {
      view.click();
      return true;
    }
    return false;
  });

  if (!clickedView) {
    console.log("❌ Could not click View");
    await browser.close();
    return;
  }

  console.log("✅ Clicked View");
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "debug-after-view.png", fullPage: true });
  console.log("📸 Screenshot: debug-after-view.png");

  // Find Apply buttons
  const applyButtons = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a, button")];
    return all
      .filter((el) => el.textContent && el.textContent.toLowerCase().includes("apply"))
      .map((el) => ({
        tag: el.tagName,
        text: el.textContent.trim().slice(0, 60),
        visible: el.offsetParent !== null,
        disabled: el.disabled || el.getAttribute("disabled") !== null,
      }));
  });

  console.log("Apply buttons found:", JSON.stringify(applyButtons, null, 2));

  if (applyButtons.filter((b) => b.visible && !b.disabled).length === 0) {
    console.log("❌ No Apply buttons found");
    await browser.close();
    return;
  }

  // Click Apply
  const clickedApply = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a, button")];
    const apply = all.find(
      (el) =>
        el.offsetParent !== null &&
        el.textContent &&
        el.textContent.toLowerCase().includes("apply") &&
        !el.disabled
    );
    if (apply) {
      apply.click();
      return true;
    }
    return false;
  });

  if (!clickedApply) {
    console.log("❌ Could not click Apply");
    await browser.close();
    return;
  }

  console.log("✅ Clicked Apply");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "debug-after-apply.png", fullPage: true });
  console.log("📸 Screenshot: debug-after-apply.png");

  // Check for modal or second Apply
  const secondApply = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a, button")];
    return all
      .filter((el) => el.textContent && el.textContent.toLowerCase().includes("apply"))
      .map((el) => ({
        text: el.textContent.trim().slice(0, 60),
        visible: el.offsetParent !== null,
      }));
  });

  console.log("Second Apply buttons:", JSON.stringify(secondApply, null, 2));

  if (secondApply.filter((b) => b.visible).length > 0) {
    await page.evaluate(() => {
      const all = [...document.querySelectorAll("a, button")];
      const apply = all.find(
        (el) =>
          el.offsetParent !== null &&
          el.textContent &&
          el.textContent.toLowerCase().includes("apply")
      );
      if (apply) apply.click();
    });
    console.log("✅ Clicked second Apply (modal or inline)");
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: "debug-final.png", fullPage: true });
  console.log("📸 Final screenshot: debug-final.png");

  await browser.close();
  console.log("✅ Done");
})();
