import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const js=vm.createContext({console,navigator:{userAgent:""},window:{}});
js.window=js; js.self=js;
for (const file of ["vendor/clipper.js","catalog.js","geometry.js","paint.js","path-effects.js","extrude.js","light-effects.js","sketch.js","effects.js","explore.js"])
  vm.runInContext(readFileSync(join(root,"extension",file),"utf8"),js,{filename:file});
const {catalog,G,run}=vm.runInContext("({catalog:VectorCatalog,G:VectorGeometry,run:VectorEffects.run})",js);
const ring={paths:[G.circle(50,50,40),G.circle(50,50,12)],fill:[228,80,50],stroke:null,width:0,opacity:100,evenodd:true};
const polygon=G.polygon([[28,39],[49,39],[70,39],[70,60],[28,60]]);
const rect={...ring,paths:[polygon],fill:[41,133,160],evenodd:false};
const source=[ring,rect], original=JSON.stringify(source);
const cases=[];
for (const e of catalog) {
  const result=run(e.id,source,{});
  assert.ok(result.length>0,e.name);
  for (const s of result) for (const p of s.paths) for (const q of p.points)
    assert.ok(q.length===6 && q.every(Number.isFinite),e.name);
  assert.equal(JSON.stringify(source),original,"Source mutated in "+e.name);
  assert.equal(JSON.stringify(result),JSON.stringify(run(e.id,source,{})),e.name+" repeatability");
  assert.ok(run(e.id,source,e.preset[1]).length>0,e.name+" preset");
  cases.push({name:e.name,result});
}
assert.equal(cases.length,13);
for (const lens of catalog.find(e=>e.id==="distort").controls[0].options)
  assert.ok(run("distort",source,{lens})[0].paths.length===2);
for (const e of ["extrude","warp","shatter","color","point"]) {
  const data={extrude:{perspective:70},warp:{top:40},shatter:{fracture:"Radial",pieces:2},
    color:{invert:100,gray:100},point:{mode:"Move anchor",contour:2,dx:19,dy:-2}}[e];
  assert.ok(run(e,source,data).length);
}
const only=[rect],box=G.bounds(only);
for (const depth of [180,1800,2713,3600]) {
  const walls=run("extrude",only,{rx:0,ry:30,rz:0,perspective:0,depth});
  const expectedWidth=box.w*Math.cos(Math.PI/6)+depth/2;
  assert.ok(Math.abs(G.bounds(walls).w-expectedWidth)<0.001,"Projected extrusion at "+depth+" pt");
}
const inset=G.bounds(run("inset",only,{distance:2}));
assert.ok(Math.abs(inset.w-(box.w-4))<0.001);
assert.equal(run("simplify",only,{error:0.3})[0].paths[0].points.length,4);
assert.equal(run("point",only,{mode:"Subdivide"})[0].paths[0].points.length,6);
const area=p=>p.points.reduce((sum,a,i)=>{
  const b=p.points[(i+1)%p.points.length];return sum+(a[0]*b[1]-a[1]*b[0])/2;
},0);
const fragments=run("shatter",only,{spread:0,spin:0});
const totalArea=fragments.reduce((sum,s)=>sum+Math.abs(s.paths.reduce((a,p)=>a+area(p),0)),0);
assert.ok(Math.abs(totalArea-Math.abs(area(polygon)))<0.05);
const insetRing=run("inset",[ring],{distance:2});
assert.equal(insetRing[0].paths.length,2);
assert.ok(area(insetRing[0].paths[0])*area(insetRing[0].paths[1])<0);
const open={...rect,paths:[{...polygon,closed:false}],fill:null,stroke:[0,0,0],width:2};
for (const id of ["shatter","inset","extrude"]) assert.throws(()=>run(id,[open],{}),/closed/i);
for (const e of catalog.filter(e=>!["shatter","inset","extrude"].includes(e.id)))
  assert.ok(run(e.id,[open],{}).length);
for (const s of run("neon",source,{glow:100,bands:16}))
  assert.ok(s.opacity>=0 && s.opacity<=100,"Neon opacity "+s.opacity);
