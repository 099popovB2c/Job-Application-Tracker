const $ = id => document.getElementById(id);

let currentTab = null;
let currentUrl = "";
let editingId = null;

const STATUSES = ["Saved", "Applied", "Interview", "Offer", "Rejected"];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function dateTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}

async function getApps() {
  const stored = await chrome.storage.local.get({ applications: [] });
  return Array.isArray(stored.applications) ? stored.applications : [];
}

async function saveApps(applications) {
  await chrome.storage.local.set({ applications });
}

function setMessage(text) {
  $("message").textContent = text;
}

async function detectCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab || null;

  if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    currentUrl = "";
    $("currentUrl").textContent = "Open a normal job listing webpage first.";
    $("saveCurrent").disabled = true;
    return;
  }

  currentUrl = tab.url.split("#")[0];
  $("currentUrl").textContent = currentUrl;
  $("saveCurrent").disabled = false;

  let detected = null;

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobPage
    });
    detected = result?.[0]?.result || null;
  } catch {}

  const apps = await getApps();
  const existing = apps.find(app => app.url === currentUrl);

  if (existing) {
    editingId = existing.id;
    $("title").value = existing.title || "";
    $("company").value = existing.company || "";
    $("location").value = existing.location || "";
    $("status").value = existing.status || "Saved";
    $("followUpDate").value = existing.followUpDate || "";
    $("source").value = existing.source || hostLabel(currentUrl);
    $("notes").value = existing.notes || "";
    $("saveCurrent").textContent = "Update Application";
    $("captureHint").textContent = "This page is already tracked. Saving will update the existing entry.";
    return;
  }

  editingId = null;
  $("title").value = clean(detected?.title || tab.title || "");
  $("company").value = clean(detected?.company || "");
  $("location").value = clean(detected?.location || "");
  $("status").value = "Saved";
  $("followUpDate").value = "";
  $("source").value = hostLabel(currentUrl);
  $("notes").value = "";
  $("saveCurrent").textContent = "Save Application";
  $("captureHint").textContent = "Fields are editable before saving.";
}

function statusClass(status) {
  return `status-${String(status || "Saved").toLowerCase()}`;
}

function applicationCard(app) {
  const card = document.createElement("article");
  card.className = "application";

  const top = document.createElement("div");
  top.className = "application-top";

  const main = document.createElement("div");
  main.className = "application-main";

  const title = document.createElement("strong");
  title.textContent = app.title || "Untitled job";

  const company = document.createElement("div");
  company.className = "company";
  company.textContent = [app.company, app.location].filter(Boolean).join(" • ") || "No company/location";

  main.appendChild(title);
  main.appendChild(company);

  const status = document.createElement("select");
  status.className = `status-select ${statusClass(app.status)}`;
  for (const value of STATUSES) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === app.status;
    status.appendChild(option);
  }

  status.addEventListener("change", async () => {
    const apps = await getApps();
    const found = apps.find(item => item.id === app.id);
    if (!found) return;

    const previous = found.status;
    found.status = status.value;
    found.updatedAt = Date.now();

    if (status.value === "Applied" && !found.appliedAt) {
      found.appliedAt = Date.now();
    }

    found.history = Array.isArray(found.history) ? found.history : [];
    found.history.push({
      from: previous,
      to: status.value,
      at: Date.now()
    });

    await saveApps(apps);
    setMessage(`${found.company || found.title}: ${status.value}`);
    await render();
  });

  top.appendChild(main);
  top.appendChild(status);

  const meta = document.createElement("div");
  meta.className = "meta";

  const dates = [];
  if (app.followUpDate) dates.push(`Follow up: ${app.followUpDate}`);
  if (app.appliedAt) dates.push(`Applied: ${new Date(app.appliedAt).toLocaleDateString()}`);
  if (app.source) dates.push(app.source);

  meta.textContent = dates.join(" • ") || `Added: ${new Date(app.createdAt).toLocaleDateString()}`;

  if (app.notes) {
    const notes = document.createElement("div");
    notes.className = "notes";
    notes.textContent = app.notes;
    card.appendChild(top);
    card.appendChild(meta);
    card.appendChild(notes);
  } else {
    card.appendChild(top);
    card.appendChild(meta);
  }

  const actions = document.createElement("div");
  actions.className = "actions";

  const open = document.createElement("button");
  open.textContent = "Open";
  open.addEventListener("click", () => chrome.tabs.create({ url: app.url }));

  const edit = document.createElement("button");
  edit.textContent = "Edit";
  edit.addEventListener("click", () => {
    currentUrl = app.url;
    editingId = app.id;
    $("currentUrl").textContent = app.url;
    $("title").value = app.title || "";
    $("company").value = app.company || "";
    $("location").value = app.location || "";
    $("status").value = app.status || "Saved";
    $("followUpDate").value = app.followUpDate || "";
    $("source").value = app.source || "";
    $("notes").value = app.notes || "";
    $("saveCurrent").textContent = "Update Application";
    $("captureHint").textContent = "Editing saved application.";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const remove = document.createElement("button");
  remove.className = "danger";
  remove.textContent = "Delete";
  remove.addEventListener("click", async () => {
    const ok = confirm(`Delete "${app.title || "this application"}" from the tracker?`);
    if (!ok) return;

    const apps = (await getApps()).filter(item => item.id !== app.id);
    await saveApps(apps);
    setMessage("Application deleted.");
    await render();
  });

  actions.appendChild(open);
  actions.appendChild(edit);
  actions.appendChild(remove);
  card.appendChild(actions);

  return card;
}

async function render() {
  const apps = await getApps();

  $("countAll").textContent = String(apps.length);
  $("countApplied").textContent = String(apps.filter(a => a.status === "Applied").length);
  $("countInterview").textContent = String(apps.filter(a => a.status === "Interview").length);
  $("countOffer").textContent = String(apps.filter(a => a.status === "Offer").length);

  const query = clean($("search").value).toLowerCase();
  const filter = $("filterStatus").value;

  const visible = apps
    .filter(app => filter === "All" || app.status === filter)
    .filter(app => {
      if (!query) return true;
      return [
        app.title,
        app.company,
        app.location,
        app.source,
        app.notes
      ].some(value => String(value || "").toLowerCase().includes(query));
    })
    .sort((a, b) => Number(b.updatedAt || b.createdAt) - Number(a.updatedAt || a.createdAt));

  $("visibleCount").textContent = String(visible.length);
  $("applicationList").replaceChildren();

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = apps.length ? "No applications match this filter." : "No applications tracked yet.";
    $("applicationList").appendChild(empty);
    return;
  }

  for (const app of visible) {
    $("applicationList").appendChild(applicationCard(app));
  }
}

