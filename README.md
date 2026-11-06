# Burg Vector

Burg Vector is an independent collection of thirteen editable vector effects for Adobe® Illustrator® 2026 on macOS. It was inspired by KPT Vector Effects 1.5. This project is unaffiliated with the original publisher, Corel, or Adobe.

Select a path, turn a control, and watch the preview. Choose **Vary** to try a nearby setting. Use **Preset → Before variation** to go back, or **Save** to keep a combination you like. Only **Create vector artwork** writes the result to your document.

## Install and use

1. Open Creative Cloud Desktop and sign in. Double-click **Install Burg Vector.command** next to **Burg Vector.zxp**. It calls Adobe’s Unified Plugin Installer Agent.
2. Reopen Illustrator and choose **Window → Extensions → Burg Vector**.
3. Select a filled shape, an outlined letter, or a group of paths. The preview follows the current Illustrator selection automatically. Deselect everything to clear it.
4. Choose an effect. Change the controls, compare it with **Show original**, or try the alternate preset. **Save** remembers one personal preset per effect on this Mac.
5. Click **Create vector artwork**. By default the result sits 18 points to the right of the source, on the source layer. **Over original** places it at the source coordinates. Illustrator selects the result, and the panel follows it so you can apply another effect.

To remove the installed extension, open Creative Cloud Desktop and use **Manage plugins**. The package uses a self-signed development certificate.

## Included effects

| Effect | Controls and output in this build |
| --- | --- |
| 3D Transform | Extrusion from 0 to 3,600 pt, XYZ rotation, perspective and directional lighting. The depth slider moves in 1 pt steps through 180 pt, then in 20 pt steps. Type any whole-point depth for exact placement. |
| Color Shift | Hue, saturation, lightness, inversion, grayscale and contrast for fills and strokes. |
| Emboss | Offset highlight and shadow shapes with adjustable depth, contrast and light angle. |
| Flare | Adjustable rays, halo and center. Drag the center in the preview. |
| Inset | Inward and outward path offsets with three corner treatments. Enclosed holes participate in the offset. |
| Neon | Graduated glow bands around contours with an adjustable bright core. |
| Point Editor | Move anchors and incoming or outgoing handles, subdivide a Bézier segment, smooth an anchor or make it a corner. Drag a point to target one contour. |
| Shadow Echo | Repeated vector shadows with distance, direction, fade, scale and rotation. |
| Fracture | Seeded cell fragments or a radial fracture, with an adjustable impact center, separation and rotation. Fragments are cut paths. |
| Simplify | Reduce anchors by fitting adjacent Bézier segments within a sampled tolerance. |
| Sketch | Seeded pen passes with adjustable roughness, width and density. |
| Vector Distort | Swirl, Spherize, Pinch, Rotate, Magnify, Zig, Zag and ZigZag lenses with movable center and adjustable radius. |
| Warp Frame | Drag the four corner handles, or set their coordinates numerically. Bow each edge independently. |

## Artwork and fidelity

Use solid RGB, CMYK or grayscale fills and strokes. Ordinary groups and compound paths are supported. Outline text and expand brushes and complex appearances before capturing. Clipping masks, group transparency, spot/gradient/pattern paint and raster artwork require preparation. 3D Transform, Inset and Fracture require closed, filled paths. Inset and Fracture polygonize curved boundaries to compute intersections.

The build targets the filter workflows and produces expanded artwork. Native Appearance-panel live effects, legacy preset import, multi-impact and multi-lens editing, 3D bevels and metallic materials are outside this version. Visual parity with the original binaries has yet to be measured. The package contains the independently written extension and the Clipper geometry library.

## Development

The extension runs offline. Its catalog is in `extension/catalog.js`, geometry and filter implementations are in `geometry.js`, `path-effects.js` and `effects.js` under that directory. The panel renders the same path data that `host.jsx` writes to Illustrator. A capture is checked again before writing, and a failed write removes the partially created group.

Run the following commands from the project directory using Node.js 20 or later.

```sh
node tools/check.mjs
node tools/check.mjs --illustrator
```

The second command runs the suite through AppleScript in a disposable Illustrator document and closes that document afterward. To rebuild the ZXP, set `ZXP_PASSWORD` for your own signing identity and run `tools/package.sh /path/to/ZXPSignCmd /path/to/identity.p12 output.zxp`. The vendored Clipper library includes JSBN. Their copyright and license notices travel with the source and signed extension. [Third-party notices](extension/vendor/LICENSES.txt)

Adobe documents the panel runtime, packaging tools and command-line installation. [CEP resources](https://github.com/Adobe-CEP/CEP-Resources) · [Adobe plug-in installer](https://helpx.adobe.com/ca/creative-cloud/apps/integration-with-other-apps/manage-plugins/install-plugins-using-upia-tool.html)

Adobe and Illustrator are either registered trademarks or trademarks of Adobe in the United States and/or other countries.
