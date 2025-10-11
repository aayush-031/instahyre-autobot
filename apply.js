const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  // --- Login with cookies and open the page ---
  const cookies = JSON.parse(process.env.INSTAHYRE_COOKIES || "[]");
  if (cookies.length) {
    await page.setCookie(...cookies);
  }
  await page.goto(
    "https://www.instahyre.com/candidate/opportunities/?matching=true",
    { waitUntil: "networkidle2" }
  );

  // Helper: click first visible element that matches an XPath
  async function clickFirstVisibleXPath(xpath, timeout = 10000) {
    await page.waitForXPath(xpath, { timeout });
    const handles = await page.$x(xpath);
    for (const h of handles) {
      const box = await h.boundingBox();
      if (box) {
        await h.click({ delay: 50 });
        return true;
      }
    }
    return false;
  }

  // 1) Open the first job card
  const viewXPath = "(//a[contains(., 'View')] | //button[contains(., 'View')])[1]";
  const opened = await clickFirstVisibleXPath(viewXPath);
  if (!opened) throw new Error("No 'View' button found");

  // 2) Wait for Apply on the job panel/drawer and click it
  const applyXPath = "//button[contains(., 'Apply') and not(@disabled)]";
  await page.waitForXPath(applyXPath, { timeout: 15000 });
  await clickFirstVisibleXPath(applyXPath);

  // 3) Handle the two post-apply possibilities:
  //    A) The “similar jobs” modal -> click Apply inside the dialog
  //    B) The drawer reloads with another job -> click Apply again
  try {
    // Case A: modal apply
    const modalApplyXPath =
      "(//div[@role='dialog' or contains(@class,'modal')]//button[contains(., 'Apply')])[1]";
    await page.waitForXPath(modalApplyXPath, { timeout: 5000 });
    await clickFirstVisibleXPath(modalApplyXPath);
  } catch {
    // Case B: inline next job (Apply shows again)
    try {
      await page.waitForXPath(applyXPath, { timeout: 7000 });
      await clickFirstVisibleXPath(applyXPath);
    } catch {
      // nothing more to do
    }
  }

  // small grace period to let network settle
  await page.waitForTimeout(2000);
  await browser.close();
})();
