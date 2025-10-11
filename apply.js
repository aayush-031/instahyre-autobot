const puppeteer = require("puppeteer-core");
const fs = require("fs");

// Helper to replace deprecated waitForTimeout
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/chromium-browser", // adjust for your CI environment
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--window-size=1920,1080",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Override navigator.webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });

  // Set realistic user agent
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // Set extra headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  });

  page.on("console", (msg) => console.log("PAGE:", msg.text()));

  // Navigate to home
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
    console.log("⚠️ No INSTAHYRE_COOKIES - script may fail without valid session");
  }

  // Navigate to opportunities
  await page.goto("https://www.instahyre.com/candidate/opportunities/?matching=true", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  await delay(3000); // replaced waitForTimeout

  // Screenshot
  await page.screenshot({ path: "debug-after-login.png", fullPage: true });
  console.log("📸 Screenshot: debug-after-login.png");

  // Save HTML
  const html = await page.content();
  fs.writeFileSync("debug-page.html", html);
  console.log("📄 HTML saved: debug-page.html");

  // Check for 403 in page content
  if (html.includes("403") || html.includes("Access Denied") || html.includes("Cloudflare")) {
    console.log("❌ Cloudflare or 403 block detected. Valid cookies required.");
    console.log("💡 Export fresh cookies from logged-in browser session");
    await browser.close();
    return;
  }

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

  console.log("View buttons:", JSON.stringify(viewButtons, null, 2));

  if (viewButtons.length === 0) {
    console.log("❌ No View buttons found - authentication likely failed");
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
  await delay(4000);
  await page.screenshot({ path: "debug-after-view.png", fullPage: true });

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

  console.log("Apply buttons:", JSON.stringify(applyButtons, null, 2));

  if (applyButtons.filter((b) => b.visible && !b.disabled).length === 0) {
    console.log("❌ No Apply buttons");
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
  await delay(3000);
  await page.screenshot({ path: "debug-after-apply.png", fullPage: true });

  // Check for second Apply
  const secondApply = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a, button")];
    return all
      .filter((el) => el.textContent && el.textContent.toLowerCase().includes("apply"))
      .map((el) => ({
        text: el.textContent.trim().slice(0, 60),
        visible: el.offsetParent !== null,
      }));
  });

  console.log("Second Apply:", JSON.stringify(secondApply, null, 2));

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
    console.log("✅ Clicked second Apply");
    await delay(2000);
  }

  await page.screenshot({ path: "debug-final.png", fullPage: true });
  console.log("📸 Final: debug-final.png");

  await browser.close();
  console.log("✅ Done");
})();
