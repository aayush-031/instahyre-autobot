const puppeteer = require("puppeteer");
const fs = require("fs");

const log = (msg) => {
  console.log(msg);
  fs.appendFileSync("output.log", msg + "\n");
};

(async () => {
  log("🚀 Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  log("🌐 Navigating to Instahyre opportunities page...");
  await page.goto("https://www.instahyre.com/candidate/opportunities/?matching=true", {
    waitUntil: "networkidle2"
  });

  // --- Step 2: Load cookies ---
  log("🍪 Loading cookies from environment...");
  const cookies = JSON.parse(process.env.INSTAHYRE_COOKIES);
  await page.setCookie(...cookies);
  log("✅ Cookies set successfully. Reloading page...");
  await page.reload({ waitUntil: "networkidle2" });

  log("🔐 Logged in successfully!");
  await page.waitForTimeout(4000);

  // --- Step 3: Scroll to load all jobs ---
  log("📜 Scrolling through job listings...");
  await autoScroll(page);
  await page.waitForTimeout(3000);

  // --- Step 4: Find possible 'View' or 'Apply' buttons ---
  log("🔍 Scanning for job 'View' or 'Apply' buttons...");
  const buttons = await page.$$eval("button, a, div[role='button']", els =>
    els
      .filter(el => /view|apply|details/i.test(el.textContent))
      .map(el => el.innerText.trim())
  );

  log(`🧩 Found ${buttons.length} clickable elements.`);
  let applied = 0;

  for (const [i, btnText] of buttons.entries()) {
    if (applied >= 5) break; // daily safety limit

    log(`➡️ (${i + 1}) Checking button: "${btnText}"`);
    if (/view|apply|details/i.test(btnText)) {
      const [button] = await page.$x(
        `//*[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${btnText.toLowerCase()}')]`
      );

      if (button) {
        try {
          log(`🖱️ Clicking button: "${btnText}"`);
          await button.click();
          await page.waitForTimeout(4000);

          const applyBtn = await page.$x("//button[contains(., 'Apply')]");
          if (applyBtn.length > 0) {
            await applyBtn[0].click();
            log(`✅ Applied to job #${applied + 1}`);
            applied++;
            await page.waitForTimeout(2500);

            // Handle "Apply to other similar jobs" popup
            const popupApply = await page.$x("//button[contains(., 'Apply') and not(@disabled)]");
            if (popupApply.length > 0) {
              await popupApply[0].click();
              log("🪄 Applied to similar jobs popup.");
              await page.waitForTimeout(1500);
            }

            // Close popup if any
            const cancelBtn = await page.$x("//button[contains(., 'Cancel')]");
            if (cancelBtn.length > 0) {
              await cancelBtn[0].click();
              log("❌ Closed popup.");
              await page.waitForTimeout(1500);
            }
          }

          // Escape from modal safely
          await page.keyboard.press("Escape");
          await page.waitForTimeout(2000);
        } catch (err) {
          log(`⚠️ Error applying: ${err.message}`);
        }
      }
    }
  }

  log(`✅ Finished run. Total jobs applied: ${applied}`);

  log("====SUMMARY====");
  log(`Applied_Count=${applied}`);
  log("================");

  await browser.close();

  // --- Helper function for scrolling ---
  async function autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 500); // 0.5s per scroll
      });
    });
  }
})();
