const REMINDER_ALARM = "JAT_FOLLOWUP_CHECK";

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function getApplications() {
  const stored = await chrome.storage.local.get({ applications: [] });
  return Array.isArray(stored.applications) ? stored.applications : [];
}

async function checkFollowUps() {
  const apps = await getApplications();
  const today = todayKey();
  const stored = await chrome.storage.local.get({ reminderSent: {} });
  const reminderSent = { ...(stored.reminderSent || {}) };

  for (const app of apps) {
    if (!app.followUpDate || app.followUpDate > today) continue;
    if (["Offer", "Rejected"].includes(app.status)) continue;

    const reminderKey = `${app.id}:${today}`;
    if (reminderSent[reminderKey]) continue;

    await chrome.notifications.create(`jat-${app.id}`, {
      type: "basic",
      iconUrl: "icon128.png",
      title: `Follow up: ${app.company || "Job application"}`,
      message: `${app.title || "Job"} — status: ${app.status || "Saved"}`,
      priority: 1
    });

    reminderSent[reminderKey] = Date.now();
  }

  // Keep only the last 45 days of reminder keys.
  const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(reminderSent)) {
    if (Number(ts) < cutoff) delete reminderSent[key];
  }

  await chrome.storage.local.set({ reminderSent });
}

async function ensureAlarm() {
  const existing = await chrome.alarms.get(REMINDER_ALARM);
  if (!existing) {
    await chrome.alarms.create(REMINDER_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: 60
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm().catch(() => {});
  checkFollowUps().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm().catch(() => {});
  checkFollowUps().catch(() => {});
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === REMINDER_ALARM) {
    checkFollowUps().catch(() => {});
  }
});

chrome.notifications.onClicked.addListener(notificationId => {
  if (!notificationId.startsWith("jat-")) return;

  const id = notificationId.slice(4);
  getApplications().then(apps => {
    const app = apps.find(item => String(item.id) === id);
    if (app?.url) chrome.tabs.create({ url: app.url });
  });
});

ensureAlarm().catch(() => {});
