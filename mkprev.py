"""Build preview.html: the game with the Matter CDN swapped for a local
copy, web fonts stripped, and a window.__pg test hook appended."""
import re
s = open('planet-genesis.html', encoding='utf-8').read()
s = s.replace('https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js', 'matter.min.js')
s = re.sub(r'<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>', '', s)
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
    load: loadLevelData, serialize: serializeLevel,
    clear: function(){ clearAllObjects(); clearWater(); }, starter: starterLevel,
    stats: function(){
      return objects.map(function(o){
        return { id:o.id, layer:o.layer, pieces:o.pieces.map(function(p){ return p.m+':'+pgVertexCount(p.poly)+'v/'+p.poly.length+'i'; }),
                 rings:o.pieces.map(function(p){ return p.poly.map(function(pl){ return pl.length; }); }),
                 parts:o.parts.length, corners:objCorners(o), static:o.body.isStatic, area:Math.round(objArea(o)),
                 pos:{x:Math.round(o.body.position.x),y:Math.round(o.body.position.y)} };
      });
    },
    regionAt: regionAt, objectAt: objectAt,
    selected: function(){ return selected; }, selectedRegion: function(){ return selectedRegion; },
    select: function(o){ selectObject(o); },
    anchor: function(){ anchorSelected(); },
    detachRegion: function(){ detachSelectedRegion(); },
    bolts: function(){ return bolts.map(function(b){ return { id:b.id, x:Math.round(b.point.x), y:Math.round(b.point.y),
      a:b.objA?b.objA.id:null, b:b.objB?b.objB.id:null, mode:b.mode }; }); },
    boltAt: function(x,y){ var bl = placeBoltAt({x:x,y:y}); return bolts.length; },
    deselect: function(){ clearSelection(); },
    selection: function(){ return selList().map(function(o){ return o.id; }); },
    deleteRegion: function(r){ return deleteRegion(r); },
    duplicate: duplicateSelected, flip: flipSelected, rotate: rotateSelected,
    deleteSel: deleteSelected, layerSel: layerSelected, merge: mergeObjects,
    grapple: grappleTargetAt, nudge: nudgeBrush, tool: function(){ return currentTool; },
    touching: function(poly,layer,reach){ return objectsTouching(poly,layer,reach); },
    waterInfo: function(){ return { count: waterCount, minRow: wMinRow, maxRow: wMaxRow }; },
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
