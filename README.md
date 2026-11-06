# Burg Vector

Burg Vector brings thirteen vector effects to Adobe Illustrator 2026. Select artwork to see it in the panel, adjust the effect, then create a group of editable paths. The blue block and white figure below were extruded together. The long white ridges are the side walls of the figure itself.

![A white figure and blue rectangle extruded together, with the figure’s outline forming long ridges across the block](screenshots/Screenshot%202026-11-06%20at%2018.15.02.png)

[Install Burg Vector](#installation) · [Try the pictured extrusion](#try-the-pictured-extrusion) · [Screenshot gallery](#one-figure-six-effects) · [All 13 effects](#effect-guide)

## Installation

Version **0.2.4** targets desktop Illustrator **2026 (30.x)** and Adobe’s CEP 12 panel runtime. The signed extension is [Burg Vector.zxp](Burg%20Vector.zxp). For macOS, choose **Code → Download ZIP** on the repository home page and extract the archive. For Windows, use the installer ZIP below.

| Platform | Status |
| --- | --- |
| macOS | Installed and tested in Illustrator 30.8.2, including all thirteen effects and a 3,600 pt extrusion. |
| Windows x64 (Intel or AMD) | The installer was exercised on Windows with simulated Adobe installer responses. End-to-end installation and effects in Illustrator on Windows still need verification. |

### macOS

1. Open Creative Cloud Desktop and sign in.
2. In the extracted folder, double-click **Install Burg Vector.command**. Keep it next to **Burg Vector.zxp**.
3. After the installer reports success, restart Illustrator and choose **Window → Extensions → Burg Vector**.

### Windows x64

**[Download the Windows installer for Burg Vector 0.2.4 (ZIP)](https://github.com/tsevis/burg-vector/releases/download/v0.2.4/Burg-Vector-0.2.4-Windows.zip)**

1. Install Illustrator 2026 (30.x) and sign in to Creative Cloud Desktop.
2. Right-click the downloaded ZIP and choose **Extract All**. Open the extracted folder and double-click **Install Burg Vector.cmd**. Keep **Burg Vector.zxp** alongside it.
3. Wait for **Burg Vector 0.2.4 is installed**. Save your work, restart Illustrator, and choose **Window → Extensions → Burg Vector**.
4. Select a filled rectangle, choose **3D Transform**, and click **Create vector artwork**. A new group beside the rectangle confirms the panel can read and write artwork in Illustrator.

The installer calls Adobe’s Unified Plugin Installer Agent and checks that Creative Cloud lists the installed version. If it cannot find the Adobe installer, open or update Creative Cloud Desktop, sign in, and try again. If Adobe reports an error, its message stays in the installer window until you press a key. [Adobe’s installation instructions](https://helpx.adobe.com/creative-cloud/apps/integration-with-other-apps/manage-plugins/install-plugins-using-upia-tool.html)

To remove the extension, use **Manage plugins** in Creative Cloud Desktop. This build uses a self-signed development certificate.

## Try the pictured extrusion

![Illustrator selection on the left and the Burg Vector panel on the right previewing a 240 pt extrusion](screenshots/Screenshot%202026-11-06%20at%2018.14.37.png)

1. Select a filled silhouette and its background together. The preview follows the selection automatically. For lettering, make an outlined copy first.
2. Choose **3D Transform**. The screenshot uses **Rotate X 15°**, **Y 30°**, **Z 19°**, **Extrusion 240 pt**, **Perspective 50%**, and **Light direction 96°**. For a longer extrusion, drag the slider up to **3,600 pt**, or type any whole-point depth. The slider moves by 1 pt through 180 pt and by 20 pt beyond it.
3. Use **Show original** to compare. Choose **Beside original** and click **Create vector artwork** to place a new group 18 pt to the right, on the source layer. **Over original** uses the source coordinates and keeps the original artwork underneath.
4. Illustrator selects the new group. You can ungroup it to edit a face, apply a different effect to the whole result, or reselect the original to try another version.

## One figure, six effects

Each pair shows the same three selected objects. Click any screenshot to inspect the controls at full size.

| Warp Frame | Vector Distort |
| --- | --- |
| [![Warp Frame panel with four corner handles around a tapered blue frame and white figure](screenshots/Screenshot%202026-11-06%20at%2018.15.34.png)](screenshots/Screenshot%202026-11-06%20at%2018.15.34.png) | [![Vector Distort panel twisting the figure into a white spiral](screenshots/Screenshot%202026-11-06%20at%2018.15.46.png)](screenshots/Screenshot%202026-11-06%20at%2018.15.46.png) |
| **Receding plane** brings the top corners together. Drag any corner in the preview to adjust the taper. | The **Swirl** lens twists the figure and background around a shared center. Move the center to change where the twist starts. |

| Fracture | Sketch |
| --- | --- |
| [![Fracture panel showing separated blue and white polygon fragments](screenshots/Screenshot%202026-11-06%20at%2018.15.52.png)](screenshots/Screenshot%202026-11-06%20at%2018.15.52.png) | [![Sketch panel outlining the figure and its blue frame with loose pen strokes](screenshots/Screenshot%202026-11-06%20at%2018.16.05.png)](screenshots/Screenshot%202026-11-06%20at%2018.16.05.png) |
| **Cells** cuts the artwork into pieces. Increase **Separation** to open the cracks, or change **Seed** for a different break pattern. | Two pen passes trace the silhouette. Adjust **Roughness** for a looser line and **Pen width** for a heavier mark. |

| Emboss | Flare |
| --- | --- |
| [![Emboss panel showing a narrow highlight and shadow along the white figure](screenshots/Screenshot%202026-11-06%20at%2018.16.21.png)](screenshots/Screenshot%202026-11-06%20at%2018.16.21.png) | [![Flare panel placing a twelve-ray starburst on the figure’s outstretched arm](screenshots/Screenshot%202026-11-06%20at%2018.16.28.png)](screenshots/Screenshot%202026-11-06%20at%2018.16.28.png) |
| A shallow **1.5 pt** edge picks out the figure against the blue. Rotate **Light direction** to change which edge catches the light. | Drag the flare center onto a detail. **Rays**, **Ray radius**, and **Halo size** control the starburst separately. |

## Effect guide

| Effect | What you can make |
| --- | --- |
| 3D Transform | Rotate and extrude filled paths. The front, back and shaded side walls become editable vector faces. |
| Warp Frame | Taper a design with four corner handles, then bow each edge independently. |
| Vector Distort | Apply Swirl, Spherize, Pinch, Rotate, Magnify, Zig, Zag or ZigZag around a movable center. |
| Fracture | Cut closed shapes into cells or radial fragments. Set the impact center, separation and rotation. |
| Inset | Offset an outline inward or outward, including the holes in compound paths. Choose round, miter or square joins. |
| Point Editor | Move an anchor or either Bézier handle, subdivide a segment, or switch a point between smooth and corner. |
| Simplify | Reduce anchor count. A lower curve tolerance keeps the result closer to the source contour. |
| Sketch | Trace paths with repeatable, slightly irregular pen strokes. Control roughness, passes, width and seed. |
| Color Shift | Change hue, saturation, lightness, contrast, inversion and grayscale for fills and strokes. |
| Emboss | Build a highlight and shadow along an edge. Set the relief depth, light angle and contrast. |
| Flare | Add a movable halo and rays. Set their size, angle and number. |
| Neon | Build a bright tube and layered glow bands around a contour. |
| Shadow Echo | Repeat the silhouette along a direction, fading, scaling or rotating the copies. |

Each effect has a built-in alternate preset. **Vary** previews a small change to the current settings. Choose **Preset → Before variation** to compare, or **Save** to keep one personal preset per effect on this computer.

## Preparing artwork

- **Paths and color.** Select painted paths, compound paths or ordinary groups with solid RGB, CMYK or grayscale fills or strokes. Outline live type, expand brushes and complex appearances, and release clipping masks before selecting the artwork. Convert spot, gradient or pattern paint to solid colors where needed.
- **Closed shapes.** 3D Transform, Inset and Fracture need closed, filled paths. Inset and Fracture approximate curves with line segments when calculating offsets and intersections.
- **Complex selections.** Work in batches of up to 150 painted objects and 6,000 source anchors. If a result exceeds 1,800 objects or 40,000 anchors, reduce the detail or select fewer objects.
- **Editing afterward.** Keep the original if you want to revisit settings. The result is an expanded group of Illustrator paths. A new selection immediately replaces the panel preview, and deselecting clears it.

## Development and credits

The panel runs offline. The [effect catalog](extension/catalog.js) defines the controls. [effects.js](extension/effects.js) and [path-effects.js](extension/path-effects.js) generate the geometry used for both the preview and the Illustrator result. The [host script](extension/host.jsx) checks the selection again before writing and removes a partially created group if a write fails.

From the repository directory, run the geometry checks with Node.js 20 or later:

```sh
node tools/check.mjs
```

On a Mac with Illustrator installed, `node tools/check.mjs --illustrator` also creates results in temporary Illustrator documents and checks the paths it reads back. To sign a new ZXP, set `ZXP_PASSWORD` for your signing identity and run `tools/package.sh /path/to/ZXPSignCmd /path/to/identity.p12 output.zxp`.

Burg Vector is an independent implementation inspired by KPT Vector Effects 1.5. It recreates filter workflows with editable output. Legacy presets, Appearance-panel live effects, 3D bevels and metallic materials are outside this version. The original software and manual are excluded from the distribution. The project is unaffiliated with the original publisher, Corel or Adobe.

The extension includes the Clipper geometry library and its JSBN component. [Third-party notices](extension/vendor/LICENSES.txt)
