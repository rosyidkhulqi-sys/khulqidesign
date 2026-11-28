# Mockup kit from a Khulqidesign mockup PSD, plus a reference render.
# A kit is what the browser needs to place a design on the mockup the way
# Photoshop does: each "Your Design - X" smart object's content size, its
# 4x4 Bezier warp mesh (content space), the document quad its bounds map to,
# blend and opacity, its layer mask, the Shading/Gloss layers clipped to it,
# "Reflection - X" copies, and the Occluder layers drawn over everything.
#
# Usage: kit.py <mockup.psd> <out dir> [--check]
#   --check renders the PSD's own demo designs through the kit and saves a
#   side-by-side with Photoshop's preview JPG (the proof the warp is right).
import io, json, os, sys, glob
import numpy as np
import cv2
from PIL import Image
from psd_tools import PSDImage

GRID = 24  # mesh cells per side when warping


def fl(v):
    return float(v)


def slot_of(layer):
    d = layer.tagged_blocks.get_data(b"SoLd").data
    size = d.get(b"Sz  ")
    W, H = fl(size.get(b"Wdth")), fl(size.get(b"Hght"))
    quad = [fl(v) for v in (d.get(b"nonAffineTransform") or d.get(b"Trnf"))]
    warp = d.get(b"warp")
    style = warp.get(b"warpStyle").enum.decode() if warp else "warpNone"
    b = warp.get(b"bounds") if warp else None
    bounds = [fl(b.get(b"Left")), fl(b.get(b"Top ")), fl(b.get(b"Rght")), fl(b.get(b"Btom"))] if b else [0, 0, W, H]
    if style == "warpCustom":
        mp = warp.get(b"customEnvelopeWarp").get(b"meshPoints")
        hx = [fl(v) for v in mp.get(b"Hrzn").values]
        vy = [fl(v) for v in mp.get(b"Vrtc").values]
        mesh = [[hx[i], vy[i]] for i in range(16)]
    else:
        x0, y0, x1, y1 = bounds
        mesh = [[x0 + (x1 - x0) * c / 3, y0 + (y1 - y0) * r / 3] for r in range(4) for c in range(4)]
    blend = layer.blend_mode.name.lower()
    return {
        "name": layer.name,
        "content": [W, H],
        "bounds": bounds,
        "quad": quad,
        "mesh": mesh,
        "blend": "multiply" if blend == "multiply" else "normal",
        "opacity": round(layer.opacity / 255, 3),
    }


def bern(t):
    s = 1 - t
    return np.stack([s ** 3, 3 * s * s * t, 3 * s * t * t, t ** 3], -1)


