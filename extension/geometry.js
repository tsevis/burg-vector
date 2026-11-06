const VectorGeometry = (() => {
  const mix = (a,b,t) => a.map((v,i) => v+(b[i]-v)*t);
  const dist = (a,b) => Math.hypot(b[0]-a[0],b[1]-a[1]);
  const xy = p => p.slice(0,2);
  const incoming = p => p.slice(2,4);
  const outgoing = p => p.slice(4,6);
  const node = p => [...p,...p,...p];
  const polygon = vertices => ({closed:true,points:vertices.map(node)});
  const cubic = (p,q) => [xy(p),outgoing(p),incoming(q),xy(q)];
  function split(c,t = 0.5) {
    const a=mix(c[0],c[1],t), b=mix(c[1],c[2],t), d=mix(c[2],c[3],t);
    const u=mix(a,b,t), v=mix(b,d,t), mid=mix(u,v,t);
    return [[c[0],a,u,mid],[mid,v,d,c[3]]];
  }
  const at = (c,t) => split(c,t)[0][3];
  function splitPath(path, needsSplit, limit) {
    const input=path.points, output=[input[0].slice()];
    const count=input.length-(path.closed ? 0 : 1);
    function visit(c,depth) {
      if (depth < limit && needsSplit(c,depth)) {
        const pair=split(c);
        visit(pair[0],depth+1);
        visit(pair[1],depth+1);
      } else {
        output[output.length-1].splice(4,2,...c[1]);
        output.push([...c[3],...c[2],...c[3]]);
      }
    }
    for (let i=0;i<count;i++) visit(cubic(input[i],input[(i+1)%input.length]),0);
    if (path.closed) output[0].splice(2,2,...incoming(output.pop()));
    return {closed:path.closed,points:output};
  }
  function flatten(path,tolerance=0.3) {
    const distanceToChord = (p,a,b) => {
      const x=b[0]-a[0],y=b[1]-a[1],len=x*x+y*y;
      const t=len ? Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/len)) : 0;
      return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);
    };
    return splitPath(path,c => Math.max(distanceToChord(c[1],c[0],c[3]),
      distanceToChord(c[2],c[0],c[3])) > tolerance,10).points.map(xy);
  }
  function mapPath(path,fn) {
    return {closed:path.closed,points:path.points.map(p =>
      [...fn(...xy(p)),...fn(...incoming(p)),...fn(...outgoing(p))])};
  }
  function bounds(shapes,includeStroke=false) {
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    for (const shape of shapes) {
      const pad=includeStroke && shape.stroke ? shape.width/2 : 0;
      const add=(x,y) => {
        x0=Math.min(x0,x-pad); x1=Math.max(x1,x+pad);
        y0=Math.min(y0,y-pad); y1=Math.max(y1,y+pad);
      };
      for (const path of shape.paths) {
        const nodes=path.points;
        for (let i=0;i<nodes.length;i++) {
          add(nodes[i][0],nodes[i][1]);
          if (!path.closed && i===nodes.length-1) break;
          const c=cubic(nodes[i],nodes[(i+1)%nodes.length]);
          for (let axis=0;axis<2;axis++) {
            const [p,q,r,s]=c.map(a=>a[axis]);
            const a=-p+3*q-3*r+s,b=2*(p-2*q+r),d=q-p;
            const disc=b*b-4*a*d;
            const roots=Math.abs(a)<1e-9 ? (Math.abs(b)>1e-9 ? [-d/b] : []) :
              (disc>=0 ? [(-b+Math.sqrt(disc))/(2*a),(-b-Math.sqrt(disc))/(2*a)] : []);
            for (const t of roots) if (t>0 && t<1) add(...at(c,t));
          }
        }
      }
    }
    return {x0,x1,y0,y1,w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2};
  }
  function circle(cx,cy,r) {
    const k=0.5522847498307936*r;
    return {closed:true,points:[[cx+r,cy,cx+r,cy-k,cx+r,cy+k],
      [cx,cy+r,cx+k,cy+r,cx-k,cy+r],[cx-r,cy,cx-r,cy+k,cx-r,cy-k],
      [cx,cy-r,cx-k,cy-r,cx+k,cy-r]]};
  }
  function random(seed) {
    let s=seed|0;
    return () => {s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};
  }
  return {mix,dist,xy,incoming,outgoing,node,polygon,cubic,at,split,splitPath,flatten,mapPath,bounds,circle,random};
})();
