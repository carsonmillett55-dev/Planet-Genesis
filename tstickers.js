/* Stickers: drawn in the studio, kept in My Stickers, stuck onto anything
   on any layer or the background, riding with it; their size, turn and flip;
   picked by their picture; saved with the level.  node tstickers.js */
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
  await p.evaluate(() => { localStorage.removeItem('pg_my_skins'); window.__pg.freezeCam(); window.__pg.setStick(true); window.__pg.setPaintMode('rect'); window.__pg.paused(true); });
  const cam = await p.evaluate(() => window.__pg.cam());
  const X = cam.x + 400, Y = cam.y + 300;
  const w2p = (x,y) => p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [x,y]);
  async function rect(mat, layer, x0, y0, x1, y1){
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); window.__pg.setPaintMode('rect'); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const st = (cmd, a, b2) => p.evaluate(([c, x, y]) => window.__pg.studio(c, x, y), [cmd, a, b2]);
  const stroke = async (x0, y0, x1, y1) => {
    const r = await st('canvasRect');
    await p.mouse.move(r.x + r.w * x0, r.y + r.h * y0); await p.mouse.down(); await p.mouse.move(r.x + r.w * x1, r.y + r.h * y1, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(60);
  };
  const gadgets = () => p.evaluate(() => window.__pg.gadgets());
  const stickers = () => gadgets().then(gs => gs.filter(g => g.kind === 'sticker'));
  const stats = () => p.evaluate(() => window.__pg.stats());

  console.log('== draw a sticker, and it is in My Stickers and in hand ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); });
  ok('Draw a new sticker opens the studio', await p.evaluate(() => window.__pg.stickerDraft()));
  await p.waitForTimeout(200);
  ok('on a square box, one drawing', (await st('where')).state === 'sticker' && Math.abs((await st('canvasRect')).w / (await st('canvasRect')).h - 1) < 0.05, await st('where'));
  await st('setColor', '#E8567A'); await stroke(0.2, 0.2, 0.8, 0.8); await stroke(0.8, 0.2, 0.2, 0.8);
  await st('close'); await p.waitForTimeout(200);
  ok('closing asks for a name', !(await p.evaluate(() => document.getElementById('nameOverlay').hidden)));
  await p.evaluate(() => { const i = document.getElementById('nameInput'); i.value = 'Cross'; document.getElementById('nameOk').click(); });
  await p.waitForTimeout(200);
  const mine = await p.evaluate(() => window.__pg.stickers());
  ok('and keeps it in My Stickers', mine.length === 1 && mine[0].name === 'Cross', mine);
  ok('with the sticker tool in hand', (await p.evaluate(() => window.__pg.tool())) === 'sticker', await p.evaluate(() => window.__pg.tool()));

  console.log('');
  console.log('== stuck onto an object it rides with it; on nothing it sits on the background ==');
  await rect('wood', 1, X-100, Y, X+100, Y+80);                 // a plank, free to move
  await p.evaluate(id => window.__pg.pickSticker(id), mine[0].id);
  const s1 = await w2p(X, Y+40);
  await p.mouse.click(s1.x, s1.y); await p.waitForTimeout(200);
  let sk = (await stickers())[0];
  const plank = () => stats().then(stt => stt.filter(o => o.pieces[0].indexOf('wood') === 0 && o.pos.y < 2300)[0]);
  ok('a click on the plank sticks one there', !!sk && sk.obj === (await plank()).id && sk.size === 120, sk && { obj: sk.obj, plank: (await plank()).id, size: sk.size });
  // move the plank: the sticker comes along
  await p.evaluate(() => window.__pg.setTool('move'));
  const pk = await plank();
  const d0 = await w2p(pk.pos.x - 85, pk.pos.y), d1 = await w2p(pk.pos.x + 115, pk.pos.y);   // grab the plank clear of the sticker's own picture (which spans ±60)
  await p.mouse.move(d0.x, d0.y); await p.mouse.down(); await p.mouse.move(d1.x, d1.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
  sk = (await stickers())[0];
  ok('moving the plank moves the sticker with it', Math.abs(sk.x - (X + 200)) < 8, { sticker: sk.x, wanted: X + 200 });
  // on nothing: stickers stick to material only
  await p.evaluate(id => window.__pg.pickSticker(id), mine[0].id);
  const s2 = await w2p(X-300, Y-200);
  await p.mouse.click(s2.x, s2.y); await p.waitForTimeout(200);
  ok('a click on nothing sticks nothing — stickers stick to material', (await stickers()).length === 1, (await stickers()).length);
  // a second one on a Back-layer wall, a different layer
  await rect('wood', 0, X-380, Y-300, X-200, Y-100);
  await p.evaluate(() => window.__pg.setLayer(1));
  await p.evaluate(id => window.__pg.pickSticker(id), mine[0].id);
  await p.mouse.click(s2.x, s2.y); await p.waitForTimeout(200);
  const bg = (await stickers()).filter(g => g.layer === 0)[0];
  ok('a click on a Back-layer wall sticks one there, on the Back layer', !!bg && Math.abs(bg.x - (X-300)) < 2, bg && { x: bg.x, layer: bg.layer });
  ok('it is picked by its picture, not a marker', (await p.evaluate(([x,y]) => window.__pg.stickerHitAt(x,y), [X-300+40, Y-200-40])) === bg.id);
  ok('and not outside it', (await p.evaluate(([x,y]) => window.__pg.stickerHitAt(x,y), [X-300+90, Y-200])) === null);

  console.log('');
  console.log('== size, turn and flip; saved with the level ==');
  await p.evaluate(id => window.__pg.gadgetSet(id, { size: 200, rot: Math.PI/4, flipX: true }), bg.id);
  ok('turned 45°, a point past its flat edge but inside its corner counts', (await p.evaluate(([x,y]) => window.__pg.stickerHitAt(x,y), [X-300+120, Y-200])) === bg.id);
  const sv = await p.evaluate(() => window.__pg.serialize('stickers'));
  const svS = sv.gadgets.filter(g => g.kind === 'sticker');
  ok('the level file carries both stickers, their drawing, size, turn and flip', svS.length === 2 && svS.every(g => g.skin && g.skin.states.sticker[0].length === 2 && g.o != null) && svS.some(g => g.size === 200 && Math.abs(g.rot - Math.PI/4) < 1e-6 && g.flipX === true), svS.map(g => ({ size: g.size, rot: g.rot, flipX: g.flipX, o: g.o })));
  await p.evaluate(d => window.__pg.load(d), sv); await p.waitForTimeout(300);
  const back = await stickers();
  ok('and they come back, each on its thing', back.length === 2 && back.every(g => g.obj) && back.some(g => g.size === 200 && g.flipX === true), back.map(g => ({ obj: g.obj, size: g.size })));
  ok('the sticker page lists what was drawn', (await p.evaluate(() => window.__pg.stickers())).length === 1);

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
