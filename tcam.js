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
  await standAt(ws.w/2, ws.h/2); await p.waitForTimeout(200);   // mid-map, where the edges do not clamp the view
  const c0 = await centre(), pp0 = await pos();
  ok('and looks at the character', Math.abs(c0.x - pp0.x) < 2 && Math.abs(c0.y - pp0.y) < 40, { centre: c0, player: pp0 });
  const mid = await w2p(pp0.x, pp0.y);
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
  ok('with LBP2\'s settings: zoom, tracking, speed, a zone', camG && camG.zoom === 1 && camG.tracking === 0.5 && camG.speed === 0.5 && camG.radius === 320, camG);
  await p.evaluate(id => window.__pg.gadgetSet(id, { zoom: 0.5, tracking: 0, speed: 1, radius: 220 }), camG.id);
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
  ok('the save carries the camera and its settings', gs && gs.zoom === 0.5 && gs.tracking === 1 && gs.speed === 1 && gs.radius === 220, gs);
  await p.evaluate(sv => window.__pg.load(sv), sv2); await p.waitForTimeout(300);
  const back = (await p.evaluate(() => window.__pg.gadgets())).filter(g => g.kind === 'camera')[0];
  ok('and a load brings it back', back && back.zoom === 0.5 && back.tracking === 1 && back.speed === 1 && back.radius === 220, back);

  console.log('');
  console.log('== a wired camera answers to the switch, not the zone ==');
  await fresh(); await camMid(); await p.waitForTimeout(150);
  const theLever = () => p.evaluate(() => window.__pg.gadgets()).then(gs => gs.filter(g => g.kind === 'lever')[0]);
  await rect('wood', 1, MX-380, MY+100, MX+600, MY+140);
  await rect('wood', 0, MX+300, MY-100, MX+420, MY+20);
  await lockAll();
  await p.evaluate(() => { window.__pg.setLayer(0); window.__pg.setTool('camera'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [MX+360, MY-40]);
  await p.evaluate(id => window.__pg.gadgetSet(id, { zoom: 0.5, tracking: 0, speed: 1, radius: 220 }), (await theCamera()).id);
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
  // hold for a second after the player leaves
  await p.evaluate(id => window.__pg.gadgetSet(id, { zoom: 0.5, tracking: 0, speed: 1, radius: 220, hold: 1 }), (await theCamera()).id);
  await play();
  const hId = (await theCamera()).id;
  await standAt(MX+360, MY+60); await p.waitForTimeout(500);
  ok('in the zone, it is in charge', (await p.evaluate(() => window.__pg.playCam())).active === hId);
  await standAt(MX-200, MY+60); await p.waitForTimeout(400);
  ok('gone from the zone, it holds the shot for its hold time', (await p.evaluate(() => window.__pg.playCam())).active === hId, await p.evaluate(() => window.__pg.playCam()));
  await p.waitForTimeout(1000);
  ok('and hands back when the hold is up', (await p.evaluate(() => window.__pg.playCam())).active === null, await p.evaluate(() => window.__pg.playCam()));
  await build(); await camMid();
  // holding for good
  await p.evaluate(id => window.__pg.gadgetSet(id, { holdForever: true }), (await theCamera()).id);
  await play();
  const fId = (await theCamera()).id;
  await standAt(MX+360, MY+60); await p.waitForTimeout(400);
  await standAt(MX-200, MY+60); await p.waitForTimeout(1500);
  ok('set to hold for good, it keeps the shot long after the player has gone', (await p.evaluate(() => window.__pg.playCam())).active === fId);
  await build(); await camMid();
  // the glide: a second spot 300px to the right and zoomed in, over half a second
  await p.evaluate(id => window.__pg.gadgetSet(id, { holdForever: false, hold: 0, sweep: { dx: 300, dy: -100, zoom: 1.5, secs: 0.5 } }), (await theCamera()).id);
  await play();
  await standAt(MX+360, MY+60); await p.waitForTimeout(1200);
  const cEnd = await centre();
  ok('after the glide the view sits on the second spot', Math.abs(cEnd.x - (MX+360+300)) < 8 && Math.abs(cEnd.y - (MY-40-100)) < 8, { centre: cEnd, wanted: [MX+660, MY-140] });
  ok('at the end zoom', Math.abs((await view()).zoom - 1.5) < 0.03, (await view()).zoom);
  await build(); await camMid();
  const svS = await p.evaluate(() => window.__pg.serialize('sweep'));
  const gsS = svS.gadgets.filter(g => g.kind === 'camera')[0];
  ok('the save carries hold, shake, freeze and the second spot', gsS && gsS.sweep && gsS.sweep.dx === 300 && gsS.sweep.zoom === 1.5 && gsS.sweep.secs === 0.5 && gsS.hold === 0 && gsS.holdForever === false, gsS);
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
