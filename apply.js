const puppeteer = require("puppeteer-core");
const fs = require("fs");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/chromium-browser",
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

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

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

  await page.goto("https://www.instahyre.com/", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  const cookiesRaw = process.env.INSTAHYRE_COOKIES || "[]";
  const cookies = JSON.parse(cookiesRaw);
  if (cookies.length) {
    await page.setCookie(...cookies);
    console.log(`✅ Set ${cookies.length} cookies`);
  }

  await page.goto("https://www.instahyre.com/candidate/opportunities/?matching=true", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  await delay(3000);

  // Count total View buttons
  const totalJobs = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    return buttons.filter(
      (el) =>
        el.offsetParent !== null &&
        el.textContent &&
        el.textContent.toLowerCase().includes("view")
    ).length;
  });

  console.log(`📊 Found ${totalJobs} jobs to apply to`);

  let applied = 0;
  let failed = 0;

  // Loop through all jobs
  for (let i = 0; i < totalJobs; i++) {
    console.log(`\n🔄 Processing job ${i + 1}/${totalJobs}`);

    try {
      // Click the first visible View button
      const clickedView = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll("button")];
        const view = buttons.find(
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
        console.log(`❌ Could not find View button for job ${i + 1}`);
        failed++;
        continue;
      }

      await delay(3000); // wait for job details to load

      // Click Apply button
      const clickedApply = await page.evaluate(() => {
        const all = [...document.querySelectorAll("button")];
        const apply = all.find(
          (el) =>
            el.offsetParent !== null &&
            el.textContent &&
            el.textContent.toLowerCase().trim() === "apply" &&
            !el.disabled
        );
        if (apply) {
          apply.click();
          return true;
        }
        return false;
      });

      if (!clickedApply) {
        console.log(`⚠️ No Apply button found for job ${i + 1} (may be already applied)`);
        // Close drawer and continue
        await page.keyboard.press("Escape");
        await delay(1500);
        continue;
      }

      await delay(2500); // wait for modal or next job to load

      // Check for modal with another Apply button or similar jobs popup
      const hasModal = await page.evaluate(() => {
        const all = [...document.querySelectorAll("button")];
        const modalApply = all.find(
          (el) =>
            el.offsetParent !== null &&
            el.textContent &&
            el.textContent.toLowerCase().trim() === "apply"
        );
        return Boolean(modalApply);
      });

      if (hasModal) {
        // Click the modal Apply button
        await page.evaluate(() => {
          const all = [...document.querySelectorAll("button")];
          const apply = all.find(
            (el) =>
              el.offsetParent !== null &&
              el.textContent &&
              el.textContent.toLowerCase().trim() === "apply"
          );
          if (apply) apply.click();
        });
        console.log(`✅ Applied to job ${i + 1} + modal job`);
        applied += 2; // applied to main job + modal suggestion
        await delay(2000);
      } else {
        console.log(`✅ Applied to job ${i + 1}`);
        applied++;
      }

      // Close any open drawer/modal to return to job list
      await page.keyboard.press("Escape");
      await delay(1500);
      await page.keyboard.press("Escape"); // double escape for nested modals
      await delay(1500);

    } catch (error) {
      console.log(`❌ Error processing job ${i + 1}:`, error.message);
      failed++;
      // Try to recover by closing any open modals
      await page.keyboard.press("Escape");
      await delay(1000);
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`✅ Successfully applied: ${applied} jobs`);
  console.log(`❌ Failed/Skipped: ${failed} jobs`);

  await page.screenshot({ path: "final-summary.png", fullPage: true });
  await browser.close();
  console.log("✅ Done");
})();
