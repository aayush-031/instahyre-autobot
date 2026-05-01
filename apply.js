const puppeteer = require("puppeteer-core");

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

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

  // ---------------- LOGIN ----------------
  const email = process.env.INSTAHYRE_EMAIL;
  const password = process.env.INSTAHYRE_PASSWORD;

  let loggedIn = false;

  try {
    if (email && password) {
      console.log("🔐 Trying login via email/password...");

      await page.goto("https://www.instahyre.com/login", {
        waitUntil: "networkidle2",
      });

      await delay(2000);

      await page.type("input[type='email']", email, { delay: 80 });
      await page.type("input[type='password']", password, { delay: 80 });

      await Promise.all([
        page.click("button[type='submit']"),
        page.waitForNavigation({ waitUntil: "networkidle2" }),
      ]);

      if (!page.url().includes("login")) {
        console.log("✅ Logged in via credentials");
        loggedIn = true;
      }
    }
  } catch (e) {
    console.log("⚠️ Login via credentials failed");
  }

  // 🔁 Fallback to cookies
  if (!loggedIn) {
    console.log("🍪 Falling back to cookies...");

    const cookiesRaw = process.env.INSTAHYRE_COOKIES || "[]";
    const cookies = JSON.parse(cookiesRaw);

    await page.goto("https://www.instahyre.com", {
      waitUntil: "networkidle2",
    });

    if (cookies.length) {
      await page.setCookie(...cookies);
      console.log(`✅ Set ${cookies.length} cookies`);
    }

    await page.goto(
      "https://www.instahyre.com/candidate/opportunities/?matching=true",
      { waitUntil: "networkidle2" }
    );

    if (page.url().includes("login")) {
      throw new Error("❌ Both login and cookies failed");
    }

    console.log("✅ Logged in via cookies");
  }

  // ---------------- JOBS ----------------
  await page.goto(
    "https://www.instahyre.com/candidate/opportunities/?matching=true",
    { waitUntil: "networkidle2" }
  );

  await autoScroll(page);
  await delay(3000);

  const totalJobs = await page.evaluate(() => {
    return [...document.querySelectorAll("button")].filter(
      (el) =>
        el.offsetParent !== null &&
        el.textContent &&
        el.textContent.toLowerCase().includes("view")
    ).length;
  });

  console.log(`📊 Found ${totalJobs} jobs`);

  let applied = 0;

  for (let i = 0; i < totalJobs; i++) {
    console.log(`\n🔄 Processing job ${i + 1}/${totalJobs}`);

    try {
      const clickedView = await page.evaluate((index) => {
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

      if (!clickedView) continue;

      await delay(2500);

      const jobTitle = await page.evaluate(() => {
        const el = document.querySelector("h1, h2");
        return el ? el.innerText : "Unknown Job";
      });

      console.log(`📌 ${jobTitle}`);

      const clickedApply = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find(
          (el) =>
            el.offsetParent !== null &&
            el.textContent &&
            el.textContent.toLowerCase().trim() === "apply"
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

      if (!clickedApply) {
        console.log("⚠️ Already applied");
        await page.keyboard.press("Escape");
        continue;
      }

      await delay(3000);

      await page.evaluate(() => {
        const modalBtn = [...document.querySelectorAll("button")].find(
          (el) =>
            el.offsetParent !== null &&
            el.textContent &&
            el.textContent.toLowerCase().trim() === "apply"
        );
        if (modalBtn) modalBtn.click();
      });

      await delay(3000);

      await page.keyboard.press("Escape");
      await delay(2000);

      const appliedCheck = await page.evaluate(() => {
        return document.body.innerText
          .toLowerCase()
          .includes("applied today");
      });

      if (appliedCheck) {
        console.log(`✅ Applied → ${jobTitle}`);
        applied++;
      } else {
        console.log(`⚠️ Could not verify → ${jobTitle}`);
      }

      await delay(3000 + Math.random() * 3000);

    } catch (err) {
      console.log("❌ Error:", err.message);
      await page.keyboard.press("Escape");
    }
  }

  console.log(`\n🎯 Total applied: ${applied}`);

  await browser.close();
})();