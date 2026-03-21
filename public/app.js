const statsEl = document.getElementById("stats");
const signalBoardEl = document.getElementById("signalBoard");
const localGapsEl = document.getElementById("localGaps");
const clustersEl = document.getElementById("clusters");
const suggestionsEl = document.getElementById("suggestions");
const patchEl = document.getElementById("patch");
const reposEl = document.getElementById("repos");
const generatedAtEl = document.getElementById("generatedAt");
const refreshButton = document.getElementById("refreshButton");
const stateButton = document.getElementById("stateButton");
const localPathInput = document.getElementById("localPath");
const maxReposInput = document.getElementById("maxRepos");
const queriesInput = document.getElementById("queries");
const coverageChartEl = document.getElementById("coverageChart");
const qualityChartEl = document.getElementById("qualityChart");
const emptyTemplate = document.getElementById("emptyState");

function emptyNode() {
  return emptyTemplate.content.firstElementChild.cloneNode(true);
}

function formatDate(value) {
  if (!value) return "no snapshot";
  return new Date(value).toLocaleString();
}

function renderStats(data) {
  const repos = data.latestScan?.repos ?? data.scan?.repos ?? [];
  const patterns = data.patterns ?? [];
  const clusters = data.clusters ?? [];
  const suggestions = data.suggestions?.suggestions ?? [];

  const items = [
    ["Repos", repos.length],
    ["Patterns", patterns.length],
    ["Clusters", clusters.length],
    ["Suggestions", suggestions.length],
  ];

  statsEl.innerHTML = "";
  for (const [label, value] of items) {
    const card = document.createElement("div");
    card.className = "stat";
    card.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div>`;
    statsEl.appendChild(card);
  }
}

function renderSignals(data) {
  const profile = data.localProfile;
  signalBoardEl.innerHTML = "";

  if (!profile) {
    signalBoardEl.appendChild(emptyNode());
    return;
  }

  const cards = [
    {
      title: "Frameworks",
      body: profile.frameworks.length > 0 ? profile.frameworks.join(", ") : "No known frameworks detected",
    },
    {
      title: "Scripts",
      body: profile.scriptNames.length > 0 ? profile.scriptNames.join(", ") : "No scripts detected",
    },
    {
      title: "Conventions",
      body: profile.conventions.filter((item) => item.detected).map((item) => item.name).join(", ") || "No conventions detected",
    },
  ];

  for (const cardData of cards) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h3>${cardData.title}</h3><div class="mini-meta"><span>${cardData.body}</span></div>`;
    signalBoardEl.appendChild(card);
  }
}

function renderGaps(data) {
  const gaps = data.localProfile?.gaps ?? [];
  localGapsEl.innerHTML = "";

  if (gaps.length === 0) {
    const safe = document.createElement("div");
    safe.className = "gap-card";
    safe.innerHTML = `<h3>No major gaps detected</h3><p class="status">Current local conventions already cover the main portfolio baseline.</p>`;
    localGapsEl.appendChild(safe);
    return;
  }

  for (const gap of gaps) {
    const card = document.createElement("div");
    card.className = "gap-card";
    card.innerHTML = `
      <div class="panel-head">
        <h3>${gap.title}</h3>
        <span class="severity ${gap.severity}">${gap.severity}</span>
      </div>
      <p>${gap.rationale}</p>
    `;
    localGapsEl.appendChild(card);
  }
}

function renderClusters(data) {
  const clusters = data.clusters ?? [];
  clustersEl.innerHTML = "";

  if (clusters.length === 0) {
    clustersEl.appendChild(emptyNode());
    return;
  }

  for (const cluster of clusters) {
    const card = document.createElement("article");
    card.className = "cluster-card";
    const keywords = cluster.keywords.map((keyword) => `<span class="keyword">${keyword}</span>`).join("");
    card.innerHTML = `
      <h3>${cluster.label}</h3>
      <div class="mini-meta">
        <span>${cluster.size} patterns</span>
        <span>${cluster.sourceRepos.length} sources</span>
      </div>
      <div class="keywords">${keywords}</div>
    `;
    clustersEl.appendChild(card);
  }
}

