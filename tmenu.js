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
  ok('Build holds Materials, My Objects, My Creatures, My Projectiles, My Particles and Stickers',
     JSON.stringify(await pageNames()) === JSON.stringify(['Materials','My Objects','My Creatures','My Projectiles','My Particles','Stickers']), await pageNames());
  ok('it opens on Materials', /Materials/.test(await p.evaluate(() => document.getElementById('pmBody').innerText)));
  await clickPage('My Objects'); await p.waitForTimeout(300);
  ok('switching page changes the body', !/painting on/.test(await p.evaluate(() => document.getElementById('pmBody').innerText)));
  // World has its settings and the Background page.
  await clickSection('World'); await p.waitForTimeout(300);
  ok('World holds World Settings, Background and Music', JSON.stringify(await pageNames()) === JSON.stringify(['World Settings','Background','Music']) && !(await p.evaluate(() => document.getElementById('pmPages').hidden)), await pageNames());

  console.log('\n== the Tools bag: editing tools apart from the connectors, logic and gameplay ==');
  await clickSection('Tools'); await p.waitForTimeout(300);
  ok('Tools holds Editing, Connectors, Logic and Gameplay',
     JSON.stringify(await pageNames()) === JSON.stringify(['Editing','Connectors','Logic','Gameplay']), await pageNames());
  const chipsOn = () => p.evaluate(() => Array.from(document.querySelectorAll('#pmBody .chip label')).map(l => l.textContent));
  ok('Editing holds Move & Select, Erase, Vacuum and Glue, and nothing else', JSON.stringify(await chipsOn()) === JSON.stringify(['Move & Select','Erase','Vacuum','Glue']), await chipsOn());
  ok('and shows their number keys', JSON.stringify(await p.evaluate(() => Array.from(document.querySelectorAll('#pmBody .chip .keyTag')).map(k => k.textContent))) === JSON.stringify(['1','2','3']));
  await clickPage('Connectors'); await p.waitForTimeout(250);
  ok('Connectors holds the bolts, the piston and the rope', (await chipsOn()).includes('Bolt') && (await chipsOn()).includes('Piston') && (await chipsOn()).includes('Rope') && !(await chipsOn()).includes('Erase'), await chipsOn());
  ok('and none of them wears a number', (await p.evaluate(() => document.querySelectorAll('#pmBody .chip .keyTag').length)) === 0);
  await clickPage('Logic'); await p.waitForTimeout(250);
  ok('Logic holds the sensors, switches and the world changer', (await chipsOn()).includes('Player sensor') && (await chipsOn()).includes('Lever') && (await chipsOn()).includes('World changer'), await chipsOn());
  await clickPage('Gameplay'); await p.waitForTimeout(250);
  ok('Gameplay holds the camera, mover, creature and the level pieces', (await chipsOn()).includes('Camera') && (await chipsOn()).includes('Mover') && (await chipsOn()).includes('Checkpoint') && (await chipsOn()).includes('Goal'), await chipsOn());
  await clickSection('Build'); await p.waitForTimeout(250);
  ok('the Materials page is materials only now', !(await chipsOn()).includes('Erase') && !(await chipsOn()).includes('Vacuum'), await chipsOn());
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // the number row
  const tool = () => p.evaluate(() => window.__pg.tool());
  await p.keyboard.press('2'); await p.waitForTimeout(80);
  ok('2 is Erase', (await tool()) === 'erase', await tool());
  await p.keyboard.press('3'); await p.waitForTimeout(80);
  ok('3 is Vacuum', (await tool()) === 'vacuum', await tool());
  await p.keyboard.press('4'); await p.waitForTimeout(80);
  ok('4 does nothing — only the editing tools have numbers', (await tool()) === 'vacuum', await tool());
  await p.keyboard.press('1'); await p.waitForTimeout(80);
  ok('1 is Move & Select', (await tool()) === 'move', await tool());

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
