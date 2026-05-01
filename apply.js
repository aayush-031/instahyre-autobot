const puppeteer = require("puppeteer-core");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 500);
    });
  });
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/chromium-browser",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
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
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  );

  page.on("console", (msg) => console.log("PAGE:", msg.text()));

  // Load cookies
  await page.goto("https://www.instahyre.com", { waitUntil: "networkidle2" });

  const cookiesRaw = process.env.INSTAHYRE_COOKIES || "[]";
  const cookies = JSON.parse(cookiesRaw);

  if (cookies.length) {
    await page.setCookie(...cookies);
    console.log(`✅ Set ${cookies.length} cookies`);
  }

  // Go to jobs page
  await page.goto("https://www.instahyre.com/candidate/opportunities/?matching=true", {
    waitUntil: "networkidle2",
  });

  if (page.url().includes("login")) {
    throw new Error("❌ Login failed - cookies invalid");
  }

  console.log("✅ Logged in");

  // 🔥 Scroll to load ALL jobs
  await autoScroll(page);
  await delay(3000);

  const totalJobs = await page.evaluate(() => {
    return [...document.querySelectorAll("button")]
      .filter(el =>
        el.offsetParent !== null &&
        el.textContent &&
        el.textContent.toLowerCase().includes("view")
      ).length;
  });

  console.log(`📊 Found ${totalJobs} jobs`);

  let applied = 0;
  let failed = 0;

  for (let i = 0; i < totalJobs; i++) {
    console.log(`\n🔄 Processing job ${i + 1}/${totalJobs}`);

    try {
      // ✅ Click correct job using index
      const clickedView = await page.evaluate((index) => {
        const views = [...document.querySelectorAll("button")]
          .filter(el =>
            el.offsetParent !== null &&
            el.textContent &&
            el.textContent.toLowerCase().includes("view")
          );

        if (views[index]) {
          views[index].click();
          return true;
        }
        return false;
      }, i);

      if (!clickedView) {
        console.log("❌ Could not click job");
        failed++;
        continue;
      }

      await delay(2500);

      // Click Apply
      const clickedApply = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find(
          el =>
            el.offsetParent !== null &&
            el.textContent &&
            el.textContent.toLowerCase().trim() === "apply" &&
            !el.disabled
        );

        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

      if (!clickedApply) {
        console.log("⚠️ Already applied or no apply button");
        await page.keyboard.press("Escape");
        await delay(1500);
        continue;
      }

      await delay(2500);

      // Handle modal apply
      await page.evaluate(() => {
        const modalBtn = [...document.querySelectorAll("button")].find(
          el =>
            el.offsetParent !== null &&
            el.textContent &&
            el.textContent.toLowerCase().trim() === "apply"
        );

        if (modalBtn) modalBtn.click();
      });

      await delay(2000);

      // ✅ REAL success check
      const success = await page.evaluate(() => {
        return [...document.querySelectorAll("button")]
          .some(el =>
            el.textContent &&
            el.textContent.toLowerCase().includes("applied")
          );
      });

      if (success) {
        console.log(`✅ Actually applied to job ${i + 1}`);
        applied++;
      } else {
        console.log(`❌ Apply failed (likely 400 or blocked)`);
        failed++;
      }

      // Close modal/drawer
      await page.keyboard.press("Escape");
      await delay(1500);
      await page.keyboard.press("Escape");

      // 🔥 Human-like delay (fix 400 errors)
      await delay(2000 + Math.random() * 2000);

    } catch (err) {
      console.log("❌ Error:", err.message);
      failed++;

      await page.keyboard.press("Escape");
      await delay(1000);
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`✅ Applied: ${applied}`);
  console.log(`❌ Failed: ${failed}`);

  await browser.close();
  console.log("✅ Done");
})();