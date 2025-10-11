const puppeteer = require("puppeteer");

(async () => {
  console.log("🚀 Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  console.log("🌐 Navigating to Instahyre opportunities page...");
  await page.goto("https://www.instahyre.com/candidate/opportunities/?matching=true", {
    waitUntil: "networkidle2"
  });

  // Step 2: Login via cookies
  try {
    console.log("🍪 Loading cookies from environment...");
    const cookies = JSON.parse(process.env.INSTAHYRE_COOKIES || "[]");

    if (!cookies.length) {
      console.error("❌ No cookies found in INSTAHYRE_COOKIES env var!");
      await browser.close();
      process.exit(1);
    }

    await page.setCookie(...cookies);
    console.log("✅ Cookies set successfully. Reloading page...");
    await page.reload({ waitUntil: "networkidle2" });
    console.log("🔐 Logged in successfully!");
  } catch (err) {
    console.error("❌ Failed to load cookies or login:", err);
    await browser.close();
    process.exit(1);
  }

  // Step 3: Scan for job buttons
  console.log("🔍 Scanning for job 'View' buttons...");
  const jobs = await page.$$("button, a");
  console.log(`🧩 Found ${jobs.length} clickable elements.`);

  let applied = 0;
  let viewButtons = [];

  for (const job of jobs) {
    try {
      const text = await page.evaluate(el => el.textContent.trim(), job);
      if (/view/i.test(text)) {
        viewButtons.push(job);
      }
    } catch (e) {}
  }

  console.log(`🎯 Found ${viewButtons.length} 'View' buttons.`);

  for (const [index, job] of viewButtons.entries()) {
    if (applied >= 5) break;

    try {
      const label = await page.evaluate(el => el.textContent.trim(), job);
      console.log(`\n🟩 (${index + 1}) Clicking on: "${label}"`);
      await job.click();
      await page.waitForTimeout(3000);

      console.log("⏳ Searching for Apply button...");
      const applyBtn = await page.$x("//button[contains(., 'Apply')]");
      if (applyBtn.length > 0) {
        console.log("✅ Apply button found. Clicking...");
        await applyBtn[0].click();
        applied++;
        console.log(`💼 Applied to ${applied} job(s) so far.`);
        await page.waitForTimeout(2000);

        // Optional: close popup
        const cancelBtn = await page.$x("//button[contains(., 'Cancel')]");
        if (cancelBtn.length > 0) {
          console.log("🧹 Closing cancel popup...");
          await cancelBtn[0].click();
        }
      } else {
        console.log("⚠️ No Apply button found for this job.");
      }

      // Close modal (escape key)
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1500);
    } catch (err) {
      console.error(`❌ Error applying to job ${index + 1}:`, err.message);
    }
  }

  console.log("\n✅ Finished run. Total jobs applied:", applied);
  await browser.close();
})();
