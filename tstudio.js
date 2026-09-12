/* The studio: drawing strokes, undo and redo, the tools an artist wants,
   frames and playback, and no rig mode.  node tstudio.js */
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
  const st = (cmd, a, b2) => p.evaluate(([c, x, y]) => window.__pg.studio(c, x, y), [cmd, a, b2]);
  const drawing = () => st('drawing');
  const where = () => st('where');
  // a stroke on the canvas from one fraction of it to another
  const stroke = async (fx0, fy0, fx1, fy1, mods) => {
    const r = await st('canvasRect');
    const a = { x: r.x + r.w * fx0, y: r.y + r.h * fy0 }, c = { x: r.x + r.w * fx1, y: r.y + r.h * fy1 };
    if (mods) await p.keyboard.down(mods);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 8 }); await p.mouse.up();
    if (mods) await p.keyboard.up(mods);
    await p.waitForTimeout(80);
  };

  console.log('');
  console.log('== the studio opens; the rig mode is gone ==');
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload(); await p.waitForTimeout(1100);
  ok('it opens', await st('open'));
  const chips = await st('chips');
  ok('two kinds of character: Simple and Animated', chips.length === 2 && chips.includes('Simple') && chips.includes('Animated') && !chips.some(c => /Simple Animated/.test(c)), chips);
  await st('click', 'Animated');
  ok('Animated is picked', (await where()).mode === 'animated');
  ok('a fresh character opens on the Size step', (await where()).state === 'size', (await where()).state);
  await st('go', 'idle', 0);
  ok('and a fresh frame is empty', (await drawing()).length === 0);

  console.log('');
  console.log('== strokes, undo and redo ==');
  await stroke(0.3, 0.3, 0.7, 0.6);
  ok('a drag draws a stroke', (await drawing()).length === 1 && (await drawing())[0].p.length > 4, await drawing());
  await stroke(0.2, 0.7, 0.8, 0.7);
  ok('and another', (await drawing()).length === 2);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  ok('Ctrl+Z takes the last one back', (await drawing()).length === 1, await st('history'));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  ok('and the one before', (await drawing()).length === 0);
  await p.keyboard.press('Control+y'); await p.waitForTimeout(80);
  ok('Ctrl+Y brings one back', (await drawing()).length === 1);
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(80);
  ok('Ctrl+Shift+Z brings the other', (await drawing()).length === 2);
  await st('click', 'Clear'); await p.waitForTimeout(80);
  ok('Clear empties the frame', (await drawing()).length === 0);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  ok('and is undone like anything else', (await drawing()).length === 2);

  console.log('');
  console.log('== the tools ==');
  await st('click', 'Clear');
  await stroke(0.2, 0.2, 0.8, 0.8, 'Shift');
  const ln = await drawing();
  ok('Shift makes a straight line: two points only', ln.length === 1 && ln[0].p.length === 4, ln[0] && ln[0].p.length);
  await st('click', 'Clear');
  await st('set', 'symmetry', true);
  await stroke(0.2, 0.3, 0.4, 0.5);
  const sym = await drawing();
  ok('symmetry draws the stroke and its mirror', sym.length === 2 && Math.abs((1 - sym[0].p[0]) - sym[1].p[0]) < 0.001, sym.map(s => s.p.slice(0, 2)));
  await st('set', 'symmetry', false);
  await st('click', 'Clear');
  await st('set', 'opacity', 0.5);
  await stroke(0.3, 0.3, 0.6, 0.3);
  ok('opacity goes on the stroke', Math.abs((await drawing())[0].a - 0.5) < 0.001, (await drawing())[0]);
  await st('set', 'opacity', 1);
  await st('setColor', '#123456');
  await stroke(0.3, 0.5, 0.6, 0.5);
  ok('any colour goes on the stroke', (await drawing())[1].c === '#123456');
  // the eyedropper reads it back
  await st('setColor', '#ffffff');
  await st('set', 'tool', 'pick');
  const r = await st('canvasRect');
  await p.mouse.click(r.x + r.w * 0.45, r.y + r.h * 0.5); await p.waitForTimeout(80);
  ok('the eyedropper picks the colour off the drawing', (await where()).color === '#123456', (await where()).color);
  ok('and hands back the brush', (await where()).tool === 'brush');
  await st('setColor', null);
  await stroke(0.3, 0.5, 0.6, 0.5);
  ok('the eraser is a stroke with no colour', (await drawing())[2].c === null);
  await p.keyboard.press('b');
  ok('B is back to the brush with a colour', (await where()).color !== null);
  await p.keyboard.press('e');
  ok('E is the eraser', (await where()).color === null);
  await p.keyboard.press('b');
  // zoom about the cursor, and the drawing is untouched
  const before = await drawing();
  await p.mouse.move(r.x + r.w * 0.5, r.y + r.h * 0.5); await p.mouse.wheel(0, -200); await p.waitForTimeout(100);
  ok('the wheel zooms the stage', (await where()).zoom > 1.1, (await where()).zoom);
  ok('and the drawing is untouched', JSON.stringify(await drawing()) === JSON.stringify(before));
  await p.keyboard.press('0');
  ok('0 zooms back out', (await where()).zoom === 1);

  console.log('');
  console.log('== frames ==');
  await st('go', 'run', 0);
  ok('Run starts with two frames', (await where()).frames === 2);
  await st('click', 'Clear'); await stroke(0.2, 0.2, 0.5, 0.5);
  await st('click', '+ copy');
  ok('"+ copy" adds a copy after this one and moves to it', (await where()).frames === 3 && (await where()).frame === 1 && (await drawing()).length === 1, await where());
  await st('click', '+ blank');
  ok('"+ blank" adds an empty frame', (await where()).frames === 4 && (await drawing()).length === 0);
  await st('click', '◀ move');
  ok('it can be moved earlier', (await where()).frame === 1 && (await drawing()).length === 0);
  await st('click', '✕');
  ok('and deleted', (await where()).frames === 3);
  for (let i = 0; i < 50; i++) await st('click', '+ blank');
  ok('a state can have 48 frames', (await where()).frames === 48, (await where()).frames);
  const fAt = (await where()).frame;
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
  ok('the arrow keys step through them', (await where()).frame === fAt - 2, { from: fAt, now: (await where()).frame });
  await p.keyboard.press('p'); await p.waitForTimeout(700);
  const w1 = await where();
  ok('P plays them at the state\'s speed', w1.playing && w1.frame !== 45, w1);
  await p.keyboard.press('p');
  await st('close');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('pg_char_frame_counts')));
  ok('the frame count is saved', saved && saved.run === 48, saved);
  const fps = await p.evaluate(() => JSON.parse(localStorage.getItem('pg_char_fps')));
  ok('with a speed per state', fps && fps.run === 8 && fps.idle === 2, fps);

  console.log('');
  console.log('== the brush shows itself, filled shapes, nudge, flip, the keys ==');
  await st('open'); await p.waitForTimeout(150);
  await st('go', 'idle', 0); await st('click', 'Clear');
  const r2 = await st('canvasRect');
  await p.mouse.move(r2.x + r2.w * 0.5, r2.y + r2.h * 0.5); await p.waitForTimeout(80);
  ok('the pointer over the stage has a brush ring under it', (await st('cursor')) !== null, await st('cursor'));
  // a filled box
  await p.keyboard.press('r');
  ok('R picks the filled box', (await where()).tool === 'rect', (await where()).tool);
  await stroke(0.2, 0.2, 0.6, 0.5);
  let d = await drawing();
  ok('dragging one out makes a filled shape with four corners', d.length === 1 && d[0].f === true && d[0].p.length === 8, d[0] && { f: d[0].f, n: d[0].p.length });
  await p.keyboard.press('c');
  await stroke(0.3, 0.6, 0.7, 0.9);
  d = await drawing();
  ok('C is the filled oval', d.length === 2 && d[1].f === true && d[1].p.length >= 40, d[1] && { f: d[1].f, n: d[1].p.length });
  await p.keyboard.press('k');
  const lr = await st('canvasRect');
  await p.mouse.move(lr.x + lr.w*0.7, lr.y + lr.h*0.2); await p.mouse.down();
  for (const q of [[0.9,0.2],[0.9,0.5],[0.7,0.5]]) await p.mouse.move(lr.x + lr.w*q[0], lr.y + lr.h*q[1], { steps: 4 });
  await p.mouse.up(); await p.waitForTimeout(80);
  d = await drawing();
  ok('K is the lasso: draw round an area and it fills', d.length === 3 && d[2].f === true && d[2].p.length >= 8, d[2] && { f: d[2].f, n: d[2].p.length });
  await p.keyboard.press('b');
  // nudge and flip
  const beforeN = await drawing();
  await p.keyboard.press('Shift+ArrowRight'); await p.waitForTimeout(60);
  d = await drawing();
  ok('Shift+right nudges the whole frame a touch right', Math.abs(d[0].p[0] - (beforeN[0].p[0] + 0.01)) < 1e-6, { before: beforeN[0].p[0], after: d[0].p[0] });
  await p.keyboard.press('v'); await p.waitForTimeout(60);
  d = await drawing();
  ok('V flips it upside down', Math.abs(d[0].p[1] - (1 - beforeN[0].p[1])) < 1e-6, { before: beforeN[0].p[1], after: d[0].p[1] });
  const beforeScale = await drawing();
  await st('click', '◐ Smaller'); await p.waitForTimeout(60);
  d = await drawing();
  ok('Smaller shrinks the frame about its centre', Math.abs(d[0].p[0] - 0.5) < Math.abs(beforeScale[0].p[0] - 0.5), { before: beforeScale[0].p[0], after: d[0].p[0] });
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  ok('and every one of those is undone like a stroke', JSON.stringify(await drawing()) === JSON.stringify(beforeN));
  // the keys can be changed
  await st('click', '⚙ Settings'); await p.waitForTimeout(80);
  ok('the Settings card off the header lists the brush on B', await p.evaluate(() => Array.from(document.querySelectorAll('.ceKeyRow')).some(r => /Brush/.test(r.textContent) && /^B$/i.test(r.querySelector('button').textContent.trim()))));
  await p.evaluate(() => { const row = Array.from(document.querySelectorAll('.ceKeyRow')).find(r => /^Line/.test(r.textContent.trim())); row.querySelector('button').click(); });
  await p.waitForTimeout(60);
  await p.keyboard.press('q'); await p.waitForTimeout(80);
  await p.keyboard.press('q'); await p.waitForTimeout(60);
  ok('the line tool can be put on Q, and Q then picks it', (await where()).tool === 'line', (await where()).tool);
  ok('and the change is remembered', (await p.evaluate(() => JSON.parse(localStorage.getItem('pg_ce_keys')).line)) === 'q');
  await st('click', 'Back to the usual keys'); await p.waitForTimeout(60);
  ok('back to the usual keys puts it on L', (await p.evaluate(() => (JSON.parse(localStorage.getItem('pg_ce_keys') || '{}').line || 'l'))) === 'l');
  ok('the colour wheel is a labelled control', await p.evaluate(() => /Colour wheel/.test(document.querySelector('.cePickWrap').textContent)));
  await st('close');

  console.log('');
  console.log('== the bucket: fill an outline, fill round an island, recolour, erase ==');
  await st('open'); await p.waitForTimeout(150);
  await st('go', 'idle', 0); await st('click', 'Clear');
  // a ring drawn with the oval tool twice: a big filled oval, then a smaller one erased out of it — a hoop with a hole
  await st('setColor', '#2B6CB0');
  await p.keyboard.press('c'); await stroke(0.15, 0.2, 0.85, 0.8);
  await p.keyboard.press('e'); await p.keyboard.press('c'); await stroke(0.3, 0.35, 0.7, 0.65);
  await p.keyboard.press('b'); await st('setColor', '#E8567A');
  ok('F picks the bucket', (await p.keyboard.press('f'), (await where()).tool === 'fill'), (await where()).tool);
  const rF = await st('canvasRect');
  await p.mouse.click(rF.x + rF.w * 0.5, rF.y + rF.h * 0.5); await p.waitForTimeout(150);      // inside the hoop's hole
  let dF = await drawing();
  const last = dF[dF.length - 1];
  ok('a click inside the hole fills it: a filled shape, in the colour', dF.length === 3 && last.f === true && last.c === '#E8567A', last && { f: last.f, c: last.c, n: last.p.length });
  ok('that stays inside the hoop: its outline reaches no further than the hole', last.p.filter((v, i) => i % 2 === 0).every(x => x > 0.27 && x < 0.73), last.p.filter((v, i) => i % 2 === 0).sort()[0]);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  ok('and it is one undo', (await drawing()).length === 2);
  // outside the hoop: the rest of the box, with the hoop as a hole in it
  await p.mouse.click(rF.x + rF.w * 0.05, rF.y + rF.h * 0.05); await p.waitForTimeout(150);
  dF = await drawing(); const outerFill = dF[dF.length - 1];
  ok('a click outside fills the rest of the box, with the hoop cut out as a hole', outerFill.f === true && Array.isArray(outerFill.h) && outerFill.h.length >= 1, outerFill && { h: outerFill.h && outerFill.h.length });
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  // on the hoop itself: it recolours the hoop
  await p.mouse.click(rF.x + rF.w * 0.5, rF.y + rF.h * 0.24); await p.waitForTimeout(150);
  dF = await drawing(); const recol = dF[dF.length - 1];
  ok('a click on the blue hoop paints the hoop pink, hole and all', recol.f === true && recol.c === '#E8567A' && Array.isArray(recol.h) && recol.h.length === 1, recol && { c: recol.c, h: recol.h && recol.h.length });
  // the eraser bucket clears an area
  await p.keyboard.press('e'); await p.keyboard.press('f');
  await p.mouse.click(rF.x + rF.w * 0.5, rF.y + rF.h * 0.24); await p.waitForTimeout(150);
  dF = await drawing(); const er = dF[dF.length - 1];
  ok('with the eraser, the bucket clears the area it is clicked on', er.f === true && er.c === null, er && { c: er.c, f: er.f });
  await p.keyboard.press('b');
  await st('close');

  console.log('');
  console.log('== the size: twice the old by default, any size, and a drawn hitbox ==');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pg_test_real_size', '1'); }); await p.reload(); await p.waitForTimeout(1100);   // the suites pin the old size; this one wants the real default
  const sz = await p.evaluate(() => window.__pg.playerSize());
  ok('a fresh character is twice the old size: 80 by 112', sz.w === 80 && sz.h === 112 && sz.scale === 2, sz);
  await st('open'); await p.waitForTimeout(150);
  ok('the studio opens on the Size step first', (await where()).state === 'size', (await where()).state);
  const chipsS = await p.evaluate(() => Array.from(document.querySelectorAll('#ceLeft .ceChips button')).map(b => b.textContent));
  const headsS = await p.evaluate(() => Array.from(document.querySelectorAll('#ceLeft h4')).map(b => b.textContent));
  ok('in order: 1. your size, 2. draw your look, then the hitbox', /^1\./.test(headsS[0]) && /^2\./.test(headsS[1]) && /Size/.test(chipsS[0]) && chipsS.some(c => /3\..*Hitbox/.test(c)), { heads: headsS, chips: chipsS });
  await p.evaluate(() => window.__pg.setCharScale(1.5)); await p.waitForTimeout(100);
  ok('any size: 1.5 makes 60 by 84', (await p.evaluate(() => window.__pg.playerSize())).h === 84, await p.evaluate(() => window.__pg.playerSize()));
  const nx = await p.evaluate(() => Array.from(document.querySelectorAll('#ceLeft button')).map(b => b.textContent).find(t => /^Next:/.test(t)));
  ok('Next goes on to the look', /Idle/.test(nx || ''), nx);
  await st('click', nx);
  await st('setColor', '#E8567A'); await stroke(0.2, 0.2, 0.8, 0.8);
  const nx2 = await p.evaluate(() => Array.from(document.querySelectorAll('#ceLeft button')).map(b => b.textContent).find(t => /^Next:/.test(t)));
  ok('and then to the hitbox', /Hitbox/.test(nx2 || ''), nx2);
  await st('click', nx2);
  await stroke(0.5, 0.3, 0.5, 0.7);                                  // a thin bar down the middle: a much smaller body than the box
  await st('close'); await p.waitForTimeout(200);
  const sz2 = await p.evaluate(() => window.__pg.playerSize());
  ok('closing rebuilds the body from the drawn hitbox: narrower than the box, in parts', sz2.w < 30 && sz2.h < 84 && sz2.parts >= 2, sz2);
  ok('while the picture keeps its full size around it', sz2.art && sz2.art.w === 60 && sz2.art.h === 84, sz2.art);
  ok('the hitbox is remembered', (await p.evaluate(() => JSON.parse(localStorage.getItem('pg_char_hit')).length)) === 1);
  // a drawn body still stands on the ground and jumps: the engine reports its parts, not it
  await p.evaluate(() => window.__pg.playerTo(400, 2200)); await p.waitForTimeout(900);
  const y0 = (await p.evaluate(() => window.__pg.playerPos())).y;
  await p.keyboard.press('Space'); await p.waitForTimeout(250);
  const y1 = (await p.evaluate(() => window.__pg.playerPos())).y;
  ok('with a drawn hitbox the character still jumps off the floor', y1 < y0 - 30, { before: y0, after: y1 });
  await p.evaluate(() => window.__pg.setCharHit([])); await p.waitForTimeout(100);
  const sz3 = await p.evaluate(() => window.__pg.playerSize());
  ok('with no hitbox drawn the body is the drawing itself — the diagonal stroke, not the box round it', sz3.w < 58 && sz3.h < 82 && sz3.parts >= 2, sz3);
  await st('open'); await p.waitForTimeout(150); await st('go', 'idle', 0); await st('click', 'Clear'); await st('close'); await p.waitForTimeout(150);
  const sz4 = await p.evaluate(() => window.__pg.playerSize());
  ok('and with nothing drawn at all, the rounded box', sz4.w === 60 && sz4.h === 84 && sz4.parts === 1, sz4);
  // "use my drawing" on the hitbox step copies the look across
  await st('open'); await p.waitForTimeout(150); await st('go', 'idle', 0); await st('setColor', '#E8567A'); await stroke(0.3, 0.5, 0.7, 0.5);
  await st('go', 'hitbox', 0); await st('click', '✨ Use my drawing as the hitbox'); await p.waitForTimeout(100);
  const hitCopy = await drawing();
  ok('Use my drawing puts the look on the hitbox step, in the hitbox colour', hitCopy.length === 1 && hitCopy[0].c === '#4FA9D6' && Math.abs(hitCopy[0].p[1] - 0.5) < 0.01, hitCopy);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  ok('and is one undo', (await drawing()).length === 0);
  await st('close');
  // the frame strip keeps its size however full the left column is
  await st('open'); await p.waitForTimeout(150); await st('click', 'Animated'); await st('go', 'idle', 0); await p.waitForTimeout(100);
  const frH = await p.evaluate(() => { const f = document.querySelector('.ceFrameStrip .fr'); return f ? f.getBoundingClientRect().height : 0; });
  ok('the frame thumbnails on the left keep their full height', frH >= 40, frH);
  await st('close');

  console.log('');
  console.log(fail ? `FAILED ${fail} of ${pass+fail} checks` : `ALL ${pass} checks`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
