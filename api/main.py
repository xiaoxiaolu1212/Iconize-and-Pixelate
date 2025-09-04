from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import Response, FileResponse, HTMLResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from io import BytesIO
from pathlib import Path
from typing import Optional
import numpy as np
from PIL import Image, ImageOps, ImageFilter, ImageChops

# --------------------------------------------------------------------------------------
# App setup
# --------------------------------------------------------------------------------------

app = FastAPI(title="Iconize & Pixelate API")

# Allow cross-origin if you later host UI elsewhere; safe for same-origin too
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resolve project root (folder that contains index.html, script.js, styles.css)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = PROJECT_ROOT / "index.html"
SCRIPT_PATH = PROJECT_ROOT / "script.js"
STYLES_PATH = PROJECT_ROOT / "styles.css"

# --------------------------------------------------------------------------------------
# Utility helpers
# --------------------------------------------------------------------------------------

def pil_to_png_bytes(img: Image.Image) -> bytes:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def hex_or_none(s: Optional[str]) -> Optional[str]:
    """Treat empty strings or 'transparent' (any case) as None."""
    if not s:
        return None
    s = s.strip()
    if s == "" or s.lower() == "transparent":
        return None
    return s

# --- Iconize pipeline ---------------------------------------------------------------

def to_grayscale(img: Image.Image) -> Image.Image:
    return ImageOps.grayscale(img)

def binarize(img: Image.Image, threshold: int = 200) -> Image.Image:
    """
    Return L-mode mask with 0 for black (ink) and 255 for white (background).
    """
    g = to_grayscale(img)
    return g.point(lambda p: 255 if p > threshold else 0, mode="L")

def smooth_edges(mask: Image.Image, radius: float = 1.2) -> Image.Image:
    blurred = mask.filter(ImageFilter.GaussianBlur(radius))
    return blurred.point(lambda p: 255 if p > 127 else 0).convert("L")

def thicken(mask: Image.Image, iterations: int = 1) -> Image.Image:
    """
    Simple morphological dilation: 3x3 max filter repeated 'iterations' times.
    Input and output are L-mode with 0/255 values.
    """
    arr = np.array(mask, dtype=np.uint8)
    for _ in range(max(0, iterations)):
        padded = np.pad(arr, 1, constant_values=0)
        arr = np.maximum.reduce([
            padded[0:-2, 0:-2], padded[0:-2, 1:-1], padded[0:-2, 2:],
            padded[1:-1, 0:-2], padded[1:-1, 1:-1], padded[1:-1, 2:],
            padded[2:,   0:-2], padded[2:,   1:-1], padded[2:,   2:]
        ])
    return Image.fromarray(arr, mode="L")