const ringOf=n=>({...rect,paths:[G.polygon(Array.from({length:n},(_,i)=>[100*Math.cos(i*2*Math.PI/n),100*Math.sin(i*2*Math.PI/n)]))]});
assert.throws(()=>run("color",[ringOf(32001)],{}),/32,000/,"Preview accepts a contour Illustrator rejects");
// 3D Transform: axis origin, bevel, metallic and light colours.
const flat3d={rx:0,ry:0,rz:0,perspective:0};
const pivot=G.bounds(run("extrude",only,{...flat3d,rz:90,depth:0,cx:0,cy:0}));
assert.ok(Math.abs(pivot.x1-box.x0)<0.001 && Math.abs(pivot.y0-box.y0)<0.001,"Axis origin pivots at the lower left");
const beveled=run("extrude",only,{...flat3d,depth:0,bevel:4,bevelDepth:6});
const cap=G.bounds([beveled[beveled.length-1]]);
assert.ok(Math.abs(cap.w-(box.w-8))<0.01 && Math.abs(cap.h-(box.h-8))<0.01,"Bevel cap is inset by the bevel size");
assert.ok(beveled.length>1,"Bevel adds facets");
const ringCap=run("extrude",[ring],{bevel:3,depth:20});
assert.equal(ringCap[ringCap.length-1].paths.length,2,"Bevel cap keeps compound holes");
assert.ok(run("extrude",[ring],{bevel:6,complexity:10,depth:40}).length<=1800,"Rounded bevel stays within object limit");
const wallColors=o=>JSON.stringify(run("extrude",only,{ry:40,depth:40,...o}).map(s=>s.fill));
assert.notEqual(wallColors({metallic:0}),wallColors({metallic:100}),"Metallic changes wall shading");
assert.notEqual(wallColors({highlight:"#ff0000"}),wallColors({highlight:"#ffffff"}),"Highlight colour tints lit faces");
assert.notEqual(wallColors({ambient:"#0000ff"}),wallColors({ambient:"#14131c"}),"Ambient colour tints shadowed faces");
assert.throws(()=>run("extrude",only,{highlight:"red"}),/Highlight/,"Colour controls validate hex");
// A contour the bevel consumes must not be bridged to another contour.
const island={...rect,paths:[G.polygon([[0,0],[100,0],[100,100],[0,100]]),G.circle(300,50,3)]};
const facets=run("extrude",[island],{...flat3d,depth:0,bevel:10}).flatMap(s=>s.paths);
assert.ok(facets.every(p=>G.bounds([{paths:[p]}]).w<150),"Vanished contour streaks across the artwork");
// One shape too small for the bevel keeps a flat face; the rest still bevel.
const mixed=run("extrude",[rect,{...rect,paths:[G.circle(200,50,3)]}],{...flat3d,depth:0,bevel:10});
assert.ok(mixed.length>2,"A small shape blocks the whole selection");
// Enriched effects.
const square={...rect,paths:[G.polygon([[0,0],[100,0],[100,100],[0,100]])]};
const hexRGB=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const near=(a,b,tol=1.01)=>a.slice(0,3).every((v,i)=>Math.abs(v-b[i])<=tol);
const areaOf=list=>list.reduce((sum,s)=>sum+Math.abs(s.paths.reduce((a,p)=>a+area(p),0)),0);
// Shadow Echo: modes and shadow colour.
const shadowJSON=o=>JSON.stringify(run("shadow",[square],{length:80,angle:0,steps:4,...o}));
const castBox=G.bounds([run("shadow",[square],{mode:"Cast",length:80,angle:30,steps:1})[0]]);
assert.ok(castBox.y0>-0.01 && castBox.y1<99 && castBox.x1>140,"Cast shadow leans along the ground from the base");
assert.notEqual(shadowJSON({mode:"Drop"}),shadowJSON({mode:"Echo"}),"Drop differs from Echo");
const drop=run("shadow",[square],{mode:"Drop",steps:4});
const dropX=50+22*Math.cos(-42*Math.PI/180);
assert.ok(drop.slice(0,4).every(s=>Math.abs(G.bounds([s]).cx-dropX)<0.01),"Drop copies share one offset");
assert.ok(drop.length===5 && near(drop[0].fill,hexRGB("#14131c").map((c,i)=>Math.round(rect.fill[i]+(c-rect.fill[i])*0.72))),"Drop shadow copies take the shadow colour");
assert.ok(near(run("shadow",[square],{color:"#0000ff",tint:100})[0].fill,[0,0,255]),"Shadow colour at full tint");
// Inset: stepped rings blending to a target colour.
const rings=run("inset",[square],{distance:30,steps:3,target:"#ffffff",blend:100});
assert.equal(rings.length,3,"Inset steps");
assert.ok(near(rings[2].fill,[255,255,255]) && Math.abs(G.bounds([rings[2]]).w-40)<0.01,"Innermost ring reaches the target colour and full distance");
// Emboss: colours and soft bands.
assert.equal(run("emboss",[square],{softness:3}).length,7,"Emboss softness bands");
assert.ok(near(run("emboss",[square],{highlight:"#ff0000",contrast:100})[1].fill,[255,0,0]),"Emboss highlight colour");
// Fracture: grout gaps, gravity, colour jitter.
const whole=areaOf(run("shatter",[square],{spread:0,spin:0}));
assert.ok(areaOf(run("shatter",[square],{spread:0,spin:0,gap:4}))<whole*0.9,"Fracture gap opens grout lines");
assert.ok(G.bounds(run("shatter",[square],{spread:0,spin:0,gravity:120})).y0<-60,"Fracture gravity drops pieces");
const jittered=new Set(run("shatter",[square],{jitter:80}).map(s=>s.fill.join()));
assert.ok(jittered.size>3,"Fracture colour jitter varies fragments");
// Vector Distort: Ripple and Wobble lenses.
const lensJSON=lens=>JSON.stringify(run("distort",[square],{lens,strength:80}));
assert.ok(new Set(["Pinch","Ripple","Wobble"].map(lensJSON)).size===3,"Ripple and Wobble are lenses of their own");
const soft=JSON.stringify(run("distort",[square],{lens:"Spherize"})), hard=JSON.stringify(run("distort",[square],{lens:"Spherize",hardness:90}));
assert.notEqual(soft,hard,"Distort edge hardness changes the falloff");
// Warp Frame: shapes.
const flatWarp={tlx:0,trx:0,try:0,bry:0};
const arc=G.bounds(run("warp",[square],{...flatWarp,shape:"Arc",bend:60}));
assert.ok(arc.y1>110,"Arc lifts the top");
for (const shape of ["Bulge","Wave","Flag","Twist"])
  assert.notEqual(JSON.stringify(run("warp",[square],{...flatWarp,shape})),JSON.stringify(run("warp",[square],flatWarp)),shape+" warps");