$("saveCurrent").addEventListener("click", async () => {
  if (!currentUrl) {
    setMessage("Open a job listing page first.");
    return;
  }

  const title = clean($("title").value);
  const company = clean($("company").value);

  if (!title && !company) {
    setMessage("Enter at least a job title or company.");
    return;
  }

  const apps = await getApps();
  const now = Date.now();

  let app = editingId
    ? apps.find(item => item.id === editingId)
    : apps.find(item => item.url === currentUrl);

  if (app) {
    const oldStatus = app.status;

    Object.assign(app, {
      url: currentUrl,
      title,
      company,
      location: clean($("location").value),
      status: $("status").value,
      followUpDate: $("followUpDate").value || "",
      source: clean($("source").value),
      notes: $("notes").value.trim(),
      updatedAt: now
    });

    if (app.status === "Applied" && !app.appliedAt) app.appliedAt = now;

    if (oldStatus !== app.status) {
      app.history = Array.isArray(app.history) ? app.history : [];
      app.history.push({ from: oldStatus, to: app.status, at: now });
    }

    setMessage("Application updated.");
  } else {
    app = {
      id: makeId(),
      url: currentUrl,
      title,
      company,
      location: clean($("location").value),
      status: $("status").value,
      followUpDate: $("followUpDate").value || "",
      source: clean($("source").value),
      notes: $("notes").value.trim(),
      createdAt: now,
      updatedAt: now,
      appliedAt: $("status").value === "Applied" ? now : null,
      history: []
    };

    apps.push(app);
    editingId = app.id;
    setMessage("Application saved.");
  }

  await saveApps(apps);
  $("saveCurrent").textContent = "Update Application";
  $("captureHint").textContent = "This application is now tracked.";
  await render();
});

$("search").addEventListener("input", () => render());
$("filterStatus").addEventListener("change", () => render());

$("exportCsv").addEventListener("click", async () => {
  const apps = await getApps();

  if (!apps.length) {
    setMessage("Nothing to export yet.");
    return;
  }

  const headers = [
    "Job Title",
    "Company",
    "Location",
    "Status",
    "Follow-up Date",
    "Source",
    "URL",
    "Notes",
    "Created",
    "Updated"
  ];

  const esc = value => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const rows = [
    headers.map(esc).join(","),
    ...apps.map(app => [
      app.title,
      app.company,
      app.location,
      app.status,
      app.followUpDate,
      app.source,
      app.url,
      app.notes,
      dateTime(app.createdAt),
      dateTime(app.updatedAt)
    ].map(esc).join(","))
  ];

  const blob = new Blob(["\uFEFF" + rows.join("\r\n")], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `job-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setMessage("CSV exported.");
});

(async () => {
  await detectCurrentPage();
  await render();
})();
