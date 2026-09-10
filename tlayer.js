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

  await p.evaluate(() => { window.__pg.setLayer(1); window.__pg.setTool('move'); });
  await p.mouse.move(1180, 700);
  await p.waitForTimeout(400);
  await p.screenshot({ path:'layers.png' });
  console.log('\n' + (fail ? 'FAILED '+fail+' of ' : 'ALL ') + (pass+fail) + ' checks');
  console.log('errors:', errs.length ? errs.slice(0,6).join('\n') : 'none');
  await b.close();
})();