// Neon: custom tube and glow colours.
const tubes=run("neon",[square],{colors:"Custom",tube:"#00ff00",glowColor:"#0000ff"});
assert.ok(near(tubes[1].stroke,[0,0,255]) && near(tubes[tubes.length-1].stroke,[255,252,246]) && near(tubes[tubes.length-2].stroke,[0,255,0]),"Neon custom colours");
// Flare: lens rings, colour and ray jitter.
assert.equal(run("flare",[square],{rings:4}).length-run("flare",[square],{}).length,4,"Flare lens rings");
assert.ok(near(run("flare",[square],{colors:"Custom",flareColor:"#00ff00"})[1].fill,[0,255,0]),"Flare colour");
assert.notEqual(JSON.stringify(run("flare",[square],{jitter:80})),JSON.stringify(run("flare",[square],{})),"Flare ray jitter");
// Sketch: hatching stays inside the shape.
const hatched=run("sketch",[square],{hatch:"Cross-hatch",spacing:10,rough:0});
const lines=hatched.filter(s=>s.paths.every(p=>!p.closed && p.points.length===2));
assert.equal(lines.length,2,"Cross-hatch draws two directions");
for (const s of lines) for (const p of s.paths) { assert.ok(!p.closed); const lb=G.bounds([{paths:[p]}]); assert.ok(lb.x0>-0.01 && lb.x1<100.01 && lb.y0>-0.01 && lb.y1<100.01,"Hatch inside shape"); }
// Color Shift: colorize, posterize, per-object randomize.
const blueish=run("color",[{...square,fill:[228,80,50]}],{hue:0,sat:0,colorize:100,target:"#3562a0"})[0].fill;
assert.ok(blueish[2]>blueish[0]+40,"Colorize moves toward the target hue");
assert.ok(run("color",[square],{hue:0,sat:0,posterize:2})[0].fill.every(c=>c===0||c===255),"Posterize to two levels");
const many=[0,1,2,3,4].map(i=>({...square,paths:[G.circle(i*30,0,10)]}));
assert.ok(new Set(run("color",many,{hue:0,sat:0,random:100}).map(s=>s.fill.join())).size>2,"Randomize varies objects");
// Simplify: keep corners.
const notch=G.polygon([[0,0],[10,0],[20,0],[20,10],[20,20],[10,20],[0,20],[0,10]]);
const kept=run("simplify",[{...rect,paths:[notch]}],{error:20,corners:60})[0].paths[0].points.length;
assert.ok(kept>=4,"Simplify keeps the square's corners");
// Explore mutations must stay inside each control's range and step, or run() rejects them.
const X=vm.runInContext("VectorExplore",js), rng=G.random(5);
for (const e of catalog) for (let i=0;i<60;i++) {
  const start=Object.fromEntries(e.controls.map(c=>[c.key,c.value]));
  const child=X.mutate(e,start,i%2 ? 1 : 0.1,rng);
  assert.notEqual(JSON.stringify(child),JSON.stringify(start),e.name+" mutation changes something");
  for (const c of e.controls.filter(c=>!c.options && !c.color))
    assert.ok(Math.abs(Math.round((child[c.key]-c.min)/c.step)*c.step+c.min-child[c.key])<1e-9,e.name+" "+c.key+" off step");
  try { run(e.id,source,child); } catch (err) { assert.doesNotMatch(err.message,/^(Check|Unknown)/,e.name+" mutation out of range"); }
}
console.log("13/13 effects and presets passed geometry checks. Verified inset, compound holes, shatter area, open paths, source preservation and anchor editing.");

