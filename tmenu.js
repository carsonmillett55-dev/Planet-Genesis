/* The personal menu: its sections, its pages, and the gradient that
   belongs to you.  node tmenu.js */
const { launch, previewURL } = require('./tenv');
let pass=0, fail=0;
const ok=(n,c,e)=>{ if(c){pass++;console.log('  ok  '+n);} else {fail++;console.log('  FAIL '+n+(e!==undefined?'  -> '+JSON.stringify(e):''));} };
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport:{width:1440,height:900} });
  const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
  p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await p.goto(previewURL);
  await p.waitForTimeout(1200);

  const open = async () => { await p.keyboard.press('KeyE'); await p.waitForTimeout(400); };
  const shown = () => p.evaluate(() => !document.getElementById('personalMenu').hidden);
  const sectionNames = () => p.evaluate(() => Array.from(document.querySelectorAll('#pmBags button')).map(b => b.innerText.replace(/\s+/g,' ').trim()));
  const pageNames = () => p.evaluate(() => Array.from(document.querySelectorAll('#pmPages button')).map(b => b.innerText.trim()));
  const clickSection = (name) => p.evaluate(n => {
    const b = Array.from(document.querySelectorAll('#pmBags button')).find(x => x.innerText.includes(n));
    if (b) b.click(); return !!b;
  }, name);
  const clickPage = (name) => p.evaluate(n => {
    const b = Array.from(document.querySelectorAll('#pmPages button')).find(x => x.innerText.includes(n));
    if (b) b.click(); return !!b;
  }, name);
  const grad = () => p.evaluate(() => {
    const el = document.getElementById('personalMenu');
    return { a: el.style.getPropertyValue('--pop-a').trim(), b: el.style.getPropertyValue('--pop-b').trim(),
             ang: el.style.getPropertyValue('--pop-ang').trim() };
  });

  console.log('\n== the menu sections ==');
  await open();
  ok('E opens the menu', await shown());
  const bags = await sectionNames();
  console.log('   ', JSON.stringify(bags));
  ok('Select comes first', /Select/i.test(bags[0]), bags[0]);
  for (const want of ['Build','Tools','World','Character']){
    ok('there is a ' + want + ' section', bags.some(b => b.includes(want)), bags);
  }

  console.log('\n== pages inside a section ==');
  await clickSection('Build'); await p.waitForTimeout(300);
  ok('Build holds Materials and My Objects',
     JSON.stringify(await pageNames()) === JSON.stringify(['Materials','My Objects']), await pageNames());
  ok('it opens on Materials', /Materials/.test(await p.evaluate(() => document.getElementById('pmBody').innerText)));
  await clickPage('My Objects'); await p.waitForTimeout(300);
  ok('switching page changes the body', !/painting on/.test(await p.evaluate(() => document.getElementById('pmBody').innerText)));
  // A bag with one page should not show a page row at all.
  await clickSection('World'); await p.waitForTimeout(300);
  ok('a one-page section hides the page row', await p.evaluate(() => document.getElementById('pmPages').hidden));

  console.log('\n== your menu gradient ==');
  await clickSection('Character'); await p.waitForTimeout(300);
  await clickPage('Menu Colour'); await p.waitForTimeout(300);
  const g0 = await grad();
  const swatches = await p.evaluate(() => document.querySelectorAll('.gradPresets button').length);
  ok('there are gradient presets to pick from', swatches >= 6, swatches);
  // Pick a preset that is not the one already applied.
  await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.gradPresets button'));
    (btns.find(b => !b.classList.contains('active')) || btns[1]).click();
  });
  await p.waitForTimeout(350);
  const g1 = await grad();
  ok('picking a preset recolours the menu', g1.a !== g0.a || g1.b !== g0.b, { g0, g1 });
  ok('the menu paints with that gradient', await p.evaluate(() => {
    const bg = getComputedStyle(document.getElementById('personalMenu')).backgroundImage;
    return /gradient/.test(bg);
  }));

  // The angle slider is the last range input on the page.
  await p.evaluate(() => {
    const r = Array.from(document.querySelectorAll('#pmBody input[type=range]')).pop();
    r.value = 40; r.dispatchEvent(new Event('input', { bubbles:true }));
  });
  await p.waitForTimeout(250);
  ok('the angle slider turns the gradient', (await grad()).ang === '40deg', (await grad()).ang);

  console.log('\n== it is yours, so it is remembered ==');
  const want = await grad();
  await p.reload();
  await p.waitForTimeout(1200);
  const after = await grad();
  ok('the gradient survives a reload', after.a === want.a && after.b === want.b && after.ang === want.ang, { want, after });

  console.log('\n== Select is a tool, not a page ==');
  await open();
  await p.evaluate(() => window.__pg.setTool('wood'));
  await clickSection('Select');
  await p.waitForTimeout(350);
  ok('picking it selects the move tool', (await p.evaluate(() => window.__pg.tool())) === 'move');
  ok('and closes the menu', !(await shown()));

  console.log('\n== play mode offers less ==');
  await p.evaluate(() => window.__pg.setMode('play'));
  await p.waitForTimeout(500);
  await open();
  const playBags = await sectionNames();
  ok('no build sections while playing', !playBags.some(b => /Build|World/.test(b)), playBags);
  ok('but your character is still there', playBags.some(b => /Character/.test(b)), playBags);

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join('\n') : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
