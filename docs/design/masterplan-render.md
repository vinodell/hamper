# Ойнеловские дали: рендер интерактивной карты

Asset: `public/images/masterplan-oinelovo-v1.webp`.
Created with built-in `image_gen`; exported as lossless WebP. The original generation remains in the Codex generated-images folder.

The site serves optimized WebP derivatives through `srcset`: `masterplan-oinelovo-1024.webp` (1024 × 1536, 738 KB) and `masterplan-oinelovo-640.webp` (640 × 960, 278 KB). Both retain the full framing and the overlay alignment. The original lossless asset is retained for future exports.

`public/images/masterplan-background.webp` is a 1200 × 675 derivative of the existing local aerial photograph. It is loaded lazily behind the map, with a static CSS blur and a light overlay. Only this decorative layer is blurred; the plan and its clickable polygons stay sharp.

The image is an illustrative architectural concept, not evidence of existing houses, landscaping, or amenities. Interactive boundaries and numbers are drawn from `src/interactiveMap/MapZones.ts`; existing source paths remain unchanged. Generated fences can deviate slightly from the overlay, which defines the actual click areas.

References: the supplied `render-example.png` for visual style, `public/bg-pic-oinelovo.png` for local context, and an SVG guide rasterized directly from all 21 existing map polygons. The guide has an 800 × 1200 coordinate space, with the original plan offset by (63, 86).

## Live plot data

Each polygon has an explicit `plotId` (`1-01` through `1-21`), matched to the API record within «Ойнеловские дали». The shared `PlotsProvider` supplies the map, table, gallery and contact form with one snapshot. Local fixtures use the same village IDs.

Sold polygons are red, have no number badge and cannot be selected. Reserved polygons stay yellow and retain their badge and interactions. Unmatched polygons are neutral and disabled. Open parcel details use the latest API values and close if the parcel is sold or removed.

Available parcel details link to the contact form and select that parcel. Reserved parcel details remain viewable without an application link, matching the table and gallery.

Successful admin saves notify other tabs on the same origin via `BroadcastChannel`. Public views also refresh on focus and every 30 seconds while visible. Development on localhost continues to use `localTest/plots.ts`, independently of the admin API.

## Generation prompt

Use case: sketch-to-render.
Create a premium architectural site-plan rendering for an interactive residential land sales map. PORTRAIT CANVAS, EXACT 2:3 aspect ratio (1600x2400 preferred).
INPUT 1 is the mandatory exact cadastral geometry / composition guide. INPUT 2 is the visual STYLE REFERENCE only: sophisticated sunlit 3D architectural miniature/aerial render with warm wood homes, graphite pitched roofs, refined greenery, mown lawns, pale stone paths, soft long shadows, tasteful landscaping. INPUT 3 is actual surrounding context only: a narrow wooded village strip with a single central street, low houses, surrounding mixed forest, entrance at bottom. Do not copy its plot count.
PRIMARY INVARIANT: Preserve all 21 polygon footprints of INPUT 1 at the EXACT SAME normalized pixel positions. Do not rotate, recenter, widen or shorten the strip. Preserve its distinctive diagonal leaning lower-left to upper-right, all exterior corners, the exact gap for central road, 10 left-row plots plus top cap plot, 10 right-row plots, individual plot boundaries and the exact surrounding margins. This image will have clickable polygons overlaid at those exact reference coordinates. Make fences/hedges exactly follow guide lines. Preserve the guide projection and canvas framing; use miniature architectural depth via low building walls and soft shadows without perspective distortion of ground geometry.
RENDER: replace every green polygon in the guide with a clean landscaped grass residential land parcel bounded by low delicate fences/hedges on exactly the guide edges. Put ONE modest contemporary wooden or warm plaster single-storey/compact two-storey house within each polygon, dark grey roof, discreet short driveway toward the central road, generous lawn. Every house footprint must remain inside its own polygon. Exactly 21 plots/21 houses, no added subplots. Central narrow pale-grey asphalt access road precisely in guide's existing gap, continuing out through bottom boundary; small subtle entrance parking and restrained play-area suggestion outside the plots near lower-left entrance only if room. Surrounding light-green guide background becomes soft realistic mixed forest, meadow, planted verges with subtle detail, less visually busy than site.
Warm late-afternoon sunlight, muted olive-green landscape, finely detailed beautiful marketing-quality architectural 3D rendering matching the sophistication of INPUT 2. Ground plan remains nearly orthographic with the exact guide alignment; buildings have slight top-down 3D depth. All plot boundaries legible. Avoid oversaturated emerald greens.
REMOVE ALL guide numbers and text. NO text, captions, logos, UI dots, pins, labels, watermarks, promotional claims, soccer fields, pools, or extra amenities. Do NOT reproduce the reference's large park. This is an illustrative rendering, not a photograph. Fill canvas with landscape.
