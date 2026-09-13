# Job Application Tracker

A privacy-first Chrome extension for tracking job applications directly from the browser.

## Features

- Save the current job listing page with one click.
- Attempts to detect:
  - job title;
  - company;
  - location;
  - source website.
- Reads structured `JobPosting` JSON-LD when a job site provides it.
- Status pipeline:
  - Saved
  - Applied
  - Interview
  - Offer
  - Rejected
- Follow-up dates with local Chrome reminders.
- Notes for salary, recruiter details and interview information.
- Search applications by title, company, location, source or notes.
- Filter by application status.
- Open, edit or delete tracked applications.
- Automatic application-status history.
- CSV export.
- No account required.
- No external API.
- No backend.

## Privacy design

The extension does not request permanent access to every website.

When the user opens the extension, Chrome's `activeTab` and `scripting` permissions are used to inspect only the currently active page in order to suggest job title/company/location fields.

Tracked applications are stored only in `chrome.storage.local`.

The extension does not send:

- job applications;
- notes;
- browsing history;
- cookies;
- passwords;
- authentication tokens;
- recruiter information

to any external server.

## Follow-up reminders

If a follow-up date is today or earlier and the application is not marked **Offer** or **Rejected**, Chrome can show a reminder notification.

The reminder check runs periodically with a Manifest V3 alarm.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extension folder.
6. Open a job listing and click the extension.
7. Review the detected fields and click **Save Application**.

## Supported job sites

The tracker is designed to be site-independent. It can be used with LinkedIn, Indeed, Glassdoor, company career pages, Welcome to the Jungle and other normal HTTP/HTTPS job pages.

Automatic field detection depends on the structure of each website, so fields always remain editable.

## CSV export

The CSV export contains:

- job title;
- company;
- location;
- status;
- follow-up date;
- source;
- URL;
- notes;
- created and updated timestamps.

## Disclaimer

This project is not affiliated with LinkedIn, Indeed, Glassdoor or any job platform.
