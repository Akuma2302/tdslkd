// Site settings.
// murabbiApi: the Google Apps Script web app URL (ends in /exec). Leave empty until it is deployed;
// the form then shows "belum disambungkan" and the dashboard shows only the imported months.
// Setup steps: backend/murabbi/README.md
// legalityApi: the Unit Legality Apps Script web app URL (ends in /exec), used by the user portal (index.html).
// Setup steps: backend/legality/README.md
window.YOSH_CONFIG = {
  murabbiApi: "",
  legalityApi: "https://script.google.com/macros/s/AKfycbw2jxiYTQ0bu0C1c9-EvOQh7BW8SgD5fP3tjFjxu-UcWeBCuykc3pZeu4e3F1S86UH3iw/exec"
};
