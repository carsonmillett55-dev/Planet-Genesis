/* The popit: LBP2's bag structure, and the gradient that belongs to you.
   node tpop.js */
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
  const bagNames = () => p.evaluate(() => Array.from(document.querySelectorAll('#pmBags button')).map(b => b.innerText.replace(/\s+/g,' ').trim()));
  const pageNames = () => p.evaluate(() => Array.from(document.querySelectorAll('#pmPages button')).map(b => b.innerText.trim()));
  const clickBag = (name) => p.evaluate(n => {
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

  console.log('\n== LBP2 bags ==');
  await open();
  ok('E opens the popit', await shown());
  const bags = await bagNames();
  console.log('   ', JSON.stringify(bags));
  ok('the popit cursor comes first', /Popit/i.test(bags[0]), bags[0]);
  for (const want of ['Goodies','Tools','Global','Costume']){
    ok('there is a ' + want + ' bag', bags.some(b => b.includes(want)), bags);
  }

  console.log('\n== pages inside a bag ==');
  await clickBag('Goodies'); await p.waitForTimeout(300);
  ok('Goodies holds Materials and My Objects',
     JSON.stringify(await pageNames()) === JSON.stringify(['Materials','My Objects']), await pageNames());
  ok('it opens on Materials', /Materials/.test(await p.evaluate(() => document.getElementById('pmBody').innerText)));
  await clickPage('My Objects'); await p.waitForTimeout(300);
  ok('switching page changes the body', !/painting on/.test(await p.evaluate(() => document.getElementById('pmBody').innerText)));
  // A bag with one page should not show a page row at all.
  await clickBag('Global'); await p.waitForTimeout(300);
  ok('a one-page bag hides the page row', await p.evaluate(() => document.getElementById('pmPages').hidden));

  console.log('\n== your popit gradient ==');
  await clickBag('Costume'); await p.waitForTimeout(300);
  await clickPage('Your Popit'); await p.waitForTimeout(300);
  const g0 = await grad();
  const swatches = await p.evaluate(() => document.querySelectorAll('.popitPresets button').length);
  ok('there are gradient presets to pick from', swatches >= 6, swatches);
  // Pick a preset that is not the one already applied.
  await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.popitPresets button'));
    (btns.find(b => !b.classList.contains('active')) || btns[1]).click();
  });
  await p.waitForTimeout(350);
  const g1 = await grad();
  ok('picking a preset recolours the popit', g1.a !== g0.a || g1.b !== g0.b, { g0, g1 });
  ok('the popit paints with that gradient', await p.evaluate(() => {
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

  console.log('\n== the cursor bag is a tool, not a page ==');
  await open();
  await p.evaluate(() => window.__pg.setTool('wood'));
  await clickBag('Popit');
  await p.waitForTimeout(350);
  ok('picking it selects the move tool', (await p.evaluate(() => window.__pg.tool())) === 'move');
  ok('and closes the popit', !(await shown()));

  console.log('\n== play mode offers less ==');
  await p.evaluate(() => window.__pg.setMode('play'));
  await p.waitForTimeout(500);
  await open();
  const playBags = await bagNames();
  ok('no build bags while playing', !playBags.some(b => /Goodies|Global/.test(b)), playBags);
  ok('but your popit is still yours', playBags.some(b => /Costume/.test(b)), playBags);

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join('\n') : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
