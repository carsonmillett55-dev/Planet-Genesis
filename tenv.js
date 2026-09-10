/* Where the browser is, and where preview.html is.

   The six suites used to each hardcode
   /opt/pw-browsers/chromium-1194/chrome-linux/chrome, which is the
   right answer on exactly one machine. This resolves whatever the
   current one actually has, so the same checks run on Linux and
   Windows without six edits every time the box changes.

   Set PG_CHROME to override. playwright-core rather than playwright
   on purpose: it drives a browser you already have instead of
   downloading a 130MB private copy. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const CANDIDATES = [
  process.env.PG_CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

function chromePath(){
  for (const c of CANDIDATES){
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error(
    'No Chrome or Chromium found. Set PG_CHROME to its full path.\nTried:\n  ' +
    CANDIDATES.filter(Boolean).join('\n  ')
  );
}

/* --no-sandbox is needed for root/CI Linux and is harmless elsewhere. */
async function launch(){
  return chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
}

/* pathToFileURL, not 'file://' + __dirname: on Windows __dirname is
   C:\Users\... and string-concatenating that yields a malformed URL. */
const previewURL = pathToFileURL(path.join(__dirname, 'preview.html')).href;

module.exports = { launch, previewURL, chromePath };
