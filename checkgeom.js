/* geom.js exists twice: as a standalone file, and inlined verbatim inside
   planet-genesis.html (the editor must not depend on a CDN for its own
   boolean operations). Nothing enforces that they agree — this does.

     node checkgeom.js

   Exits 0 when they match, 1 when they have drifted, and prints the first
   few differing lines so you can see which copy is stale. Run it after any
   edit to the geometry core. */
const fs = require('fs');
const path = require('path');

const here = __dirname;
const g = fs.readFileSync(path.join(here, 'geom.js'), 'utf8').trim();
const h = fs.readFileSync(path.join(here, 'planet-genesis.html'), 'utf8');

const lines = g.split('\n');
const first = lines[0];
const last = lines.filter(l => l.trim()).pop();
const i = h.indexOf(first);
const j = h.indexOf(last);

if (i < 0 || j < 0) {
  console.error('FAIL: could not find the inlined geometry core in planet-genesis.html.');
  console.error('      Looked for the first line of geom.js:\n      ' + JSON.stringify(first));
  process.exit(1);
}

const inlined = h.slice(i, j + last.length).trim();
if (inlined === g) {
  console.log('ok  geom.js matches the copy inlined in planet-genesis.html (' + lines.length + ' lines)');
  process.exit(0);
}

console.error('FAIL: geom.js and the inlined copy have drifted.');
const a = g.split('\n'), b = inlined.split('\n');
let shown = 0, diffs = 0;
for (let k = 0; k < Math.max(a.length, b.length); k++) {
  if (a[k] === b[k]) continue;
  diffs++;
  if (shown++ < 5) {
    console.error('  line ' + (k + 1));
    console.error('    geom.js : ' + JSON.stringify(a[k] === undefined ? '' : a[k]));
    console.error('    inlined : ' + JSON.stringify(b[k] === undefined ? '' : b[k]));
  }
}
console.error('  ' + diffs + ' differing line(s). Whichever you edited, copy it over the other.');
process.exit(1);