def stroke_from_mask(mask: Image.Image, width: int = 2) -> Image.Image:
    if width <= 0:
        return Image.new("L", mask.size, 0)
    outer = thicken(mask, iterations=max(1, width // 2))
    inner = mask
    return ImageChops.subtract(outer, inner)

def flat_iconize(
    img: Image.Image,
    fg: str = "#111111",
    bg: Optional[str] = None,
    threshold: int = 200,
    stroke_px: int = 0,
) -> Image.Image:
    """
    Assumes black lines on white background.
    Produces flat-colored RGBA with optional stroke and background.
    """
    mask = binarize(img, threshold=threshold)
    mask = smooth_edges(mask, radius=1.2)
    mask = thicken(mask, iterations=1)

    W, H = img.size

    # Our mask has 0 for ink (black), 255 for background (white).
    # Convert to alpha where ink -> 255, background -> 0
    alpha = mask.point(lambda p: 0 if p > 0 else 255)

    fg_layer = Image.new("RGBA", (W, H), fg)
    fg_layer.putalpha(alpha)

    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if bg:
        base = Image.new("RGBA", (W, H), bg)

    if stroke_px > 0:
        s = stroke_from_mask(mask, width=stroke_px)
        s_alpha = s.point(lambda p: 255 if p > 0 else 0)
        stroke_layer = Image.new("RGBA", (W, H), "#000000")
        stroke_layer.putalpha(s_alpha)
        base = Image.alpha_composite(base, stroke_layer)

    out = Image.alpha_composite(base, fg_layer)
    return out

# --- Pixelate pipeline --------------------------------------------------------------

def pixelate(
    img: Image.Image,
    palette_size: int = 8,
    pixel_size: int = 8,
    dither: bool = False,
) -> Image.Image:
    """
    Quick, dependency-light pixelation:
      1) Reduce palette with a 1-iteration k-means-lite.
      2) Downscale with NEAREST and upscale back with NEAREST.
      3) Optional dithering via P-mode conversion.
    """
    rgb = img.convert("RGB")
    arr = np.array(rgb)
    h, w, _ = arr.shape
    flat = arr.reshape(-1, 3).astype(np.float32)

    n = max(2, min(int(palette_size), flat.shape[0]))
    rng = np.random.default_rng(42)
    centers = flat[rng.choice(flat.shape[0], size=n, replace=False)]
    # assign
    dist = ((flat[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
    labels = dist.argmin(axis=1)
    # update
    for k in range(n):
        pts = flat[labels == k]
        if pts.size:
            centers[k] = pts.mean(axis=0)

    mapped = centers[labels].reshape(h, w, 3).astype(np.uint8)
    pal_img = Image.fromarray(mapped, mode="RGB")

    # chunky pixels
    down_w = max(1, w // int(pixel_size))
    down_h = max(1, h // int(pixel_size))
    down = pal_img.resize((down_w, down_h), Image.NEAREST)
    up = down.resize((w, h), Image.NEAREST)

    if dither:
        up = up.convert("P", palette=Image.ADAPTIVE, colors=n).convert("RGB")
    return up

# --------------------------------------------------------------------------------------
# API routes
# --------------------------------------------------------------------------------------

@app.post("/iconize")
async def iconize_endpoint(
    file: UploadFile = File(...),
    fg_color: str = Form("#111111"),
    bg_color: str = Form(""),
    threshold: int = Form(200),
    stroke_px: int = Form(0),
):
    """
    Form fields expected by your frontend:
      - fg_color (hex), bg_color (hex or empty string for transparent)
      - threshold (0..255), stroke_px (0..8)
    """
    try:
        data = await file.read()
        img = Image.open(BytesIO(data))
        out = flat_iconize(
            img,
            fg=fg_color,
            bg=hex_or_none(bg_color),
            threshold=int(threshold),
            stroke_px=int(stroke_px),
        )
        return Response(content=pil_to_png_bytes(out), media_type="image/png")
    except Exception as e:
        return PlainTextResponse(str(e), status_code=400)

@app.post("/pixelate")
async def pixelate_endpoint(
    file: UploadFile = File(...),
    palette_size: int = Form(8),
    pixel_size: int = Form(8),
    dither: str = Form("false"),  # "true" | "false"
):
    """
    Form fields expected by your frontend:
      - palette_size (2..32), pixel_size (2..32), dither ("true"/"false")
    """
    try:
        data = await file.read()
        img = Image.open(BytesIO(data))
        out = pixelate(
            img,
            palette_size=int(palette_size),
            pixel_size=int(pixel_size),
            dither=str(dither).lower() == "true",
        )
        return Response(content=pil_to_png_bytes(out), media_type="image/png")
    except Exception as e:
        return PlainTextResponse(str(e), status_code=400)

# --------------------------------------------------------------------------------------
# Frontend routes (serve your existing files at same origin)
# --------------------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def index():
    if INDEX_PATH.exists():
        return FileResponse(INDEX_PATH)
    return HTMLResponse("<h1>Index not found</h1>", status_code=404)

@app.get("/styles.css")
def styles():
    if STYLES_PATH.exists():
        return FileResponse(STYLES_PATH, media_type="text/css")
    return PlainTextResponse("styles.css not found", status_code=404)

@app.get("/script.js")
def script():
    if SCRIPT_PATH.exists():
        return FileResponse(SCRIPT_PATH, media_type="application/javascript")
    return PlainTextResponse("script.js not found", status_code=404)

