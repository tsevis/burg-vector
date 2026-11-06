/* Illustrator's ExtendScript engine uses ES3. The panel owns effect math. */
var BurgVectorHost = (function () {
    var capture = null, observed = null;
    function fail(message) { throw new Error(message); }
    function json(value) {
        var i, parts = [];
        if (value === null) return "null";
        if (typeof value === "string") {
            return '"' + value.replace(/["\\\x00-\x1f\u2028\u2029]/g, function (c) {
                return "\\u" + ("000" + c.charCodeAt(0).toString(16)).slice(-4);
            }) + '"';
        }
        if (typeof value === "number") {
            if (!isFinite(value)) fail("Invalid coordinate in artwork.");
            return String(value);
        }
        if (typeof value === "boolean") return String(value);
        if (value instanceof Array) {
            for (i = 0; i < value.length; i++) parts.push(json(value[i]));
            return "[" + parts.join(",") + "]";
        }
        for (i in value) if (value.hasOwnProperty(i)) parts.push(json(i) + ":" + json(value[i]));
        return "{" + parts.join(",") + "}";
    }
    function paint(color) {
        if (color.typename === "RGBColor") return [color.red, color.green, color.blue];
        var type, channels;
        if (color.typename === "CMYKColor") {
            type = ImageColorSpace.CMYK; channels = [color.cyan, color.magenta, color.yellow, color.black];
        } else if (color.typename === "GrayColor") {
            type = ImageColorSpace.GrayScale; channels = [color.gray];
        } else {
            fail("Use solid RGB, CMYK, or grayscale paint. Expand gradients, patterns and spot colors first.");
        }
        var rgb = app.convertSampleColor(type, channels, ImageColorSpace.RGB, ColorConvertPurpose.defaultpurpose);
        return [rgb[0], rgb[1], rgb[2], color.typename].concat(channels);
    }
    function toPaint(v) {
        var c;
        if (v[3] === "CMYKColor") {
            c = new CMYKColor(); c.cyan=v[4]; c.magenta=v[5]; c.yellow=v[6]; c.black=v[7];
        } else if (v[3] === "GrayColor") {
            c = new GrayColor(); c.gray=v[4];
        } else {
            c = new RGBColor(); c.red=v[0]; c.green=v[1]; c.blue=v[2];
        }
        return c;
    }
    function contour(item, counts) {
        if (item.guides || item.clipping) fail("Release clipping masks and omit guides to preview these paths.");
        var points = [], pp = item.pathPoints;
        counts.points += pp.length;
        if (counts.points > 6000) fail("Select at most 6,000 source anchors at a time.");
        if (pp.length < 2) fail("Remove isolated anchor points from the selection.");
        for (var i = 0; i < pp.length; i++) {
            var q = pp[i], a = q.anchor, l = q.leftDirection, r = q.rightDirection;
            points.push([a[0],a[1],l[0],l[1],r[0],r[1]]);
        }
        return {points:points,closed:item.closed};
    }
    function readItem(item, shapes, counts) {
        if (item.hidden) return;
        if (item.blendingMode != BlendModes.NORMAL) fail("Expand blended artwork before capturing.");
        if (item.typename === "GroupItem") {
            if (item.clipped || item.opacity !== 100) fail("Expand masked or translucent groups before capturing.");
            // Illustrator enumerates children front to back. The renderer paints back to front.
            for (var i = item.pageItems.length - 1; i >= 0; i--) readItem(item.pageItems[i], shapes, counts);
            return;
        }
        var path = item, paths = [];
        if (item.typename === "CompoundPathItem") {
            if (item.pathItems.length === 0) fail("The selected compound path is empty.");
            path = item.pathItems[0];
            for (var j = 0; j < item.pathItems.length; j++) paths.push(contour(item.pathItems[j], counts));
        } else if (item.typename === "PathItem") {
            paths.push(contour(item, counts));
        } else {
            fail("Select paths, compound paths, or path groups. Outline live type and expand other artwork first.");
        }
        if (!path.filled && !path.stroked) return;
        var dash = [], dashes = path.strokeDashes;
        if (path.stroked) for (var k = 0; k < dashes.length; k++) dash.push(dashes[k]);
        shapes.push({paths:paths,fill:path.filled ? paint(path.fillColor) : null,
            stroke:path.stroked ? paint(path.strokeColor) : null,width:path.stroked ? path.strokeWidth : 0,
            opacity:item.opacity,evenodd:path.evenodd,dash:dash,dashOffset:path.strokeDashOffset,
            cap:path.strokeCap == StrokeCap.ROUNDENDCAP ? "round" : (path.strokeCap == StrokeCap.PROJECTINGENDCAP ? "square" : "butt"),
            join:path.strokeJoin == StrokeJoin.ROUNDENDJOIN ? "round" : (path.strokeJoin == StrokeJoin.BEVELENDJOIN ? "bevel" : "miter"),
            miter:path.strokeMiterLimit});
        if (shapes.length > 150) fail("Select at most 150 painted objects at a time.");
    }
    function stack(item) {
        var order = [];
        while (item.typename !== "Document") {
            // Layer zero is frontmost. Within a layer, zOrderPosition increases toward the front.
            if (item.typename === "Layer") {
                var peers = item.parent.layers, n = 0;
                while (n < peers.length && peers[n] != item) n++;
                order.unshift(-n);
            } else { order.unshift(item.zOrderPosition); }
            item = item.parent;
        }
        return order;
    }
    function selected() {
        if (!app.documents.length) fail("Open an Illustrator document and select artwork.");
        var doc = app.activeDocument, sel = doc.selection, rows = [], shapes = [], ids = [];
        if (!sel || !sel.length || sel.typename === "TextRange") fail("Select whole vector objects with the Selection tool.");
        for (var i = 0; i < sel.length; i++) {
            if (!sel[i].uuid) fail("Select whole vector objects with the Selection tool.");
            rows.push({item:sel[i],order:stack(sel[i])});
        }
        rows.sort(function(a,b) {
            for (var j = 0; j < Math.min(a.order.length,b.order.length); j++)
                if (a.order[j] !== b.order[j]) return a.order[j]-b.order[j];
            return a.order.length-b.order.length;
        });
        var counts = {points:0}, right = -Infinity, top = -Infinity;
        for (i = 0; i < rows.length; i++) {
            var item = rows[i].item;
            readItem(item, shapes, counts); ids.push(item.uuid);
            var bounds = item.visibleBounds;
            right = Math.max(right,bounds[2]); top = Math.max(top,bounds[1]);
        }
        if (!shapes.length) fail("The selection contains no visible painted paths.");
        return {doc:doc,shapes:shapes,ids:ids,right:right,top:top,layer:rows[rows.length-1].item.layer};
    }
    function inDocumentCoordinates(fn) {
        var old = app.coordinateSystem;
        try { app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM; return fn(); }
        finally { app.coordinateSystem = old; }
    }
    function withCoordinates(fn) {
        try { return inDocumentCoordinates(fn); }
        catch (e) { return json({error:String(e.message || e)}); }
    }
    function ticket() { return String(new Date().getTime()) + "-" + String(Math.random()).slice(2); }
    function sameDocument(a,b) {
        // Illustrator throws when comparing a cached reference to a closed document.
        try { return a == b; } catch (_) { return false; }
    }
    function takeSnapshot() {
        var s = selected(), data = json(s.shapes), ids = s.ids.join(",");
        if (!capture || !sameDocument(capture.doc,s.doc) || capture.ids !== ids || capture.data !== data)
            capture = {doc:s.doc,ids:ids,data:data,token:ticket()};
        return '{"token":'+json(capture.token)+',"shapes":'+data+'}';
    }
    function read() {
        observed = null;
        return withCoordinates(takeSnapshot);
    }
    // Idle polls look at the selected objects, not their individual paths or anchors.
    function watch(previous, inspect) {
        try {
            var doc = app.documents.length ? app.activeDocument : null, sel = doc ? doc.selection : null;
            var ids = [], key = "none", state = "empty", note = doc ?
                "Select artwork in Illustrator." : "Open an Illustrator document to preview artwork.";
            if (sel && (sel.typename === "TextRange" || sel.typename === "InsertionPoint")) {
                key = "text"; state = "unsupported"; note = "Select whole objects. Outline live type to preview it.";
            } else if (sel && sel.length) {
                for (var i = 0; i < sel.length; i++) {
                    var item = sel[i];
                    ids.push(item.uuid ? item.uuid + ":" + item.geometricBounds.join(",") : String(item.typename));
                }
                key = ids.sort().join("|"); state = "selection";
            }
            var same = observed && sameDocument(observed.doc,doc) && observed.key === key;
            if (same && previous === observed.revision && !inspect) return '{"unchanged":true}';
            var revision, reply;
            if (state === "selection") {
                try { reply = inDocumentCoordinates(takeSnapshot); }
                catch (problem) { state = "unsupported"; note = String(problem.message || problem); }
            }
            if (state === "selection") {
                revision = capture.token;
            } else {
                capture = null;
                revision = same && observed.note === note ? observed.revision : ticket();
                reply = json({state:state,reason:note});
            }
            observed = {doc:doc,key:key,revision:revision,note:state === "selection" ? null : note};
            if (previous === revision) return '{"unchanged":true}';
            return '{"revision":'+json(revision)+','+reply.substring(1);
        } catch (e) {
            observed = null; capture = null;
            return json({error:String(e.message || e)});
        }
    }
    function style(path, s) {
        path.filled = !!s.fill; path.stroked = !!s.stroke; path.evenodd = !!s.evenodd;
        if (s.fill) path.fillColor = toPaint(s.fill);
        if (s.stroke) {
            path.strokeColor = toPaint(s.stroke); path.strokeWidth = s.width;
            path.strokeCap = s.cap === "round" ? StrokeCap.ROUNDENDCAP :
                (s.cap === "square" ? StrokeCap.PROJECTINGENDCAP : StrokeCap.BUTTENDCAP);
            path.strokeJoin = s.join === "round" ? StrokeJoin.ROUNDENDJOIN :
                (s.join === "bevel" ? StrokeJoin.BEVELENDJOIN : StrokeJoin.MITERENDJOIN);
            path.strokeMiterLimit = s.miter || 4;
            path.strokeDashes = s.dash && s.dash.length ? s.dash : [];
            path.strokeDashOffset = s.dashOffset || 0;
        }
    }
    function draw(group,s) {
        var multi = s.paths.length > 1, parent = multi ? group.compoundPathItems.add() : group;
        var path;
        for (var i = s.paths.length - 1; i >= 0; i--) {
            var p = s.paths[i], anchors = [], pts = p.points;
            if (pts.length > 1000) fail("Illustrator limits each contour to 1,000 anchors in this build. Reduce the effect detail or simplify the source.");
            for (var j = 0; j < pts.length; j++) anchors.push([pts[j][0],pts[j][1]]);
            path = parent.pathItems.add(); path.setEntirePath(anchors); path.closed = p.closed;
            for (j = 0; j < pts.length; j++) {
                var q = pts[j];
                if (q[0] === q[2] && q[0] === q[4] && q[1] === q[3] && q[1] === q[5]) continue;
                var point = path.pathPoints[j];
                if (q[0] !== q[2] || q[1] !== q[3]) point.leftDirection = [q[2],q[3]];
                if (q[0] !== q[4] || q[1] !== q[5]) point.rightDirection = [q[4],q[5]];
            }
            style(path,s);
        }
        (multi ? parent : path).opacity = s.opacity;
    }
    function apply(token,name,shapes,placement) {
        return withCoordinates(function() {
            if (!capture || capture.token !== token) fail("The selection changed. The preview is refreshing.");
            var s = selected();
            if (!sameDocument(capture.doc,s.doc) || capture.ids !== s.ids.join(",") || capture.data !== json(s.shapes))
                fail("The artwork or selection changed. The preview is refreshing.");
            if (s.layer.locked || !s.layer.visible) fail("Unlock the source layer first.");
            var group = s.layer.groupItems.add(), previous = s.doc.selection;
            try {
                group.name = "Burg Vector · " + name;
                for (var i = 0; i < shapes.length; i++) draw(group,shapes[i]);
                if (placement === "beside") {
                    var b = group.visibleBounds;
                    group.translate(s.right + 18 - b[0], s.top - b[1]);
                }
                s.doc.selection = null; group.selected = true;
                capture = null; observed = null;
                return json({count:shapes.length});
            } catch (e) {
                group.remove(); s.doc.selection = previous; throw e;
            }
        });
    }
    return {read:read,watch:watch,apply:apply};
})();
