/* All distances are Illustrator points, coordinates are Y-up. */
const VectorCatalog = (() => {
  const range = (key, label, value, min, max, step = 1, unit = "") =>
    ({key, label, value, min, max, step, unit});
  const choice = (key, label, options) => ({key, label, options, value: options[0]});
  const angle = (key, label, value) => range(key, label, value, -180, 180, 1, "°");
  const pt = (key, label, value, min, max, step = 1) => range(key, label, value, min, max, step, "pt");
  const pct = (key, label, value, min = 0, max = 100) => range(key, label, value, min, max, 1, "%");
  const seed = () => range("seed", "Seed", 17, 1, 999);
  return [
    {id:"extrude", name:"3D Transform", family:"Form", controls:[
      angle("rx","Rotate X",20), angle("ry","Rotate Y",-28), angle("rz","Rotate Z",0),
      {...pt("depth","Extrusion",28,0,3600),fineMax:180,coarseStep:20},
      pct("perspective","Perspective",0,0,85), angle("light","Light direction",130)],
      preset:["Deep relief",{rx:35,ry:32,depth:56,light:75}]},
    {id:"warp", name:"Warp Frame", family:"Form", controls:[
      ...["tl","tr","bl","br"].flatMap((key,i) => ["x","y"].map(axis =>
        pct(key+axis, ["Top left","Top right","Bottom left","Bottom right"][i]+" "+axis.toUpperCase(),
          ({tlx:10,trx:-18,try:12,bry:-9})[key+axis] || 0,-100,100))),
      ...["top","right","bottom","left"].map(key=>pct(key,key[0].toUpperCase()+key.slice(1)+" bow",0,-100,100))],
      preset:["Receding plane",{tlx:32,tly:-6,trx:-28,try:-6,blx:-10,brx:10}]},
    {id:"distort", name:"Vector Distort", family:"Form", controls:[
      choice("lens","Lens",["Swirl","Spherize","Pinch","Rotate","Magnify","Zig","Zag","ZigZag"]), pct("strength","Strength",65,-100,100),
      pct("radius","Radius",75,5,160),pct("cx","Center X",50),pct("cy","Center Y",50)],
      preset:["Glass lens",{lens:"Spherize",strength:80,radius:55}]},
    {id:"shatter", name:"Fracture", family:"Form", controls:[
      choice("fracture","Fracture",["Cells","Radial"]),range("pieces","Fragments",14,2,80),pt("spread","Separation",12,0,100),
      angle("spin","Rotation scatter",8),pct("cx","Impact X",50),pct("cy","Impact Y",50),seed()],preset:["Splinters",{pieces:36,spread:18,spin:18,seed:43}]},
    {id:"inset", name:"Inset", family:"Paths", controls:[
      pt("distance","Inset distance",4,-72,72,0.25),choice("join","Corner join",["Round","Miter","Bevel"])],
      preset:["Outward offset",{distance:-6,join:"Round"}]},
    {id:"point", name:"Point Editor", family:"Paths", controls:[
      choice("mode","Operation",["Subdivide","Smooth","Corner","Move anchor","Move incoming handle","Move outgoing handle"]),
      range("contour","Contour (0 = all)",0,0,1000),range("index","Anchor",1,1,1000),pt("dx","Move X",8,-160,160,0.5),
      pt("dy","Move Y",0,-160,160,0.5)],preset:["Smooth anchor",{mode:"Smooth",index:1}]},
    {id:"simplify", name:"Simplify", family:"Paths", controls:[
      pt("error","Curve tolerance",1.5,0.1,20,0.1)],preset:["Fine detail",{error:0.4}]},
    {id:"sketch", name:"Sketch", family:"Paths", controls:[
      pt("rough","Roughness",1.8,0,14,0.1),range("passes","Pen passes",2,1,6),
      pt("width","Pen width",1,0.2,10,0.1),seed()],preset:["Loose graphite",{passes:4,rough:3.5,width:0.6}]},
    {id:"color", name:"Color Shift", family:"Color & light", controls:[
      angle("hue","Hue shift",35),pct("sat","Saturation change",8,-100,100),
      pct("lum","Lightness change",0,-100,100),pct("invert","Inversion",0),pct("gray","Grayscale",0),pct("contrast","Contrast",0,-100,100)],preset:["Muted inks",{hue:-15,sat:-45,lum:7}]},
    {id:"emboss", name:"Emboss", family:"Color & light", controls:[
      pt("depth","Edge depth",4,0.25,40,0.25),angle("light","Light direction",125),
      pct("contrast","Contrast",68)],preset:["Stamped foil",{depth:2,light:48,contrast:90}]},
    {id:"flare", name:"Flare", family:"Color & light", controls:[
      range("rays","Rays",12,4,48),pct("radius","Ray radius",85,10,200),
      pct("halo","Halo size",22,3,80),angle("angle","Ray angle",12),
      pct("cx","Center X",62),pct("cy","Center Y",62)],preset:["Starburst",{rays:8,radius:125,halo:16,angle:0}]},
    {id:"neon", name:"Neon", family:"Color & light", controls:[
      pt("width","Tube width",10,1,80,0.5),range("bands","Glow bands",7,2,16),
      pct("glow","Glow intensity",32,5,100)],preset:["Fine filament",{width:4,bands:9,glow:24}]},
    {id:"shadow", name:"Shadow Echo", family:"Color & light", controls:[
      pt("length","Shadow length",22,1,180),angle("angle","Direction",-42),
      range("steps","Copies",9,1,30),pct("fade","Far opacity",10,1,100),
      pct("scale","Far scale",100,20,180),angle("spin","Far rotation",0)],
      preset:["Rotating echo",{length:40,angle:-25,steps:8,fade:20,scale:70,spin:22}]}
  ];
})();
