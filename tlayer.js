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
  await p.evaluate(() => { window.__pg.freezeCam(); window.__pg.setStick(true); window.__pg.setPaintMode('rect'); });
  const cam = await p.evaluate(() => window.__pg.cam());
  const X = cam.x + 300, Y = cam.y + 250;
  async function drag(pts){
    const s0 = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), pts[0]);
    await p.mouse.move(s0.x, s0.y); await p.mouse.down();
    for (const q of pts.slice(1)){ const s = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), q); await p.mouse.move(s.x, s.y, {steps:6}); }
    await p.mouse.up(); await p.waitForTimeout(160);
  }
  const tool = (t,br) => p.evaluate(([t,br]) => { window.__pg.setTool(t); if(br) window.__pg.setBrush(br); window.__pg.deselect(); }, [t,br]);

  console.log('\n== a shape is the same size on every layer ==');
  const boxes = {};
  for (const layer of [0,1,2]){
    await p.evaluate(l => { window.__pg.setLayer(l); window.__pg.deselect(); }, layer);
    await tool('wood', 1);
    await drag([[X, Y + layer*160],[X+240, Y + layer*160 + 120]]);
    const st = (await p.evaluate(()=>window.__pg.stats())).filter(o=>o.pos.y<2300);
    const o = st[st.length-1];
    boxes[layer] = await p.evaluate(id => window.__pg.bounds(id), o.id);
    console.log('   layer ' + layer + ':', JSON.stringify(boxes[layer]));
  }
  const w = l => boxes[l].x2 - boxes[l].x, h = l => boxes[l].y2 - boxes[l].y;
  ok('back layer is the size you dragged', Math.abs(w(0) - 240) < 1 && Math.abs(h(0) - 120) < 1, boxes[0]);
  ok('mid layer is the size you dragged',  Math.abs(w(1) - 240) < 1 && Math.abs(h(1) - 120) < 1, boxes[1]);
  ok('front layer is the size you dragged',Math.abs(w(2) - 240) < 1 && Math.abs(h(2) - 120) < 1, boxes[2]);

  console.log('\n== you can click a back-layer shape where you see it ==');
  for (const layer of [0,1,2]){
    await p.evaluate(l => window.__pg.setLayer(l), layer);
    const bb = boxes[layer];
    // just inside the top-left corner: under the old 0.88x/1.1x scale this missed
    const hit = await p.evaluate(([x,y]) => { const h = window.__pg.objectAt(x,y,0); return h ? h.obj.layer : null; },
                                 [bb.x + 4, bb.y + 4]);
    ok('layer ' + layer + ' hit-tests at its drawn corner', hit === layer, {layer, hit});
  }

  console.log('\n== clicking overlapping objects picks the top one ==');
  await p.evaluate(() => { window.__pg.clear(); window.__pg.starter(); window.__pg.setLayer(1); window.__pg.deselect(); });
  await p.waitForTimeout(150);
  await tool('metal', 1);                                   // the "plane"
  await drag([[X, Y],[X+400, Y+220]]);
  await p.evaluate(() => window.__pg.deselect());
  await tool('rubber', 1);                                  // the "little dude" on top
  await p.evaluate(() => window.__pg.setPaintMode('brush'));
  await drag([[X+190, Y+90],[X+210, Y+130]]);
  await p.evaluate(() => window.__pg.deselect());
  const stt = (await p.evaluate(()=>window.__pg.stats())).filter(o=>o.pos.y<2300);
  console.log('   objects:', JSON.stringify(stt.map(o=>({id:o.id, pieces:o.pieces}))));
  const picked = await p.evaluate(([x,y]) => { const h = window.__pg.objectAt(x,y,0); return h ? h.materialId : null; }, [X+200, Y+110]);
  ok('clicking the little one picks the little one', picked === 'rubber', picked);

  console.log('\n== a front-layer object does not steal a mid-layer click ==');
  await p.evaluate(() => { window.__pg.setLayer(2); window.__pg.deselect(); window.__pg.setPaintMode('rect'); });
  await tool('ice', 1);
  await drag([[X-40, Y-40],[X+440, Y+260]]);                // big front-layer backdrop over everything
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.deselect(); });
  const picked2 = await p.evaluate(([x,y]) => { const h = window.__pg.objectAt(x,y,0); return h ? h.materialId : null; }, [X+200, Y+110]);
  ok('building on Mid, a Mid click stays on Mid', picked2 === 'rubber', picked2);
  await p.evaluate(() => window.__pg.setLayer(2));
  const picked3 = await p.evaluate(([x,y]) => { const h = window.__pg.objectAt(x,y,0); return h ? h.materialId : null; }, [X+200, Y+110]);
  ok('switch to Front and the same click picks the Front piece', picked3 === 'ice', picked3);

  console.log('');
  console.log('== the layer of what is under Select ==');
  // Still the ice backdrop on Front over the rubber on Mid, from above.
  const label = () => p.evaluate(() => { const e = document.getElementById('hoverLayer'); return e.hidden ? null : e.textContent; });
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('move'); window.__pg.deselect(); });
  const over = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+200, Y+110]);
  await p.mouse.move(over.x, over.y); await p.waitForTimeout(250);
  ok('building on Mid, hovering there says Mid', /Mid/.test((await label()) || ''), await label());
  await p.evaluate(() => window.__pg.setLayer(2));
  await p.mouse.move(over.x + 1, over.y); await p.waitForTimeout(250);
  ok('building on Front, the same spot says Front', /Front/.test((await label()) || ''), await label());
  const nowhere = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+200, Y-400]);
  await p.mouse.move(nowhere.x, nowhere.y); await p.waitForTimeout(250);
  ok('and over nothing it goes away', (await label()) === null, await label());

  console.log('');
  console.log('== peek: the layers in front go faint ==');
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('move'); });
  const a0 = await p.evaluate(() => [0,1,2].map(l => window.__pg.layerAlpha(l)));
  ok('peek off: Front and Mid are solid, Back a little faded as always', a0[2] === 1 && a0[1] === 1 && a0[0] > 0.6, a0);
  await p.keyboard.press('v'); await p.waitForTimeout(100);
  const a1 = await p.evaluate(() => [0,1,2].map(l => window.__pg.layerAlpha(l)));
  ok('V peeks: building on Mid, Front goes faint and Mid and Back do not', a1[2] < 0.3 && a1[1] === 1 && a1[0] === a0[0], a1);
  await p.evaluate(() => window.__pg.setLayer(0));
  const a2 = await p.evaluate(() => [0,1,2].map(l => window.__pg.layerAlpha(l)));
  ok('building on Back, both layers in front go faint', a2[2] < 0.3 && a2[1] < 0.3 && a2[0] === a0[0], a2);
  ok('the Peek button in the layer pill shows it on', await p.evaluate(() => !!document.querySelector('#layerHud button.peek.active, .peek.active')));
  await p.keyboard.press('v'); await p.waitForTimeout(100);
  ok('V again turns it off', (await p.evaluate(() => window.__pg.layerAlpha(2))) === 1);
  // the middle button on a thing hides that thing while held
  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('move'); });
  const mm = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+200, Y+110]);   // the ice on Front over the rubber
  await p.mouse.move(mm.x, mm.y); await p.mouse.down({ button: 'middle' }); await p.waitForTimeout(100);
  const pk = await p.evaluate(() => window.__pg.peekObj());
  ok('holding the middle button on a thing hides that thing', pk !== null, pk);
  await p.mouse.up({ button: 'middle' }); await p.waitForTimeout(100);
  ok('letting go brings it back', (await p.evaluate(() => window.__pg.peekObj())) === null);
  const nowhereM = await p.evaluate(([x,y]) => window.__pg.w2sPage(x,y), [X+600, Y-100]);
  const v0 = await p.evaluate(() => window.__pg.view());
  await p.mouse.move(nowhereM.x, nowhereM.y); await p.mouse.down({ button: 'middle' }); await p.mouse.move(nowhereM.x - 60, nowhereM.y, { steps: 4 }); await p.mouse.up({ button: 'middle' }); await p.waitForTimeout(100);
  ok('on nothing, the middle button still pans', (await p.evaluate(() => window.__pg.peekObj())) === null && (await p.evaluate(() => window.__pg.view())).x !== v0.x);

  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('move'); });
  await p.mouse.move(1180, 700);
  await p.waitForTimeout(400);
  await p.screenshot({ path:'layers.png' });
  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join('\n') : 'none');
  await b.close();
})();
