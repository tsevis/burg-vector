/* Sketch: rough pen passes over the outlines, with optional hatching clipped inside fills. */
const VectorSketch = (() => {
  const G=VectorGeometry, P=VectorPathEffects, K=VectorPaint;

  function hatchLines(shape,angle,spacing,rough,rand) {
    const b=G.bounds([shape]),a=angle*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a);
    const reach=Math.hypot(b.w,b.h)/2+spacing,segments=[];
    for (let d=-reach;d<=reach;d+=spacing) {
      const px=b.cx-uy*d,py=b.cy+ux*d;
      segments.push([[px-ux*reach,py-uy*reach],[px+ux*reach,py+uy*reach]]);
    }
    const wobble=()=>rough*0.5*(2*rand()-1);
    return P.clipLines(shape,segments).map(line=>({closed:false,
      points:line.map(([x,y])=>G.node([x+(rough ? wobble() : 0),y+(rough ? wobble() : 0)]))}));
  }
  function hatching(s,v,rand) {
    if (v.hatch==="None" || !s.fill || s.paths.some(p=>!p.closed)) return [];
    const angles=v.hatch==="Cross-hatch" ? [v.hatchAngle,v.hatchAngle+90] : [v.hatchAngle];
    const pen={fill:null,stroke:K.tint(s.fill,K.ink,0.65),width:Math.max(0.2,v.width*0.6),
      opacity:s.opacity*0.7,cap:"round",join:"round",dash:[],evenodd:false};
    return angles.map(a=>({...s,...pen,paths:hatchLines(s,a,v.spacing,v.rough,rand)})).filter(h=>h.paths.length);
  }
  function sketch(shapes,v,b) {
    // Hatching draws from its own stream so the pen passes match earlier versions.
    const rand=G.random(v.seed),hatchRand=G.random(v.seed+7919),result=[];
    for (const s of shapes) {
      if (s.fill) result.push({...s,stroke:null});
      result.push(...hatching(s,v,hatchRand));
      const paths=s.paths.map(p=>G.splitPath(p,c=>G.dist(c[0],c[3])>Math.max(7,Math.max(b.w,b.h)/18),5));
      for (let j=0;j<v.passes;j++) {
        const jitter=()=>v.rough*(2*rand()-1);
        const traced=paths.map(p=>({closed:p.closed,points:p.points.map(q=>{
          const x=jitter(),y=jitter();
          return [q[0]+x,q[1]+y,q[2]+x+jitter()/2,q[3]+y+jitter()/2,q[4]+x+jitter()/2,q[5]+y+jitter()/2];
        })}));
        result.push({...s,paths:traced,fill:null,stroke:K.tint(s.stroke||K.base(s),K.ink,0.65),width:v.width,
          opacity:s.opacity*(j===0 ? 0.85 : 0.5),cap:"round",join:"round",dash:[]});
      }
    }
    return result;
  }
  return {sketch};
})();
