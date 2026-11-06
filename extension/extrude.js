/* 3D Transform: rotation about a movable axis origin, extrusion, a faceted bevel
   and flat-shaded faces lit by highlight and ambient colours. */
const VectorExtrude = (() => {
  const G=VectorGeometry, P=VectorPathEffects, rad=Math.PI/180;
  const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
  const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const blend=(color,target,t)=>G.mix(color.slice(0,3),target,t).map(Math.round);
  const SHADE_LEVELS=12, WALL_TOLERANCE=0.45;

  // Light runs from -1 (turned away) to 1 (facing the light). Metallic folds it into
  // alternating bright and dark bands, the way polished metal reflects its surroundings.
  function shader(v) {
    const highlight=hex(v.highlight), ambient=hex(v.ambient), metal=v.metallic/100;
    const darkest=Math.max(0.06,v.blackpoint/100);
    return (color,light) => {
      const l=(1-metal)*light+metal*Math.cos(Math.PI*1.5*(1-light));
      const shaded=blend(color,ambient,clamp(0.38-0.26*l,0.06,darkest));
      return l>0 ? blend(shaded,highlight,l*v.whitepoint/100*0.6) : shaded;
    };
  }

  function projector(v,b) {
    const cx=Math.cos(v.rx*rad),sx=Math.sin(v.rx*rad),cy=Math.cos(v.ry*rad),sy=Math.sin(v.ry*rad);
    const cz=Math.cos(v.rz*rad),sz=Math.sin(v.rz*rad);
    const ox=b.x0+b.w*v.cx/100, oy=b.y0+b.h*v.cy/100;
    const camera=Math.max(1,b.w,b.h,v.depth)*2;
    const project=(x,y,z) => {
      const u=x-ox,w=y-oy,k=w*sx+z*cx;
      const xx=u*cy+k*sy,yy=w*cx-z*sx,depth=-u*sy+k*cy;
      const scale=camera/(camera-depth*v.perspective/100);
      return [ox+scale*(xx*cz-yy*sz),oy+scale*(xx*sz+yy*cz),depth];
    };
    // The face at z=0 is toward the viewer unless the rotation turns the shape around.
    const toward=cx*cy>=0 ? 1 : -1;
    return {project,toward};
  }

  // Nearest point on the rings within `reach`, or null. Each segment is filed only under the
  // grid cells it passes through, so long diagonal edges stay cheap.
  function locator(rings,reach) {
    const cell=reach, grid=new Map(), key=(i,j)=>i+","+j;
    for (const r of rings) r.forEach((a,n)=>{
      const q=r[(n+1)%r.length], samples=Math.ceil(G.dist(a,q)/(cell/2))+1, seen=new Set();
      for (let k=0;k<=samples;k++) {
        const t=k/samples, id=key(Math.floor((a[0]+(q[0]-a[0])*t)/cell),Math.floor((a[1]+(q[1]-a[1])*t)/cell));
        if (seen.has(id)) continue;
        seen.add(id); if (!grid.has(id)) grid.set(id,[]); grid.get(id).push([a,q]);
      }
    });
    return p => {
      const i=Math.floor(p[0]/cell),j=Math.floor(p[1]/cell);
      let best=null,bd=reach*reach;
      for (let di=-1;di<=1;di++) for (let dj=-1;dj<=1;dj++) for (const [a,q] of grid.get(key(i+di,j+dj))||[]) {
        const x=q[0]-a[0],y=q[1]-a[1],len=x*x+y*y;
        const t=len ? clamp(((p[0]-a[0])*x+(p[1]-a[1])*y)/len,0,1) : 0;
        const c=[a[0]+t*x,a[1]+t*y],d=(c[0]-p[0])**2+(c[1]-p[1])**2;
        if (d<=bd) {bd=d;best=c;}
      }
      return best;
    };
  }
  const signedArea=pts=>pts.reduce((sum,p,k)=>{const q=pts[(k+1)%pts.length];return sum+p[0]*q[1]-q[0]*p[1];},0);

  // Strips of quads climb from the outline to the inset cap. A point whose ring has gone
  // (a thin part or a small island consumed by the bevel) stays where it is, so nothing is
  // bridged to another contour. Facets turned away from the viewer are skipped, and facets
  // of equal shade are merged into one compound shape. Returns null when nothing is left.
  function bevel(s,v,proj,near,tolerance,shade,lx,ly) {
    const steps=v.complexity, levels=new Map(), angle=i=>i/steps*Math.PI/2;
    const inset=i=>v.bevel*(1-Math.cos(angle(i)));
    let chains=s.paths.map(p=>G.flatten(p,tolerance)), z0=near, cap=null;
    for (let i=1;i<=steps;i++) {
      const rings=P.offsetRings(s,inset(i));
      if (!rings.length) break;
      const z1=near+proj.toward*v.bevelDepth*Math.sin(angle(i));
      const find=locator(rings,Math.max(0.25,8*(inset(i)-inset(i-1))));
      const next=chains.map(c=>c.map(a=>find(a) || a)), tilt=Math.cos((angle(i-1)+angle(i))/2);
      chains.forEach((chain,c)=>chain.forEach((a,n)=>{
        const m=(n+1)%chain.length, inner=next[c], flat=[a,chain[m],inner[m],inner[n]];
        const quad=[proj.project(...a,z0),proj.project(...chain[m],z0),
          proj.project(...inner[m],z1),proj.project(...inner[n],z1)].map(G.xy);
        const area=signedArea(quad), facing=signedArea(flat)*area*proj.toward;
        if (Math.abs(area)<1e-6 || facing<=0) return;
        const out=[(quad[0][0]+quad[1][0]-quad[2][0]-quad[3][0])/2,(quad[0][1]+quad[1][1]-quad[2][1]-quad[3][1])/2];
        const len=Math.hypot(...out)||1, light=tilt*(out[0]*lx+out[1]*ly)/len;
        const level=Math.round((light+1)/2*SHADE_LEVELS);
        if (!levels.has(level)) levels.set(level,[]);
        levels.get(level).push(G.polygon(area>0 ? quad : quad.reverse()));
      }));
      chains=next; z0=z1; cap=rings;
    }
    if (!cap) return null;
    const facets=[...levels.keys()].sort((a,b)=>a-b).map(level=>({paths:levels.get(level),
      fill:shade(s.fill,level/SHADE_LEVELS*2-1),stroke:null,width:0,opacity:s.opacity,evenodd:false}));
    return facets.concat({...s,evenodd:false,
      paths:cap.map(r=>G.polygon(r.map(p=>proj.project(...p,z0).slice(0,2))))});
  }

  function walls(s,proj,near,far,tolerance,shade,lx,ly) {
    const out=[];
    for (const p of s.paths) {
      const ring=G.flatten(p,tolerance);
      for (let i=0;i<ring.length;i++) {
        const a=ring[i],q=ring[(i+1)%ring.length];
        const quad=[proj.project(...a,far),proj.project(...q,far),proj.project(...q,near),proj.project(...a,near)];
        const edgeX=quad[1][0]-quad[0][0],edgeY=quad[1][1]-quad[0][1],length=Math.hypot(edgeX,edgeY);
        if (length<0.0001) continue;
        // Pick the screen normal pointing toward the outward extrusion silhouette.
        const extX=quad[3][0]-quad[0][0],extY=quad[3][1]-quad[0][1];
        const sign=edgeY*extX-edgeX*extY>0 ? -1 : 1;
        const light=sign*(edgeY*lx-edgeX*ly)/length;
        out.push({z:quad.reduce((acc,p)=>acc+p[2],0)/4,shape:{paths:[G.polygon(quad.map(G.xy))],
          fill:shade(s.fill,light),stroke:null,width:0,opacity:s.opacity,evenodd:false}});
      }
    }
    return out.sort((a,b)=>a.z-b.z).map(w=>w.shape);
  }

  function extrude(shapes,v,b) {
    const proj=projector(v,b), shade=shader(v), ambient=hex(v.ambient);
    const lx=Math.cos(v.light*rad),ly=Math.sin(v.light*rad);
    const result=[];
    for (const s of shapes) {
      if (!s.fill || s.paths.some(p=>!p.closed)) throw Error("3D Transform needs closed, filled paths. Outline strokes or type first.");
      const near=proj.toward>0 ? 0 : -v.depth,far=-v.depth-near;
      const curved=v.perspective ? {...s,paths:s.paths.map(p=>G.splitPath(p,c=>G.dist(c[0],c[3])>Math.max(1,b.w,b.h)/5,4))} : s;
      const face=(z,src=curved)=>({...src,paths:src.paths.map(p=>G.mapPath(p,(x,y)=>proj.project(x,y,z).slice(0,2)))});
      if (v.depth>0) {
        const back=face(far);
        const k=Math.min(0.45,Math.max(0.06,v.blackpoint/100));
        result.push({...back,fill:blend(s.fill,ambient,k),stroke:s.stroke && blend(s.stroke,ambient,k)});
        result.push(...walls(s,proj,near,far,WALL_TOLERANCE,shade,lx,ly));
      }
      const beveled=v.bevel>0 ? bevel(s,v,proj,near,WALL_TOLERANCE,shade,lx,ly) : null;
      if (beveled) result.push(...beveled); else result.push(face(near));
    }
    return result;
  }
  return {extrude};
})();
