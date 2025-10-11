const puppeteer = require("puppeteer");

// Polyfill for waitForTimeout if Puppeteer < v3
puppeteer.Page.prototype.waitForTimeout = async function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

(async () => {
  console.log("🚀 Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  console.log("🌐 Navigating to Instahyre opportunities page...");
  await page.goto("https://www.instahyre.com/candidate/opportunities/?matching=true", {
    waitUntil: "networkidle2"
  });

  console.log("🍪 Loading cookies from environment...");
  const cookies = JSON.parse(process.env.INSTAHYRE_COOKIES);
  await page.setCookie(...cookies);
  console.log("✅ Cookies set successfully. Reloading page...");
  await page.reload({ waitUntil: "networkidle2" });

  console.log("🔐 Logged in successfully!");
  await page.waitForTimeout(4000);

  // --- Step 3: Wait for job cards to appear ---
  console.log("🔍 Waiting for job cards...");
  await page.waitForSelector(".opportunity-card", { timeout: 15000 });
  console.log("✅ Job cards loaded!");

  // --- Step 4: Find and click “View” buttons ---
  const viewButtons = await page.$x("//button[contains(., 'View')]");
  console.log(`🎯 Found ${viewButtons.length} 'View' buttons.`);

  let applied = 0;
  for (const button of viewButtons) {
    if (applied >= 5) break;

    console.log(`🖱️ Opening job ${applied + 1}...`);
    await button.click();
    await page.waitForTimeout(3000);

    const applyBtn = await page.$x("//button[contains(., 'Apply')]");
    if (applyBtn.length > 0) {
      console.log("💼 Found Apply button, clicking...");
      await applyBtn[0].click();
      await page.waitForTimeout(2000);
      applied++;

      // Close popup if Cancel or Escape works
      const cancelBtn = await page.$x("//button[contains(., 'Cancel')]");
      if (cancelBtn.length > 0) {
        await cancelBtn[0].click();
      } else {
        await page.keyboard.press("Escape");
      }

      await page.waitForTimeout(1500);
    } else {
      console.log("⚠️ No Apply button found for this job.");
      await page.keyboard.press("Escape");
    }
  }

  console.log(`✅ Finished run. Total jobs applied: ${applied}`);
  await browser.close();
})();
