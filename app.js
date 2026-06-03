// ─── Toggle sub-jobs accordion ───────────────────────────────────────────────
window.toggleSubJobs = function (id) {
  const container = document.getElementById(`subjobs-${id}`);
  const button = document.getElementById(`btn-${id}`);
  if (container && button) {
    const isHidden = container.classList.toggle("hidden");
    button.innerText = isHidden
      ? `Show Jobs (${container.children.length}) ↓`
      : "Hide Jobs ↑";
  }
};

// ─── State ────────────────────────────────────────────────────────────────────
let allJobs = [];
let activeFilter = "all";

// ─── Render job cards ─────────────────────────────────────────────────────────
function renderJobs(jobs) {
  const container = document.getElementById("job-cards-container");
  const countEl = document.getElementById("results-count");

  if (jobs.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-16 text-slate-500">
        <p class="text-4xl mb-3">🔍</p>
        <p class="text-lg font-medium">No jobs found in this category right now.</p>
        <p class="text-sm mt-1">Check back tomorrow — we update daily.</p>
      </div>`;
    if (countEl) countEl.textContent = "0 opportunities";
    return;
  }

  if (countEl) {
    countEl.textContent = `${jobs.length} opportunit${jobs.length === 1 ? "y" : "ies"}`;
  }

  container.innerHTML = jobs
    .map((job) => {
      const isActive = job.status === "Active";
      const isGovt = job.category === "government";
      const hasSubJobs = job.subJobs && job.subJobs.length > 0;

      // Category badge
      const categoryBadge = isGovt
        ? `<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">🏛️ Government</span>`
        : `<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">💻 Private IT</span>`;

      // Status badge
      const statusBadge = `
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full ${
          isActive
            ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
            : "bg-slate-800 text-slate-400 border border-slate-700"
        }">
          ${isActive ? "● Live" : "⏳ Upcoming"}
        </span>`;

      // Action area
      let actionMarkup = "";
      if (hasSubJobs) {
        actionMarkup = `
          <button
            id="btn-${job.id}"
            onclick="toggleSubJobs('${job.id}')"
            class="w-full text-center block py-2.5 px-4 rounded-xl font-medium text-sm transition bg-teal-500 hover:bg-teal-600 text-slate-950 cursor-pointer"
          >
            Show Jobs (${job.subJobs.length}) ↓
          </button>
          <div id="subjobs-${job.id}" class="hidden mt-3 space-y-2 border-t border-slate-800 pt-3 max-h-72 overflow-y-auto">
            ${job.subJobs
              .map(
                (sub) => `
              <a
                href="${sub.link}"
                target="_blank"
                rel="noopener noreferrer"
                class="block p-3 bg-slate-900 rounded-lg text-xs text-slate-300 border border-slate-800 hover:border-teal-500/40 transition flex justify-between items-start gap-2"
              >
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-slate-200 truncate">${sub.title}</p>
                  ${sub.company ? `<p class="text-slate-500 mt-0.5">${sub.company}</p>` : ""}
                  ${sub.location ? `<p class="text-slate-600 text-[10px] mt-0.5">📍 ${sub.location}</p>` : ""}
                </div>
                <span class="text-teal-400 font-bold shrink-0">Apply ↗</span>
              </a>`
              )
              .join("")}
          </div>`;
      } else {
        actionMarkup = `
          <a
            href="${job.link || "#"}"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full text-center block py-2.5 px-4 rounded-xl font-medium text-sm transition ${
              isActive
                ? "bg-teal-500 hover:bg-teal-600 text-slate-950"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-default"
            }"
          >
            ${isActive ? "Apply / View Details ↗" : "Notification Coming Soon"}
          </a>`;
      }

      // Source + last updated footer
      const metaFooter =
        job.source || job.lastUpdated
          ? `<div class="mt-3 pt-3 border-t border-slate-800/60 flex justify-between items-center text-[10px] text-slate-600">
              <span>📡 ${job.source || "Official Portal"}</span>
              <span>Updated: ${job.lastUpdated || "Today"}</span>
            </div>`
          : "";

      return `
        <div class="bg-slate-950 border ${
          isActive ? "border-teal-500/25" : "border-slate-800"
        } rounded-2xl p-6 flex flex-col justify-between hover:border-slate-600 transition duration-200">
          <div class="flex-grow">
            <div class="flex justify-between items-center mb-3 gap-2 flex-wrap">
              <div class="flex items-center gap-2">
                ${categoryBadge}
              </div>
              ${statusBadge}
            </div>
            <h3 class="text-lg font-bold text-white mb-3 leading-tight">${job.department}</h3>
            <div class="space-y-1.5 text-sm mb-5">
              <div class="flex justify-between gap-4">
                <span class="text-slate-500 shrink-0">Vacancies</span>
                <span class="font-semibold text-slate-300 text-right">${job.vacancies}</span>
              </div>
              <div class="flex justify-between gap-4">
                <span class="text-slate-500 shrink-0">Timeline</span>
                <span class="text-slate-300 text-right">${job.date}</span>
              </div>
            </div>
          </div>
          <div class="mt-auto">
            ${actionMarkup}
            ${metaFooter}
          </div>
        </div>`;
    })
    .join("");
}

