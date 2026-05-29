# Email to Google OAuth Verification — Confirming narrower scopes

Use after updating the OAuth consent screen to `drive.file` and deploying the app changes.

**Subject:** Re: [your ticket subject] — Confirming narrower scopes for Profitloop

---

Hello Google OAuth Verification Team,

Thank you for your guidance regarding our requested Drive scope.

We are **confirming that we will use the narrower scope** `https://www.googleapis.com/auth/drive.file` instead of `https://www.googleapis.com/auth/drive.readonly`.

**Application:** Profitloop / Synckerja (HR & production workflow)  
**Use of Google Drive:** Users paste a Google Drive file or folder URL into a production content plan. We do **not** need access to the user's entire Drive.

**How `drive.file` is used:**

- Users connect Google via OAuth only when they want enhanced in-app preview (e.g. folder carousel, authenticated thumbnails, or streaming a file they own or were granted access to).
- When Drive API access is required for a specific file or folder, the user grants access through the **Google Picker API** for that resource only.
- We do **not** browse or index Drive files the user has not explicitly selected.

**What does not require Drive API scope:**

- Saving the pasted Drive URL to our database.
- Notifications and task workflows that only store/open the URL.
- Public preview via Google's embed/iframe when the file is shared as "Anyone with the link" or when the user has not connected Google.

**User responsibility at save time:** Before saving a link, our users are instructed to set the file or folder sharing in Google Drive to **"Anyone with the link (viewer)"** or to grant **reviewer access** to the appropriate accounts. We do not use OAuth at save time to read the whole Drive.

We have updated our OAuth consent screen to request only `drive.file`, enabled the Google Picker API, and removed `drive.readonly` from our production configuration.

Please let us know if you need a short screen recording, an updated privacy policy section, or test credentials.

Best regards,  
[Your name]  
[Role]  
Profitloop / Synckerja  
[Contact email]
