/* ============================================================
   POLYGON GEOMETRY CORE
   ------------------------------------------------------------
   Every painted shape in the game is a real polygon, the way
   LittleBigPlanet stores material: a flat list of corners split
   into loops (one outer contour plus any number of holes), and
   painting, erasing and cutting are boolean union and difference
   on those contours. Not a pile of circles.

   Types, matching polygon-clipping's own:
     Ring       [[x,y], ...]        implicitly closed, no repeated last point
     Poly       [outer, hole, ...]
     MultiPoly  [Poly, ...]         each Poly is one CONNECTED piece

   Winding convention, enforced by pgClean and relied on everywhere:
     outer rings have POSITIVE shoelace, holes NEGATIVE.
   That makes canvas `fill()` (nonzero) do the right thing with
   holes for free, and it is also the order Matter.js wants its
   body vertices in (checked against Bodies.rectangle).
   ============================================================ */
(function(root){
  "use strict";
  var PC = root.polygonClipping;
  var earcut = root.earcut;

  var TAU = Math.PI * 2;

  /* ---- basic ring maths ---------------------------------- */

  // Twice the signed area. Positive = the winding we call "outer".
  function ringArea2(r){
    var s = 0, n = r.length, i, a, b;
    for (i = 0; i < n; i++){
      a = r[i]; b = r[(i + 1) % n];
      s += a[0]*b[1] - b[0]*a[1];
    }
    return s;
  }
  function pgArea(mp){
    var s = 0, i, j, p;
    for (i = 0; i < mp.length; i++){
      p = mp[i];
      for (j = 0; j < p.length; j++) s += ringArea2(p[j]);
    }
    return s / 2;
  }
  function pgVertexCount(mp){
    var n = 0, i, j;
    for (i = 0; i < mp.length; i++)
      for (j = 0; j < mp[i].length; j++) n += mp[i][j].length;
    return n;
  }
  function pgBounds(mp){
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var i, j, k, r, v;
    for (i = 0; i < mp.length; i++)
      for (j = 0; j < mp[i].length; j++){
        r = mp[i][j];
        for (k = 0; k < r.length; k++){
          v = r[k];
          if (v[0] < minX) minX = v[0];
          if (v[0] > maxX) maxX = v[0];
          if (v[1] < minY) minY = v[1];
          if (v[1] > maxY) maxY = v[1];
        }
      }
    if (minX === Infinity) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, x2: maxX, y2: maxY };
  }
  // Area centroid of a single ring. Matter.js recentres a body's vertices
  // on their AREA centroid, so handing it this exact point as the body's
  // position leaves the vertices precisely where we put them.
  function ringCentroid(r){
    var cx = 0, cy = 0, a2 = 0, n = r.length, i, p, q, cr;
    for (i = 0; i < n; i++){
      p = r[i]; q = r[(i+1) % n];
      cr = p[0]*q[1] - q[0]*p[1];
      a2 += cr; cx += (p[0]+q[0])*cr; cy += (p[1]+q[1])*cr;
    }
    if (Math.abs(a2) < 1e-9){
      cx = 0; cy = 0;
      for (i = 0; i < n; i++){ cx += r[i][0]; cy += r[i][1]; }
      return { x: cx/n, y: cy/n };
    }
    return { x: cx/(3*a2), y: cy/(3*a2) };
  }
  function pgCentroid(mp){
    // Area-weighted centroid of the whole multipolygon (holes subtract,
    // because their rings are wound the other way and carry negative area).
    var cx = 0, cy = 0, a2 = 0, i, j, k, r, n, p, q, cr;
    for (i = 0; i < mp.length; i++)
      for (j = 0; j < mp[i].length; j++){
        r = mp[i][j]; n = r.length;
        for (k = 0; k < n; k++){
          p = r[k]; q = r[(k+1) % n];
          cr = p[0]*q[1] - q[0]*p[1];
          a2 += cr;
          cx += (p[0] + q[0]) * cr;
          cy += (p[1] + q[1]) * cr;
        }
      }
    if (Math.abs(a2) < 1e-9){
      var b = pgBounds(mp);
      return b ? { x: b.x + b.w/2, y: b.y + b.h/2 } : { x:0, y:0 };
    }
    return { x: cx / (3*a2), y: cy / (3*a2) };
  }

  /* ---- cleanup ------------------------------------------------
     Run after every boolean. These are exactly the invariants LBP's
     corner editor enforces on the player: corners that land on each
     other are merged, corners that sit in a straight line between
     their neighbours are dropped, and anything under three corners
     stops existing.
     ------------------------------------------------------------ */

  // Douglas-Peucker on a closed ring. Split at the two most distant
  // points first so the ring isn't biased by wherever vertex 0 landed.
  function dpOpen(pts, first, last, tol2, keep){
    var maxD = -1, idx = -1;
    var ax = pts[first][0], ay = pts[first][1];
    var bx = pts[last][0],  by = pts[last][1];
    var dx = bx - ax, dy = by - ay;
    var len2 = dx*dx + dy*dy;
    for (var i = first + 1; i < last; i++){
      var px = pts[i][0] - ax, py = pts[i][1] - ay, d;
      if (len2 < 1e-12){ d = px*px + py*py; }
      else {
        var t = (px*dx + py*dy) / len2;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        var ex = px - t*dx, ey = py - t*dy;
        d = ex*ex + ey*ey;
      }
      if (d > maxD){ maxD = d; idx = i; }
    }
    if (maxD > tol2 && idx > 0){
      dpOpen(pts, first, idx, tol2, keep);
      keep[idx] = 1;
      dpOpen(pts, idx, last, tol2, keep);
    }
  }
  function simplifyRing(r, tol){
    var n = r.length;
    if (n < 8 || tol <= 0) return r;
    // farthest pair from vertex 0 — good enough anchor, O(n)
    var far = 0, fd = -1, i, dx, dy, d;
    for (i = 1; i < n; i++){
      dx = r[i][0]-r[0][0]; dy = r[i][1]-r[0][1]; d = dx*dx+dy*dy;
      if (d > fd){ fd = d; far = i; }
    }
    var open = r.slice(far).concat(r.slice(0, far + 1)); // closed: first == last
    var keep = new Uint8Array(open.length);
    keep[0] = keep[open.length-1] = 1;
    dpOpen(open, 0, open.length-1, tol*tol, keep);
    var out = [];
    for (i = 0; i < open.length - 1; i++) if (keep[i]) out.push(open[i]);
    return out.length >= 3 ? out : r;
  }
  // Drop repeated and straight-through corners.
  function tidyRing(r, weld, straight){
    var n = r.length, out = [], i, p, q;
    for (i = 0; i < n; i++){
      p = r[i]; q = out.length ? out[out.length-1] : null;
      if (q && Math.abs(p[0]-q[0]) < weld && Math.abs(p[1]-q[1]) < weld) continue;
      out.push(p);
    }
    while (out.length > 1){
      p = out[0]; q = out[out.length-1];
      if (Math.abs(p[0]-q[0]) < weld && Math.abs(p[1]-q[1]) < weld) out.pop();
      else break;
    }
    if (out.length < 3) return null;
    // collinear pass, repeated until stable (removing one corner can make
    // its neighbour collinear too)
    var changed = true, guard = 0;
    while (changed && out.length > 3 && guard++ < 8){
      changed = false;
      var res = [];
      for (i = 0; i < out.length; i++){
        var a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
        var ux = b[0]-a[0], uy = b[1]-a[1], vx = c[0]-b[0], vy = c[1]-b[1];
        var cross = ux*vy - uy*vx;
        var len = Math.sqrt((ux*ux+uy*uy) * (vx*vx+vy*vy));
        // perpendicular deviation of b from the line a->c
        if (len > 1e-9 && Math.abs(cross) / Math.sqrt(ux*ux+uy*uy || 1) < straight &&
            Math.abs(cross) / Math.sqrt(vx*vx+vy*vy || 1) < straight){
          changed = true; continue;                     // drop b
        }
        res.push(b);
      }
      if (res.length < 3) return null;
      out = res;
    }
    return out.length >= 3 ? out : null;
  }

  var MIN_RING_AREA = 6;      // px^2 — below this a fragment is a speck
  var MIN_PIECE_AREA = 20;    // px^2 — below this a whole island is noise

  function pgClean(mp, tol){
    if (!mp || !mp.length) return [];
    tol = (tol == null) ? 0.55 : tol;
    var out = [], i, j;
    for (i = 0; i < mp.length; i++){
      var poly = mp[i], rings = [];
      for (j = 0; j < poly.length; j++){
        var r = poly[j];
        // polygon-clipping closes its rings (last == first); drop the repeat
        if (r.length > 1){
          var a = r[0], b = r[r.length-1];
          if (a[0] === b[0] && a[1] === b[1]) r = r.slice(0, r.length-1);
        }
        if (r.length < 3) continue;
        r = simplifyRing(r, tol);
        r = tidyRing(r, 0.02, 0.06);
        if (!r) continue;
        var a2 = ringArea2(r);
        if (Math.abs(a2) / 2 < (j === 0 ? MIN_PIECE_AREA : MIN_RING_AREA)) {
          if (j === 0) { rings.length = 0; break; }      // the island itself is a speck
          continue;                                       // a pinhole; let it close up
        }
        // enforce winding: outer positive, holes negative
        if ((j === 0) !== (a2 > 0)) r = r.slice().reverse();
        rings.push(r);
      }
      if (rings.length) out.push(rings);
    }
    return out;
  }

  /* ---- boolean ops --------------------------------------------
     polygon-clipping is exact-arithmetic and robust, but a
     degenerate input can still throw. Every call is guarded: if the
     op fails we keep the geometry we already had rather than losing
     the player's work.
     ------------------------------------------------------------ */
  function opGuard(fn, fallback){
    try {
      var r = fn();
      return (r && r.length) ? r : [];
    } catch (e){
      if (root.__pgWarn) root.__pgWarn(e);
      return fallback === undefined ? null : fallback;
    }
  }
  function pgUnion(a, b, tol){
    if (!a || !a.length) return pgClean(b || [], tol);
    if (!b || !b.length) return pgClean(a, tol);
    var r = opGuard(function(){ return PC.union(a, b); }, null);
    return r === null ? a : pgClean(r, tol);
  }
  /* Unioning N shapes in one call makes the clipper carry every input's
     corners through a single sweep, which goes quadratic on the sizes we
     hit migrating an old level (1,200 circles took six seconds). Doing it
     as a balanced reduction instead — small groups, cleaned, then groups
     of groups — keeps every individual sweep small AND throws away the
     interior corners at each level, so the work shrinks as it goes. */
  function pgUnionMany(list, tol, chunk){
    list = list.filter(function(m){ return m && m.length; });
    if (!list.length) return [];
    if (list.length === 1) return pgClean(list[0], tol);
    chunk = chunk || 16;
    var guard = 0;
    while (list.length > 1 && guard++ < 40){
      var next = [], i;
      for (i = 0; i < list.length; i += chunk){
        var grp = list.slice(i, i + chunk);
        if (grp.length === 1){ next.push(grp[0]); continue; }
        var r = opGuard(function(){ return PC.union(grp[0], grp.slice(1)); }, null);
        if (r === null){                       // degenerate group: fold pairwise
          var acc = grp[0];
          for (var j = 1; j < grp.length; j++) acc = pgUnion(acc, grp[j], tol);
          next.push(acc);
        } else next.push(pgClean(r, tol));
      }
      if (next.length >= list.length) return pgClean(next[0] || [], tol);
      list = next.filter(function(m){ return m && m.length; });
      if (!list.length) return [];
    }
    return pgClean(list[0], tol);
  }
  function pgDiff(a, b, tol){
    if (!a || !a.length) return [];
    if (!b || !b.length) return pgClean(a, tol);
    var r = opGuard(function(){ return PC.difference(a, b); }, null);
    return r === null ? a : pgClean(r, tol);
  }
  function pgIntersect(a, b, tol){
    if (!a || !a.length || !b || !b.length) return [];
    var r = opGuard(function(){ return PC.intersection(a, b); }, []);
    return pgClean(r || [], tol);
  }
  function pgIntersects(a, b){
    if (!a || !a.length || !b || !b.length) return false;
    var ba = pgBounds(a), bb = pgBounds(b);
    if (!ba || !bb) return false;
    if (ba.x2 < bb.x || bb.x2 < ba.x || ba.y2 < bb.y || bb.y2 < ba.y) return false;
    var r = opGuard(function(){ return PC.intersection(a, b); }, []);
    return !!(r && r.length);
  }

  /* ---- transforms ------------------------------------------- */
  function pgMap(mp, fn){
    var out = [], i, j, k;
    for (i = 0; i < mp.length; i++){
      var poly = [];
      for (j = 0; j < mp[i].length; j++){
        var r = mp[i][j], nr = new Array(r.length);
        for (k = 0; k < r.length; k++) nr[k] = fn(r[k][0], r[k][1]);
        poly.push(nr);
      }
      out.push(poly);
    }
    return out;
  }
  function pgTranslate(mp, dx, dy){
    if (!dx && !dy) return mp;
    return pgMap(mp, function(x, y){ return [x + dx, y + dy]; });
  }
  // Rotate by `ang` about the origin then translate.
  function pgTransform(mp, ang, dx, dy){
    var c = Math.cos(ang), s = Math.sin(ang);
    return pgMap(mp, function(x, y){ return [x*c - y*s + dx, x*s + y*c + dy]; });
  }
  function pgScale(mp, sx, sy, ox, oy){
    ox = ox || 0; oy = oy || 0;
    return pgMap(mp, function(x, y){ return [ox + (x-ox)*sx, oy + (y-oy)*sy]; });
  }
  function pgClone(mp){ return pgMap(mp, function(x,y){ return [x,y]; }); }

  /* ---- hit testing ------------------------------------------ */
  function ringContains(r, x, y){
    var inside = false, n = r.length, i, j, a, b;
    for (i = 0, j = n - 1; i < n; j = i++){
      a = r[i]; b = r[j];
      if (((a[1] > y) !== (b[1] > y)) &&
          (x < (b[0]-a[0]) * (y-a[1]) / (b[1]-a[1]) + a[0])) inside = !inside;
    }
    return inside;
  }
  // Which connected piece of `mp` contains (x,y)? -1 for none.
  function pgPieceAt(mp, x, y){
    for (var i = 0; i < mp.length; i++){
      var poly = mp[i];
      if (!ringContains(poly[0], x, y)) continue;
      var inHole = false;
      for (var j = 1; j < poly.length; j++) if (ringContains(poly[j], x, y)){ inHole = true; break; }
      if (!inHole) return i;
    }
    return -1;
  }
  function pgContains(mp, x, y){ return pgPieceAt(mp, x, y) >= 0; }
  function seg2(px, py, ax, ay, bx, by){
    var dx = bx-ax, dy = by-ay, l2 = dx*dx+dy*dy, t;
    if (l2 < 1e-12) t = 0; else {
      t = ((px-ax)*dx + (py-ay)*dy) / l2;
      if (t < 0) t = 0; else if (t > 1) t = 1;
    }
    var ex = px - (ax + t*dx), ey = py - (ay + t*dy);
    return ex*ex + ey*ey;
  }
  // Distance from (x,y) to the nearest edge. Signed is not needed —
  // callers pair this with pgContains.
  function pgEdgeDist(mp, x, y, cap){
    var best = cap != null ? cap*cap : Infinity, i, j, k, r, n;
    for (i = 0; i < mp.length; i++)
      for (j = 0; j < mp[i].length; j++){
        r = mp[i][j]; n = r.length;
        for (k = 0; k < n; k++){
          var a = r[k], b = r[(k+1) % n];
          var d = seg2(x, y, a[0], a[1], b[0], b[1]);
          if (d < best) best = d;
        }
      }
    return Math.sqrt(best);
  }
  // Cheap "is this point anywhere near" pre-filter.
  function pgNear(mp, x, y, slack){
    var b = pgBounds(mp);
    if (!b) return false;
    return x >= b.x - slack && x <= b.x2 + slack && y >= b.y - slack && y <= b.y2 + slack;
  }

  /* ---- the brush ---------------------------------------------
     A brush footprint is a convex ring. A DRAGGED brush covers the
     Minkowski sum of that ring with the drag segment, and for a
     convex ring that is exactly the convex hull of the ring stamped
     at both ends — so a straight drag produces a mathematically
     straight edge, which is the whole point.
     ------------------------------------------------------------ */
  function circleRing(x, y, r, quality){
    // Segment count from the sagitta error, so a small brush is cheap
    // and a huge one still reads as round.
    var err = quality || 0.25;
    var n;
    if (r <= err) n = 3;
    else n = Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - err / r)));
    if (n < 10) n = 10; if (n > 64) n = 64;
    if (n & 1) n++;                 // even, so a capsule's two half-arcs meet
    var ring = new Array(n);
    for (var i = 0; i < n; i++){
      var a = i / n * TAU;
      ring[i] = [x + Math.cos(a)*r, y + Math.sin(a)*r];
    }
    return ringArea2(ring) > 0 ? ring : ring.reverse();
  }
  function brushRing(shape, x, y, r, ang, quality){
    var pts, i;
    if (shape === "square") pts = [[-r,-r],[r,-r],[r,r],[-r,r]];
    else if (shape === "diamond") pts = [[0,-r],[r,0],[0,r],[-r,0]];
    else return circleRing(x, y, r, quality);
    var c = Math.cos(ang||0), s = Math.sin(ang||0), out = new Array(pts.length);
    for (i = 0; i < pts.length; i++) out[i] = [x + pts[i][0]*c - pts[i][1]*s, y + pts[i][0]*s + pts[i][1]*c];
    return ringArea2(out) > 0 ? out : out.reverse();
  }
  // Monotone-chain hull, emitted with positive winding.
  function hull(pts){
    if (pts.length < 3) return pts.slice();
    pts = pts.slice().sort(function(a,b){ return a[0]-b[0] || a[1]-b[1]; });
    function cr(o,a,b){ return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]); }
    var lo = [], up = [], i;
    for (i = 0; i < pts.length; i++){
      while (lo.length >= 2 && cr(lo[lo.length-2], lo[lo.length-1], pts[i]) <= 0) lo.pop();
      lo.push(pts[i]);
    }
    for (i = pts.length-1; i >= 0; i--){
      while (up.length >= 2 && cr(up[up.length-2], up[up.length-1], pts[i]) <= 0) up.pop();
      up.push(pts[i]);
    }
    lo.pop(); up.pop();
    var h = lo.concat(up);
    if (h.length < 3) return h;
    return ringArea2(h) > 0 ? h : h.reverse();
  }
  // The exact area swept by `shape` dragged from a to b.
  function sweepRing(shape, ax, ay, bx, by, r, ang, quality){
    var dx = bx-ax, dy = by-ay;
    if (dx*dx + dy*dy < 1e-6) return brushRing(shape, ax, ay, r, ang, quality);
    if (shape === "circle" || !shape){
      /* A capsule, built directly rather than hulled: the two sides run
         along the drag, and each end is half of the brush circle. Both
         half-arcs turn the same way as the sides they join, so the ring
         is simple — an arc that turned the other way would fold the
         capsule into a bowtie and the "cut" would come out ragged. */
      var len = Math.sqrt(dx*dx + dy*dy);
      var nx = -dy/len, ny = dx/len;              // left normal
      var n = circleRing(0, 0, r, quality).length, half = n/2, out = [], i, t;
      var a0 = Math.atan2(ny, nx);
      // round the far end, sweeping THROUGH the direction of travel
      for (i = 0; i <= half; i++){
        t = a0 - i/half*Math.PI;
        out.push([bx + Math.cos(t)*r, by + Math.sin(t)*r]);
      }
      // and the near end, sweeping back through the reverse direction
      for (i = 0; i <= half; i++){
        t = a0 - Math.PI - i/half*Math.PI;
        out.push([ax + Math.cos(t)*r, ay + Math.sin(t)*r]);
      }
      var tidy = tidyRing(out, 0.02, 0.02) || out;
      return ringArea2(tidy) > 0 ? tidy : tidy.reverse();
    }
    return hull(brushRing(shape, ax, ay, r, ang, quality)
          .concat(brushRing(shape, bx, by, r, ang, quality)));
  }
  /* Thin a drag path down to the corners that actually matter before any
     geometry is built. The pointer reports a position every few pixels,
     so a straight drag arrives as two hundred nearly-identical points;
     collapsing those to the two ends is the difference between a stroke
     that costs 200 boolean ops and one that costs 1 — and it is also why
     a straight drag comes out as a mathematically straight edge instead
     of two hundred slightly different ones. */
  function thinPath(pts, tol){
    if (pts.length < 3) return pts;
    var keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length-1] = 1;
    dpOpen(pts, 0, pts.length-1, tol*tol, keep);
    var out = [], i;
    for (i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }
  /* A whole stroke as ONE multipolygon. Each segment contributes the
     exact area the brush swept over it, so the outline is the true
     envelope of the drag rather than a chain of separate stamps. */
  function strokePoly(pts, shape, r, ang, tol, quality){
    if (!pts.length) return [];
    var dot = function(){ return pgClean([[brushRing(shape, pts[0][0], pts[0][1], r, ang, quality)]], tol); };
    if (pts.length === 1) return dot();
    pts = thinPath(pts, Math.min(0.4, r * 0.05));
    if (pts.length === 1) return dot();
    var parts = [], i;
    for (i = 1; i < pts.length; i++){
      var ring = sweepRing(shape, pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1], r, ang, quality);
      if (ring.length >= 3) parts.push([[ring]]);
    }
    if (!parts.length) return dot();
    return pgUnionMany(parts, tol);
  }

  /* ---- convex decomposition for physics ----------------------
     earcut triangulates with holes natively, then Hertel-Mehlhorn
     merges the triangles back into as few convex pieces as it can.
     A hillside that used to be 1,172 circle bodies comes out as a
     few dozen convex parts.
     ------------------------------------------------------------ */
  function isConvexRing(pts, maxV){
    var n = pts.length;
    if (maxV && n > maxV) return false;
    var sign = 0, i;
    for (i = 0; i < n; i++){
      var a = pts[i], b = pts[(i+1)%n], c = pts[(i+2)%n];
      var cr = (b[0]-a[0])*(c[1]-b[1]) - (b[1]-a[1])*(c[0]-b[0]);
      if (Math.abs(cr) < 1e-9) continue;
      if (sign === 0) sign = cr > 0 ? 1 : -1;
      else if ((cr > 0 ? 1 : -1) !== sign) return false;
    }
    return true;
  }
  /* Bigger convex parts are strictly better for the physics engine:
     collision cost is (parts of A) x (parts of B) pairs, and one 20-gon
     beats six triangles even though it has more axes to project onto. */
  var MAX_PART_VERTS = 24;
  function decomposePoly(poly){
    // poly = [outer, hole...] with our winding convention
    var coords = [], holes = [], i, j, r;
    for (i = 0; i < poly.length; i++){
      r = poly[i];
      if (i > 0) holes.push(coords.length / 2);
      for (j = 0; j < r.length; j++){ coords.push(r[j][0], r[j][1]); }
    }
    var tris;
    try { tris = earcut(coords, holes.length ? holes : null, 2); }
    catch (e){ return []; }
    if (!tris || tris.length < 3) return [];
    var pt = function(k){ return [coords[k*2], coords[k*2+1]]; };

    var faces = [], k;
    for (k = 0; k < tris.length; k += 3){
      var f = [tris[k], tris[k+1], tris[k+2]];
      var A = pt(f[0]), B = pt(f[1]), C = pt(f[2]);
      var s = (B[0]-A[0])*(C[1]-A[1]) - (B[1]-A[1])*(C[0]-A[0]);
      if (Math.abs(s) < 1e-7) continue;                 // slivers help nobody
      if (s < 0) f = [f[0], f[2], f[1]];                // force positive winding
      faces.push(f);
    }
    if (!faces.length) return [];

    // union-find over faces so an edge always resolves to the face that
    // currently owns it, however many merges have happened
    var parent = new Int32Array(faces.length);
    for (i = 0; i < faces.length; i++) parent[i] = i;
    function find(a){ while (parent[a] !== a){ parent[a] = parent[parent[a]]; a = parent[a]; } return a; }

    // map every directed edge to its original face
    var edge = new Map();
    for (i = 0; i < faces.length; i++){
      var fc = faces[i];
      for (j = 0; j < fc.length; j++) edge.set(fc[j] + "," + fc[(j+1)%fc.length], i);
    }
    // Hertel-Mehlhorn: drop an internal edge whenever the two faces either
    // side of it merge into something still convex. One pass is the classic
    // formulation, but the result depends heavily on the order edges are
    // visited, and a couple of extra passes keep finding merges that the
    // first pass's ordering ruled out — for a few percent more time it
    // routinely halves the part count.
    var keys = Array.from(edge.keys());
    var e, key, sp, u, v, oi, f1, f2, A2, B2, iA, iB, merged, pass, didMerge;
    for (pass = 0; pass < 4; pass++){
      didMerge = false;
      for (e = 0; e < keys.length; e++){
        key = keys[e]; sp = key.indexOf(",");
        u = +key.slice(0, sp); v = +key.slice(sp+1);
        oi = edge.get(v + "," + u);
        if (oi === undefined) continue;                   // boundary edge
        f1 = find(edge.get(key)); f2 = find(oi);
        if (f1 === f2) continue;                          // already one face
        A2 = faces[f1]; B2 = faces[f2];
        if (A2.length + B2.length - 2 > MAX_PART_VERTS) continue;
        iA = -1; iB = -1;
        for (i = 0; i < A2.length; i++) if (A2[i] === u && A2[(i+1)%A2.length] === v){ iA = i; break; }
        for (i = 0; i < B2.length; i++) if (B2[i] === v && B2[(i+1)%B2.length] === u){ iB = i; break; }
        if (iA < 0 || iB < 0) continue;
        merged = [];
        for (i = 0; i < A2.length; i++) merged.push(A2[(iA + 1 + i) % A2.length]);   // v ... u
        for (i = 0; i < B2.length - 2; i++) merged.push(B2[(iB + 2 + i) % B2.length]);
        if (!isConvexRing(merged.map(pt), MAX_PART_VERTS)) continue;
        faces[f1] = merged;
        parent[f2] = f1;
        didMerge = true;
      }
      if (!didMerge) break;
      keys.reverse();                    // opposite order finds different merges
    }
    var out = [], seen = {};
    for (i = 0; i < faces.length; i++){
      var root2 = find(i);
      if (seen[root2]) continue;
      seen[root2] = 1;
      var verts = faces[root2].map(pt);
      var t = tidyRing(verts, 0.01, 0.02);
      if (t && t.length >= 3 && ringArea2(t) > 2) out.push(t);
    }
    return out;
  }
  // Every convex part of a whole multipolygon.
  function pgConvexParts(mp){
    var out = [], i, k;
    for (i = 0; i < mp.length; i++){
      var parts = decomposePoly(mp[i]);
      for (k = 0; k < parts.length; k++) out.push(parts[k]);
    }
    return out;
  }

  /* ---- pieces ------------------------------------------------ */
  // A MultiPoly already IS the list of connected pieces — each entry is
  // one outer contour with its own holes — so splitting is free.
  function pgPieces(mp){
    var out = [], i;
    for (i = 0; i < mp.length; i++) out.push([mp[i]]);
    return out;
  }

  /* ---- serialisation -----------------------------------------
     Quantised to 1/8 px and delta-encoded, which is what turns a
     hillside from ~91KB of circle records into a few KB of corners.
     ------------------------------------------------------------ */
  function pgPack(mp){
    // [ [ringLen,...], x0,y0, dx,dy, ... ]  all integers at 1/8 px
    var lens = [], nums = [], i, j, k;
    for (i = 0; i < mp.length; i++){
      var poly = mp[i];
      lens.push(-poly.length);                 // negative marks a new piece
      for (j = 0; j < poly.length; j++){
        var r = poly[j];
        lens.push(r.length);
        var px = 0, py = 0;
        for (k = 0; k < r.length; k++){
          var x = Math.round(r[k][0] * 8), y = Math.round(r[k][1] * 8);
          nums.push(x - px, y - py);
          px = x; py = y;
        }
      }
    }
    return { l: lens, d: nums };
  }
  var UNPACK_MAX_CORNERS = 40000;
  function pgUnpack(o, budget){
    if (!o || !Array.isArray(o.l) || !Array.isArray(o.d)) return [];
    var cap = Math.min(budget || UNPACK_MAX_CORNERS, UNPACK_MAX_CORNERS);
    var mp = [], li = 0, di = 0, px = 0, py = 0, used = 0;
    while (li < o.l.length){
      var nRings = -o.l[li++];
      if (!(nRings > 0) || nRings > 4096) return mp;
      var poly = [];
      for (var j = 0; j < nRings && li < o.l.length; j++){
        var n = o.l[li++];
        if (!(n >= 3) || n > cap - used) return mp;
        used += n;
        var r = new Array(n);
        px = 0; py = 0;
        for (var k = 0; k < n; k++){
          var dx = +o.d[di++], dy = +o.d[di++];
          if (!isFinite(dx) || !isFinite(dy)) return mp;
          px += dx; py += dy;
          if (Math.abs(px) > 1e8 || Math.abs(py) > 1e8) return mp;
          r[k] = [px/8, py/8];
        }
        poly.push(r);
      }
      if (poly.length) mp.push(poly);
    }
    return mp;
  }

  var API = {
    ringArea2: ringArea2, pgArea: pgArea, pgBounds: pgBounds, pgCentroid: pgCentroid,
    ringCentroid: ringCentroid, ringBounds: function(r){ return pgBounds([[r]]); },
    pgVertexCount: pgVertexCount, pgClean: pgClean,
    pgUnion: pgUnion, pgUnionMany: pgUnionMany, pgDiff: pgDiff,
    pgIntersect: pgIntersect, pgIntersects: pgIntersects,
    pgTranslate: pgTranslate, pgTransform: pgTransform, pgScale: pgScale,
    pgClone: pgClone, pgMap: pgMap,
    ringContains: ringContains, pgContains: pgContains, pgPieceAt: pgPieceAt,
    pgEdgeDist: pgEdgeDist, pgNear: pgNear,
    circleRing: circleRing, brushRing: brushRing, sweepRing: sweepRing,
    strokePoly: strokePoly, hull: hull, thinPath: thinPath,
    pgConvexParts: pgConvexParts, decomposePoly: decomposePoly, pgPieces: pgPieces,
    pgPack: pgPack, pgUnpack: pgUnpack,
    simplifyRing: simplifyRing, tidyRing: tidyRing
  };
  for (var k2 in API) root[k2] = API[k2];
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : global);