function renderSuggestions(data) {
  const suggestions = data.suggestions?.suggestions ?? [];
  suggestionsEl.innerHTML = "";

  if (suggestions.length === 0) {
    suggestionsEl.appendChild(emptyNode());
    return;
  }

  for (const suggestion of suggestions) {
    const card = document.createElement("div");
    card.className = "suggestion-card";
    card.innerHTML = `
      <div class="panel-head">
        <h3>${suggestion.title}</h3>
        <span class="chip ${suggestion.scope === "micro" ? "muted" : "accent"}">${suggestion.scope}</span>
      </div>
      <p>${suggestion.rationale}</p>
      <div class="mini-meta">
        <span>Confidence ${(suggestion.confidence * 100).toFixed(0)}%</span>
        <span>${suggestion.sources.join(", ")}</span>
      </div>
      <p class="status">${suggestion.changeSummary}</p>
    `;
    suggestionsEl.appendChild(card);
  }
}

function renderPatch(data) {
  patchEl.textContent = data.patch ?? "";
}

function renderRepos(data) {
  const repos = data.latestScan?.repos ?? data.scan?.repos ?? [];
  reposEl.innerHTML = "";

  if (repos.length === 0) {
    reposEl.appendChild(emptyNode());
    return;
  }

  for (const repo of repos.slice(0, 8)) {
    const card = document.createElement("article");
    card.className = "repo-card";
    card.innerHTML = `
      <a href="${repo.htmlUrl}" target="_blank" rel="noreferrer">
        <h3>${repo.fullName}</h3>
      </a>
      <p>${repo.description || "No description provided."}</p>
      <div class="repo-meta">
        <span>Score ${repo.score}</span>
        <span>${repo.signals.stars} stars</span>
        <span>${repo.language || "Unknown language"}</span>
      </div>
    `;
    reposEl.appendChild(card);
  }
}

function sparkPath(values, width, height) {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function renderChart(element, values, tone) {
  if (!element) return;
  if (values.length === 0) {
    element.innerHTML = "";
    return;
  }

  const width = 320;
  const height = 100;
  const path = sparkPath(values, width, height);
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;

  element.innerHTML = `
    <defs>
      <linearGradient id="${tone}-gradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${tone}" stop-opacity="0.35"></stop>
        <stop offset="100%" stop-color="${tone}" stop-opacity="0.02"></stop>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#${tone}-gradient)"></path>
    <path d="${path}" fill="none" stroke="${tone}" stroke-width="4" stroke-linecap="round"></path>
  `;
}

function renderHistory(data) {
  const history = data.history ?? [];
  renderChart(coverageChartEl, history.map((point) => point.repoCount + point.patternCount + point.clusterCount), "#0f766e");
  renderChart(qualityChartEl, history.map((point) => point.suggestionCount + point.gapCount), "#b45309");
}

function renderAll(data) {
  generatedAtEl.textContent = formatDate(data.generatedAt || data.latestScan?.scannedAt);
  renderStats(data);
  renderSignals(data);
  renderHistory(data);
  renderGaps(data);
  renderClusters(data);
  renderSuggestions(data);
  renderPatch(data);
  renderRepos(data);
}

async function loadState() {
  const response = await fetch("/api/intel/state");
  const data = await response.json();
  renderAll(data);
}

async function refreshState() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Scanning...";

  const payload = {
    localPath: localPathInput.value || undefined,
    maxRepos: maxReposInput.value ? Number(maxReposInput.value) : undefined,
    queries: queriesInput.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };

  const response = await fetch("/api/intel/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  renderAll(data);

  refreshButton.disabled = false;
  refreshButton.textContent = "Run Fresh Scan";
}

refreshButton.addEventListener("click", () => {
  refreshState().catch((error) => {
    console.error(error);
    refreshButton.disabled = false;
    refreshButton.textContent = "Run Fresh Scan";
  });
});

stateButton.addEventListener("click", () => {
  loadState().catch(console.error);
});

loadState().catch(console.error);
