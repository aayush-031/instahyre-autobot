const puppeteer = require("puppeteer-core");

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function humanDelay(min = 2500, max = 5000) {
  const ms = min + Math.random() * (max - min);
  return delay(ms);
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 400);
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

  // ---------------- LOGIN VIA COOKIES ----------------
  await page.goto("https://www.instahyre.com", {
    waitUntil: "networkidle2",
  });

  const cookiesRaw = process.env.INSTAHYRE_COOKIES || "[]";
  const cookies = JSON.parse(cookiesRaw);

  if (cookies.length) {
    await page.setCookie(...cookies);
    console.log(`✅ Set ${cookies.length} cookies`);
  }

  await page.goto(
    "https://www.instahyre.com/candidate/opportunities/?matching=true",
    { waitUntil: "networkidle2" }
  );

  if (page.url().includes("login")) {
    throw new Error("❌ Cookies invalid / expired");
  }

  console.log("✅ Logged in via cookies");

  // ---------------- LOAD JOBS ----------------
  await autoScroll(page);
  await humanDelay();

  const totalJobs = await page.evaluate(() => {
    return [...document.querySelectorAll("button")]
      .filter(
        (el) =>
          el.offsetParent !== null &&
          el.textContent &&
          el.textContent.toLowerCase().includes("view")
      ).length;
  });

  console.log(`📊 Found ${totalJobs} jobs`);

  let applied = 0;
  let skipped = 0;

  for (let i = 0; i < totalJobs; i++) {
    console.log(`\n🔄 Processing job ${i + 1}/${totalJobs}`);

    try {
      // Click job card
      const clicked = await page.evaluate((index) => {
        const views = [...document.querySelectorAll("button")].filter(
          (el) =>
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

      if (!clicked) {
        console.log("❌ Could not open job");
        continue;
      }

      await humanDelay();

      // Get job title
      const title = await page.evaluate(() => {
        const el = document.querySelector("h1, h2");
        return el ? el.innerText : "Unknown Job";
      });

      console.log(`📌 ${title}`);

      // Click Apply (robust)
      const clickedApply = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find(
          (el) =>
            el.offsetParent !== null &&
            el.textContent &&
            el.textContent.toLowerCase().includes("apply")
        );

        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

      if (!clickedApply) {
        console.log("⚠️ Already applied or no apply button");
        skipped++;

        await page.keyboard.press("Escape");
        await humanDelay(1500, 2500);
        continue;
      }

      console.log("👉 Clicked primary apply");

      await humanDelay(3000, 5000);

      // Handle modal apply
      const modalApply = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find(
          (el) =>
            el.offsetParent !== null &&
            el.textContent &&
            el.textContent.toLowerCase().includes("apply")
        );

        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

      if (modalApply) {
        console.log("👉 Clicked modal apply");
      }

      await humanDelay(3000, 6000);

      // Close modal
      await page.keyboard.press("Escape");
      await humanDelay(1500, 2500);

      // Check if applied (list view)
      const appliedCheck = await page.evaluate(() => {
        return document.body.innerText
          .toLowerCase()
          .includes("applied today");
      });

      if (appliedCheck) {
        console.log(`✅ Applied → ${title}`);
        applied++;
      } else {
        console.log(`⚠️ Could not verify → ${title}`);
      }

      // Debug screenshot (optional but useful)
      await page.screenshot({ path: `debug-${i}.png` });

      await humanDelay(4000, 7000);
    } catch (err) {
      console.log("❌ Error:", err.message);
      await page.keyboard.press("Escape");
      await humanDelay(1000, 2000);
    }
  }

  console.log(`\n🎯 Total applied: ${applied}`);
  console.log(`⚠️ Skipped: ${skipped}`);

  await browser.close();
})();