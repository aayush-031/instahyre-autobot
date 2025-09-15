const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  // --- Step 1: Go to Instahyre ---
  await page.goto("https://www.instahyre.com/candidate/opportunities/?matching=true", {
    waitUntil: "networkidle2"
  });

  // --- Step 2: Login with cookies (safer than username/password here) ---
  // 👉 Once you log in manually, grab your cookies and paste them here.
  const cookies = JSON.parse(process.env.INSTAHYRE_COOKIES);
  await page.setCookie(...cookies);
  await page.reload({ waitUntil: "networkidle2" });

  console.log("Logged in!");

  // --- Step 3: Find jobs and apply ---
  const jobs = await page.$$("button, a"); // crude selector
  let applied = 0;

  for (const job of jobs) {
    const text = await page.evaluate(el => el.textContent, job);
    if (/view/i.test(text) && applied < 5) {  // limit per run
      await job.click();
      await page.waitForTimeout(3000);

      const applyBtn = await page.$x("//button[contains(., 'Apply')]");
      if (applyBtn.length > 0) {
        await applyBtn[0].click();
        console.log("Applied to job");
        applied++;
        await page.waitForTimeout(2000);

        // close popup if exists
        const cancelBtn = await page.$x("//button[contains(., 'Cancel')]");
        if (cancelBtn.length > 0) {
          await cancelBtn[0].click();
        }
      }

      // Close modal (escape)
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1500);
    }
  }

  console.log("Done. Applied to", applied, "jobs.");
  await browser.close();
})();