def mesh_points(slot, n=GRID):
    """(n+1)x(n+1) document points of the warped content grid."""
    t = np.linspace(0, 1, n + 1)
    bu, bv = bern(t), bern(t)  # (n+1,4)
    m = np.array(slot["mesh"]).reshape(4, 4, 2)  # rows (v), cols (u)
    pts = np.einsum("ir,jc,rck->ijk", bv, bu, m)  # (v, u, 2) in bounds space
    x0, y0, x1, y1 = slot["bounds"]
    src = np.float32([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
    dst = np.float32(np.array(slot["quad"]).reshape(4, 2))
    Hm = cv2.getPerspectiveTransform(src, dst)
    flat = cv2.perspectiveTransform(pts.reshape(-1, 1, 2).astype(np.float32), Hm).reshape(n + 1, n + 1, 2)
    return flat


def warp_content(img, slot, size, n=GRID):
    """The content image (RGBA, any size) warped onto a document-sized RGBA."""
    Wd, Hd = size
    src = np.array(img.convert("RGBA").resize((int(slot["content"][0]), int(slot["content"][1])), Image.LANCZOS)).astype(np.float32)
    # premultiply, so edges blend cleanly
    src[..., :3] *= src[..., 3:4] / 255
    cw, ch = src.shape[1], src.shape[0]
    pts = mesh_points(slot, n)
    out = np.zeros((Hd, Wd, 4), np.float32)
    for i in range(n):
        for j in range(n):
            s = np.float32([[j / n * cw, i / n * ch], [(j + 1) / n * cw, i / n * ch],
                            [(j + 1) / n * cw, (i + 1) / n * ch], [j / n * cw, (i + 1) / n * ch]])
            d = np.float32([pts[i, j], pts[i, j + 1], pts[i + 1, j + 1], pts[i + 1, j]])
            x0, y0 = np.floor(d.min(0)).astype(int) - 1
            x1, y1 = np.ceil(d.max(0)).astype(int) + 1
            x0, y0 = max(x0, 0), max(y0, 0)
            x1, y1 = min(x1, Wd), min(y1, Hd)
            if x1 <= x0 or y1 <= y0:
                continue
            M = cv2.getPerspectiveTransform(s, d - np.float32([x0, y0]))
            patch = cv2.warpPerspective(src, M, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
            cell = np.zeros((y1 - y0, x1 - x0), np.uint8)
            cv2.fillConvexPoly(cell, np.round((d - [x0, y0]) * 16).astype(np.int32), 255, lineType=cv2.LINE_AA, shift=4)
            k = (cell.astype(np.float32) / 255)[..., None]
            roi = out[y0:y1, x0:x1]
            roi[:] = roi * (1 - k) + patch * k
    return out  # premultiplied RGBA, 0..255


def layer_rgba(layer, size):
    """A layer as a document-sized RGBA float array (straight alpha 0..1)."""
    Wd, Hd = size
    full = np.zeros((Hd, Wd, 4), np.float32)
    im = layer.topil()
    if im is None:
        return full
    im = np.array(im.convert("RGBA")).astype(np.float32) / 255
    l, t, r, b = layer.bbox
    full[t:b, l:r] = im[: b - t, : r - l]
    return full


def mask_array(layer, size):
    Wd, Hd = size
    if not layer.has_mask():
        return np.ones((Hd, Wd), np.float32)
    m = layer.mask
    full = np.full((Hd, Wd), m.background_color / 255, np.float32)
    im = m.topil()
    if im is not None:
        l, t, r, b = m.bbox
        full[t:b, l:r] = np.array(im.convert("L")).astype(np.float32)[: b - t, : r - l] / 255
    return full


def read(psd_path):
    psd = PSDImage.open(psd_path)
    size = psd.size
    slots, occluders = [], []
    for layer in psd.descendants():
        if layer.kind == "smartobject" and (layer.name.startswith("Your Design - ") or layer.name.startswith("Reflection - ")):
            s = slot_of(layer)
            s["layer"] = layer
            # groups around it count too: their opacity and masks (the
            # Reflections group fades its copies with both)
            s["parents"] = []
            p = layer.parent
            while p is not None and p is not psd:
                s["parents"].append(p)
                s["opacity"] = round(s["opacity"] * p.opacity / 255, 3)
                p = p.parent
            s["clips"] = [c for c in layer.clip_layers if c.visible]
            slots.append(s)
        elif layer.kind == "pixel" and layer.name.startswith("Occluder") and layer.visible:
            occluders.append(layer)
    return psd, size, slots, occluders


def demo_content(layer):
    data = layer.smart_object.data
    return PSDImage.open(io.BytesIO(data)).composite()


def blend_over(base, top_rgb, alpha, mode):
    a = alpha[..., None]
    if mode == "multiply":
        mixed = base * top_rgb
    elif mode == "screen":
        mixed = 1 - (1 - base) * (1 - top_rgb)
    else:
        mixed = top_rgb
    return base * (1 - a) + mixed * a


def full_mask(s, size):
    m = mask_array(s["layer"], size)
    for p in s.get("parents", []):
        m = m * mask_array(p, size)
    return m


def render(base_img, size, slots, occluders, content_for):
    out = np.array(base_img.convert("RGB")).astype(np.float32) / 255
    for s in slots:
        img = content_for(s)
        if img is None:
            continue
        w = warp_content(img, s, size) / 255
        alpha = w[..., 3] * full_mask(s, size) * s["opacity"]
        rgb = np.where(w[..., 3:4] > 0, w[..., :3] / np.maximum(w[..., 3:4], 1e-6), 0)
        out = blend_over(out, rgb, alpha, s["blend"])
        # Shading / Gloss clipped to the design: limited by its alpha and mask
        clip = w[..., 3] * full_mask(s, size)
        for c in s["clips"]:
            L = layer_rgba(c, size)
            mode = c.blend_mode.name.lower()
            out = blend_over(out, L[..., :3], L[..., 3] * clip * (c.opacity / 255), "multiply" if mode == "multiply" else "screen" if mode == "screen" else "normal")
    for o in occluders:
        L = layer_rgba(o, size)
        out = blend_over(out, L[..., :3], L[..., 3] * (o.opacity / 255), "normal")
    return Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8))


WIDTH = 2800  # the kit's width: sharp in Create, light to download


def save_png(arr01, path, mode="RGBA"):
    """arr: float 0..1, RGBA (straight) or L."""
    Image.fromarray(np.clip(arr01 * 255, 0, 255).astype(np.uint8), mode).save(path, optimize=True)


def export(psd_path, out_dir, base, size, slots, occluders):
    """Writes the browser kit: base.jpg, per slot its mask and clipped
    Shading/Gloss (cropped to the slot), occluders.png, each design's
    sample, and kit.json with every coordinate at the kit's scale."""
    k = WIDTH / size[0]
    kw, kh = round(size[0] * k), round(size[1] * k)
    sc = lambda a: (Image.fromarray(a) if isinstance(a, np.ndarray) else a)
    base.convert("RGB").resize((kw, kh), Image.LANCZOS).save(os.path.join(out_dir, "base.jpg"), quality=88, optimize=True)
    designs, kit_slots = [], []
    design_id = {}
    for s in slots:
        name = s["name"].split(" - ", 1)[1]
        if s["name"].startswith("Your Design"):
            design_id[name] = len(designs)
            designs.append({"name": name, "content": s["content"]})
    for i, s in enumerate(slots):
        name = s["name"].split(" - ", 1)[1]
        pts = mesh_points(s, 8).reshape(-1, 2)
        x0, y0 = np.floor(pts.min(0)).astype(int) - 2
        x1, y1 = np.ceil(pts.max(0)).astype(int) + 2
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, size[0]), min(y1, size[1])
        crop = lambda a: a[y0:y1, x0:x1]
        bw, bh = max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))
        m = crop(full_mask(s, size))
        Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8), "L").resize((bw, bh), Image.LANCZOS).save(os.path.join(out_dir, f"s{i}-mask.png"), optimize=True)
        clips = []
        for j, c in enumerate(s["clips"]):
            L = crop(layer_rgba(c, size))
            Image.fromarray(np.clip(L * 255, 0, 255).astype(np.uint8), "RGBA").resize((bw, bh), Image.LANCZOS).save(os.path.join(out_dir, f"s{i}-c{j}.png"), optimize=True)
            mode = c.blend_mode.name.lower()
            clips.append({"file": f"s{i}-c{j}.png", "blend": mode if mode in ("multiply", "screen") else "normal", "opacity": round(c.opacity / 255, 3)})
        if s["name"].startswith("Your Design"):
            demo_content(s["layer"]).save(os.path.join(out_dir, f"d{design_id[name]}-sample.png"), optimize=True)
        kit_slots.append({
            "name": s["name"],
            "design": design_id.get(name, 0),
            "reflection": s["name"].startswith("Reflection"),
            "bounds": s["bounds"],
            "mesh": s["mesh"],
            "quad": [round(v * k, 2) for v in s["quad"]],
            "box": [round(x0 * k, 2), round(y0 * k, 2), bw, bh],
            "blend": s["blend"],
            "opacity": s["opacity"],
            "mask": f"s{i}-mask.png",
            "clips": clips,
        })
    occ = None
    if occluders:
        full = np.zeros((size[1], size[0], 4), np.float32)
        for o in occluders:
            L = layer_rgba(o, size)
            a = L[..., 3:4] * (o.opacity / 255)
            full[..., :3] = full[..., :3] * (1 - a) + L[..., :3] * a
            full[..., 3:4] = full[..., 3:4] * (1 - a) + a
        ys, xs = np.nonzero(full[..., 3] > 0)
        ox0, oy0, ox1, oy1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        part = full[oy0:oy1, ox0:ox1].copy()
        part[..., :3] = np.where(part[..., 3:4] > 0, part[..., :3] / np.maximum(part[..., 3:4], 1e-6), 0)
        ow, oh = max(1, round((ox1 - ox0) * k)), max(1, round((oy1 - oy0) * k))
        Image.fromarray(np.clip(part * 255, 0, 255).astype(np.uint8), "RGBA").resize((ow, oh), Image.LANCZOS).save(os.path.join(out_dir, "occluders.png"), optimize=True)
        occ = {"file": "occluders.png", "box": [round(ox0 * k, 2), round(oy0 * k, 2), ow, oh]}
    kit = {"v": 1, "size": [kw, kh], "base": "base.jpg", "designs": designs, "slots": kit_slots, "occluders": occ}
    with open(os.path.join(out_dir, "kit.json"), "w") as f:
        json.dump(kit, f, indent=1)
    print(os.path.basename(os.path.dirname(psd_path)), "kit:", len(designs), "designs,", len(kit_slots), "slots", "+ occluders" if occ else "")