if (process.argv.includes("--illustrator")) {
  cases.push({name:"Bevelled metallic 3D",result:run("extrude",source,{bevel:4,complexity:6,metallic:70,depth:60,cx:20,highlight:"#ffe0a0",ambient:"#102040"})});
  cases.push({name:"Neon full glow",result:run("neon",source,{glow:100,bands:16})});
  cases.push({name:"Cross-hatch sketch",result:run("sketch",source,{hatch:"Cross-hatch",spacing:4})});
  cases.push({name:"Fracture with grout and gravity",result:run("shatter",source,{gap:2,gravity:40,jitter:60})});
  cases.push({name:"Drop shadow, stepped inset, Ripple",result:[...run("shadow",source,{mode:"Drop",steps:6}),
    ...run("inset",source,{distance:3,steps:4,blend:80}),...run("distort",source,{lens:"Ripple",frequency:6})]});
  cases.push({name:"1,500-anchor contour",result:run("color",[ringOf(1500)],{})});
  cases.push({name:"3,600 pt extrusion",result:run("extrude",source,{rx:180,ry:60,rz:91,depth:3600,perspective:85,light:-56})});
  const temp=mkdtempSync(join(tmpdir(),"vector-effects-qa-"));
  const script=join(temp,"suite.jsx"), apple=join(temp,"run.applescript");
  const runHost=(file)=>execFileSync("/usr/bin/osascript",[apple,file],
    {encoding:"utf8",timeout:650000,maxBuffer:4*1024*1024}).trim();
  writeFileSync(apple,`on run argv
    set scriptFile to POSIX file (item 1 of argv)
    with timeout of 600 seconds
      tell application id "com.adobe.illustrator" to do javascript scriptFile
    end timeout
  end run`);
  const host=JSON.stringify(join(root,"extension/host.jsx"));
  // Every run owns its scratch document, even when an assertion fails.
  writeFileSync(script,`(function () {
    $.evalFile(new File(${host}));
    var doc=app.documents.add(DocumentColorSpace.RGB,600,400);
    var cases=${JSON.stringify(cases)}, input=${original}, rows=[];
    function check(ok,msg) { if (!ok) throw Error(msg); }
    function decode(s) { var obj=eval("("+s+")");check(!obj.error,obj.error);return obj; }
    function make(s) {
      var parent=s.paths.length>1 ? doc.compoundPathItems.add() : doc.activeLayer;
      var p,col=new RGBColor();col.red=s.fill[0];col.green=s.fill[1];col.blue=s.fill[2];
      for (var i=0;i<s.paths.length;i++) {
        p=parent.pathItems.add();var points=s.paths[i].points,coords=[];
        for(var j=0;j<points.length;j++) coords.push([points[j][0],points[j][1]]);
        p.setEntirePath(coords);p.closed=true;p.filled=true;p.fillColor=col;p.stroked=false;p.evenodd=s.evenodd;
        for(j=0;j<points.length;j++){p.pathPoints[j].leftDirection=points[j].slice(2,4);p.pathPoints[j].rightDirection=points[j].slice(4);}
      }
      return s.paths.length>1 ? parent : p;
    }
    try {
      var ring=make(input[0]),rect=make(input[1]);app.redraw();var initial=doc.activeLayer.pageItems.length;
      function selectSource() { doc.selection=null;ring.selected=true;rect.selected=true; }
      function watch(last,inspect) { return decode(BurgVectorHost.watch(last ? last.revision : null,!!inspect)); }
      doc.selection=null;var empty=watch(null);
      check(empty.state==="empty" && watch(empty).unchanged,"empty selection");
      ring.selected=true;var first=watch(empty);
      check(first.shapes.length===1 && watch(first).unchanged && watch(first,true).unchanged,"stable selection");
      doc.selection=null;rect.selected=true;var second=watch(first);
      check(second.shapes.length===1 && second.token!==first.token,"switched objects");
      check(BurgVectorHost.apply(first.token,"stale",input,"above").indexOf("changed")>=0,"stale selection");
      selectSource();var multi=watch(second);
      check(multi.shapes.length===2 && multi.token!==second.token,"multiple selection");
      var other=app.documents.add(DocumentColorSpace.RGB,180,180);
      try {
        other.selection=null;var away=watch(multi);
        check(away.state==="empty" && !away.token,"switched documents");
        var gradientPath=other.pathItems.rectangle(90,10,40,30),paint=new GradientColor();
        paint.gradient=other.gradients.add();gradientPath.filled=true;gradientPath.fillColor=paint;gradientPath.selected=true;
        var unsupported=watch(away);
        check(unsupported.state==="unsupported" && !unsupported.shapes && watch(unsupported).unchanged,"unsupported artwork");
      } finally {other.close(SaveOptions.DONOTSAVECHANGES);}
      selectSource();check(watch(unsupported).shapes.length===2,"return to source document");
      for(var i=0;i<cases.length;i++) {
        selectSource(); var c=cases[i],source=decode(BurgVectorHost.read());
        check(source.shapes[0].fill[0]===input[0].fill[0], "source stacking");
        var count=decode(BurgVectorHost.apply(source.token,c.name,c.result,"above")).count;
        check(count===c.result.length,c.name+" output count");
        var group=doc.selection[0];check(group.typename==="GroupItem" && group.pageItems.length===count,c.name+" group");
        var readback=decode(BurgVectorHost.read()).shapes;
        check(readback.length===count,c.name+" readback count");
        for(var k=0;k<count;k++) {
          var got=readback[k],want=c.result[k];
          check(got.paths.length===want.paths.length,c.name+" contour count");
          check(!!got.fill===!!want.fill && !!got.stroke===!!want.stroke,c.name+" paint");
          for(var ch=0;ch<3;ch++) {
            if(want.fill)check(Math.abs(want.fill[ch]-got.fill[ch])<1.1,c.name+" fill/order");
            if(want.stroke)check(Math.abs(want.stroke[ch]-got.stroke[ch])<1.1,c.name+" stroke/order");
          }
          // Illustrator stores compound path children in reverse insertion order.
          var unused=got.paths.slice();
          for(var m=0;m<want.paths.length;m++){
            var contour=want.paths[m], match=-1;
            for(var n=0;n<unused.length;n++){
              var first=unused[n].points[0],origin=contour.points[0];
              if(unused[n].points.length===contour.points.length && Math.abs(first[0]-origin[0])<0.02 && Math.abs(first[1]-origin[1])<0.02){match=n;break;}
            }
            check(match>=0,c.name+" anchor count/order");var points=unused.splice(match,1)[0].points;
            for(var a=0;a<points.length;a++)for(var xy=0;xy<6;xy++)
              check(Math.abs(points[a][xy]-contour.points[a][xy])<0.02,c.name+" Bezier coordinate");
          }
        }
        group.remove();check(doc.activeLayer.pageItems.length===initial,c.name+" original objects");rows.push(c.name);
      }
      selectSource();var stale=decode(BurgVectorHost.read());rect.translate(2,0);
      check(BurgVectorHost.apply(stale.token,"stale",cases[0].result,"beside").indexOf("changed")>=0,"stale edit");
      selectSource();var token=decode(BurgVectorHost.read()).token;
      var out=decode(BurgVectorHost.apply(token,"placement",input,"beside"));var placed=doc.selection[0];
      check(Math.abs(placed.visibleBounds[0]-ring.visibleBounds[2]-18)<0.02,"beside placement");
      var follow=watch({revision:token});
      check(follow.shapes.length===input.length && follow.token!==token && watch(follow).unchanged,"follow created result");
      placed.remove();
      selectSource();token=decode(BurgVectorHost.read()).token;
      var rollback=BurgVectorHost.apply(token,"rollback",[input[0],{paths:[]}],"above");
      check(rollback.indexOf("error")>=0 && doc.activeLayer.pageItems.length===initial,"partial output rollback");
      return "PASS Illustrator "+app.version+" | "+rows.join(", ")+" | selection tracking, stacking, Bezier handles, placement, stale artwork and rollback";
    } catch(e) { return "FAIL: "+e.message+" (line "+e.line+")"; }
    finally { doc.close(SaveOptions.DONOTSAVECHANGES); }
  })();`);
  const message=runHost(script);console.log(message);
  assert.ok(message.startsWith("PASS "),message);
}
