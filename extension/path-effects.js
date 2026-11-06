const VectorPathEffects = (() => {
  const G=VectorGeometry, C=ClipperLib, scale=1024;
  const intPath = pts => pts.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)}));
  function contours(shape) {
    if (!shape.fill || shape.paths.some(p=>!p.closed))
      throw Error("Select closed, filled paths for this effect. Outline strokes first.");
    return shape.paths.map(p=>intPath(G.flatten(p,0.2)));
  }
  function clip(subject,mask,evenodd) {
    const op=new C.Clipper(), out=[];
    op.AddPaths(subject,C.PolyType.ptSubject,true);
    if (mask) op.AddPath(mask,C.PolyType.ptClip,true);
    const fill=evenodd ? C.PolyFillType.pftEvenOdd : C.PolyFillType.pftNonZero;
    op.Execute(mask ? C.ClipType.ctIntersection : C.ClipType.ctUnion,out,fill,C.PolyFillType.pftNonZero);
    return out;
  }
  const fromInts = rings => rings.map(r=>G.polygon(r.map(p=>[p.X/scale,p.Y/scale])));
  const joins={Round:"jtRound",Miter:"jtMiter",Bevel:"jtSquare"};
  // Positive distances shrink the filled area; holes grow. Returns nonzero-oriented rings.
  function shrink(rings,distance,join="Round") {
    const offset=new C.ClipperOffset(3,0.18*scale), out=[];
    offset.AddPaths(rings,C.JoinType[joins[join]],C.EndType.etClosedPolygon);
    offset.Execute(out,-distance*scale);
    return out;
  }
  function offsetRings(shape,distance,join="Round") {
    return shrink(clip(contours(shape),null,shape.evenodd),distance,join).map(r=>r.map(p=>[p.X/scale,p.Y/scale]));
  }
  // Clips straight segments to a filled shape; returns the inside pieces as [[x,y],[x,y]].
  function clipLines(shape,segments) {
    const op=new C.Clipper(), tree=new C.PolyTree();
    for (const s of segments) op.AddPath(intPath(s),C.PolyType.ptSubject,false);
    op.AddPaths(contours(shape),C.PolyType.ptClip,true);
    const fill=shape.evenodd ? C.PolyFillType.pftEvenOdd : C.PolyFillType.pftNonZero;
    op.Execute(C.ClipType.ctIntersection,tree,C.PolyFillType.pftNonZero,fill);
    return C.Clipper.OpenPathsFromPolyTree(tree).filter(p=>p.length>=2)
      .map(p=>[p[0],p[p.length-1]].map(q=>[q.X/scale,q.Y/scale]));
  }
  function inset(shapes,v) {
    const result=[],K=VectorPaint,steps=v.steps||1,target=v.target ? K.hex(v.target) : null;
    for (const shape of shapes) {
      contours(shape);
      if (!v.distance) { result.push(shape); continue; }
      // Each step is a further ring, blended a step closer to the target colour.
      for (let i=1;i<=steps;i++) {
        const rings=offsetRings(shape,v.distance*i/steps,v.join),t=(v.blend||0)/100*i/steps;
        if (!rings.length) break;
        const painted=t ? K.changeInks(shape,c=>K.tint(c,target,t)) : shape;
        result.push({...painted,paths:rings.map(G.polygon),evenodd:false});
      }
    }
    if (!result.length) throw Error("The inset consumes the artwork. Reduce the distance or use a negative value to expand it.");
    return result;
  }
  // Intersect the bounding rectangle with the bisectors separating neighboring seeds.
  function cellFor(site,sites,b) {
    let ring=[[b.x0-1,b.y0-1],[b.x1+1,b.y0-1],[b.x1+1,b.y1+1],[b.x0-1,b.y1+1]];
    for (const other of sites) {
      if (other===site) continue;
      const dx=other[0]-site[0],dy=other[1]-site[1];
      const mid=G.mix(site,other,0.5);
      const side=p=>(p[0]-mid[0])*dx+(p[1]-mid[1])*dy;
      const cut=[];
      for (let i=0;i<ring.length;i++) {
        const a=ring[i],q=ring[(i+1)%ring.length],da=side(a),dq=side(q);
        if (da<=0) cut.push(a);
        if ((da<0 && dq>0)||(da>0 && dq<0)) cut.push(G.mix(a,q,da/(da-dq)));
      }
      ring=cut;
    }
    return intPath(ring);
  }
  function shatter(shapes,v,b) {
    // Gravity and colour jitter draw from their own streams so earlier fractures are unchanged.
    const rand=G.random(v.seed), fall=G.random(v.seed+104729), shade=G.random(v.seed+7919), sites=[], result=[];
    const K=VectorPaint;
    const originals=shapes.map(contours);
    for (let i=0;i<v.pieces;i++) sites.push([b.x0+rand()*b.w,b.y0+rand()*b.h]);
    const center=[b.x0+b.w*v.cx/100,b.y0+b.h*v.cy/100],reach=4*Math.max(1,b.w,b.h);
    const rays=sites.map((_,i)=>(i+rand()*0.5)*2*Math.PI/sites.length);
    const ray=(a,r)=>[center[0]+r*Math.cos(a),center[1]+r*Math.sin(a)];
    for (let index=0;index<sites.length;index++) {
      let site=sites[index],mask;
      if (v.fracture==="Radial") {
        const a=rays[index],next=index+1<rays.length ? rays[index+1] : rays[0]+2*Math.PI;
        // The outer polyline encloses the bounds even when a wedge spans half a turn.
        const vertices=[center];
        for (let j=0;j<=6;j++) vertices.push(ray(a+(next-a)*j/6,reach));
        mask=intPath(vertices);site=ray((a+next)/2,Math.max(1,b.w,b.h)/3);
      } else mask=cellFor(site,sites,b);
      const theta=(2*rand()-1)*v.spin*Math.PI/180;
      const dx=(site[0]-center[0])/(Math.max(1,b.w)/2)*v.spread;
      const dy=(site[1]-center[1])/(Math.max(1,b.h)/2)*v.spread;
      const drop=v.gravity ? v.gravity*(0.5+0.5*fall()) : 0;
      const jitter=v.jitter ? (2*shade()-1)*v.jitter/100 : 0;
      const recolor=s=>jitter ? K.changeInks(s,c=>K.tint(c,jitter>0 ? K.white : K.ink,Math.abs(jitter)*0.6)) : s;
      const move=(x,y)=>[site[0]+dx+(x-site[0])*Math.cos(theta)-(y-site[1])*Math.sin(theta),
        site[1]+dy-drop+(x-site[0])*Math.sin(theta)+(y-site[1])*Math.cos(theta)];
      shapes.forEach((shape,i)=>{
        let rings=clip(originals[i],mask,shape.evenodd);
        if (v.gap && rings.length) rings=shrink(rings,v.gap/2,"Miter");
        if (rings.length) result.push(recolor({...shape,evenodd:false,paths:fromInts(rings).map(p=>G.mapPath(p,move))}));
      });
    }
    return result;
  }
  function point(path,v) {
    const pts=path.points.map(p=>p.slice()), n=pts.length;
    const i=v.index-1;
    if (i>=n) return path;
    const p=pts[i],prev=pts[(i+n-1)%n],next=pts[(i+1)%n];
    if (v.mode==="Subdivide") {
      if (!path.closed && i===n-1) return path;
      const [a,b]=G.split(G.cubic(p,next));
      p.splice(4,2,...a[1]); next.splice(2,2,...b[2]);
      pts.splice(i+1,0,[...a[3],...a[2],...b[1]]);
    } else if (v.mode==="Smooth") {
      const before=(!path.closed && i===0) ? p : prev;
      const after=(!path.closed && i===n-1) ? p : next;
      const len=G.dist(before,after)||1,ux=(after[0]-before[0])/len,uy=(after[1]-before[1])/len;
      const l=G.dist(before,p)/3,r=G.dist(after,p)/3;
      p.splice(2,4,p[0]-ux*l,p[1]-uy*l,p[0]+ux*r,p[1]+uy*r);
    } else if (v.mode==="Corner") {
      p.splice(2,4,p[0],p[1],p[0],p[1]);
    } else {
      const offsets=v.mode==="Move anchor" ? [0,2,4] : [v.mode==="Move incoming handle" ? 2 : 4];
      for (const j of offsets) {p[j]+=v.dx;p[j+1]+=v.dy;}
    }
    return {closed:path.closed,points:pts};
  }
  // Fit two neighboring cubics with one. Endpoint tangent directions are retained.
  function fitPair(a,b,c,tolerance) {
    const left=G.cubic(a,b),right=G.cubic(b,c);
    const chordLen=p=>G.dist(p[0],p[1])+G.dist(p[1],p[2])+G.dist(p[2],p[3]);
    const l=chordLen(left),r=chordLen(right),fraction=l/(l+r);
    if (!(fraction>0 && fraction<1)) return null;
    const direction=(o,p,fallback)=>{
      const q=G.dist(o,p)>1e-6 ? p : fallback, len=G.dist(o,q)||1;
      return [(q[0]-o[0])/len,(q[1]-o[1])/len];
    };
    const u=direction(a,left[1],b),v=direction(c,right[2],b);
    const samples=[];
    for (let i=1;i<=12;i++) samples.push([fraction*i/12,G.at(left,i/12)]);
    for (let i=1;i<12;i++) samples.push([fraction+(1-fraction)*i/12,G.at(right,i/12)]);
    let aa=0,ab=0,bb=0,ar=0,br=0;
    for (const [t,p] of samples) {
      const s=1-t,m=3*t*s*s,n=3*s*t*t;
      const x=p[0]-(s*s*s+m)*a[0]-(t*t*t+n)*c[0];
      const y=p[1]-(s*s*s+m)*a[1]-(t*t*t+n)*c[1];
      aa+=m*m; bb+=n*n; ab+=m*n*(u[0]*v[0]+u[1]*v[1]);
      ar+=m*(u[0]*x+u[1]*y); br+=n*(v[0]*x+v[1]*y);
    }
    const det=aa*bb-ab*ab;
    if (Math.abs(det)<1e-9) return null;
    const h=Math.max(0,(ar*bb-br*ab)/det),k=Math.max(0,(br*aa-ar*ab)/det);
    const curve=[G.xy(a),[a[0]+u[0]*h,a[1]+u[1]*h],[c[0]+v[0]*k,c[1]+v[1]*k],G.xy(c)];
    // Straight edges can have different parameter speeds despite coinciding geometrically.
    const flat=[a,b,c].every(p=>G.dist(p,G.incoming(p))+G.dist(p,G.outgoing(p))<1e-6);
    if (flat && G.dist(a,b)+G.dist(b,c)-G.dist(a,c)<1e-7) return [G.xy(a),G.xy(c)];
    if (samples.some(([t,p])=>G.dist(G.at(curve,t),p)>tolerance)) return null;
    return curve.slice(1,3);
  }
  // Degrees the path turns at an anchor, from its handles or, when retracted, its neighbours.
  function turn(p,prev,next) {
    const from=G.dist(p,G.incoming(p))>1e-6 ? G.incoming(p) : G.xy(prev);
    const to=G.dist(p,G.outgoing(p))>1e-6 ? G.outgoing(p) : G.xy(next);
    const d=Math.abs(Math.atan2(to[1]-p[1],to[0]-p[0])-Math.atan2(p[1]-from[1],p[0]-from[0]))*180/Math.PI;
    return d>180 ? 360-d : d;
  }
  function simplify(path,tolerance,corners=0) {
    const pts=path.points.map(p=>p.slice()),min=path.closed ? 3 : 2;
    // Disjoint pairs per pass bound accumulated fitting error.
    let budget=tolerance;
    for (let pass=0;pass<5 && pts.length>min;pass++,budget/=2) {
      let changed=false;
      for (let i=1;i<(path.closed ? pts.length : pts.length-1) && pts.length>min;i++) {
        const a=pts[i-1],c=pts[(i+1)%pts.length];
        if (corners && turn(pts[i],a,c)>=corners) continue;
        const fit=fitPair(a,pts[i],c,budget/2);
        if (!fit) continue;
        a.splice(4,2,...fit[0]);c.splice(2,2,...fit[1]);pts.splice(i,1);changed=true;
      }
      if (!changed) break;
    }
    return {closed:path.closed,points:pts};
  }
  return {inset,offsetRings,clipLines,shatter,point,simplify};
})();
