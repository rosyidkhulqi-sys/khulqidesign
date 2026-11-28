# Mockup kits

A mockup PSD can't be read by the browser, so each mockup gets a **kit**: the
pieces Create needs to place a design on it the way Photoshop does.

From the PSD (made by the rules in the mockup folder's `_old/BRIEF.md`):

- every `Your Design - X` smart object: its content size, its 4×4 Bézier warp
  mesh (Photoshop's custom warp, or a flat grid for none), the document quad
  its bounds map to (perspective), blend and opacity, and its layer mask
  together with any group masks and opacities around it;
- `Reflection - X` copies, which show design X;
- the `Shading` / `Gloss` / `Light` layers clipped to each design (Multiply or
  Screen), drawn only where the design is;
- the `Occluder` layers, drawn over everything;
- each design's sample (the PSD's own demo), so a mockup opens filled in.

The base photo is the mockup folder's PNG (the clean scene).

## Files

```
kit/
  kit.json          size, designs, slots (mesh, quad, box, blend, mask, clips), occluders
  base.jpg          the scene, 2800 px wide
  s<i>-mask.png     slot i's mask, cropped to its box
  s<i>-c<j>.png     slot i's clipped Shading / Gloss, cropped to its box
  d<n>-sample.png   design n's sample
  occluders.png     everything in front of the designs
```

Mesh points are in the design's own space (`bounds`); `quad` and `box` are in
kit pixels. A design point (u, v) goes through the Bézier mesh, then the
perspective map from `bounds` to `quad`.

## Use

Needs Python 3 with `pillow`, `psd-tools`, `numpy`, `opencv-python-headless`
(a virtualenv outside the repo).

```
python kit.py  path/to/mockup.psd  out/kit  --export          # write the kit
python kit.py  path/to/mockup.psd  out/     --check           # PSD render vs Photoshop's JPG
python kitrender.py out/kit path/to/mockup.jpg out/check.jpg  # render from the kit alone
```

`--check` and `kitrender.py` print the mean difference from Photoshop's
preview (0 to 255). The first nine mockups (MK AI 1126) all came out under 2:
the same picture.

## The browser renderer

`src/lib/mockupRender.js` draws a mockup from its kit in the browser with the
same steps (`loadKit`, `renderMockup`). It takes `makeCanvas` and `loadImage`
from the caller, so it also runs in Node for checking:

```
npm i --no-save @napi-rs/canvas      # in a scratch folder, not the app
node test-render.mjs ../../src/lib/mockupRender.js path/to/kit out.png
```

The first kits rendered this way match Photoshop as closely as the Python
render (mean difference 0.8 to 1.4), in 16 to 70 ms each.