if __name__ == "__main__":
    psd_path, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    psd, size, slots, occluders = read(psd_path)
    folder = os.path.dirname(psd_path)
    base = Image.open(glob.glob(os.path.join(folder, "*.png"))[0])
    if "--check" in sys.argv:
        by_name = {s["name"]: s for s in slots}

        def content_for(s):
            # a reflection shows its design's content
            src = by_name.get("Your Design - " + s["name"].split(" - ", 1)[1], s) if s["name"].startswith("Reflection") else s
            return demo_content(src["layer"])

        mine = render(base, size, slots, occluders, content_for)
        ps = Image.open(glob.glob(os.path.join(folder, "*.jpg"))[0]).convert("RGB")
        a, b = mine.copy(), ps.copy()
        a.thumbnail((1000, 1000)); b.thumbnail((1000, 1000))
        side = Image.new("RGB", (a.width * 2 + 10, a.height), "white")
        side.paste(a, (0, 0)); side.paste(b, (a.width + 10, 0))
        side.save(os.path.join(out_dir, "check.jpg"), quality=88)
        diff = np.abs(np.array(mine).astype(int) - np.array(ps).astype(int)).mean()
        print(os.path.basename(folder), "mean abs diff vs Photoshop:", round(float(diff), 2))
    if "--export" in sys.argv:
        export(psd_path, out_dir, base, size, slots, occluders)
