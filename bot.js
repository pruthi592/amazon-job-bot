const { chromium } = require("playwright");
const fs = require("fs");
const fetch = require("node-fetch");

// ===== CONFIG =====
const CHECK_INTERVAL = 2 * 60 * 1000; // 2 min

// 🎯 ~25km AREA (Brampton + nearby)
const TARGET_LOCATIONS = [
  "brampton",
  "mississauga",
  "etobicoke",
  "bolton",
];

// 🔔 DISCORD WEBHOOK
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1490824568221204551/F-87np1Ehnjk7hHjTaWwoT047K7AAW8sx1qyGlo1pSkE_gvfchGNnPhXW8i4a_jI50aM";

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
async function sendAlert(jobTitle, jobLocation, jobLink) {
  console.log("🚨 New Job Found:", jobTitle);

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🚨 **NEW AMAZON JOB**\n\n📦 ${jobTitle}\n📍 ${jobLocation}\n🔗 ${jobLink}`
      })
    });
  } catch (err) {
    console.error("❌ Discord error:", err.message);
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

    await sendAlert(job.title, job.location, job.link);

    console.log(`✅ MATCH: ${job.title} - ${job.location}`);

    // 👉 OPEN JOB (optional)
    await page.goto(job.link, { waitUntil: "domcontentloaded" });

    console.log("👉 APPLY manually");
    return;
  }
}

// ===== LOOP =====
async function runBot() {
  const browser = await chromium.launch({ headless: true });
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
