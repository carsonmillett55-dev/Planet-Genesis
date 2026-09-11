/* Gadgets: player sensor, button, lever, and the wires that carry their
   signal to a motor or wobble bolt.  node tgadget.js */
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
  const w2p = (x,y) => p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [x,y]);
  async function rect(mat, layer, x0, y0, x1, y1){
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const gads = () => p.evaluate(() => window.__pg.gadgets());
  const boltsNow = () => p.evaluate(() => window.__pg.bolts());
  const rel = (id) => p.evaluate(i => window.__pg.boltRel(i), id);
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const build = async () => { await p.evaluate(() => window.__pg.setMode('build')); await p.waitForTimeout(250); };
  const fresh = async () => {
    await build();
    await p.evaluate(() => { window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); });
    await p.waitForTimeout(150);
  };
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  /* A locked platform on Mid with a gadget of the given kind on its top. */
  const platformWith = async (tool, gx, gy) => {
    await fresh();
    await rect('wood', 1, X, Y, X+240, Y+40);
    await lockAll();
    await p.evaluate(t => { window.__pg.setLayer(1); window.__pg.setTool(t); }, tool);
    await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [gx == null ? X+120 : gx, gy == null ? Y+2 : gy]);
    return (await gads())[0];
  };

  console.log('');
  console.log('== placing ==');
  const s1 = await platformWith('sensor');
  ok('a sensor goes on the object under the cursor', !!s1 && s1.kind === 'sensor', s1);
  await p.evaluate(() => window.__pg.setTool('button'));
  const nNone = await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X+120, Y-200]);
  ok('but not on empty space', nNone === 1, nNone);

  console.log('');
  console.log('== a player sensor sees the player ==');
  const s2 = await platformWith('sensor');
  await p.evaluate(id => window.__pg.gadgetSet(id, { radius: 120 }), s2.id);
  await play();
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+120, Y-60]);
  await p.waitForTimeout(250);
  ok('close by, it is on', (await gads())[0].out === 1, (await gads())[0]);
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+120, Y-400]);
  await p.waitForTimeout(250);
  ok('far away, it is off', (await gads())[0].out === 0, (await gads())[0]);

  console.log('');
  console.log('== a button is pressed by standing on it ==');
  const bt = await platformWith('button');
  await play();
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+120, Y-30]);
  await p.waitForTimeout(500);
  ok('standing on it turns it on', (await gads())[0].out === 1, (await gads())[0]);
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+40, Y-30]);
  await p.waitForTimeout(400);
  ok('stepping off turns it off', (await gads())[0].out === 0, (await gads())[0]);
  await build();
  /* Coming back to Build restores the world from a snapshot, so ids change. */
  await p.evaluate(id => window.__pg.gadgetSet(id, { sticky: true }), (await gads())[0].id);
  await play();
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+120, Y-30]);
  await p.waitForTimeout(500);
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+40, Y-30]);
  await p.waitForTimeout(400);
  ok('a sticky button stays on after you leave', (await gads())[0].out === 1, (await gads())[0]);

  console.log('');
  console.log('== a lever is flipped with the interact key ==');
  const lv = await platformWith('lever');
  await play();
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+120, Y-30]);
  await p.waitForTimeout(300);
  await p.keyboard.press('KeyF'); await p.waitForTimeout(200);
  ok('F next to it flips it on', (await gads())[0].out === 1, (await gads())[0]);
  await p.keyboard.press('KeyF'); await p.waitForTimeout(200);
  ok('F again flips it off', (await gads())[0].out === 0, (await gads())[0]);
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+120, Y-300]);
  await p.waitForTimeout(200);
  await p.keyboard.press('KeyF'); await p.waitForTimeout(200);
  ok('F from far away does nothing', (await gads())[0].out === 0, (await gads())[0]);
  await build();
  await p.evaluate(id => window.__pg.gadgetSet(id, { springs: true }), (await gads())[0].id);
  await play();
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+120, Y-30]);
  await p.waitForTimeout(300);
  await p.keyboard.down('KeyF'); await p.waitForTimeout(200);
  const heldOn = (await gads())[0].out;
  await p.keyboard.up('KeyF'); await p.waitForTimeout(200);
  ok('a springy lever is on only while F is held', heldOn === 1 && (await gads())[0].out === 0, { heldOn, after: (await gads())[0].out });

  console.log('');
  console.log('== a wire drives a motor bolt ==');
  await fresh();
  await rect('wood', 0, X+300, Y-60, X+380, Y+160);        // Back post (static by nature)
  await rect('wood', 1, X-160, Y+200, X+80, Y+240);        // a platform for the sensor, well clear of the arm
  await lockAll();
  await rect('metal', 1, X+280, Y, X+480, Y+34);           // Mid arm across the post — free, short enough to miss the platform
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('motorbolt'); });
  await p.evaluate(([x,y]) => window.__pg.boltAt(x,y), [X+340, Y+17]);
  const mb = (await boltsNow())[0];
  await p.evaluate(id => window.__pg.boltSet(id, { speed: 0.08 }), mb.id);
  await p.evaluate(() => window.__pg.setTool('sensor'));
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-40, Y+202]);
  const sn = (await gads())[0];
  await p.evaluate(id => window.__pg.gadgetSet(id, { radius: 100 }), sn.id);
  ok('the wire is accepted', await p.evaluate(([f,t]) => window.__pg.wire(f,t), [sn.id, mb.id]));
  await play();
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X-600, Y+150]);   // far from the sensor, on the floor
  await p.waitForTimeout(300);
  const r0 = await rel(mb.id);
  await p.waitForTimeout(600);
  const r1 = await rel(mb.id);
  ok('with the sensor off, the motor holds still', Math.abs(r1 - r0) < 2, { r0, r1, input: await p.evaluate(i => window.__pg.boltInput(i), mb.id) });
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X-40, Y+150]);    // onto the sensor's platform
  await p.waitForTimeout(300);
  const r2 = await rel(mb.id);
  await p.waitForTimeout(600);
  const r3 = await rel(mb.id);
  ok('with the sensor on, the motor turns', Math.abs(r3 - r2) > 10, { r2, r3 });

  console.log('');
  console.log('== a wire makes a wobble bolt a flipper ==');
  await build();
  const mbw = (await boltsNow())[0];     // renumbered by the snapshot restore
  await p.evaluate(id => window.__pg.boltSet(id, { kind: 'wobble', angle: 60, period: 0.8 }), mbw.id);
  await play();
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X-600, Y+150]);
  await p.waitForTimeout(900);
  const f0 = await rel(mbw.id);
  ok('signal off: it rests at its start angle', Math.abs(f0) < 8, f0);
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X-40, Y+150]);
  await p.waitForTimeout(900);
  const f1 = await rel(mbw.id);
  ok('signal on: it swings out to its angle and stays', Math.abs(f1) > 40 && Math.abs(f1) < 75, f1);
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X-600, Y+150]);
  await p.waitForTimeout(900);
  const f2 = await rel(mbw.id);
  ok('signal off again: it swings back', Math.abs(f2) < 10, f2);

  console.log('');
  console.log('== it rides with its object ==');
  const rg = await platformWith('lever', X+30, Y+2);
  await p.evaluate(() => { window.__pg.paused(true); window.__pg.setTool('move'); const o = window.__pg.objects().filter(q => q.id === window.__pg.gadgets()[0].obj)[0]; window.__pg.select(o); });
  const g0 = (await gads())[0];
  await p.evaluate(() => window.__pg.rotate(Math.PI/2));
  await p.waitForTimeout(300);
  const g1 = (await gads())[0];
  ok('rotating the host moves the gadget with it', Math.hypot(g1.x - g0.x, g1.y - g0.y) > 40, { g0:[g0.x,g0.y], g1:[g1.x,g1.y] });
  await p.evaluate(() => window.__pg.flip());
  await p.waitForTimeout(300);
  ok('and it survives a rebuild', (await gads()).length === 1 && (await gads())[0].obj === g0.obj);

  console.log('');
  console.log('== the box, and wiring by clicking ==');
  await fresh();
  await rect('wood', 0, X+300, Y-60, X+380, Y+160);
  await rect('wood', 1, X-160, Y+200, X+80, Y+240);
  await lockAll();
  await rect('metal', 1, X+280, Y, X+480, Y+34);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('motorbolt'); });
  await p.evaluate(([x,y]) => window.__pg.boltAt(x,y), [X+340, Y+17]);
  const mb2 = (await boltsNow())[0];
  await p.evaluate(() => window.__pg.setTool('lever'));
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-40, Y+202]);
  const lv2 = (await gads())[0];
  await p.evaluate(() => window.__pg.setTool('move'));
  const gp = await w2p(lv2.x, lv2.y);
  await p.mouse.click(gp.x, gp.y, { button:'right' });
  await p.waitForTimeout(250);
  ok('right-click opens the box for the gadget', await p.evaluate(() => window.__pg.ctxOpen()));
  ok('titled by kind', /Lever/.test(await p.evaluate(() => document.querySelector('#opHead .t').textContent)));
  await p.evaluate(() => { Array.from(document.querySelectorAll('#opBody button')).find(x => /Connect to/.test(x.textContent)).click(); });
  await p.waitForTimeout(150);
  ok('Connect to… starts a wire', (await p.evaluate(() => window.__pg.wiring())) === lv2.id);
  const bp = await w2p(mb2.x, mb2.y);
  await p.mouse.click(bp.x, bp.y);
  await p.waitForTimeout(300);
  const ws = await p.evaluate(() => window.__pg.wires());
  ok('clicking the motor bolt finishes it', ws.length === 1 && ws[0].from === lv2.id && ws[0].to === mb2.id, ws);
  ok('and the box lists the wire', await p.evaluate(() => /Motor bolt/.test(document.getElementById('opBody').innerText)));

  console.log('');
  console.log('== it saves, loads, and undoes ==');
  const data = await p.evaluate(() => window.__pg.serialize('g'));
  ok('the save carries gadgets and wires', data.gadgets.length === 1 && data.gadgets[0].kind === 'lever' && data.wires.length === 1, { g: data.gadgets, w: data.wires });
  await p.evaluate(d => window.__pg.load(d), data);
  await p.waitForTimeout(300);
  const gl = await gads(), wl = await p.evaluate(() => window.__pg.wires());
  ok('and they come back wired up', gl.length === 1 && wl.length === 1 && wl[0].from === gl[0].id, { gl, wl });
  await p.evaluate(id => window.__pg.selectGadget(id), gl[0].id);
  await p.keyboard.press('Delete');
  await p.waitForTimeout(250);
  ok('Del removes the gadget and its wire', (await gads()).length === 0 && (await p.evaluate(() => window.__pg.wires())).length === 0);
  await p.evaluate(() => window.__pg.undo());
  await p.waitForTimeout(400);
  ok('undo brings both back', (await gads()).length === 1 && (await p.evaluate(() => window.__pg.wires())).length === 1);

  console.log('');
  console.log('== a gadget resizes and flips with its object ==');
  const rb = await platformWith('button', X+40, Y+2);
  await p.evaluate(() => { window.__pg.paused(true); window.__pg.setTool('move'); const o = window.__pg.objects().filter(q => q.id === window.__pg.gadgets()[0].obj)[0]; window.__pg.select(o); });
  const hostId = rb.obj;
  const hb0 = await p.evaluate(i => window.__pg.bounds(i), hostId);
  const gb0 = (await gads())[0];
  // Pull the bottom-right handle out to about 1.6x.
  const hf = await w2p(hb0.x2+5, hb0.y2+5);
  const ht = await w2p(hb0.x-5 + (hb0.x2-hb0.x+10)*1.6, hb0.y-5 + (hb0.y2-hb0.y+10)*1.6);
  await p.mouse.move(hf.x, hf.y); await p.mouse.down(); await p.mouse.move(ht.x, ht.y, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(400);
  const hb1 = await p.evaluate(i => window.__pg.bounds(i), hostId);
  const gb1 = (await gads())[0];
  const kx = (hb1.x2 - hb1.x) / (hb0.x2 - hb0.x);
  console.log('   host grew x' + kx.toFixed(2) + '; button width', gb0.size, '->', gb1.size, '; x', gb0.x, '->', gb1.x);
  ok('the host got bigger', kx > 1.3, kx);
  ok('the button grew with it', Math.abs(gb1.size / gb0.size - kx) < 0.15, { before: gb0.size, after: gb1.size, kx });
  ok('and stayed on the same spot of the object',
     Math.abs((gb1.x - hb1.x) / (hb1.x2 - hb1.x) - (gb0.x - hb0.x) / (hb0.x2 - hb0.x)) < 0.06,
     { before: (gb0.x - hb0.x) / (hb0.x2 - hb0.x), after: (gb1.x - hb1.x) / (hb1.x2 - hb1.x) });
  ok('and is still on top of it', Math.abs(gb1.y - hb1.y) < 12, { gy: gb1.y, top: hb1.y });
  await p.evaluate(() => window.__pg.flip());
  await p.waitForTimeout(300);
  const gb2 = (await gads())[0], hb2 = await p.evaluate(i => window.__pg.bounds(i), hostId);
  ok('flipping the host mirrors the gadget across it',
     Math.abs(((gb2.x - hb2.x) / (hb2.x2 - hb2.x)) - (1 - (gb1.x - hb1.x) / (hb1.x2 - hb1.x))) < 0.06,
     { before: (gb1.x - hb1.x) / (hb1.x2 - hb1.x), after: (gb2.x - hb2.x) / (hb2.x2 - hb2.x) });
  const sd = await p.evaluate(() => window.__pg.serialize('s'));
  ok('the size survives a save', Math.abs(sd.gadgets[0].size - gb2.size) < 0.01 && sd.gadgets[0].scale > 1.3, sd.gadgets[0]);

  console.log('');
  console.log('== gadgets work in Build when the world is running ==');
  const bl = await platformWith('lever');
  await p.evaluate(() => { window.__pg.paused(false); window.__pg.setFlying(false); });
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+120, Y-30]);
  await p.waitForTimeout(400);
  ok('the prompt knows there is a lever to use', (await p.evaluate(() => window.__pg.nearLever())) === (await gads())[0].id);
  await p.keyboard.press('KeyF'); await p.waitForTimeout(200);
  ok('F flips the lever in Build, unpaused', (await gads())[0].out === 1, (await gads())[0]);
  await p.evaluate(() => window.__pg.paused(true));
  await p.waitForTimeout(100);
  await p.keyboard.press('KeyF'); await p.waitForTimeout(200);
  ok('but not while paused', (await gads())[0].out === 1, (await gads())[0]);
  await p.evaluate(() => window.__pg.paused(false));

  console.log('');
  console.log('== paused, you walk instead of floating ==');
  await fresh();
  await rect('wood', 1, X, Y, X+300, Y+40);
  await rect('wood', 1, X+300, Y-120, X+340, Y+40);   // a wall at the right end
  await lockAll();
  await p.evaluate(() => { window.__pg.paused(true); window.__pg.setFlying(false); });
  await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [X+100, Y-200]);   // in the air over the platform
  await p.waitForTimeout(900);
  const pp0 = await p.evaluate(() => window.__pg.playerPos());
  ok('you fall to the ground rather than hang in the air', pp0.y > Y-80 && pp0.y < Y+5, { y: pp0.y, top: Y });
  const yBefore = pp0.y;
  await p.keyboard.down('KeyD'); await p.waitForTimeout(1200); await p.keyboard.up('KeyD');
  await p.waitForTimeout(100);
  const pp1 = await p.evaluate(() => window.__pg.playerPos());
  ok('you walk along it', pp1.x > pp0.x + 60, { from: pp0.x, to: pp1.x });
  ok('the wall stops you', pp1.x < X+300, { x: pp1.x, wall: X+300 });
  ok('and you stay on the ground while walking', Math.abs(pp1.y - yBefore) < 6, { before: yBefore, after: pp1.y });
  await p.keyboard.press('Space'); await p.waitForTimeout(250);
  const ppJ = await p.evaluate(() => window.__pg.playerPos());
  await p.waitForTimeout(900);
  const ppL = await p.evaluate(() => window.__pg.playerPos());
  ok('Space jumps', ppJ.y < yBefore - 20, { up: ppJ.y, ground: yBefore });
  ok('and you land again', Math.abs(ppL.y - yBefore) < 6, { landed: ppL.y, ground: yBefore });

  console.log('');
  console.log('== a gadget can be dragged to a new spot and keeps its wires ==');
  await fresh();
  await rect('wood', 0, X+300, Y-60, X+380, Y+160);
  await rect('wood', 1, X-160, Y+200, X+80, Y+240);
  await rect('wood', 1, X+120, Y+200, X+260, Y+240);      // a second platform
  await lockAll();
  await rect('metal', 1, X+280, Y, X+480, Y+34);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('motorbolt'); });
  await p.evaluate(([x,y]) => window.__pg.boltAt(x,y), [X+340, Y+17]);
  const mbm = (await boltsNow())[0];
  await p.evaluate(() => window.__pg.setTool('lever'));
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-100, Y+202]);
  const lvm = (await gads())[0];
  await p.evaluate(([f,t]) => window.__pg.wire(f,t), [lvm.id, mbm.id]);
  await p.evaluate(() => window.__pg.setTool('move'));
  const dragTo = async (fx, fy, tx, ty) => {
    const a = await w2p(fx, fy), c = await w2p(tx, ty);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(300);
  };
  await dragTo(lvm.x, lvm.y, X, Y+202);                 // along the same platform
  let gm = (await gads())[0];
  ok('dragging along its object moves it there', Math.abs(gm.x - X) < 8 && gm.obj === lvm.obj, { x: gm.x, want: X, obj: gm.obj });
  ok('and it is still wired to the motor', (await p.evaluate(() => window.__pg.wires())).length === 1);
  await dragTo(gm.x, gm.y, X+190, Y+202);               // onto the second platform
  gm = (await gads())[0];
  ok('dragging onto another object moves it onto that one', Math.abs(gm.x - (X+190)) < 8 && gm.obj !== lvm.obj, { x: gm.x, obj: gm.obj, was: lvm.obj });
  ok('wires survive the change of object too', (await p.evaluate(() => window.__pg.wires())).length === 1);
  await dragTo(gm.x, gm.y, X+190, Y-300);               // into thin air
  const gm2 = (await gads())[0];
  ok('dropping it on nothing puts it back where it was', Math.abs(gm2.x - gm.x) < 3 && Math.abs(gm2.y - gm.y) < 3 && gm2.obj === gm.obj, { from: [gm.x, gm.y], now: [gm2.x, gm2.y] });
  await p.evaluate(() => window.__pg.undo()); await p.waitForTimeout(350);
  ok('undo takes it back a step', Math.abs((await gads())[0].x - X) < 8, (await gads())[0].x);

  console.log('');
  console.log((fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join(String.fromCharCode(10)) : 'none');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
