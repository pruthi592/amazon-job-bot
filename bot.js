const { chromium } = require("playwright");
const fs = require("fs");

// ===== CONFIG =====
const CHECK_INTERVAL = 2 * 60 * 1000;

// 🎯 ~25km AREA (Brampton + nearby)
const TARGET_LOCATIONS = [
  "brampton",
  "mississauga",
  "etobicoke",
  "bolton",
];

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1490749883135819899/N8JMx2kAbRKYKqeK8JmezPDlOMA4s0pVfHj628dT12PtqnSgQhxeHf6jcWDnkkEV5NQK"; // 🔥 paste your webhook here

// ===== LOAD SEEN JOBS =====
let seenJobs = new Set();
if (fs.existsSync("seen_jobs.json")) {
  seenJobs = new Set(JSON.parse(fs.readFileSync("seen_jobs.json")));
}

// ===== SAVE JOBS =====
function saveJobs() {
  fs.writeFileSync("seen_jobs.json", JSON.stringify([...seenJobs]));
}

// ===== SEND ALERT =====
async function sendAlert(jobTitle, jobLink) {
  console.log("🚨 New Job Found:", jobTitle);

  if (DISCORD_WEBHOOK !== "https://discord.com/api/webhooks/1490749883135819899/N8JMx2kAbRKYKqeK8JmezPDlOMA4s0pVfHj628dT12PtqnSgQhxeHf6jcWDnkkEV5NQK") {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🚨 Warehouse Job Found!\n${jobTitle}\n${jobLink}`
      })
    });
  }
}

// ===== MAIN FUNCTION =====
async function checkJobs(page) {
  console.log("🔍 Checking jobs...");

  await page.goto(
    "https://www.amazon.jobs/en/search?base_query=Warehouse+Associate&country=CAN",
    { waitUntil: "domcontentloaded" }
  );

  await page.waitForTimeout(3000);

  const jobs = await page.$$eval(".job-tile", (elements) =>
    elements.map((el) => ({
      title: el.querySelector(".job-title")?.innerText || "",
      link: el.querySelector("a")?.href || "",
      location: el.querySelector(".location")?.innerText || ""
    }))
  );

  console.log("🧾 Jobs found:", jobs.length);

  for (const job of jobs) {
    if (!job.link || seenJobs.has(job.link)) continue;

const title = job.title.toLowerCase();
const location = job.location.toLowerCase();

console.log("📍 Checking:", job.title, "|", job.location);

// ✅ EXACT ROLE MATCHING
const validRoles = [
  "fulfillment centre warehouse associate",
  "sortation centre warehouse associate",
  "delivery station warehouse associate",
  "xl warehouse associate"
];

// Check if title matches ANY of the exact roles
const isValidRole = validRoles.some(role => title.includes(role));

if (!isValidRole) continue;
    // 🎯 LOCATION FILTER (~25km)
    const isNearby = TARGET_LOCATIONS.some(loc =>
      location.includes(loc)
    );

    if (!isNearby) continue;

    // ✅ SAVE + ALERT
    seenJobs.add(job.link);
    saveJobs();

    await sendAlert(job.title, job.link);

    console.log(`✅ MATCH: ${job.title} - ${job.location}`);

    // 👉 OPEN JOB
    await page.goto(job.link, { waitUntil: "domcontentloaded" });

    console.log("👉 APPLY manually");
    return;
  }
}

// ===== LOOP =====
async function runBot() {
  const browser = await chromium.launch({ headless: true }); // 🔥 headless for cloud
  const page = await browser.newPage();

  while (true) {
    try {
      await checkJobs(page);
    } catch (err) {
      console.log("⚠️ Error:", err.message);
    }

    await new Promise((r) => setTimeout(r, CHECK_INTERVAL));
  }
}

runBot();
