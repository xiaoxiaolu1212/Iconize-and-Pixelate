# Iconize and Pixelate

A complete web application for transforming sketches into icons and pixel art. Draw your sketch on the canvas and use AI-powered processing to create beautiful icons or retro pixel art.

## Features

- **Interactive Drawing Canvas**: Draw with mouse or touch on a responsive canvas
- **Iconize Mode**: Convert sketches to clean icons with customizable:
  - Threshold adjustment (0-255)
  - Stroke size (0-8)
  - Color picker for fill color
  - Background color selection
- **Pixelate Mode**: Transform sketches into pixel art with:
  - Palette size control (2-32 colors)
  - Pixel size adjustment (2-32)
  - Dithering on/off option
- **Real-time Preview**: See your processed image instantly
- **Download Results**: Save your creations as PNG files
- **Responsive Design**: Works on desktop and mobile devices

## Installation

1. **Install Python Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Server**:
   ```bash
   uvicorn api.main:app --reload --port 8000
   ```

3. **Open the Website**:
   Navigate to `http://localhost:8000` in your browser

## Project Structure

```
Iconize and Pixelate/
├─ api/
│  └─ main.py            # FastAPI backend with image processing
├─ index.html            # Frontend page with drawing interface
├─ styles.css            # Modern, responsive styling
├─ script.js             # Frontend logic for drawing and API calls
├─ requirements.txt      # Python dependencies
└─ README.md             # This file
```

## API Endpoints

- `GET /` - Serves the main web interface
- `POST /iconize` - Processes sketches into icons
- `POST /pixelate` - Converts sketches to pixel art

## How to Use

1. **Draw**: Use your mouse or touch to draw on the canvas
2. **Choose Mode**: Click "Iconize" or "Pixelate" to process your sketch
3. **Adjust Settings**: Use the sliders and controls to fine-tune the result
4. **Download**: Click the download button to save your creation

## Technical Details

- **Backend**: FastAPI with Pillow and NumPy for image processing
- **Frontend**: Vanilla JavaScript with HTML5 Canvas
- **Image Processing**: Custom algorithms for threshold, stroke, and pixelation
- **File Handling**: PNG format for high-quality output

## License

MIT
