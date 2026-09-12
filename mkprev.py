"""Build preview.html: the game with the Matter CDN swapped for a local
copy, web fonts stripped, and a window.__pg test hook appended."""
import re
s = open('planet-genesis.html', encoding='utf-8').read()
s = s.replace('https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js', 'matter.min.js')
s = re.sub(r'<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>', '', s)
# The suites were written on the 4800 x 2400 map and their scenes sit where
# that map's floor was; tenv.js pins every suite page to it through these
# two keys (pg_test_world_w / _h) unless pg_test_real_world is set. The
# shipping file has no such switch: it is rewritten into the preview only.
WORLD_LINE = 'var WORLD_W = 19200, WORLD_H = 9600;'
assert WORLD_LINE in s, 'the world size line moved'
s = s.replace(WORLD_LINE, "var WORLD_W = +localStorage.getItem('pg_test_world_w') || 19200, WORLD_H = +localStorage.getItem('pg_test_world_h') || 9600;")
HOOK = """
  window.__pg = {
    objects: function(){ return objects; },
    G: { pgArea:pgArea, pgVertexCount:pgVertexCount, pgBounds:pgBounds, pgContains:pgContains },
    cam: function(){ return { x:camX, y:camY, s:camScale }; },
    w2s: worldToScreen,
    w2sPage: function(x, y){ var q = worldToScreen(x, y), r = canvas.getBoundingClientRect(); return { x: q.x + r.left, y: q.y + r.top }; },
    setTool: function(t){ currentTool = t; canvas.dataset.tool = t; },
    setLayer: function(l){ buildLayer = l; },
    setBrush: function(v){ paintScale = v; },
    setBrushShape: function(sh){ paintShape = sh; },
    setPaintMode: function(m){ paintMode = m; },
    setStick: function(v){ stickPaint = !!v; },
    freezeCam: function(){ camFollow = false; },
    zoomTo: function(z, x, y){ camFollow = false; camZoom = z; applyCamScale(); camX = x - viewRectW/camScale/2; camY = y - viewRectH/camScale/2; clampCamNow(); },
    setMode: setMode, mode: function(){ return mode; },
    load: loadLevelData, serialize: serializeLevel, autosave: autosaveNow,
    charState: function(){ return { crouching: crouching, sliding: sliding, anim: charPoseId() }; },
    setPaintAlpha: function(v){ paintAlpha = v; },
    stickerDraft: function(){ openStickerDraft(); return !charEditorOverlay.hidden; },
    matDraft: function(){ openMaterialDraft(); return !charEditorOverlay.hidden; },
    myMats: function(){ return myMats.map(function(id){ var d = customMats[id]; return { id: id, name: d.name, tilePx: d.tilePx, friction: d.friction, restitution: d.restitution, density: d.density, grabbable: d.grabbable, hazard: d.hazard, floats: d.floats }; }); },
    matSet: function(id, props){ var d = customMats[id]; if (!d) return false; for (var k in props) d[k] = props[k]; customMatChanged(id); persistMyMats(); return true; },
    matForget: function(id){ myMats = myMats.filter(function(x){ return x !== id; }); persistMyMats(); },
    matKnown: function(id){ return !!customMats[id]; },
    matColour: function(id){ var r = matOf(id); return r ? r.color : null; },
    stickers: function(){ return (mySkins.sticker || []).map(function(s){ return { id: s.id, name: s.name }; }); },
    pickSticker: function(id){ var e = (mySkins.sticker || []).find(function(s){ return s.id === id; }); if (!e) return false; stickerPick = e; currentTool = "sticker"; canvas.dataset.tool = "sticker"; return true; },
    stickerHitAt: function(x, y){ var g = gadgetAt(x, y); return g ? g.id : null; },
    objAlpha: function(id, v){ var o = objects.find(function(o){ return o.id === id; }); if (!o) return null; if (v != null) o.alpha = v; return o.alpha == null ? 1 : o.alpha; },
    peekObj: function(){ return peekObj ? peekObj.id : null; },
    peek: function(v){ if (v != null && !!v !== layerPeek) togglePeek(); return layerPeek; },
    layerAlpha: function(l){ return layerDepth(l).a; },
    enclosedArea: function(x, y){ var r = enclosedRegionAt(x, y, buildLayer); return r ? Math.round(Math.abs(pgArea(r))) : 0; },
    enclosedAreaOn: function(x, y, l){ var r = enclosedRegionAt(x, y, l); return r ? Math.round(Math.abs(pgArea(r))) : 0; },
    clear: function(){ clearAllObjects(); clearWater(); }, starter: starterLevel,
    stats: function(){
      return objects.map(function(o){
        return { id:o.id, layer:o.layer, pieces:o.pieces.map(function(p){ return p.m+':'+pgVertexCount(p.poly)+'v/'+p.poly.length+'i'; }),
                 rings:o.pieces.map(function(p){ return p.poly.map(function(pl){ return pl.length; }); }),
                 parts:o.parts.length, corners:objCorners(o), static:o.body.isStatic, area:Math.round(objArea(o)),
                 alpha:o.alpha == null ? 1 : o.alpha,
                 areaBy:o.pieces.reduce(function(acc,p){ var k = p.m.split(':')[0]; acc[k] = (acc[k]||0) + Math.abs(pgArea(p.poly)); return acc; }, {}),
                 pos:{x:Math.round(o.body.position.x),y:Math.round(o.body.position.y)}, angle:+o.body.angle.toFixed(3),
                 bounds:{x:Math.round(o.body.bounds.min.x),y:Math.round(o.body.bounds.min.y),x2:Math.round(o.body.bounds.max.x),y2:Math.round(o.body.bounds.max.y)}, sensor:!!o.body.isSensor };
      });
    },
    regionAt: regionAt, objectAt: objectAt,
    selected: function(){ return selected; }, selectedRegion: function(){ return selectedRegion; },
    select: function(o){ selectObject(o); },
    anchor: function(){ anchorSelected(); },
    detachRegion: function(){ detachSelectedRegion(); },
    bolts: function(){ return bolts.map(function(b){ var wp = boltWorldPoint(b); return { id:b.id, x:Math.round(wp.x), y:Math.round(wp.y),
      a:b.objA?b.objA.id:null, b:b.objB?b.objB.id:null, mode:b.mode, layer:b.layer, speed:b.speed, tightness:b.tightness,
      kind:b.kind, dir:b.dir, strength:b.strength, angle:b.angle, period:b.period, visible:b.visible, limit:b.limit, minA:b.minA, maxA:b.maxA }; }); },
    flip: function(){ flipSelected(); },
    boltAt: function(x,y){ var bl = placeBoltAt({x:x,y:y}); return bolts.length; },
    boltSet: function(id, props){ var b = bolts.filter(function(q){ return q.id===id; })[0]; if (!b) return false;
      if (props.kind) setBoltKind(b, props.kind);
      for (var k in props){ if (k === 'kind') continue; if (k === 'stiffness' || k === 'damping') b.constraint[k] = props[k]; else b[k] = props[k]; }
      applyBoltMode(b); return true; },
    boltPairAt: function(x, y){ var pr = boltPairAt(x, y); return pr ? { front: pr.front.id, partner: pr.partner.id, layer: pr.layer } : null; },
    boltRel: function(id){ var b = bolts.filter(function(q){ return q.id===id; })[0]; return b ? +(relAngle(b)*180/Math.PI).toFixed(1) : null; },
    fling: function(vx, vy){ if (player) Body.setVelocity(player, { x:vx, y:vy }); },
    worldSize: function(){ return { w: WORLD_W, h: WORLD_H }; },
    view: function(){ return { x: camX, y: camY, w: viewRectW / camScale, h: viewRectH / camScale, zoom: camZoom }; },
    boltGap: function(id){ var b = bolts.filter(function(q){ return q.id===id; })[0]; if (!b || !b.constraint) return null;
      var pa = toWorldPoint(b.constraint.bodyA, b.constraint.pointA), pb = toWorldPoint(b.constraint.bodyB, b.constraint.pointB);
      return +Math.hypot(pa.x-pb.x, pa.y-pb.y).toFixed(2); },
    paused: function(v){ if (v != null) setPaused(!!v); return !runner.enabled; },
    engineSet: function(k, v){ engine[k] = v; return engine[k]; },
    timing: function(){ return { lastDelta: engine.timing.lastDelta, timeScale: engine.timing.timeScale, runnerDelta: runner.delta, isFixed: runner.isFixed, fps: runner.fps, dh: (runner.deltaHistory||[]).slice(-5) }; },
    stepRate: function(ms){ return new Promise(function(res){ var n = 0, f = function(){ n++; }; Events.on(engine, 'afterUpdate', f); setTimeout(function(){ Events.off(engine, 'afterUpdate', f); res(n * 1000 / ms); }, ms); }); },
    gadgets: function(){ return gadgets.map(function(g){ var wp = gadgetWorld(g); return { id:g.id, kind:g.kind, x:Math.round(wp.x), y:Math.round(wp.y), layer:g.layer,
      out:g.out, on:g.on, radius:g.radius, size:g.size, sticky:g.sticky, springs:g.springs, visible:g.visible, obj:g.obj?g.obj.id:null, input:g.input, scale:g.scale||1,
      zoom:g.zoom, tracking:g.tracking, speed:g.speed, hold:g.hold, holdMode:g.holdMode, holdForever:g.holdForever, once:g.once, shake:g.shake, freeze:g.freeze, sweep:g.sweep ? { dx:g.sweep.dx, dy:g.sweep.dy, zoom:g.sweep.zoom, secs:g.sweep.secs } : null,
      zone:g.zone ? { dx:g.zone.dx, dy:g.zone.dy, w:g.zone.w, h:g.zone.h } : null, view:g.view ? { dx:g.view.dx, dy:g.view.dy } : null,
      line:g.line ? { dx:g.line.dx, dy:g.line.dy } : null, bounce:g.bounce, u:g.u, home:g.home,
      setLight:g.setLight, light:g.light, setWater:g.setWater, water:g.water, secs:g.secs, latch:g.latch, latched:g.latched,
      range:g.range, fly:g.fly, deadly:g.deadly, weakMode:g.weakMode, color:g.color, look:g.look, weakArea: g.weak ? +Math.abs(pgArea(g.weak)).toFixed(1) : 0, dangerArea: g.danger ? +Math.abs(pgArea(g.danger)).toFixed(1) : 0,
      width: g.width, reach: g.reach, strength: g.strength, rot: g.rot, flipX: g.flipX,
      hasSkin: !!(g.skin && skinHasArt(g.skin)), actionMode: g.actionMode, ghost: g.ghost, face: g.face, rate: g.rate, pspeed: g.pspeed, life: g.life, psize: g.psize,
      alpha: g.alpha, drawnFacing: g.drawnFacing, dying: g.dying, art: g.art ? { x:g.art.x, y:g.art.y, w:g.art.w, h:g.art.h } : null, hitStrokes: g.hitbox ? g.hitbox.length : 0 }; }); },
    skinStudioAt: function(id, step){ var g = gadgetById(id); if (!g) return false; openSkinStudio(g, step); return !charEditorOverlay.hidden; },
    refreshHost: function(id){ var g = gadgetById(id); if (g && g.obj) refreshObjectPhysics(g.obj); return !!g; },
    skinStudio: function(id){ var g = gadgetById(id); if (!g) return false; openSkinStudio(g); return !charEditorOverlay.hidden; },
    skinState: function(id){ var g = gadgetById(id); return g ? skinStateFor(g) : null; },
    sprites: function(){ return sprites.length; },
    skinOf: function(id){ var g = gadgetById(id); return g && g.skin ? packSkin(g.skin) : null; },
    setSkin: function(id, sk){ var g = gadgetById(id); if (!g) return false; g.skin = normalizeSkin(sk, g.kind); return true; },
    maskPaint: function(){ return maskPaint ? { g: maskPaint.g.id, kind: maskPaint.kind } : null; },
    beginMask: function(id, kind){ var g = gadgetById(id); if (!g) return false; selectGadget(g); beginMaskPaint(g, kind); return true; },
    endMask: function(){ endMaskPaint(); },
    liveWorld: function(){ return { light: liveLight(), water: liveWater() }; },
    moverDraft: function(){ return moverDraft ? moverDraft.id : null; },
    flying: function(){ return flying; },
    studio: function(cmd, a, b){
      if (cmd === 'open'){ openCharEditor(); return !charEditorOverlay.hidden; }
      if (cmd === 'close'){ closeCharEditor(); return charEditorOverlay.hidden; }
      if (cmd === 'drawing'){ return JSON.parse(JSON.stringify(ceTargetDrawing())); }
      if (cmd === 'where'){ return { state: pmEditState, frame: pmEditFrame, frames: ceFramesOf(pmEditState).length, mode: charMode, tool: ceTool, color: pmPaintColor, symmetry: ceSymmetry, zoom: +ceZoom.toFixed(3), playing: cePlaying, fps: charFps[pmEditState] }; }
      if (cmd === 'go'){ pmEditState = a; pmEditFrame = b || 0; renderCharEditorPanels(); ceLayout(); return true; }
      if (cmd === 'canvasRect'){ var r = ceCanvas.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
      if (cmd === 'chips'){ return Array.from(ceModeRowEl.querySelectorAll('button')).map(function(b){ return b.textContent; }); }
      if (cmd === 'click'){ var btn = Array.from(charEditorOverlay.querySelectorAll('button')).find(function(x){ return x.textContent.trim() === a; }); if (btn){ btn.click(); return true; } return false; }
      if (cmd === 'size'){ if (ceSubject.setSize) ceSubject.setSize(a, b); renderCharEditorPanels(); ceLayout(); return ceSubject.g ? { w: ceSubject.g.art.w, h: ceSubject.g.art.h } : null; }
      if (cmd === 'cursor'){ return ceCursor ? { x: +ceCursor.x.toFixed(3), y: +ceCursor.y.toFixed(3) } : null; }
      if (cmd === 'history'){ return { undo: ceHistory.undo.length, redo: ceHistory.redo.length }; }
      if (cmd === 'setColor'){ pmPaintColor = a; return pmPaintColor; }
      if (cmd === 'set'){ if (a === 'tool') ceTool = b; if (a === 'symmetry') ceSymmetry = !!b; if (a === 'opacity') ceOpacity = b; if (a === 'smooth') ceSmooth = !!b; renderCharEditorPanels(); return true; }
      return null;
    },
    menu: function(section){ if (section === null){ closePersonalMenu(); return false; } pmActiveSection = section; pmActivePage = null; openPersonalMenu(); return pmOpen; },
    camShot: function(id){ var g = gadgetById(id); return g && g.kind === 'camera' ? cameraShotRect(g) : null; },
    edCam: function(){ return edCam ? { zoom: edCam.zoom } : null; },
    camEdit: function(){ return { held: camEditHeld, left: Math.round(camEditUntil - performance.now()), wanted: worldPagePreviewWanted(), section: pmActiveSection, open: pmOpen }; },
    worldSet: function(k, v){ worldSettings[k] = v; applyWorldSettings(); return worldSettings[k]; },
    worldGet: function(k){ return worldSettings[k]; },
    camFollowing: function(){ return camFollow; },
    playCam: function(){ return { active: playCam.active ? playCam.active.id : null, easing: playCam.easing, cx: playCam.cx, cy: playCam.cy, zoom: playCam.zoom }; },
    mode: function(){ return mode; },
    s2wPage: function(px, py){ return screenToWorld(px, py); },
    nearLever: function(){ var g = leverNearPlayer(); return g ? g.id : null; },
    links: function(){ return links.map(function(l){ var e = linkEnds(l); return { id:l.id, kind:l.kind, a:l.objA.id, b:l.objB.id, ax:Math.round(e.a.x), ay:Math.round(e.a.y), bx:Math.round(e.b.x), by:Math.round(e.b.y),
      layer:l.layer, min:l.min, max:l.max, time:l.time, pause:l.pause, stiff:l.stiff, flipper:l.flipper, going:l.going, len:+l.len.toFixed(1), length:l.length, visible:l.visible, input:l.input,
      span:+Math.hypot(e.b.x-e.a.x, e.b.y-e.a.y).toFixed(1), segs:l.segs?l.segs.length:0 }; }); },
    linkAt: function(x,y){ placeLinkAt({x:x,y:y}); return links.length; },
    linkDraft: function(){ return linkDraft ? linkDraft.obj.id : null; },
    linkSet: function(id, props){ var l = linkById(id); if (!l) return false; for (var k in props){ if (k === 'length'){ setRopeLength(l, props[k]); } else if (k === 'stiff'){ setPistonStiff(l, !!props[k]); } else l[k] = props[k]; } return true; },
    ropePoints: function(id){ var l = linkById(id); return l && l.segs ? ropePoints(l).map(function(q){ return [Math.round(q.x), Math.round(q.y)]; }) : null; },
    selectLink: function(id){ var l = linkById(id); if (l){ selectLink(l); opWanted = true; renderSelBar(); } },
    linkDebug: function(id){ var l = linkById(id); if (!l || !l.constraint) return null; var c = l.constraint;
      return { A:{ x:+c.bodyA.position.x.toFixed(2), y:+c.bodyA.position.y.toFixed(2), ang:+c.bodyA.angle.toFixed(4), pt:[+c.pointA.x.toFixed(2), +c.pointA.y.toFixed(2)], angA:+(c.angleA||0).toFixed(4), st:c.bodyA.isStatic },
               B:{ x:+c.bodyB.position.x.toFixed(2), y:+c.bodyB.position.y.toFixed(2), ang:+c.bodyB.angle.toFixed(4), pt:[+c.pointB.x.toFixed(2), +c.pointB.y.toFixed(2)], angB:+(c.angleB||0).toFixed(4), st:c.bodyB.isStatic },
               ref: l.stiffRef ? { rod:+l.stiffRef.rodAng0.toFixed(4), base:+l.stiffRef.baseAng0.toFixed(4), rel:+l.stiffRef.relAng0.toFixed(4), tgtIsA:l.stiffRef.tgtIsA } : null, len:l.len }; },
    setFlying: function(v){ setFlying(!!v); return flying; },
    gadgetAt: function(x,y){ placeGadgetAt({x:x,y:y}); return gadgets.length; },
    gadgetSet: function(id, props){ var g = gadgetById(id); if (!g) return false; for (var k in props) g[k] = props[k]; return true; },
    wire: function(fromId, toId){ return addWire(gadgetById(fromId), receiverById(toId)); },
    wires: function(){ return wires.slice(); },
    playerTo: function(x, y){ if (player){ Body.setPosition(player, {x:x,y:y}); Body.setVelocity(player, {x:0,y:0}); } },
    boltInput: function(id){ var b = boltById(id); return b ? b.input : undefined; },
    selectGadget: function(id){ var g = gadgetById(id); if (g){ selectGadget(g); opWanted = true; renderSelBar(); } },
    wiring: function(){ return wiring ? wiring.from.id : null; },
    boltGapTrue: function(id){ var b = bolts.filter(function(q){ return q.id===id; })[0]; if (!b || !b.constraint) return null;
      var c = b.constraint, pa = { x:c.bodyA.position.x + c.pointA.x, y:c.bodyA.position.y + c.pointA.y };
      var pb = { x:c.bodyB.position.x + c.pointB.x, y:c.bodyB.position.y + c.pointB.y };
      return { gap:+Math.hypot(pa.x-pb.x, pa.y-pb.y).toFixed(2), armAngleDeg:+(c.bodyB.angle*180/Math.PI).toFixed(1),
               drawnAt: boltWorldPoint(b), trueAt: pb }; },
    deselect: function(){ clearSelection(); },
    selection: function(){ return selList().map(function(o){ return o.id; }); },
    deleteRegion: function(r){ return deleteRegion(r); },
    duplicate: duplicateSelected, flip: flipSelected, rotate: rotateSelected,
    deleteSel: deleteSelected, layerSel: layerSelected, merge: mergeObjects,
    grabbing: function(){ return !!grabConstraint || !!carried; }, carrying: function(){ return carried ? carried.id : null; }, grab: function(v){ setGrabHeld(!!v); return !!grabConstraint || !!carried; },
    setGrabbable: function(id, v){ var o = objects.filter(function(q){ return q.id===id; })[0]; if (o) o.grabbable = v; return !!o; },
    grabTarget: function(){ var t = grabTarget(); return t ? { obj: t.obj.id, hold: t.hold } : null; },
    holdOverlap: function(){ var o = carried || (grabConstraint && grabConstraint.bodyB.plugin && grabConstraint.bodyB.plugin.obj); if (!o || !player || !o.body) return null;
      var cs = Query.collides(player, [o.body]), d = 0; cs.forEach(function(c){ if (c.depth > d) d = c.depth; }); return +d.toFixed(1); },
    playerVel: function(){ return player ? { x:+player.velocity.x.toFixed(2), y:+player.velocity.y.toFixed(2) } : null; },
    nudge: nudgeBrush, tool: function(){ return currentTool; },
    touching: function(poly,layer,reach){ return objectsTouching(poly,layer,reach); },
    waterInfo: function(){ return { count: waterCount, minRow: wMinRow, maxRow: wMaxRow }; },
    waterTimed: function(n){ var t0 = performance.now(); for (var i = 0; i < n; i++) stepWater(); var t1 = performance.now(); for (var j = 0; j < n; j++) rebuildWaterSolid(true); var t2 = performance.now();
      ctx.save(); for (var k = 0; k < n; k++) drawMaterialWater(); ctx.restore(); var t3 = performance.now();
      return { step: +((t1 - t0) / n).toFixed(2), solid: +((t2 - t1) / n).toFixed(2), draw: +((t3 - t2) / n).toFixed(2) }; },
    pour: function(x, y, r, amt){ addWaterAt(x, y, r, amt); return waterCount; },
    waterLevelAt: function(x, y){ var i = waterIndexAt(x, y); return i < 0 ? null : +waterLevels[i].toFixed(4); },
    waterTotal: function(){ var t = 0; for (var i = 0; i < WCELLS; i++) t += waterLevels[i]; return +t.toFixed(3); },
    spawnY: function(){ return checkpoints[0].y; },
    brush: function(){ return { shape: paintShape, r: paintRadius(), mode: paintMode, layer: buildLayer }; },
    bounds: function(id){ var o = objects.filter(function(q){ return q.id===id; })[0]; if(!o) return null;
      var b=o.body.bounds; return {x:+b.min.x.toFixed(2),y:+b.min.y.toFixed(2),x2:+b.max.x.toFixed(2),y2:+b.max.y.toFixed(2)}; },
    worldLight: function(v){ if (v != null) worldSettings.light = v; return worldSettings.light; },
    matOf: matOf, matKey: matKey,
    setSolidLight: function(v){ var o = selList()[0] || objects[objects.length-1];
      o.lightSolid = !!v; rebuildFromPieces(o); if (objects.indexOf(o)>=0) refreshObjectPhysics(o); return o.id; },
    setLightFalls: function(v){ var o = selList()[0] || objects[objects.length-1];
      o.lightFalls = !!v; refreshObjectPhysics(o); return o.id; },
    lightState: function(){ var o = objects[objects.length-1];
      return { id:o.id, solid:!!o.lightSolid, falls:!!o.lightFalls, sensor:o.body.isSensor,
               still:o.body.isStatic, parts:o.parts.length, forced:!!o.forcedStatic }; },
    lightWorld: function(){ var o = objects.filter(function(q){ return q.allGlow; })[0]; if(!o) return null;
      var L = objectLights(o)[0]; var b=o.body, ca=Math.cos(b.angle), sa=Math.sin(b.angle);
      return { x: L.x*ca - L.y*sa + b.position.x, y: L.x*sa + L.y*ca + b.position.y }; },
    pixel: function(x, y){ var c = canvas.getContext('2d');
      var d = c.getImageData(Math.round(x*dpr), Math.round(y*dpr), 1, 1).data;
      return [d[0], d[1], d[2]]; },
    brightest: function(){ var c = canvas.getContext('2d');
      var d = c.getImageData(0,0,canvas.width,canvas.height).data, best=-1, bx=0, by=0;
      for (var i=0;i<d.length;i+=4){ var L=d[i]+d[i+1]+d[i+2]; if (L>best){best=L; var px=(i/4)|0; bx=px%canvas.width; by=(px/canvas.width)|0;} }
      return { x:+(bx/dpr).toFixed(1), y:+(by/dpr).toFixed(1), lum:best }; },
    playerPos: function(){ return player ? { x:player.position.x, y:player.position.y } : null; },
    playerSize: function(){ return { w: PW, h: PH, scale: charScale, art: charArt, parts: player ? player.parts.length : 0 }; },
    setCharScale: function(v){ setCharScale(v); return charScale; },
    setCharHit: function(strokes){ setCharHit(strokes); return { w: PW, h: PH, parts: player ? player.parts.length : 0 }; },
    objMass: function(id){ var o = objects.filter(function(q){ return q.id===id; })[0]; if (!o || !o.body) return null; var b = o.body; return b.isStatic ? (b._original ? b._original.mass : Infinity) : b.mass; },
    objWeight: function(id){ var o = objects.filter(function(q){ return q.id===id; })[0]; return o ? (o.weight == null ? 1 : o.weight) : null; },
    playerMass: function(){ return player ? player.mass : null; },
    openBox: function(id){ var o = objects.filter(function(q){ return q.id===id; })[0]; if (!o) return false; selectObject(o); opWanted = true; renderSelBar(); return !objPanelEl.hidden; },
    ctxOpen: function(){ return !objPanelEl.hidden; },
    holes: function(){ return objects.map(function(o){ return o.pieces.map(function(p){ return p.poly.map(function(pl){ return pl.slice(1).map(function(h){ return h.length; }); }); }); }); },
    undo: undo, redo: redo
  };
})();
</script>"""
old = "})();\n</script>"
assert s.count(old) == 1, s.count(old)
open('preview.html', 'w', encoding='utf-8').write(s.replace(old, HOOK))
print("preview.html", len(s))
