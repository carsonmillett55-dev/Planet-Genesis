/* The camera and the level's player settings: Play's own zoom, zooming on
   the cursor in Build, Camera gadgets, walking and sprinting pace, grab
   reach.  node tcam.js */
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
    await p.evaluate(([m,l]) => { window.__pg.setLayer(l); window.__pg.setTool(m); window.__pg.deselect(); }, [mat, layer]);
    const a = await w2p(x0,y0), c = await w2p(x1,y1);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up();
    await p.waitForTimeout(150);
    await p.evaluate(() => window.__pg.deselect());
  }
  const pos = () => p.evaluate(() => window.__pg.playerPos());
  const view = () => p.evaluate(() => window.__pg.view());
  const lockAll = () => p.evaluate(() => { window.__pg.objects().forEach(o => { if (!o.body.isStatic){ window.__pg.select(o); window.__pg.anchor(); } }); window.__pg.deselect(); });
  const fresh = async () => {
    await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.setPaintMode('rect'); window.__pg.deselect(); window.__pg.setFlying(false); });
    await camHome();
    await p.waitForTimeout(200);
  };
  const play = async () => { await p.evaluate(() => { window.__pg.paused(false); window.__pg.setMode('play'); }); await p.waitForTimeout(400); };
  const build = async () => { await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); }); await camHome(); await p.waitForTimeout(300); };
  const standAt = async (x, y) => { await p.evaluate(([x,y]) => window.__pg.playerTo(x,y), [x,y]); await p.waitForTimeout(350); };
  const centre = async () => { const v = await view(); return { x: v.x + v.w/2, y: v.y + v.h/2 }; };

  console.log('');
  console.log('== Play has its own zoom, set in Build ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await lockAll();
  const z0 = (await view()).zoom;
  ok('the editor starts at its own zoom', Math.abs(z0 - 1) < 0.01, z0);
  await p.evaluate(() => window.__pg.worldSet('playZoom', 0.6));
  await play();
  ok('entering Play takes the level\'s zoom', Math.abs((await view()).zoom - 0.6) < 0.01, (await view()).zoom);
  const ws = await p.evaluate(() => window.__pg.worldSize());
  // mid-map, where the edges do not clamp the view. Play cannot be paused, so
  // the character is falling: read the view and the character in one go, and
  // allow a physics step of lag between the two
  await p.evaluate(([x,y]) => { window.__pg.playerTo(x, y); }, [ws.w/2, ws.h/2]); await p.waitForTimeout(200);
  const both = () => p.evaluate(() => { const v = window.__pg.view(), q = window.__pg.playerPos(); return { cx: v.x + v.w/2, cy: v.y + v.h/2, px: q.x, py: q.y }; });
  const bb = await both();
  ok('and looks at the character — a little above them, 70px by default', Math.abs(bb.cx - bb.px) < 2 && Math.abs(bb.cy - (bb.py - 70)) < 20, bb);
  await p.evaluate(() => window.__pg.worldSet('camHeight', 0)); await p.waitForTimeout(120);
  const b0 = await both();
  ok('camera height at 0 centres it on them', Math.abs(b0.cy - b0.py) < 20, b0);
  await p.evaluate(() => window.__pg.worldSet('camHeight', -200)); await p.waitForTimeout(120);
  const b1 = await both();
  ok('and at 200 above, it looks 200px over their head', Math.abs(b1.cy - (b1.py - 200)) < 20, b1);
  await p.evaluate(() => window.__pg.worldSet('camHeight', -70));
  const mid = await w2p(bb.px, bb.py);
  await p.mouse.move(mid.x, mid.y); await p.mouse.wheel(0, -300); await p.waitForTimeout(150);
  ok('the wheel does nothing in Play', Math.abs((await view()).zoom - 0.6) < 0.01, (await view()).zoom);
  await build();
  ok('back in Build the editor zoom is back', Math.abs((await view()).zoom - z0) < 0.01, (await view()).zoom);
  const sv = await p.evaluate(() => window.__pg.serialize('cam'));
  ok('the save carries it', Math.abs(sv.world.playZoom - 0.6) < 1e-6, sv.world);

  console.log('');
  console.log('== the wheel zooms on the cursor, not the character ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.paused(false); });
  await p.evaluate(() => { window.__pg.setMode('build'); });
  // the camera is on the character to begin with
  const homeBtn = await p.evaluate(() => { const h = document.getElementById('camHome'); if (h) h.click(); return !!h; });
  await p.waitForTimeout(200);
  ok('the camera follows the character to begin with', await p.evaluate(() => window.__pg.camFollowing()));
  const pt = await w2p(X+250, Y-100);                       // a spot well away from the character
  await p.mouse.move(pt.x, pt.y);
  const under0 = await p.evaluate(([x,y]) => window.__pg.s2wPage(x,y), [pt.x, pt.y]);
  await p.mouse.wheel(0, -100); await p.waitForTimeout(80); await p.mouse.wheel(0, -100); await p.waitForTimeout(80); await p.mouse.wheel(0, -100); await p.waitForTimeout(200);
  const under1 = await p.evaluate(([x,y]) => window.__pg.s2wPage(x,y), [pt.x, pt.y]);
  console.log('   under the cursor before', Math.round(under0.x), Math.round(under0.y), ' after', Math.round(under1.x), Math.round(under1.y), ' zoom', (await view()).zoom.toFixed(2));
  ok('zoomed in', (await view()).zoom > 1.2, (await view()).zoom);
  ok('what was under the cursor is still under the cursor', Math.abs(under1.x - under0.x) < 3 && Math.abs(under1.y - under0.y) < 3, { before: under0, after: under1 });
  ok('and the camera has let go of the character', !(await p.evaluate(() => window.__pg.camFollowing())));
  await p.evaluate(() => { const h = document.getElementById('camHome'); if (h) h.click(); });
  await p.waitForTimeout(200);
  ok('the home button brings it back', await p.evaluate(() => window.__pg.camFollowing()));

  console.log('');
  console.log('== a Camera takes over inside its zone ==');
  // built in the middle of the map, where the edges cannot clamp the view
  const wsz = await p.evaluate(() => window.__pg.worldSize());
  const camMid = () => p.evaluate(([x,y]) => window.__pg.zoomTo(1, x, y), [wsz.w/2, wsz.h/2]);
  await fresh(); await camMid(); await p.waitForTimeout(150);
  const mv = await view();
  const MX = mv.x + 400, MY = mv.y + 300;
  const theCamera = () => p.evaluate(() => window.__pg.gadgets()).then(gs => gs.filter(g => g.kind === 'camera')[0]);
  await rect('wood', 1, MX-380, MY+100, MX+600, MY+140);    // floor
  await rect('wood', 0, MX+300, MY-100, MX+420, MY+20);     // Back: a plate to hang the camera on
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(0); window.__pg.setTool('camera'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [MX+360, MY-40]);
  const camG = await theCamera();
  ok('a camera can be placed from the Tools', !!camG, camG);
  ok('with LBP2\'s settings: zoom, tracking, speed, a zone box, a view', camG && camG.zoom === 1 && camG.tracking === 0.5 && camG.speed === 0.5 && camG.zone && camG.zone.w === 640 && camG.zone.h === 400 && camG.view && camG.view.dx === 0, camG);
  await p.evaluate(id => window.__pg.gadgetSet(id, { zoom: 0.5, tracking: 0, speed: 1, zone: { dx: 0, dy: 0, w: 440, h: 440 } }), camG.id);
  await play();
  await standAt(MX-200, MY+60); await p.waitForTimeout(300);   // far from the camera
  ok('outside the zone the camera is not in charge', (await p.evaluate(() => window.__pg.playCam())).active === null);
  ok('and the view is the ordinary one', Math.abs((await view()).zoom - 1) < 0.01, (await view()).zoom);
  await standAt(MX+360, MY+60); await p.waitForTimeout(600);   // under it, inside the zone
  const pc = await p.evaluate(() => window.__pg.playCam());
  ok('inside the zone it takes over', pc.active === camG.id, pc);
  ok('the view zooms out to the camera\'s zoom', Math.abs((await view()).zoom - 0.5) < 0.02, (await view()).zoom);
  const c1 = await centre();
  ok('with tracking at 0 it looks at the camera itself, not the player', Math.abs(c1.x - (MX+360)) < 6 && Math.abs(c1.y - (MY-40)) < 6, { centre: c1, camera: [MX+360, MY-40] });
  await standAt(MX+460, MY+60); await p.waitForTimeout(600);   // still in the zone, off to the side
  const c2 = await centre();
  ok('and stays on the camera as the player moves about', Math.abs(c2.x - (MX+360)) < 6, { centre: c2 });
  await standAt(MX-200, MY+60); await p.waitForTimeout(900);   // out again
  const c3 = await centre(), pp3 = await pos();
  ok('leaving the zone hands the view back', (await p.evaluate(() => window.__pg.playCam())).active === null && Math.abs((await view()).zoom - 1) < 0.02 && Math.abs(c3.x - pp3.x) < 6, { zoom: (await view()).zoom, centre: c3, player: pp3 });
  await build(); await camMid();
  await p.evaluate(id => window.__pg.gadgetSet(id, { tracking: 1 }), (await theCamera()).id);   // ids are renumbered by the mode switch
  await play();
  await standAt(MX+430, MY+60); await p.waitForTimeout(700);
  const c4 = await centre(), pp4 = await pos();
  ok('tracking at 100% follows the player at the camera\'s zoom', Math.abs(c4.x - pp4.x) < 6 && Math.abs((await view()).zoom - 0.5) < 0.02, { centre: c4, player: pp4, zoom: (await view()).zoom });
  await build(); await camMid();
  const sv2 = await p.evaluate(() => window.__pg.serialize('cam2'));
  const gs = sv2.gadgets.filter(g => g.kind === 'camera')[0];
  ok('the save carries the camera and its settings', gs && gs.zoom === 0.5 && gs.tracking === 1 && gs.speed === 1 && gs.zone && gs.zone.w === 440, gs);
  await p.evaluate(sv => window.__pg.load(sv), sv2); await p.waitForTimeout(300);
  const back = (await p.evaluate(() => window.__pg.gadgets())).filter(g => g.kind === 'camera')[0];
  ok('and a load brings it back', back && back.zoom === 0.5 && back.tracking === 1 && back.speed === 1 && back.zone && back.zone.w === 440 && back.zone.h === 440, back);

  console.log('');
  console.log('== a wired camera answers to the switch, not the zone ==');
  await fresh(); await camMid(); await p.waitForTimeout(150);
  const theLever = () => p.evaluate(() => window.__pg.gadgets()).then(gs => gs.filter(g => g.kind === 'lever')[0]);
  await rect('wood', 1, MX-380, MY+100, MX+600, MY+140);
  await rect('wood', 0, MX+300, MY-100, MX+420, MY+20);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(0); window.__pg.setTool('camera'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [MX+360, MY-40]);
  await p.evaluate(id => window.__pg.gadgetSet(id, { zoom: 0.5, tracking: 0, speed: 1, zone: { dx: 0, dy: 0, w: 440, h: 440 } }), (await theCamera()).id);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('lever'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [MX-200, MY+100]);
  ok('a lever can be wired to a camera', await p.evaluate(([a,b]) => window.__pg.wire(a,b), [(await theLever()).id, (await theCamera()).id]));
  await play();
  await standAt(MX+360, MY+60); await p.waitForTimeout(600);   // inside the zone, lever off
  ok('inside the zone but with the lever off, it stays out of it', (await p.evaluate(() => window.__pg.playCam())).active === null);
  await build(); await camMid();
  await p.evaluate(id => window.__pg.gadgetSet(id, { on: true }), (await theLever()).id);
  await play();
  await standAt(MX-200, MY+60); await p.waitForTimeout(600);   // far outside the zone, lever on
  const cwId = (await theCamera()).id;
  ok('lever on, it takes over wherever the player is', (await p.evaluate(() => window.__pg.playCam())).active === cwId && Math.abs((await view()).zoom - 0.5) < 0.02, { pc: await p.evaluate(() => window.__pg.playCam()), zoom: (await view()).zoom });
  await build();

  console.log('');
  console.log('== hold, the glide to a second spot, shake, and freezing the player ==');
  await fresh(); await camMid(); await p.waitForTimeout(150);
  await rect('wood', 1, MX-380, MY+100, MX+600, MY+140);
  await rect('wood', 0, MX+300, MY-100, MX+420, MY+20);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(0); window.__pg.setTool('camera'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [MX+360, MY-40]);
  // "until the player leaves the zone": the default — leave, and it hands back at once
  await p.evaluate(id => window.__pg.gadgetSet(id, { zoom: 0.5, tracking: 0, speed: 1, zone: { dx: 0, dy: 0, w: 440, h: 440 } }), (await theCamera()).id);
  await play();
  const hId = (await theCamera()).id;
  ok('a fresh camera holds until the player leaves the zone', (await theCamera()).holdMode === 'zone');
  await standAt(MX+360, MY+60); await p.waitForTimeout(500);
  ok('in the zone, it is in charge', (await p.evaluate(() => window.__pg.playCam())).active === hId);
  await standAt(MX-200, MY+60); await p.waitForTimeout(150);
  ok('gone from the zone, it hands back straight away', (await p.evaluate(() => window.__pg.playCam())).active === null, await p.evaluate(() => window.__pg.playCam()));
  await build(); await camMid();
  // "for a set time": the shot runs its time out even with the player still inside, and does not restart until they have left and come back
  await p.evaluate(id => window.__pg.gadgetSet(id, { holdMode: 'time', hold: 1 }), (await theCamera()).id);
  await play();
  const tId = (await theCamera()).id;
  await standAt(MX+360, MY+60); await p.waitForTimeout(400);
  ok('set to a time, it starts when the player arrives', (await p.evaluate(() => window.__pg.playCam())).active === tId);
  await p.waitForTimeout(1000);
  ok('and is over when its time is up, player still in the zone', (await p.evaluate(() => window.__pg.playCam())).active === null, await p.evaluate(() => window.__pg.playCam()));
  await p.waitForTimeout(400);
  ok('and does not start again while they stand there', (await p.evaluate(() => window.__pg.playCam())).active === null);
  await p.evaluate(id => window.__pg.gadgetSet(id, { hold: 2 }), tId);
  await standAt(MX-200, MY+60); await p.waitForTimeout(200);
  await standAt(MX+360, MY+60); await p.waitForTimeout(400);
  ok('but leaving and coming back starts it afresh', (await p.evaluate(() => window.__pg.playCam())).active === tId);
  await standAt(MX-200, MY+60); await p.waitForTimeout(300);
  ok('and a timed shot keeps going after the player leaves, until its time is up', (await p.evaluate(() => window.__pg.playCam())).active === tId);
  await build(); await camMid();
  // "until another camera takes over"
  await p.evaluate(id => window.__pg.gadgetSet(id, { holdMode: 'forever' }), (await theCamera()).id);
  await play();
  const fId = (await theCamera()).id;
  await standAt(MX+360, MY+60); await p.waitForTimeout(400);
  await standAt(MX-200, MY+60); await p.waitForTimeout(1500);
  ok('set to hold for good, it keeps the shot long after the player has gone', (await p.evaluate(() => window.__pg.playCam())).active === fId);
  await build(); await camMid();
  // the glide: a second spot 300px to the right and zoomed in, over half a second
  await p.evaluate(id => window.__pg.gadgetSet(id, { holdMode: 'zone', sweep: { dx: 300, dy: -100, zoom: 1.5, secs: 0.5 } }), (await theCamera()).id);
  await play();
  await standAt(MX+360, MY+60); await p.waitForTimeout(1200);
  const cEnd = await centre();
  ok('after the glide the view sits on the second spot', Math.abs(cEnd.x - (MX+360+300)) < 8 && Math.abs(cEnd.y - (MY-40-100)) < 8, { centre: cEnd, wanted: [MX+660, MY-140] });
  ok('at the end zoom', Math.abs((await view()).zoom - 1.5) < 0.03, (await view()).zoom);
  await build(); await camMid();
  const svS = await p.evaluate(() => window.__pg.serialize('sweep'));
  const gsS = svS.gadgets.filter(g => g.kind === 'camera')[0];
  ok('the save carries hold, shake, freeze and the second spot', gsS && gsS.sweep && gsS.sweep.dx === 300 && gsS.sweep.zoom === 1.5 && gsS.sweep.secs === 0.5 && gsS.holdMode === 'zone' && gsS.hold === 1, gsS);
  await p.evaluate(sv => window.__pg.load(sv), svS); await p.waitForTimeout(300);
  const gsB = await theCamera();
  ok('and a load brings them back', gsB && gsB.sweep && gsB.sweep.dx === 300 && gsB.sweep.dy === -100 && gsB.sweep.zoom === 1.5, gsB && gsB.sweep);
  // shake: the view jitters while it is in charge
  await camMid();
  await p.evaluate(id => window.__pg.gadgetSet(id, { sweep: null, shake: 1 }), (await theCamera()).id);
  await play();
  await standAt(MX+360, MY+60); await p.waitForTimeout(600);
  const xs = []; for (let i = 0; i < 10; i++){ xs.push((await centre()).x); await p.waitForTimeout(25); }
  const spread = Math.max(...xs) - Math.min(...xs);
  ok('shake at 100% makes the view jitter', spread > 3, { spread, xs: xs.map(x => Math.round(x)) });
  await build(); await camMid();
  // freeze: the player cannot walk while the shot is on
  await p.evaluate(id => window.__pg.gadgetSet(id, { shake: 0, freeze: true }), (await theCamera()).id);
  await play();
  await standAt(MX+360, MY+60); await p.waitForTimeout(400);
  const fx0 = (await pos()).x;
  await p.keyboard.down('KeyD'); await p.waitForTimeout(500); await p.keyboard.up('KeyD');
  const fx1 = (await pos()).x;
  ok('with the controls off for the shot, D does not walk you', Math.abs(fx1 - fx0) < 3, { from: fx0, to: fx1 });
  await standAt(MX-200, MY+60); await p.waitForTimeout(400);
  const gx0 = (await pos()).x;
  await p.keyboard.down('KeyD'); await p.waitForTimeout(500); await p.keyboard.up('KeyD');
  ok('and outside the zone you walk as usual', (await pos()).x > gx0 + 80, { from: gx0, to: (await pos()).x });
  await build();

  console.log('');
  console.log('== the zone is a box you can move and resize; the view is a frame you can move and zoom ==');
  await fresh(); await camMid(); await p.waitForTimeout(150);
  await rect('wood', 1, MX-380, MY+100, MX+600, MY+140);
  await rect('wood', 0, MX+300, MY-100, MX+420, MY+20);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(0); window.__pg.setTool('camera'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [MX+360, MY-40]);
  // a wide, flat zone off to the left of the camera, and the view looking somewhere else again
  await p.evaluate(id => window.__pg.gadgetSet(id, { zoom: 1.5, tracking: 0, speed: 1, zone: { dx: -400, dy: 100, w: 600, h: 120 }, view: { dx: 150, dy: 60 } }), (await theCamera()).id);
  await play();
  await standAt(MX+360, MY+60); await p.waitForTimeout(400);          // under the camera: outside the zone box, which sits to the left
  ok('standing under the camera, outside its box, it stays out of it', (await p.evaluate(() => window.__pg.playCam())).active === null);
  await standAt(MX+360-400+250, MY+60); await p.waitForTimeout(600);  // far along the flat box, still inside it
  ok('inside the box — even far from the camera — it takes over', (await p.evaluate(() => window.__pg.playCam())).active !== null);
  const cv = await centre();
  ok('and looks where the view frame was put, not at the camera', Math.abs(cv.x - (MX+360+150)) < 8 && Math.abs(cv.y - (MY-40+60)) < 8, { centre: cv, wanted: [MX+510, MY+20] });
  await build(); await camMid();
  // now by hand: select it and drag the corners and edges on the level
  const cid = (await theCamera()).id;
  await p.evaluate(id => window.__pg.selectGadget(id), cid); await p.evaluate(() => { window.__pg.setTool('move'); });
  await p.waitForTimeout(150);
  const g0 = await theCamera();
  const drag = async (x0, y0, x1, y1) => {
    const a = await w2p(x0, y0), c = await w2p(x1, y1);
    for (const q of [a, c]) if (q.x < 2 || q.y < 2 || q.x > 1278 || q.y > 758) throw new Error('drag point off the screen: ' + JSON.stringify(q) + ' — a drag from off-screen breaks every later drag');
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
  };
  const ax = MX+360, ay = MY-40;                                    // the camera's own spot
  // the zone's bottom-right corner: pull it 100 right and 40 down
  const zr = { x: ax + g0.zone.dx - g0.zone.w/2, y: ay + g0.zone.dy - g0.zone.h/2, w: g0.zone.w, h: g0.zone.h };
  await drag(zr.x + zr.w, zr.y + zr.h, zr.x + zr.w + 100, zr.y + zr.h + 40);
  let g1 = await theCamera();
  ok('dragging a zone corner resizes the zone', Math.abs(g1.zone.w - (g0.zone.w + 100)) < 3 && Math.abs(g1.zone.h - (g0.zone.h + 40)) < 3, g1.zone);
  ok('about the opposite corner, which stays put', Math.abs((ax + g1.zone.dx - g1.zone.w/2) - zr.x) < 3 && Math.abs((ay + g1.zone.dy - g1.zone.h/2) - zr.y) < 3, g1.zone);
  // the zone's top edge, in the middle: slide the whole box up 60
  const zr1 = { x: ax + g1.zone.dx - g1.zone.w/2, y: ay + g1.zone.dy - g1.zone.h/2, w: g1.zone.w, h: g1.zone.h };
  await drag(zr1.x + zr1.w/2 + 30, zr1.y, zr1.x + zr1.w/2 + 30, zr1.y - 60);
  let g2 = await theCamera();
  ok('dragging the zone\'s edge moves the whole zone', Math.abs(g2.zone.dy - (g1.zone.dy - 60)) < 3 && Math.abs(g2.zone.w - g1.zone.w) < 1, g2.zone);
  // the view frame's left edge: slide the shot 80 to the right
  const fw = (await view()).w * (await view()).zoom / g2.zoom, fh = (await view()).h * (await view()).zoom / g2.zoom;   // the frame at the camera's zoom, in world px
  const fr = { x: ax + g2.view.dx - fw/2, y: ay + g2.view.dy - fh/2, w: fw, h: fh };
  await drag(fr.x, fr.y + fr.h/2 + 40, fr.x + 80, fr.y + fr.h/2 + 40);
  let g3 = await theCamera();
  ok('dragging the frame\'s edge moves where it looks', Math.abs(g3.view.dx - (g2.view.dx + 80)) < 3 && Math.abs(g3.view.dy - g2.view.dy) < 3, g3.view);
  // the frame's bottom-right corner, pulled in: a tighter shot
  const fr3 = { x: ax + g3.view.dx - fw/2, y: ay + g3.view.dy - fh/2, w: fw, h: fh };
  await drag(fr3.x + fr3.w, fr3.y + fr3.h, fr3.x + fr3.w * 0.6, fr3.y + fr3.h * 0.6);
  let g4 = await theCamera();
  ok('dragging a frame corner inward zooms the shot in', g4.zoom > g3.zoom * 1.4, { before: g3.zoom, after: g4.zoom });
  ok('and the opposite corner of the frame stays put', Math.abs((ax + g4.view.dx - fw * g3.zoom / g4.zoom / 2) - fr3.x) < 4, { left: ax + g4.view.dx - fw * g3.zoom / g4.zoom / 2, was: fr3.x });
  const svZ = await p.evaluate(() => window.__pg.serialize('zone'));
  const gz = svZ.gadgets.filter(g => g.kind === 'camera')[0];
  ok('the save carries the zone box and the view', gz && gz.zone && Math.abs(gz.zone.w - g4.zone.w) < 0.01 && gz.view && Math.abs(gz.view.dx - g4.view.dx) < 0.01, gz && { zone: gz.zone, view: gz.view });
  await p.evaluate(sv => window.__pg.load(sv), svZ); await p.waitForTimeout(300);
  const gzB = await theCamera();
  ok('and a load brings them back', gzB && Math.abs(gzB.zone.w - g4.zone.w) < 0.01 && Math.abs(gzB.zone.dy - g4.zone.dy) < 0.01 && Math.abs(gzB.view.dx - g4.view.dx) < 0.01, gzB && { zone: gzB.zone, view: gzB.view });

  console.log('');
  console.log('== grab the zone anywhere inside it; the frame is the shot as it really lands ==');
  await fresh(); await camMid(); await p.waitForTimeout(150);
  await rect('wood', 1, MX-380, MY+100, MX+600, MY+140);
  await rect('wood', 0, MX+300, MY-100, MX+420, MY+20);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(0); window.__pg.setTool('camera'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [MX+360, MY-40]);
  await p.evaluate(id => window.__pg.gadgetSet(id, { zoom: 1.5, tracking: 0, speed: 1, zone: { dx: -400, dy: 100, w: 600, h: 120 }, view: { dx: 150, dy: 60 } }), (await theCamera()).id);
  await p.evaluate(id => window.__pg.selectGadget(id), (await theCamera()).id); await p.evaluate(() => { window.__pg.setTool('move'); });
  await p.waitForTimeout(150);
  const gi0 = await theCamera();
  const zc = { x: MX+360 + gi0.zone.dx, y: MY-40 + gi0.zone.dy };
  await drag(zc.x + 40, zc.y + 10, zc.x + 40 + 70, zc.y + 10 + 30);         // from well inside the box, nowhere near an edge
  const gi1 = await theCamera();
  ok('dragging from the middle of the zone box moves it', Math.abs(gi1.zone.dx - (gi0.zone.dx + 70)) < 3 && Math.abs(gi1.zone.dy - (gi0.zone.dy + 30)) < 3 && gi1.zone.w === gi0.zone.w, gi1.zone);
  // the honest frame: tracking at 50%, the player standing somewhere — the shot sits halfway
  await p.evaluate(id => window.__pg.gadgetSet(id, { tracking: 0.5 }), gi1.id);
  await p.evaluate(() => window.__pg.setFlying(true));
  await standAt(MX-100, MY-300); await p.waitForTimeout(200);
  const pp = await pos(), vc = { x: MX+360 + gi1.view.dx, y: MY-40 + gi1.view.dy };
  const shot = await p.evaluate(id => window.__pg.camShot(id), gi1.id);
  const sc = { x: shot.x + shot.w/2, y: shot.y + shot.h/2 };
  ok('with tracking at 50% the drawn frame sits halfway between the view spot and the player (as the camera aims at them, 70px up)', Math.abs(sc.x - (vc.x + pp.x)/2) < 3 && Math.abs(sc.y - (vc.y + pp.y - 70)/2) < 3, { shot: sc, view: vc, player: pp });
  // and it agrees with what Play actually shows from there
  await play();
  await standAt(MX-100, MY-300); await p.waitForTimeout(100);
  await p.evaluate(() => window.__pg.playerTo(0, 0));   // (a nudge so the physics has settled at the same spot)
  await standAt(MX+360-400+70+100, MY+60); await p.waitForTimeout(700);   // inside the zone, so it takes over
  const ppP = await pos();
  const shotP = await p.evaluate(id => window.__pg.camShot(id), (await theCamera()).id);
  const cP = await centre();
  ok('and in Play the view lands exactly on the frame, for wherever the player is', Math.abs(cP.x - (shotP.x + shotP.w/2)) < 6 && Math.abs(cP.y - (shotP.y + shotP.h/2)) < 6, { view: cP, frame: [shotP.x + shotP.w/2, shotP.y + shotP.h/2], player: ppP });
  await build(); await camMid();
  // dragging the frame with tracking on still lands the frame under the cursor
  const gi2 = await theCamera();
  await p.evaluate(id => window.__pg.selectGadget(id), gi2.id); await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.setFlying(true); });
  await standAt(MX-100, MY-300); await p.waitForTimeout(200);
  const sh0 = await p.evaluate(id => window.__pg.camShot(id), gi2.id);
  await drag(sh0.x, sh0.y + sh0.h/2 + 40, sh0.x + 80, sh0.y + sh0.h/2 + 40);
  const sh1 = await p.evaluate(id => window.__pg.camShot(id), gi2.id);
  ok('dragging the frame by 80px moves the frame by 80px, tracking or not', Math.abs((sh1.x - sh0.x) - 80) < 4 && Math.abs(sh1.y - sh0.y) < 4, { before: sh0.x, after: sh1.x });
  const gi3 = await theCamera();
  ok('(which means the view spot moved twice as far)', Math.abs((gi3.view.dx - gi2.view.dx) - 160) < 6, { before: gi2.view.dx, after: gi3.view.dx });

  console.log('');
  console.log('== a camera can sit in mid-air, on any layer ==');
  await fresh(); await camMid(); await p.waitForTimeout(150);
  await rect('wood', 1, MX-380, MY+100, MX+600, MY+140);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(2); window.__pg.setTool('camera'); });   // the Front layer, with nothing on it
  const sky = await w2p(MX+360, MY-40);
  await p.mouse.click(sky.x, sky.y); await p.waitForTimeout(200);
  const air = await theCamera();
  ok('clicking empty sky with the Front layer picked places a camera there', !!air && air.obj === null && air.layer === 2 && Math.abs(air.x - (MX+360)) < 2, air);
  await p.evaluate(id => window.__pg.gadgetSet(id, { zoom: 0.5, tracking: 0, speed: 1, zone: { dx: 0, dy: 0, w: 440, h: 440 } }), air.id);
  await play();
  await standAt(MX+360, MY+60); await p.waitForTimeout(600);
  ok('and it works from there', (await p.evaluate(() => window.__pg.playCam())).active !== null && Math.abs((await view()).zoom - 0.5) < 0.03, (await view()).zoom);
  await build(); await camMid();
  const svA = await p.evaluate(() => window.__pg.serialize('air'));
  const ga = svA.gadgets.filter(g => g.kind === 'camera')[0];
  ok('the save keeps a camera with no object under it', ga && ga.o === null && ga.layer === 2, ga);
  await p.evaluate(sv => window.__pg.load(sv), svA); await p.waitForTimeout(300);
  const gaB = await theCamera();
  ok('and a load brings it back where it was', gaB && gaB.obj === null && gaB.layer === 2 && Math.abs(gaB.x - (MX+360)) < 2, gaB);
  // dragging it: onto the floor attaches it, back into the air frees it
  await p.evaluate(id => window.__pg.selectGadget(id), gaB.id); await p.evaluate(() => { window.__pg.setTool('move'); });
  await drag(MX+360, MY-40, MX+100, MY+120);
  const gOn = await theCamera();
  ok('dragged onto the floor, it rides the floor', gOn && gOn.obj !== null && gOn.layer === 1, gOn && { obj: gOn.obj, layer: gOn.layer });
  await drag(MX+100, MY+120, MX+100, MY-200);
  const gOff = await theCamera();
  ok('dragged back into the air, it is free again', gOff && gOff.obj === null && Math.abs(gOff.y - (MY-200)) < 2, gOff && { obj: gOff.obj, y: gOff.y });

  console.log('');
  console.log('== in Build, walking into a zone shows the shot; flying brings the editor back ==');
  await fresh(); await camMid(); await p.waitForTimeout(150);
  await rect('wood', 1, MX-380, MY+100, MX+600, MY+140);
  await rect('wood', 0, MX+300, MY-100, MX+420, MY+20);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(0); window.__pg.setTool('camera'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [MX+360, MY-40]);
  await p.evaluate(id => window.__pg.gadgetSet(id, { zoom: 0.5, tracking: 0, speed: 1, zone: { dx: 0, dy: 0, w: 440, h: 440 } }), (await theCamera()).id);
  await p.evaluate(() => { window.__pg.deselect(); window.__pg.setTool('move'); });
  // the editor camera on the character, flying, inside the zone: nothing happens
  await p.evaluate(() => { window.__pg.setFlying(true); const h = document.getElementById('camHome'); if (h) h.click(); });
  await standAt(MX+360, MY+60); await p.waitForTimeout(500);
  const bz0 = (await view()).zoom;
  ok('flying through the zone, the editor view is untouched', Math.abs(bz0 - 1) < 0.01 && (await p.evaluate(() => window.__pg.playCam())).active === null, { zoom: bz0 });
  // land: the shot shows
  await p.evaluate(() => window.__pg.setFlying(false));
  await p.waitForTimeout(700);
  ok('landed inside the zone, the camera shows its shot', (await p.evaluate(() => window.__pg.playCam())).active !== null && Math.abs((await view()).zoom - 0.5) < 0.03, { zoom: (await view()).zoom, pc: await p.evaluate(() => window.__pg.playCam()) });
  const bc = await centre();
  ok('looking where the camera looks', Math.abs(bc.x - (MX+360)) < 8 && Math.abs(bc.y - (MY-40)) < 8, { centre: bc });
  // fly again: straight back to the editor's zoom, on the character
  await p.evaluate(() => window.__pg.setFlying(true));
  await p.waitForTimeout(200);
  ok('flying again puts the editor view back at once', Math.abs((await view()).zoom - 1) < 0.01 && (await p.evaluate(() => window.__pg.playCam())).active === null && (await p.evaluate(() => window.__pg.camFollowing())), { zoom: (await view()).zoom });
  ok('and the editor zoom was never overwritten by the preview', (await p.evaluate(() => window.__pg.edCam())) === null);
  // walk out of the zone on foot: it hands back by itself
  await p.evaluate(() => window.__pg.setFlying(false));
  await standAt(MX+360, MY+60); await p.waitForTimeout(600);
  ok('walking, the shot is on again', (await p.evaluate(() => window.__pg.playCam())).active !== null);
  await standAt(MX-300, MY+60); await p.waitForTimeout(900);
  ok('walking out of the zone hands the editor view back', Math.abs((await view()).zoom - 1) < 0.02 && (await p.evaluate(() => window.__pg.playCam())).active === null, { zoom: (await view()).zoom });
  await p.evaluate(() => window.__pg.setFlying(true));

  console.log('');
  console.log('== the World page shows exactly what Play\'s camera will show, as you set it ==');
  await fresh(); await camMid(); await p.waitForTimeout(150);
  await rect('wood', 1, MX-380, MY+100, MX+400, MY+140);
  await lockAll();
  await p.evaluate(() => window.__pg.paused(false));
  await standAt(MX, MY+60); await p.waitForTimeout(400);
  // the editor camera is off somewhere else, detached
  await p.evaluate(([x,y]) => window.__pg.zoomTo(1.3, x, y), [MX+300, MY-200]); await p.waitForTimeout(100);
  const ed0 = await view();
  ok('the editor view starts detached, elsewhere, at its own zoom', !(await p.evaluate(() => window.__pg.camFollowing())) && Math.abs(ed0.zoom - 1.3) < 0.01, ed0);
  await p.evaluate(() => { window.__pg.worldSet('playZoom', 0.7); window.__pg.worldSet('camHeight', -120); });
  ok('the World page opens', await p.evaluate(() => window.__pg.menu('world')));
  await p.waitForTimeout(150);
  const wpc = await centre(), wpp = await pos();
  ok('with it open the level shows the character at the Play zoom', Math.abs((await view()).zoom - 0.7) < 0.01, (await view()).zoom);
  ok('and at the Play height', Math.abs(wpc.x - wpp.x) < 2 && Math.abs(wpc.y - (wpp.y - 120)) < 2, { centre: wpc, player: wpp });
  await p.evaluate(() => { window.__pg.worldSet('camHeight', 40); window.__pg.worldSet('playZoom', 1.1); }); await p.waitForTimeout(120);
  const wpc2 = await centre();
  ok('changing the height and zoom shows at once', Math.abs((await view()).zoom - 1.1) < 0.01 && Math.abs(wpc2.y - (wpp.y + 40)) < 2, { zoom: (await view()).zoom, centre: wpc2, player: wpp });
  await p.evaluate(() => window.__pg.menu(null)); await p.waitForTimeout(150);
  const ed1 = await view();
  ok('closing the page puts the editor view back exactly where it was', !(await p.evaluate(() => window.__pg.camFollowing())) && Math.abs(ed1.zoom - 1.3) < 0.01 && Math.abs(ed1.x - ed0.x) < 2 && Math.abs(ed1.y - ed0.y) < 2, { before: ed0, after: ed1 });
  await p.evaluate(() => { window.__pg.worldSet('playZoom', 1); window.__pg.worldSet('camHeight', -70); window.__pg.paused(true); });

  console.log('');
  console.log('== the level sets the walking and sprinting pace ==');
  await fresh();
  await rect('wood', 1, X-380, Y+100, X+600, Y+140);
  await lockAll();
  await play();
  const walkFor = async (ms, sprint) => {
    await standAt(X-300, Y+60); await p.waitForTimeout(200);
    const a = (await pos()).x;
    if (sprint) await p.keyboard.down('Shift');
    await p.keyboard.down('KeyD'); await p.waitForTimeout(ms); await p.keyboard.up('KeyD');
    if (sprint) await p.keyboard.up('Shift');
    await p.waitForTimeout(150);
    return (await pos()).x - a;
  };
  const d1 = await walkFor(500, false);
  await p.evaluate(() => window.__pg.worldSet('walkSpeed', 2));
  const d2 = await walkFor(500, false);
  console.log('   walked', d1.toFixed(0) + 'px at 100%,', d2.toFixed(0) + 'px at 200%');
  ok('walking speed at 200% walks about twice as far', d2 > d1 * 1.7 && d2 < d1 * 2.3, { d1, d2 });
  await p.evaluate(() => { window.__pg.worldSet('walkSpeed', 1); window.__pg.worldSet('sprintSpeed', 1); });
  const d3 = await walkFor(500, true);
  ok('sprint at 100% of walking is no faster than walking', Math.abs(d3 - d1) < d1 * 0.15, { walk: d1, sprint: d3 });
  await p.evaluate(() => window.__pg.worldSet('sprintSpeed', 2.5));
  const d4 = await walkFor(500, true);
  ok('sprint at 250% is much faster', d4 > d1 * 2, { walk: d1, sprint: d4 });
  await build();
  await p.evaluate(() => { window.__pg.worldSet('walkSpeed', 1.5); window.__pg.worldSet('sprintSpeed', 2.5); });
  const sv3 = await p.evaluate(() => window.__pg.serialize('pace'));
  ok('the save carries the pace', sv3.world.walkSpeed === 1.5 && sv3.world.sprintSpeed === 2.5, sv3.world);
  await p.evaluate(sv => window.__pg.load(sv), sv3); await p.waitForTimeout(300);
  ok('and a load brings it back', (await p.evaluate(() => window.__pg.worldGet('walkSpeed'))) === 1.5 && (await p.evaluate(() => window.__pg.worldGet('sprintSpeed'))) === 2.5);

  console.log('');
  console.log('== grab reach ==');
  await fresh();
  await p.waitForTimeout(300);
  await rect('wood', 1, X-380, Y+100, X+400, Y+140);
  await rect('sponge', 1, X+60, Y, X+140, Y+100);           // a sponge block
  await lockAll();
  await play();
  await standAt(X+60 - 20 - 40, Y+60); await p.waitForTimeout(300);   // 40px short of touching it
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('at the usual reach, 40px away is out of reach', !(await p.evaluate(() => window.__pg.grabbing())));
  await p.keyboard.up('KeyQ');
  await p.evaluate(() => window.__pg.worldSet('grabReach', 60));
  await p.waitForTimeout(100);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(250);
  ok('with the reach set to 60px it can be grabbed from there', await p.evaluate(() => window.__pg.grabbing()));
  await p.keyboard.up('KeyQ');
  await build();
  await p.evaluate(() => window.__pg.starter());
  ok('a new level goes back to the defaults', (await p.evaluate(() => window.__pg.worldGet('grabReach'))) === 16 && (await p.evaluate(() => window.__pg.worldGet('walkSpeed'))) === 1 && (await p.evaluate(() => window.__pg.worldGet('playZoom'))) === 1);

  console.log('');
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
