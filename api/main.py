from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import io
import os
from typing import Optional

app = FastAPI(title="Iconize and Pixelate API")

# Serve static files (CSS, JS)
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Serve the main HTML page"""
    with open("index.html", "r") as f:
        return HTMLResponse(content=f.read())

@app.post("/iconize")
async def iconize_image(
    file: UploadFile = File(...),
    threshold: int = Form(128),
    stroke_size: int = Form(2),
    color: str = Form("#000000"),
    background: str = Form("#FFFFFF")
):
    """Convert sketch to icon with threshold, stroke, and color fill"""
    try:
        # Read and process the image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGBA")
        
        # Convert to grayscale for threshold
        gray = image.convert("L")
        
        # Apply threshold
        thresholded = gray.point(lambda x: 255 if x > threshold else 0, mode="1")
        thresholded = thresholded.convert("RGBA")
        
        # Create new image with background color
        result = Image.new("RGBA", image.size, background)
        
        # Convert color hex to RGB
        color_rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
        
        # Apply stroke and fill
        if stroke_size > 0:
            # Create stroke by dilating the thresholded image
            stroke_img = Image.new("RGBA", image.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(stroke_img)
            
            # Get the outline of the thresholded image
            outline = thresholded.filter(ImageFilter.FIND_EDGES)
            outline = outline.convert("RGBA")
            
            # Apply stroke
            for y in range(image.height):
                for x in range(image.width):
                    if outline.getpixel((x, y))[3] > 0:
                        # Draw stroke around this pixel
                        for dy in range(-stroke_size, stroke_size + 1):
                            for dx in range(-stroke_size, stroke_size + 1):
                                if 0 <= x + dx < image.width and 0 <= y + dy < image.height:
                                    if dx*dx + dy*dy <= stroke_size*stroke_size:
                                        result.putpixel((x + dx, y + dy), color_rgb + (255,))
        
        # Fill the main shape
        for y in range(image.height):
            for x in range(image.width):
                if thresholded.getpixel((x, y))[0] == 0:  # Black pixel in thresholded
                    result.putpixel((x, y), color_rgb + (255,))
        
        # Convert to PNG and return
        output = io.BytesIO()
        result.save(output, format="PNG")
        output.seek(0)
        
        return FileResponse(
            io.BytesIO(output.getvalue()),
            media_type="image/png",
            filename="iconized.png"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/pixelate")
async def pixelate_image(
    file: UploadFile = File(...),
    palette_size: int = Form(8),
    pixel_size: int = Form(8),
    dithering: bool = Form(False)
):
    """Convert sketch to pixel art with reduced palette and pixelation"""
    try:
        # Read and process the image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Resize to smaller size for pixelation
        small_size = (image.width // pixel_size, image.height // pixel_size)
        small_image = image.resize(small_size, Image.NEAREST)
        
        # Reduce palette
        if dithering:
            # Apply Floyd-Steinberg dithering
            small_image = small_image.quantize(colors=palette_size, method=Image.MEDIANCUT)
        else:
            # Simple palette reduction
            small_image = small_image.quantize(colors=palette_size, method=Image.MEDIANCUT)
        
        # Convert back to RGB
        small_image = small_image.convert("RGB")
        
        # Scale back up with nearest neighbor
        result = small_image.resize(image.size, Image.NEAREST)
        
        # Convert to PNG and return
        output = io.BytesIO()
        result.save(output, format="PNG")
        output.seek(0)
        
        return FileResponse(
            io.BytesIO(output.getvalue()),
            media_type="image/png",
            filename="pixelated.png"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
