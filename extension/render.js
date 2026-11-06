/* Draws effect shapes into SVG for the main preview, Explore tiles and preset thumbnails. */
const VectorRender = (() => {
  const NS="http://www.w3.org/2000/svg";
  const el=(name,attrs={})=>{
    const node=document.createElementNS(NS,name);
    for (const [key,val] of Object.entries(attrs)) node.setAttribute(key,val);
    return node;
  };
  function pathData(p) {
    const pts=p.points;let d="M"+pts[0][0]+" "+pts[0][1];
    for (let i=0;i<pts.length-(p.closed ? 0 : 1);i++) {
      const a=pts[i],b=pts[(i+1)%pts.length];
      d+="C"+[a[4],a[5],b[2],b[3],b[0],b[1]].join(" ");
    }
    return d+(p.closed ? "Z" : "");
  }
  const paint=c=>c ? "rgb("+c.slice(0,3).map(Math.round).join(",")+")" : "none";
  function shapes(group,list) {
    for (const s of list) {
      const node=el("path",{d:s.paths.map(pathData).join(" "),fill:paint(s.fill),stroke:paint(s.stroke),
        "stroke-width":s.width||0,"fill-rule":s.evenodd ? "evenodd" : "nonzero",
        "stroke-linecap":s.cap||"butt","stroke-linejoin":s.join||"miter",
        "stroke-miterlimit":s.miter||4,opacity:s.opacity/100});
      if (s.dash && s.dash.length) {node.setAttribute("stroke-dasharray",s.dash.join(" "));node.setAttribute("stroke-dashoffset",s.dashOffset||0);}
      group.append(node);
    }
  }
  // A self-contained, fitted drawing: Illustrator's Y-up coordinates flipped for SVG.
  function thumbnail(list) {
    const svg=el("svg",{"aria-hidden":"true"});
    if (!list || !list.length) return svg;
    const b=VectorGeometry.bounds(list,true), pad=Math.max(1,Math.max(b.w,b.h)*0.08);
    svg.setAttribute("viewBox",[b.x0-pad,-b.y1-pad,Math.max(1,b.w)+2*pad,Math.max(1,b.h)+2*pad].join(" "));
    const g=el("g",{transform:"scale(1,-1)"});shapes(g,list);svg.append(g);
    return svg;
  }
  return {el,shapes,thumbnail};
})();