// ─── Filter logic ─────────────────────────────────────────────────────────────
function applyFilter(filter) {
  activeFilter = filter;

  // Update button styles
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    const isActive = btn.dataset.filter === filter;
    btn.className = btn.className
      .replace(/bg-teal-500\s*text-slate-950/g, "")
      .replace(/bg-slate-800\s*text-slate-300/g, "")
      .trim();

    if (isActive) {
      btn.classList.add("bg-teal-500", "text-slate-950");
      btn.classList.remove("bg-slate-800", "text-slate-300");
    } else {
      btn.classList.add("bg-slate-800", "text-slate-300");
      btn.classList.remove("bg-teal-500", "text-slate-950");
    }
  });

  const filtered =
    filter === "all"
      ? allJobs
      : allJobs.filter((j) => j.category === filter);

  renderJobs(filtered);
}

// ─── Build filter bar ─────────────────────────────────────────────────────────
function buildFilterBar() {
  const bar = document.getElementById("filter-bar");
  if (!bar) return;

  const govtCount = allJobs.filter((j) => j.category === "government").length;
  const itCount = allJobs.filter((j) => j.category === "private-it").length;

  const filters = [
    { label: `All (${allJobs.length})`, value: "all" },
    { label: `🏛️ Government (${govtCount})`, value: "government" },
    { label: `💻 Private IT (${itCount})`, value: "private-it" },
  ];

  bar.innerHTML = filters
    .map(
      (f) => `
      <button
        data-filter="${f.value}"
        onclick="applyFilter('${f.value}')"
        class="filter-btn px-4 py-2 rounded-full text-sm font-semibold transition ${
          f.value === activeFilter
            ? "bg-teal-500 text-slate-950"
            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
        }"
      >
        ${f.label}
      </button>`
    )
    .join("");
}

// ─── Main loader ──────────────────────────────────────────────────────────────
async function loadJobTracker() {
  const container = document.getElementById("job-cards-container");

  try {
    const response = await fetch("./data.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    allJobs = await response.json();

    buildFilterBar();
    renderJobs(allJobs);
  } catch (error) {
    console.error("Error loading tracker data:", error);
    container.innerHTML = `
      <div class="col-span-full text-center py-16">
        <p class="text-4xl mb-3">⚠️</p>
        <p class="text-red-400 font-medium">Failed to load job listings.</p>
        <p class="text-slate-500 text-sm mt-1">Please try refreshing the page.</p>
      </div>`;
  }
}

document.addEventListener("DOMContentLoaded", loadJobTracker);
