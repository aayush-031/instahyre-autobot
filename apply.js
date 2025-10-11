const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  // Enable console forwarding to see page errors
  page.on("console", (msg) => console.log("PAGE:", msg.text()));

  // Visit domain first so cookie domains resolve
  await page.goto("https://www.instahyre.com/", { waitUntil: "domcontentloaded" });
  const cookiesRaw = process.env.INSTAHYRE_COOKIES || "[]";
  const cookies = JSON.parse(cookiesRaw);

  if (cookies.length) {
    await page.setCookie(...cookies);
    console.log(`Set ${cookies.length} cookies`);
  } else {
    console.log("⚠️ No INSTAHYRE_COOKIES found; may not be authenticated");
  }

  // Navigate to opportunities page
  await page.goto("https://www.instahyre.com/candidate/opportunities/?matching=true", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  // Take a screenshot to see what loaded
  await page.screenshot({ path: "debug-after-login.png", fullPage: true });
  console.log("📸 Screenshot saved: debug-after-login.png");

  // Dump the page HTML to check structure
  const html = await page.content();
  fs.writeFileSync("debug-page.html", html);
  console.log("📄 HTML saved: debug-page.html");

  // Try to find any button or link that says "View"
  const viewButtons = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a, button")];
    return all
      .filter((el) => el.textContent && el.textContent.toLowerCase().includes("view"))
      .map((el) => ({
        tag: el.tagName,
        text: el.textContent.trim().slice(0, 50),
        visible: el.offsetParent !== null,
      }));
  });
  console.log("Found View buttons:", JSON.stringify(viewButtons, null, 2));

  if (viewButtons.length === 0) {
    console.log("❌ No 'View' buttons found. Check if cookies are valid or login is required.");
    await browser.close();
    return;
  }

  // Try clicking the first visible View
  const clicked = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a, button")];
    const view = all.find(
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

  if (!clicked) {
    console.log("❌ Could not click View button");
    await browser.close();
    return;
  }

  console.log("✅ Clicked first View button");
  await page.waitForTimeout(3000);

  // Take another screenshot after clicking View
  await page.screenshot({ path: "debug-after-view-click.png", fullPage: true });
  console.log("📸 Screenshot saved: debug-after-view-click.png");

  // Look for Apply button
  const applyButtons = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a, button")];
    return all
      .filter((el) => el.textContent && el.textContent.toLowerCase().includes("apply"))
      .map((el) => ({
        tag: el.tagName,
        text: el.textContent.trim().slice(0, 50),
        visible: el.offsetParent !== null,
      }));
  });
  console.log("Found Apply buttons:", JSON.stringify(applyButtons, null, 2));

  if (applyButtons.length === 0) {
    console.log("❌ No 'Apply' buttons found after clicking View");
    await browser.close();
    return;
  }

  // Click Apply
  const clickedApply = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a, button")];
    const apply = all.find(
      (el) =>
        el.offsetParent !== null &&
        el.textContent &&
        el.textContent.toLowerCase().includes("apply")
    );
    if (apply) {
      apply.click();
      return true;
    }
    return false;
  });

  if (!clickedApply) {
    console.log("❌ Could not click Apply button");
    await browser.close();
    return;
  }

  console.log("✅ Clicked Apply button");
  await page.waitForTimeout(3000);

  // Screenshot after Apply click
  await page.screenshot({ path: "debug-after-apply-click.png", fullPage: true });
  console.log("📸 Screenshot saved: debug-after-apply-click.png");

  // Check for modal or second Apply
  const secondApply = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a, button")];
    return all
      .filter((el) => el.textContent && el.textContent.toLowerCase().includes("apply"))
      .map((el) => ({
        tag: el.tagName,
        text: el.textContent.trim().slice(0, 50),
        visible: el.offsetParent !== null,
      }));
  });
  console.log("Found second Apply buttons:", JSON.stringify(secondApply, null, 2));

  // Try to click modal Apply if exists
  if (secondApply.filter((b) => b.visible).length > 0) {
    await page.evaluate(() => {
      const all = [...document.querySelectorAll("a, button")];
      const apply = all.find(
        (el) =>
          el.offsetParent !== null &&
          el.textContent &&
          el.textContent.toLowerCase().includes("apply")
      );
      if (apply) apply.click();
    });
    console.log("✅ Clicked second Apply");
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: "debug-final.png", fullPage: true });
  console.log("📸 Final screenshot saved: debug-final.png");

  await browser.close();
  console.log("✅ Script completed");
})();
