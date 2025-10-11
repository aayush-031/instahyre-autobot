const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  // Visit domain, set cookies, then go to opportunities
  await page.goto("https://www.instahyre.com/", { waitUntil: "domcontentloaded" }); // ensure cookie domain loads
  const cookies = JSON.parse(process.env.INSTAHYRE_COOKIES || "[]");
  if (cookies.length) await page.setCookie(...cookies);
  await page.goto("https://www.instahyre.com/candidate/opportunities/?matching=true", {
    waitUntil: "networkidle2",
  });

  // Small helper: wait for a visible button/link whose text starts with label
  async function waitForButton(label, rootSelector = "body", timeout = 20000) {
    await page.waitForFunction(
      (label, rootSelector) => {
        const root = document.querySelector(rootSelector) || document.body;
        const els = [...root.querySelectorAll("a,button")];
        return Boolean(
          els.find(
            (el) =>
              el.offsetParent !== null &&
              el.textContent &&
              el.textContent.trim().toLowerCase().startsWith(label.toLowerCase())
          )
        );
      },
      { timeout },
      label,
      rootSelector
    );
  }

  async function clickButton(label, rootSelector = "body") {
    return page.evaluate((label, rootSelector) => {
      const root = document.querySelector(rootSelector) || document.body;
      const els = [...root.querySelectorAll("a,button")];
      const el = els.find(
        (n) =>
          n.offsetParent !== null &&
          n.textContent &&
          n.textContent.trim().toLowerCase().startsWith(label.toLowerCase())
      );
      if (el) {
        el.click();
        return true;
      }
      return false;
    }, label, rootSelector);
  }

  // 1) Click the first "View" on the recommendations list
  await waitForButton("View"); // list rendered
  await clickButton("View");

  // 2) Click "Apply" in the opened job drawer/page
  await waitForButton("Apply");
  await clickButton("Apply");

  // 3) Post-apply cases:
  //    A) Similar-jobs modal -> click Apply in the dialog
  //    B) Drawer reloads with another job -> click Apply again inline
  try {
    // try modal for a few seconds
    await waitForButton("Apply", "[role='dialog'], .modal, .ReactModal__Content", 7000);
    await clickButton("Apply", "[role='dialog'], .modal, .ReactModal__Content");
  } catch {
    // fall back to inline second Apply
    try {
      await waitForButton("Apply", "body", 7000);
      await clickButton("Apply");
    } catch {
      // no second apply shown; continue
    }
  }

  await page.waitForTimeout(1500);
  await browser.close();
})();
