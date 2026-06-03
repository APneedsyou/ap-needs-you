import { chromium, Browser, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubJob {
  title: string;
  link: string;
  company?: string;
  location?: string;
  postedDate?: string;
}

interface Job {
  id: string;
  department: string;
  vacancies: string;
  date: string;
  status: "Active" | "Upcoming" | "Closed";
  category: "government" | "private-it";
  link?: string;
  subJobs?: SubJob[];
  lastUpdated: string;
  source: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 20);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  label = ""
): Promise<T | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`⚠️  ${label} attempt ${i + 1} failed:`, (err as Error).message);
      if (i === retries) return null;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return null;
}

// ─── Scraper: Freshersworld (AP IT Jobs) ─────────────────────────────────────

async function scrapeFreshersworld(page: Page): Promise<SubJob[]> {
  console.log("🔍 Scraping Freshersworld for AP IT jobs...");

  await page.goto(
    "https://www.freshersworld.com/jobs/jobsearch/IT-software-jobs-in-andhra-pradesh",
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(2000);

  const jobs = await page.evaluate(() => {
    const results: SubJob[] = [];
    // Freshersworld job listing selectors
    const cards = document.querySelectorAll(".job-container, .job-details-main-wrapper, article.job");
    cards.forEach((card, i) => {
      if (i >= 15) return; // limit to 15
      const titleEl = card.querySelector("h3 a, .job-title a, h2 a");
      const companyEl = card.querySelector(".company-name, .org-name");
      const locationEl = card.querySelector(".location, .job-location");
      const linkEl = card.querySelector("a[href]") as HTMLAnchorElement;

      const title = titleEl?.textContent?.trim();
      const link = titleEl
        ? (titleEl as HTMLAnchorElement).href || linkEl?.href
        : linkEl?.href;

      if (title && link) {
        results.push({
          title,
          company: companyEl?.textContent?.trim() || "IT Company",
          location: locationEl?.textContent?.trim() || "Andhra Pradesh",
          link,
        });
      }
    });
    return results;
  });

  console.log(`  ✅ Found ${jobs.length} jobs on Freshersworld`);
  return jobs;
}

// ─── Scraper: Naukri (AP IT Jobs via free search) ────────────────────────────

async function scrapeNaukriAPJobs(page: Page): Promise<SubJob[]> {
  console.log("🔍 Scraping Naukri for AP IT jobs...");

  // Use Naukri's structured URL for AP IT jobs
  await page.goto(
    "https://www.naukri.com/it-jobs-in-andhra-pradesh",
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(3000);

  // Handle potential bot challenge
  const title = await page.title();
  if (title.toLowerCase().includes("access denied") || title.toLowerCase().includes("captcha")) {
    console.warn("  ⚠️  Naukri blocked access, skipping...");
    return [];
  }

  const jobs = await page.evaluate(() => {
    const results: SubJob[] = [];
    const cards = document.querySelectorAll(
      "article.jobTuple, .jobTupleHeader, [class*='jobTuple'], .cust-job-tuple"
    );

    cards.forEach((card, i) => {
      if (i >= 12) return;
      const titleEl = card.querySelector("a.title, .title a, a[class*='title']") as HTMLAnchorElement;
      const companyEl = card.querySelector(".companyInfo a, a.subTitle");
      const locationEl = card.querySelector(".locWdth, span[class*='location']");

      if (titleEl?.textContent && titleEl?.href) {
        results.push({
          title: titleEl.textContent.trim(),
          company: companyEl?.textContent?.trim() || "",
          location: locationEl?.textContent?.trim() || "Andhra Pradesh",
          link: titleEl.href,
        });
      }
    });
    return results;
  });

  console.log(`  ✅ Found ${jobs.length} jobs on Naukri`);
  return jobs;
}

// ─── Scraper: TimesJobs (AP IT Jobs) ─────────────────────────────────────────

async function scrapeTimesJobs(page: Page): Promise<SubJob[]> {
  console.log("🔍 Scraping TimesJobs for AP IT jobs...");

  await page.goto(
    "https://www.timesjobs.com/candidate/job-search.html?searchType=personalizedSearch&from=submit&txtKeywords=IT&txtLocation=Andhra+Pradesh",
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(2000);

  const jobs = await page.evaluate(() => {
    const results: SubJob[] = [];
    const cards = document.querySelectorAll("li.clearfix.job-bx.wht-shd-bx");

    cards.forEach((card, i) => {
      if (i >= 12) return;
      const titleEl = card.querySelector("h2 a") as HTMLAnchorElement;
      const companyEl = card.querySelector("h3.joblist-comp-name");
      const locationEl = card.querySelector("ul.top-jd-dtl li");

      if (titleEl?.textContent && titleEl?.href) {
        results.push({
          title: titleEl.textContent.trim(),
          company: companyEl?.textContent?.trim() || "",
          location: locationEl?.textContent?.trim() || "Andhra Pradesh",
          link: titleEl.href,
        });
      }
    });
    return results;
  });

  console.log(`  ✅ Found ${jobs.length} jobs on TimesJobs`);
  return jobs;
}

// ─── Scraper: APPSC Government Jobs ──────────────────────────────────────────

async function scrapeAPPSC(page: Page): Promise<Job[]> {
  console.log("🔍 Scraping APPSC for government notifications...");

  await page.goto("https://psc.ap.gov.in", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  const notifications = await page.evaluate(() => {
    const results: Array<{
      title: string;
      link: string;
      date: string;
    }> = [];

    // APPSC typically shows notifications in a table or list
    const rows = document.querySelectorAll(
      "table tr, .notification-item, ul.news li, .latest-notifications li"
    );

    rows.forEach((row, i) => {
      if (i >= 10) return;
      const linkEl = row.querySelector("a") as HTMLAnchorElement;
      const dateEl = row.querySelector("td:last-child, .date, span.date");

      if (linkEl?.textContent?.trim() && linkEl.href) {
        results.push({
          title: linkEl.textContent.trim(),
          link: linkEl.href,
          date: dateEl?.textContent?.trim() || "",
        });
      }
    });

    return results;
  });

  // Convert to Job format
  const jobs: Job[] = notifications
    .filter((n) => n.title.length > 10)
    .slice(0, 8)
    .map((n, i) => ({
      id: `APPSC-${String(i + 1).padStart(2, "0")}`,
      department: n.title.slice(0, 80),
      vacancies: "See notification",
      date: n.date || today(),
      status: "Active" as const,
      category: "government" as const,
      link: n.link,
      lastUpdated: today(),
      source: "APPSC Official Portal",
    }));

  console.log(`  ✅ Found ${jobs.length} notifications on APPSC`);
  return jobs;
}

// ─── Scraper: AP Grama Sachivalayam / APSSDC ─────────────────────────────────

async function scrapeAPSSDC(page: Page): Promise<Job[]> {
  console.log("🔍 Scraping APSSDC for skill/govt jobs...");

  await page.goto("https://apssdc.in/jobs", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  const items = await page.evaluate(() => {
    const results: Array<{ title: string; link: string; date: string }> = [];
    const cards = document.querySelectorAll(
      ".job-item, article, .opportunity-card, .card"
    );

    cards.forEach((card, i) => {
      if (i >= 8) return;
      const titleEl = card.querySelector("h2, h3, h4, .title");
      const linkEl = card.querySelector("a") as HTMLAnchorElement;
      const dateEl = card.querySelector(".date, time, .meta");

      const title = titleEl?.textContent?.trim();
      const link = linkEl?.href;

      if (title && link && title.length > 5) {
        results.push({
          title,
          link,
          date: dateEl?.textContent?.trim() || "",
        });
      }
    });

    return results;
  });

  const jobs: Job[] = items.map((item, i) => ({
    id: `APSSDC-${String(i + 1).padStart(2, "0")}`,
    department: item.title.slice(0, 80),
    vacancies: "Multiple",
    date: item.date || today(),
    status: "Active" as const,
    category: "government" as const,
    link: item.link,
    lastUpdated: today(),
    source: "APSSDC Official Portal",
  }));

  console.log(`  ✅ Found ${jobs.length} jobs on APSSDC`);
  return jobs;
}

// ─── Fallback: Static verified govt data (when scrapers fail) ─────────────────

function getStaticGovtJobs(): Job[] {
  return [
    {
      id: "APPSC-GRP1",
      department: "APPSC Group 1 Services (Home Dept / Police)",
      vacancies: "2,778 Posts",
      date: "August 15, 2026",
      status: "Upcoming",
      category: "government",
      link: "https://psc.ap.gov.in",
      lastUpdated: today(),
      source: "APPSC Official Portal",
    },
    {
      id: "APPSC-GRP2",
      department: "APPSC Group 2 & Engineering Services",
      vacancies: "1,253 Posts",
      date: "September 15, 2026",
      status: "Upcoming",
      category: "government",
      link: "https://psc.ap.gov.in",
      lastUpdated: today(),
      source: "APPSC Official Portal",
    },
    {
      id: "DSC-2026",
      department: "School Education – Mega DSC Teacher Recruitment",
      vacancies: "3,004 Posts",
      date: "October 15, 2026",
      status: "Upcoming",
      category: "government",
      link: "https://naipunyam.ap.gov.in",
      lastUpdated: today(),
      source: "AP School Education Portal",
    },
    {
      id: "APHEDCET",
      department: "Higher Education Department",
      vacancies: "1,500 Posts",
      date: "May 2026 (Active)",
      status: "Active",
      category: "government",
      link: "https://portal-psc.ap.gov.in",
      lastUpdated: today(),
      source: "AP Higher Education Portal",
    },
  ];
}

// ─── Main Runner ──────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 AP Needs You - Job Scraper Starting...\n");

  const browser: Browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  const allJobs: Job[] = [];

  // ── 1. Private IT Jobs ───────────────────────────────────────────────────
  const itSubJobs: SubJob[] = [];

  const freshersworldJobs = await withRetry(
    () => scrapeFreshersworld(page),
    2,
    "Freshersworld"
  );
  if (freshersworldJobs) itSubJobs.push(...freshersworldJobs);

  const naukriJobs = await withRetry(
    () => scrapeNaukriAPJobs(page),
    2,
    "Naukri"
  );
  if (naukriJobs) itSubJobs.push(...naukriJobs);

  const timesJobs = await withRetry(
    () => scrapeTimesJobs(page),
    2,
    "TimesJobs"
  );
  if (timesJobs) itSubJobs.push(...timesJobs);

  // Deduplicate by title similarity
  const seen = new Set<string>();
  const deduped = itSubJobs.filter((job) => {
    const key = job.title.slice(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduped.length > 0) {
    allJobs.push({
      id: "IT-PRIVATE",
      department: "Private IT Jobs – Andhra Pradesh",
      vacancies: `${deduped.length} Live Openings Tracked`,
      date: `Updated: ${today()}`,
      status: "Active",
      category: "private-it",
      subJobs: deduped.slice(0, 20),
      lastUpdated: today(),
      source: "Freshersworld, Naukri, TimesJobs",
    });
  }

  // ── 2. Government Jobs ────────────────────────────────────────────────────
  const appscJobs = await withRetry(() => scrapeAPPSC(page), 2, "APPSC");
  const apSSDCJobs = await withRetry(() => scrapeAPSSDC(page), 2, "APSSDC");

  const liveGovtJobs = [
    ...(appscJobs || []),
    ...(apSSDCJobs || []),
  ];

  // Always include static fallback data + merge live data
  const staticJobs = getStaticGovtJobs();

  // Merge: live jobs first, then static (avoid duplicate IDs)
  const liveIds = new Set(liveGovtJobs.map((j) => j.id));
  const mergedGovt = [
    ...liveGovtJobs,
    ...staticJobs.filter((j) => !liveIds.has(j.id)),
  ];

  allJobs.push(...mergedGovt);

  // ── 3. Write output ───────────────────────────────────────────────────────
  await browser.close();

  const outputPath = path.join(__dirname, "..", "data.json");
  fs.writeFileSync(outputPath, JSON.stringify(allJobs, null, 2));

  console.log(`\n✅ Done! ${allJobs.length} job entries written to data.json`);
  console.log(`   📁 Path: ${outputPath}`);

  // Print summary
  const itCount = allJobs.filter((j) => j.category === "private-it").length;
  const govtCount = allJobs.filter((j) => j.category === "government").length;
  console.log(`   💼 Private IT: ${itCount} card(s)`);
  console.log(`   🏛️  Government: ${govtCount} notifications`);
}

main().catch((err) => {
  console.error("❌ Scraper failed:", err);
  process.exit(1);
});
