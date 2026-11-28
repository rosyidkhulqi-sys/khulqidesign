# Renders a mockup from its kit alone (what the browser will do), with the
# PSD's sample designs, and compares with Photoshop's preview JPG.
# Usage: kitrender.py <kit dir> <photoshop jpg> <out.jpg>
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from kit import warp_content, blend_over  # same warp the browser ports

kd, ps_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
kit = json.load(open(os.path.join(kd, "kit.json")))
W, H = kit["size"]
out = np.array(Image.open(os.path.join(kd, kit["base"])).convert("RGB")).astype(np.float32) / 255


def place(img_path, box, mode="RGBA"):
    """A kit image put at its box on a kit-sized array (0..1)."""
    x, y, w, h = box
    im = np.array(Image.open(img_path).convert(mode).resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    if im.ndim == 2:
        im = im[..., None]
    full = np.zeros((H, W, im.shape[2]), np.float32)
    x, y = int(round(x)), int(round(y))
    full[y:y + h, x:x + w] = im[: H - y, : W - x]
    return full


for s in kit["slots"]:
    d = kit["designs"][s["design"]]
    sample = Image.open(os.path.join(kd, f"d{s['design']}-sample.png"))
    slot = {"content": d["content"], "bounds": s["bounds"], "mesh": s["mesh"], "quad": s["quad"]}
    w = warp_content(sample, slot, (W, H)) / 255
    mask = place(os.path.join(kd, s["mask"]), s["box"], "L")[..., 0]
    alpha = w[..., 3] * mask * s["opacity"]
    rgb = np.where(w[..., 3:4] > 0, w[..., :3] / np.maximum(w[..., 3:4], 1e-6), 0)
    out = blend_over(out, rgb, alpha, s["blend"])
    clip = w[..., 3] * mask
    for c in s["clips"]:
        L = place(os.path.join(kd, c["file"]), s["box"])
        out = blend_over(out, L[..., :3], L[..., 3] * clip * c["opacity"], c["blend"])
if kit["occluders"]:
    L = place(os.path.join(kd, kit["occluders"]["file"]), kit["occluders"]["box"])
    out = blend_over(out, L[..., :3], L[..., 3], "normal")

mine = Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8))
ps = Image.open(ps_path).convert("RGB").resize((W, H), Image.LANCZOS)
diff = np.abs(np.array(mine).astype(int) - np.array(ps).astype(int)).mean()
a, b = mine.copy(), ps.copy()
a.thumbnail((1000, 1000)); b.thumbnail((1000, 1000))
side = Image.new("RGB", (a.width * 2 + 10, a.height), "white")
side.paste(a, (0, 0)); side.paste(b, (a.width + 10, 0))
side.save(out_path, quality=88)
print(os.path.basename(kd), "kit render vs Photoshop:", round(float(diff), 2))
