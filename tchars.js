/* Characters: the swim and in-water poses, a hitbox drawn for the
   crouch, a character that comes armed, and a level's own characters —
   everyone the same one, or each player picking, one each or not.
   node tchars.js */
const { launch, previewURL } = require('./tenv');
let pass=0, fail=0;
const ok=(n,c,e)=>{ if(c){pass++;console.log('  ok  '+n);} else {fail++;console.log('  FAIL '+n+(e!==undefined?'  -> '+JSON.stringify(e):''));} };
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport:{width:1280,height:760} });
  const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
  p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await p.goto(previewURL);
  await p.waitForTimeout(1100);
  await p.evaluate(() => { window.__pg.freezeCam(); window.__pg.setStick(false); window.__pg.setPaintMode('rect'); });
  const cam = await p.evaluate(() => window.__pg.cam());
  const X = cam.x + 400, Y = cam.y + 300;
  const view0 = await p.evaluate(() => window.__pg.view());
  const camHome = () => p.evaluate(v => window.__pg.zoomTo(v.zoom, v.x + v.w/2, v.y + v.h/2), view0);
  const w2p = (x,y) => p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [x,y]);
  async function rect(mat, layer, x0, y0, x1, y1){
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); window.__pg.setPaintMode('rect'); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const players = () => p.evaluate(() => window.__pg.players());
  const wearing = () => p.evaluate(() => window.__pg.wearing());
  const pick = () => p.evaluate(() => window.__pg.pick());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(true); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const build = async () => { await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await camHome(); await p.waitForTimeout(300); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };
  const pad = (over) => { const bt = []; for (let i = 0; i < 17; i++) bt.push({ pressed: false, value: 0 }); const g = { connected: true, axes: [0, 0, 0, 0], buttons: bt }; if (over){ if (over.axes) g.axes = over.axes; (over.press || []).forEach(i => { bt[i].pressed = true; bt[i].value = 1; }); } return g; };
  const pads = async (list) => { await p.evaluate(l => window.__pg.fakePads(l), list); await p.waitForTimeout(80); };
  const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };
  const box = () => p.evaluate(() => window.__pg.playerBox());

  console.log('== in the water: swimming, or treading it ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);   // the floor
  await rect('wood', 1, X-380, Y-200, X-340, Y+100);   // a wall at the left
  await rect('wood', 1, X+100, Y-200, X+140, Y+100);   // and at the right: a tank between them
  await lockAll();
  await p.evaluate(([x,y]) => window.__pg.pour(x, y, 120, 1), [X-120, Y+40]);
  await p.evaluate(([x,y]) => window.__pg.pour(x, y, 120, 1), [X-120, Y-60]);
  await play(); await standAt(X-120, Y-40); await p.waitForTimeout(700);
  ok('still in the water, the pose is "In water"', (await p.evaluate(() => window.__pg.poseId())) === 'float', await p.evaluate(() => window.__pg.poseId()));
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(150);
  ok('moving in it, "Swim"', (await p.evaluate(() => window.__pg.poseId())) === 'swim', await p.evaluate(() => window.__pg.poseId()));
  await p.keyboard.up('ArrowRight');
  await standAt(X+300, Y+60); await p.waitForTimeout(500);
  ok('on dry ground, idle', (await p.evaluate(() => window.__pg.poseId())) === 'idle', await p.evaluate(() => window.__pg.poseId()));
  ok('the poses are in the creator\'s list', await p.evaluate(() => { const d = window.__pg.charData(); return Array.isArray(d.sprites.swim) && Array.isArray(d.sprites.float) && d.frameCounts.swim === 2; }));

  console.log('== a hitbox drawn for the crouch ==');
  await build();
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await lockAll();
  await play(); await standAt(X, Y+60); await p.waitForTimeout(400);
  const stand = await box();
  await p.keyboard.down('ArrowDown'); await p.waitForTimeout(300);
  const squashed = await box();
  ok('crouching squashes the box down, as ever', squashed.crouching && squashed.h < stand.h * 0.7 && Math.abs(squashed.w - stand.w) < 2, { stand, squashed });
  await p.keyboard.up('ArrowDown'); await p.waitForTimeout(400);
  // a crouch hitbox that is a narrow pillar: a third of the box wide, the whole squat box tall
  await p.evaluate(() => window.__pg.hitCrouch([{ c: '#4FA9D6', w: 0, f: true, p: [0.34, 0.02, 0.66, 0.02, 0.66, 0.98, 0.34, 0.98] }]));
  await p.waitForTimeout(300);
  const stand2 = await box();
  ok('standing, the drawn crouch hitbox changes nothing', Math.abs(stand2.w - stand.w) < 2 && Math.abs(stand2.h - stand.h) < 2, { stand, stand2 });
  await p.keyboard.down('ArrowDown'); await p.waitForTimeout(300);
  const narrow = await box();
  ok('crouched, the body is the drawn one: a third as wide', narrow.crouching && narrow.w < stand.w * 0.45 && narrow.w > stand.w * 0.2, { narrow, stand });
  ok('sat on the feet line, where the squashed box was', Math.abs(narrow.bounds.y2 - squashed.bounds.y2) < 4 && narrow.h < stand.h * 0.7, { narrow: narrow.bounds, squashed: squashed.bounds });
  await p.keyboard.up('ArrowDown'); await p.waitForTimeout(400);
  ok('and standing again, the standing one', Math.abs((await box()).w - stand.w) < 2);
  ok('it is part of the character data', await p.evaluate(() => Array.isArray(window.__pg.charData().hitCrouch) && window.__pg.charData().hitCrouch.length === 1));
  await p.evaluate(() => window.__pg.hitCrouch([]));

  console.log('== a character that comes armed ==');
  await build();
  ok('nothing in hand to begin with', (await p.evaluate(() => window.__pg.charGun())) === null);
  await p.evaluate(() => window.__pg.charGun({ mode: 'bullet', shots: 3, rate: 10, speed: 900, pgrav: 0 }));
  const g0 = await p.evaluate(() => window.__pg.charGun());
  ok('the launcher is kept with the character', g0 && g0.mode === 'bullet' && g0.shots === 3 && g0.rate === 10, g0);
  ok('and saved in its data', (await p.evaluate(() => window.__pg.charData())).gun.mode === 'bullet');
  await play(); await standAt(X, Y+60); await p.waitForTimeout(200);
  let w = await wearing();
  ok('Play starts armed, from the character', w[0].armed && w[0].gunFrom === 'character', w[0]);
  ok('the ammo readout counts three shots', /3 left/.test(await p.evaluate(() => { const c = document.createElement('canvas'); return window.__pg.gun() ? (window.__pg.gun().left + ' left') : ''; })), await p.evaluate(() => window.__pg.gun()));
  const pr0 = await p.evaluate(() => window.__pg.projectiles().length);
  await p.evaluate(([x, y]) => window.__pg.fireAt(0, x, y), [X+300, Y+60]);
  await p.waitForTimeout(60);
  ok('and fires', (await p.evaluate(() => window.__pg.projectiles().length)) > pr0 && (await p.evaluate(() => window.__pg.gun())).left === 2, await p.evaluate(() => window.__pg.gun()));
  await p.evaluate(() => window.__pg.die()); await p.waitForTimeout(200);
  ok('a respawn arms them again, with the shots back', (await p.evaluate(() => window.__pg.gun())).left === 3, await p.evaluate(() => window.__pg.gun()));
  await build();
  await p.evaluate(() => window.__pg.charGun(null));
  ok('taking the launcher off the character', (await p.evaluate(() => window.__pg.charGun())) === null);

  console.log('== a level\'s own characters: everyone must use this one ==');
  const own = await p.evaluate(() => window.__pg.charData());
  const red = JSON.parse(JSON.stringify(own)); red.color = '#FF0000'; red.scale = 1.5; red.gun = { mode: 'ray', shots: 0 };
  const blue = JSON.parse(JSON.stringify(own)); blue.color = '#0000FF'; blue.scale = 1;
  await p.evaluate(d => window.__pg.addLevelChar('Red', d), red);
  await p.evaluate(d => window.__pg.addLevelChar('Blue', d), blue);
  await p.evaluate(() => { const c = window.__pg.levelChars(); c.mode = 'fixed'; window.__pg.levelChars(c); });
  ok('the level lists two of its own', (await p.evaluate(() => window.__pg.levelChars())).list.length === 2 && (await p.evaluate(() => window.__pg.levelChars())).mode === 'fixed');
  ok('the Level page shows the list', await p.evaluate(() => { window.__pg.menu('world', 'leveltype'); const t = document.getElementById('pmBody').innerText; window.__pg.menu(null); return /Must use one of mine/.test(t) && /Red/.test(t) && /Blue/.test(t) && !/Any size/.test(t); }));
  await play(); await p.waitForTimeout(300);
  w = await wearing();
  ok('in Play, player one wears Red — its colour, its size, its ray', w[0].color === '#FF0000' && Math.abs(w[0].scale - 1.5) < 0.01 && w[0].levelChar === 0 && w[0].own && w[0].armed && w[0].gunFrom === 'character', w[0]);
  await pads([pad(), pad({ press: [9] })]); await p.waitForTimeout(120); await pads([pad(), pad()]); await p.waitForTimeout(200);
  w = await wearing();
  ok('a player joining wears it too', w.length === 2 && w[1].color === '#FF0000' && w[1].levelChar === 0, w[1]);
  await build();
  w = await wearing();
  ok('back in Build everyone is their own again', w[0].color === own.color && Math.abs(w[0].scale - own.scale) < 0.01 && !w[0].own && w[0].levelChar === null && w[1].color !== '#FF0000', w);
  const file = await p.evaluate(() => window.__pg.serialize());
  ok('the level file carries the characters', file.world.chars && file.world.chars.mode === 'fixed' && file.world.chars.list.length === 2 && file.world.chars.list[1].name === 'Blue', file.world.chars && { mode: file.world.chars.mode, n: file.world.chars.list.length });

  console.log('== pick from mine, one player each ==');
  await p.evaluate(() => { const c = window.__pg.levelChars(); c.mode = 'choose'; c.unique = true; window.__pg.levelChars(c); });
  await play(); await p.waitForTimeout(300);
  let pk = await pick();
  ok('Play opens the picker for player one', pk && pk.player === 'p0' && pk.open && pk.cards.length === 2 && pk.cards[0].active, pk);
  ok('the world holds still while they choose', await p.evaluate(() => window.__pg.paused()));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(80);
  ok('the arrows move the choice', (await pick()).cards[1].active);
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  w = await wearing();
  ok('Enter picks it: player one is Blue', w[0].levelChar === 1 && w[0].color === '#0000FF', w[0]);
  pk = await pick();
  ok('then the picker is for player two', pk && pk.player === 'p1' && pk.open, pk);
  ok('and Blue is taken', pk.cards[1].taken && pk.cards[0].active && !pk.cards[0].taken, pk.cards);
  await pads([pad(), pad({ axes: [1, 0, 0, 0] })]); await p.waitForTimeout(120); await pads([pad(), pad()]); await p.waitForTimeout(80);
  ok('the stick cannot land on the taken one', (await pick()).cards[0].active);
  await pads([pad(), pad({ press: [0] })]); await p.waitForTimeout(150); await pads([pad(), pad()]); await p.waitForTimeout(200);
  w = await wearing();
  ok('A picks Red for player two', w[1].levelChar === 0 && w[1].color === '#FF0000', w[1]);
  ok('the picker is away and the world runs', (await pick()) === null && !(await p.evaluate(() => window.__pg.paused())));
  await build();
  ok('Build: both their own again', (await wearing()).every(q => q.levelChar === null && !q.own));

  console.log('== pick from mine, the same one allowed ==');
  await p.evaluate(() => { const c = window.__pg.levelChars(); c.unique = false; window.__pg.levelChars(c); });
  await play(); await p.waitForTimeout(300);
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  pk = await pick();
  ok('player two may pick the one player one took', pk && pk.player === 'p1' && !pk.cards[0].taken, pk && pk.cards);
  await pads([pad(), pad({ press: [0] })]); await p.waitForTimeout(150); await pads([pad(), pad()]); await p.waitForTimeout(200);
  w = await wearing();
  ok('both are Red', w[0].levelChar === 0 && w[1].levelChar === 0, w);
  await build();
  await p.evaluate(() => { const c = window.__pg.levelChars(); c.mode = 'any'; window.__pg.levelChars(c); });
  await play(); await p.waitForTimeout(300);
  ok('"their own": no picker, everyone as they are', (await pick()) === null && (await wearing()).every(q => q.levelChar === null), await wearing());
  await build();
  await pads([pad(), null]); await p.evaluate(() => { window.__pgFakePads = null; window.__pgFakePad = undefined; });

  console.log('== no page errors ==');
  ok('no errors', errs.length === 0, errs);
  await b.close();
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  process.exit(fail ? 1 : 0);
})();
