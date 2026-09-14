(() => {
  const $ = id => document.getElementById(id);
  const message = text => { const node = $("message"); if (node) node.textContent = text; };
  const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  $("exportJson")?.addEventListener("click", async () => {
    const stored = await chrome.storage.local.get({ applications: [] });
    const applications = Array.isArray(stored.applications) ? stored.applications : [];
    const payload = { app: "Job Application Tracker", version: 1, exportedAt: new Date().toISOString(), applications };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `job-applications-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message(`Backed up ${applications.length} application(s).`);
  });

  $("importJsonButton")?.addEventListener("click", () => $("importJsonFile")?.click());

  $("importJsonFile")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.applications;
      if (!Array.isArray(incoming)) throw new Error("No applications array found.");
      const valid = incoming.filter(item => item && typeof item === "object" && (item.title || item.company)).map(item => ({
        ...item,
        id: item.id || makeId(),
        status: ["Saved", "Applied", "Interview", "Offer", "Rejected"].includes(item.status) ? item.status : "Saved",
        createdAt: Number(item.createdAt || Date.now()),
        updatedAt: Number(item.updatedAt || Date.now()),
        history: Array.isArray(item.history) ? item.history : []
      }));
      if (!valid.length) throw new Error("No valid applications found.");

      const replace = confirm(`Import ${valid.length} application(s)?\n\nOK = replace current data\nCancel = merge`);
      if (replace) {
        await chrome.storage.local.set({ applications: valid });
      } else {
        const stored = await chrome.storage.local.get({ applications: [] });
        const current = Array.isArray(stored.applications) ? stored.applications : [];
        const ids = new Set(current.map(item => item.id));
        for (const item of valid) {
          if (ids.has(item.id)) item.id = makeId();
          current.push(item);
        }
        await chrome.storage.local.set({ applications: current });
      }
      message(`Imported ${valid.length} application(s). Reopen the popup to refresh.`);
    } catch (error) {
      message(`Import failed: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  });
})();
