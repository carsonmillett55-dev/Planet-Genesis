const { launch, previewURL } = require('./tenv');
let pass=0, fail=0;
const ok=(n,c,e)=>{ if(c){pass++;console.log('  ok  '+n);} else {fail++;console.log('  FAIL '+n+(e!==undefined?'  -> '+JSON.stringify(e):''));} };
const lum = c => 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport:{width:1280,height:760} });
  const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
  p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await p.goto(previewURL);
  await p.waitForTimeout(1100);
  await p.evaluate(() => { window.__pg.freezeCam(); window.__pg.setStick(true); window.__pg.setPaintMode('rect'); });
  const cam = await p.evaluate(() => window.__pg.cam());
  const X = cam.x + 300, Y = cam.y + 260;
  async function drag(pts){
    const s0 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), pts[0]);
    await p.mouse.move(s0.x, s0.y); await p.mouse.down();
    for (const q of pts.slice(1)){ const s = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), q); await p.mouse.move(s.x, s.y, {steps:6}); }
    await p.mouse.up(); await p.waitForTimeout(170);
  }
  const use = (k,br,mode) => p.evaluate(([k,br,mode]) => { window.__pg.setTool(k); if(br) window.__pg.setBrush(br); if(mode) window.__pg.setPaintMode(mode); window.__pg.deselect(); }, [k,br,mode]);
  // canvas-local sampling point for a world position
  const at = async (wx,wy) => { const s = await p.evaluate(([x,y]) => window.__pg.w2s(x,y), [wx,wy]); return s; };
  const sample = async (wx,wy) => { const s = await at(wx,wy); return p.evaluate(([x,y]) => window.__pg.pixel(x,y), [s.x, s.y]); };

  console.log('\n== a wall stops the light ==');
  // a tall wall, with a light to its left
  await use('metal', 1, 'rect');
  await drag([[X, Y-160],[X+40, Y+160]]);
  await use('light', 2.2, 'brush');
  await drag([[X-120, Y],[X-115, Y]]);
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); window.__pg.worldLight(0.05); });
  await p.mouse.move(1200, 730);
  await p.waitForTimeout(600);
  const litSide  = await sample(X - 220, Y);      // same distance, light's side
  const darkSide = await sample(X + 220, Y);      // same distance, behind the wall
  console.log('   in front of the wall', litSide, ' behind it', darkSide);
  ok('the light lights its own side', lum(litSide) > lum(darkSide) * 1.4, {litSide, darkSide});
  ok('and does not reach past the wall', lum(darkSide) < lum(litSide) * 0.6, {litSide, darkSide});
  await p.screenshot({ path:'shadow.png' });

  console.log('\n== a light does not shadow itself ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.worldLight(0.05); window.__pg.setPaintMode('rect'); });
  await p.waitForTimeout(150);
  await use('wood', 1, 'rect');
  await drag([[X-100, Y-60],[X+100, Y+60]]);      // a plank
  await use('light', 1.4, 'brush');
  await drag([[X, Y],[X+6, Y]]);                  // a lamp painted INTO it
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
  await p.mouse.move(1200, 730);
  await p.waitForTimeout(500);
  const around = await sample(X, Y - 90);
  console.log('   just above the plank', around);
  const far = await sample(X + 600, Y - 90);
  ok('a lamp set into a wall still lights the room', lum(around) > lum(far) * 1.4, {around, far});

  console.log('\n== solid light ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.worldLight(1); });
  await p.waitForTimeout(150);
  await p.evaluate(()=>window.__pg.setStick(false));
  await use('light', 1, 'rect');
  await drag([[X, Y],[X+180, Y+90]]);
  let st = await p.evaluate(()=>window.__pg.lightState());
  console.log('   default:', JSON.stringify(st));
  ok('light is walk-through by default', st.sensor && !st.solid, st);
  ok('and holds itself up', st.still, st);
  await p.evaluate(()=>window.__pg.setSolidLight(true));
  await p.waitForTimeout(250);
  st = await p.evaluate(()=>window.__pg.lightState());
  console.log('   made solid:', JSON.stringify(st));
  ok('solid light has real collision', !st.sensor && st.parts > 0, st);
  ok('and can still be stood on where it is', st.still, st);
  await p.evaluate(()=>window.__pg.setLightFalls(true));
  await p.waitForTimeout(250);
  st = await p.evaluate(()=>window.__pg.lightState());
  ok('letting it fall makes gravity take it', !st.still, st);
  await p.evaluate(()=>window.__pg.setLightFalls(false));

  console.log('\n== the toggles survive a save ==');
  const data = await p.evaluate(() => window.__pg.serialize('lt'));
  await p.evaluate(d => window.__pg.load(d), data);
  await p.waitForTimeout(350);
  st = await p.evaluate(()=>window.__pg.lightState());
  console.log('   after reload:', JSON.stringify(st));
  ok('solid light comes back solid', st.solid && !st.sensor, st);

  console.log('\n== shadows keep 60fps ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.worldLight(0.1); window.__pg.setPaintMode('rect'); });
  await p.waitForTimeout(150);
  for (let i=0;i<7;i++){ await use('metal', 1, 'rect'); await drag([[X-300+i*95, Y-140],[X-260+i*95, Y+140]]); }
  for (let i=0;i<4;i++){ await use('light:'+(9+i*5), 1.6, 'brush'); await drag([[X-260+i*180, Y+190],[X-254+i*180, Y+190]]); }
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
  await p.mouse.move(1200, 730);
  await p.waitForTimeout(700);
  const fr = await p.evaluate(() => new Promise(res => {
    const ts=[]; let last=performance.now(), n=0;
    (function tick(){ const now=performance.now(); ts.push(now-last); last=now;
      if (++n<80) requestAnimationFrame(tick); else { ts.sort((a,b)=>a-b); res({med:+ts[40].toFixed(1), p90:+ts[72].toFixed(1)}); } })();
  }));
  console.log('   4 lights, 7 walls:', JSON.stringify(fr));
  ok('still 60fps with shadows', fr.med < 18, fr);
  await p.screenshot({ path:'shadow-many.png' });

  console.log('\n== a big bright light survives being zoomed into ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.worldLight(0.05); window.__pg.setPaintMode('rect'); });
  await p.waitForTimeout(150);
  await use('light', 4, 'rect');
  await drag([[X-80, Y-80],[X+80, Y+80]]);
  await p.evaluate(() => { var o = window.__pg.objects(); o[o.length-1].glow = 2.4; window.__pg.setTool('move'); window.__pg.deselect(); });
  await p.mouse.move(1240, 740);
  for (const z of [0.6, 1.4, 2.6]){
    await p.evaluate(([z,x,y]) => window.__pg.zoomTo(z, x, y), [z, X, Y]);
    await p.waitForTimeout(500);
    const mid = await sample(X, Y);
    // the glow should still reach a long way at every zoom
    const out = await sample(X + 150, Y);
    console.log('   zoom ' + z + ': centre', mid, ' 150px out', out);
    ok('zoom ' + z + ' keeps the big light lit right through', lum(mid) > 120 && lum(out) > 60, {mid, out});
  }
  await p.evaluate(([x,y]) => window.__pg.zoomTo(0.82, x, y), [X, Y]);
  await p.waitForTimeout(400);

  console.log('\n== a light just off screen still shines onto it ==');
  const camNow = await p.evaluate(() => window.__pg.cam());
  // park the camera so the light sits just past the left edge
  await p.evaluate(([x,y]) => window.__pg.zoomTo(0.82, x, y), [X + 620, Y]);
  await p.waitForTimeout(500);
  const edge = await p.evaluate(() => { const c = window.__pg.cam(); return { x: c.x + 30, y: 0 }; });
  const nearEdge = await sample(edge.x, Y);
  const farSide = await sample(edge.x + 900, Y);
  console.log('   near the edge', nearEdge, ' far side', farSide);
  ok('light from off screen still reaches in', lum(nearEdge) > lum(farSide) * 1.4, {nearEdge, farSide});

  console.log('\n== the player picks up the light ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.worldLight(0.04); window.__pg.setPaintMode('rect'); });
  await p.waitForTimeout(200);
  const spawn = await p.evaluate(() => window.__pg.playerPos());
  await p.evaluate(([x,y]) => window.__pg.zoomTo(0.82, x, y), [spawn.x + 200, spawn.y - 60]);
  await p.waitForTimeout(300);
  const dark = await sample(spawn.x, spawn.y);
  await use('light', 2, 'brush');
  await drag([[spawn.x + 70, spawn.y],[spawn.x + 76, spawn.y]]);
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
  await p.mouse.move(1240, 740);
  await p.waitForTimeout(500);
  const bright = await sample(spawn.x, spawn.y);
  console.log('   player in the dark', dark, ' player by a light', bright);
  ok('the player carries no lamp of their own', lum(dark) < 60, dark);
  ok('but brightens when a real light reaches them', lum(bright) > lum(dark) * 1.5, {dark, bright});
  await p.screenshot({ path:'player-lit.png' });

  console.log('\n== glow: range, duplication and undo ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.worldLight(0.05); window.__pg.setPaintMode('rect'); });
  await p.waitForTimeout(180);
  await use('light', 1.2, 'rect');
  await drag([[X, Y],[X+70, Y+70]]);
  await p.evaluate(() => { var o = window.__pg.objects(); o[o.length-1].glow = 6; o[o.length-1].lightSolid = true; });
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
  await p.mouse.move(1240, 740);
  await p.waitForTimeout(450);
  const reach = await sample(X + 700, Y + 35);
  const beyond = await sample(X + 1600, Y + 35);
  console.log('   700px out', reach, ' 1600px out', beyond);
  ok('a 600% light reaches a long way', lum(reach) > lum(beyond) * 1.5, {reach, beyond});

  const src = await p.evaluate(() => { var o = window.__pg.objects(); var t = o[o.length-1];
    window.__pg.select(t); window.__pg.duplicate();
    var c = window.__pg.objects(); var d = c[c.length-1];
    return { srcGlow:t.glow, copyGlow:d.glow, srcSolid:!!t.lightSolid, copySolid:!!d.lightSolid,
             copySensor:d.body.isSensor }; });
  console.log('   ', JSON.stringify(src));
  ok('a duplicate keeps the light level', src.copyGlow === src.srcGlow, src);
  ok('and keeps the solid setting', src.copySolid === src.srcSolid && !src.copySensor, src);

  const round = await p.evaluate(() => { var d = window.__pg.serialize('g'); window.__pg.load(d);
    var o = window.__pg.objects(); return o.map(function(q){ return q.glow; }).filter(function(g){ return g === 6; }).length; });
  ok('glow survives save and load', round >= 2, round);

  console.log('\n== lights glow by day, reach with their size, and a spotlight shines a cone ==');
  await p.evaluate(() => { window.__pg.setMode('build'); window.__pg.paused(true); window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.deselect(); window.__pg.setStick(true); window.__pg.worldLight(1); });
  await p.waitForTimeout(200);
  await use('light', 1, 'rect');
  await drag([[X-300, Y-40],[X-100, Y]]);          // a big strip
  await drag([[X+200, Y-12],[X+212, Y]]);          // a small dab
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
  await p.mouse.move(1200, 730); await p.waitForTimeout(400);
  const dayNear = await sample(X-200, Y+40), dayFar = await sample(X-200, Y+300);
  ok('by day a light still glows around itself', lum(dayNear) > lum(dayFar) + 6, { dayNear, dayFar });
  const glows = await p.evaluate(() => window.__pg.objects().map(o => window.__pg.glowOf(o.id)).filter(Boolean));
  ok('a bigger light reaches further', glows.length === 2 && Math.max(glows[0].reach, glows[1].reach) > Math.min(glows[0].reach, glows[1].reach) * 1.3, glows);
  await p.evaluate(() => window.__pg.worldLight(0.05)); await p.waitForTimeout(400);
  const bigLit = await sample(X-200, Y+120), smallLit = await sample(X+206, Y+120);
  ok('at night the big one lights further than the small one', lum(bigLit) > lum(smallLit) + 8, { bigLit, smallLit });
  // a spotlight on the floor, pointing up and to the right
  await use('wood', 1, 'rect');
  await drag([[X-300, Y+200],[X+300, Y+240]]);
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('spot'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X, Y+220]);
  const spot = (await p.evaluate(() => window.__pg.gadgets())).filter(g => g.kind === 'spot')[0];
  ok('a spotlight is placed, pointing right by default, 60° wide, reaching 600', !!spot && spot.obj !== null && spot.cone === 60 && spot.reach === 600, spot && { cone: spot.cone, reach: spot.reach });
  await p.evaluate(id => window.__pg.gadgetSet(id, { angle: 0, cone: 40, reach: 500, color: '#80D8FF' }), spot.id);   // straight up, narrow
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); });
  await p.mouse.move(1200, 730); await p.waitForTimeout(400);
  const inCone = await sample(X, Y+40), offCone = await sample(X+250, Y+150);
  ok('inside the cone is lit, beside it is dark', lum(inCone) > lum(offCone) * 1.6, { inCone, offCone });
  ok('and it is lit blue', inCone[2] > inCone[0] + 10, inCone);
  const spots = await p.evaluate(() => window.__pg.spots());
  ok('the cone points straight up in the host\'s frame', spots.length === 1 && Math.abs(Math.cos(spots[0].dir)) < 0.05 && Math.sin(spots[0].dir) < 0, spots);
  // wired to a sensor that is off, it is dark
  await p.evaluate(() => { window.__pg.setTool('sensor'); });
  await p.evaluate(([x,y]) => window.__pg.gadgetAt(x,y), [X-250, Y+220]);
  await p.evaluate(([a, b2]) => window.__pg.wire(a, b2), [(await p.evaluate(() => window.__pg.gadgets())).filter(g => g.kind === 'sensor')[0].id, spot.id]);
  await p.evaluate(() => { window.__pg.setTool('move'); window.__pg.deselect(); window.__pg.paused(false); window.__pg.playerTo(3000, 200); });
  await p.mouse.move(1200, 730); await p.waitForTimeout(500);
  const wiredOff = await sample(X, Y+40);
  ok('wired to a sensor that is off, the beam is off', lum(wiredOff) < lum(inCone) * 0.6 && (await p.evaluate(() => window.__pg.spots())).length === 0, { wiredOff, inCone });
  await p.evaluate(() => window.__pg.paused(true));
  const roundS = await p.evaluate(() => { var d = window.__pg.serialize('s'); window.__pg.load(d); return window.__pg.gadgets().filter(g => g.kind === 'spot')[0]; });
  ok('a spotlight survives save and load with its beam', roundS && roundS.cone === 40 && roundS.reach === 500 && roundS.color === '#80D8FF', roundS && [roundS.cone, roundS.reach, roundS.color]);

  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join('\n') : 'none');
  await b.close();
})();
