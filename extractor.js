function extractJobPage() {
  const result = {
    url: location.href,
    title: "",
    company: "",
    location: ""
  };

  const clean = value => String(value || "").replace(/\s+/g, " ").trim();

  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')];
  for (const script of jsonLd) {
    try {
      const parsed = JSON.parse(script.textContent || "null");
      const nodes = Array.isArray(parsed)
        ? parsed
        : parsed?.["@graph"]
          ? parsed["@graph"]
          : [parsed];

      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const type = node["@type"];
        const types = Array.isArray(type) ? type : [type];

        if (!types.includes("JobPosting")) continue;

        result.title = clean(node.title) || result.title;

        if (typeof node.hiringOrganization === "string") {
          result.company = clean(node.hiringOrganization);
        } else {
          result.company =
            clean(node.hiringOrganization?.name) ||
            clean(node.hiringOrganization?.legalName) ||
            result.company;
        }

        const loc = node.jobLocation;
        const firstLoc = Array.isArray(loc) ? loc[0] : loc;
        const addr = firstLoc?.address || firstLoc;

        result.location = [
          addr?.addressLocality,
          addr?.addressRegion,
          addr?.addressCountry
        ].filter(Boolean).map(clean).join(", ") || result.location;

        break;
      }
    } catch {}
  }

  if (!result.title) {
    const h1 = document.querySelector("h1");
    result.title =
      clean(h1?.innerText) ||
      clean(document.querySelector('meta[property="og:title"]')?.content) ||
      clean(document.title);
  }

  if (!result.company) {
    const candidates = [
      '[data-testid*="company"]',
      '[class*="company"]',
      '[class*="employer"]',
      'a[href*="/company/"]'
    ];

    for (const selector of candidates) {
      const node = document.querySelector(selector);
      const text = clean(node?.innerText || node?.textContent);
      if (text && text.length <= 120) {
        result.company = text;
        break;
      }
    }
  }

  if (!result.location) {
    const candidates = [
      '[data-testid*="location"]',
      '[class*="location"]',
      '[class*="job-location"]'
    ];

    for (const selector of candidates) {
      const node = document.querySelector(selector);
      const text = clean(node?.innerText || node?.textContent);
      if (text && text.length <= 120) {
        result.location = text;
        break;
      }
    }
  }

  return result;
}
