/* Iconize & Pixelate — DPR-safe drawing + API wiring (matches your HTML) */

(() => {
  // ====== Config ======
  const API_BASE = ""; // same origin. If your API is elsewhere, e.g. "https://my-api.fly.dev"

  // ====== Elements ======
  const canvas = document.getElementById("drawingCanvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const clearBtn     = document.getElementById("clearCanvas");
  const iconizeBtn   = document.getElementById("iconizeBtn");
  const pixelateBtn  = document.getElementById("pixelateBtn");
  const downloadBtn  = document.getElementById("downloadBtn");

  const resultContainer = document.getElementById("resultContainer");

  // Iconize controls
  const iconPanel   = document.getElementById("iconizeControls");
  const thSlider    = document.getElementById("thresholdSlider");
  const thValue     = document.getElementById("thresholdValue");
  const strokeSlider= document.getElementById("strokeSlider");
  const strokeValue = document.getElementById("strokeValue");
  const colorPicker = document.getElementById("colorPicker");
  const bgPicker    = document.getElementById("backgroundPicker");

  // Pixelate controls
  const pixelPanel  = document.getElementById("pixelateControls");
  const palSlider   = document.getElementById("paletteSlider");
  const palValue    = document.getElementById("paletteValue");
  const pixSlider   = document.getElementById("pixelSlider");
  const pixValue    = document.getElementById("pixelValue");
  const dithering   = document.getElementById("ditheringCheckbox");

  // Display slider values live
  const linkVal = (slider, out) => {
    if (!slider || !out) return;
    const update = () => (out.textContent = slider.value);
    slider.addEventListener("input", update);
    update();
  };
  linkVal(thSlider, thValue);
  linkVal(strokeSlider, strokeValue);
  linkVal(palSlider, palValue);
  linkVal(pixSlider, pixValue);

  // ====== DPR-safe canvas sizing (fixes brush under-cursor) ======
  const LOGICAL_W = canvas.width;   // from your HTML attributes (400)
  const LOGICAL_H = canvas.height;  // (400)

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;

    // CSS size (how big it looks on screen)
    canvas.style.width  = `${LOGICAL_W}px`;
    canvas.style.height = `${LOGICAL_H}px`;

    // Internal bitmap size (actual pixels)
    const targetW = Math.floor(LOGICAL_W * dpr);
    const targetH = Math.floor(LOGICAL_H * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width  = targetW;
      canvas.height = targetH;
    }

    // Scale back so lineWidth etc. use logical units
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitCanvas();
  window.addEventListener("resize", fitCanvas);

  // White background
  function resetCanvas() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // fill in device pixels
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  resetCanvas();

  // ====== Drawing (simple black brush + eraser via right-click) ======
  let drawing = false;
  let last = null;
  const BRUSH_PX = 8; // tweak if you want a slider later

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - r.left) / r.width) * LOGICAL_W;
    const y = ((clientY - r.top) / r.height) * LOGICAL_H;
    return { x, y };
  }

  function strokeLine(a, b, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function onStart(e) {
    drawing = true;
    last = getPos(e);
    e.preventDefault();
  }
  function onMove(e) {
    if (!drawing) return;
    const p = getPos(e);
    const isRightClick = e.buttons === 2; // right mouse = erase
    const color = isRightClick ? "#ffffff" : "#000000";
    strokeLine(last, p, color, BRUSH_PX);
    last = p;
    e.preventDefault();
  }
  function onEnd() {
    drawing = false;
    last = null;
  }

  canvas.addEventListener("contextmenu", (e) => e.preventDefault()); // disable menu for erasing
  canvas.addEventListener("mousedown", onStart);
  canvas.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onEnd);

  canvas.addEventListener("touchstart", onStart, { passive: false });
  canvas.addEventListener("touchmove", onMove, { passive: false });
  canvas.addEventListener("touchend", onEnd);

  // Clear canvas button
  clearBtn?.addEventListener("click", resetCanvas);

  // ====== Result handling ======
  let currentResultURL = "";
  function setResultBlob(blob) {
    // Clear previous
    if (currentResultURL) URL.revokeObjectURL(currentResultURL);
    currentResultURL = URL.createObjectURL(blob);

    // Replace placeholder with <img>
    resultContainer.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "Processed result";
    img.src = currentResultURL;
    img.className = "result-image";
    resultContainer.appendChild(img);

    downloadBtn.style.display = "inline-block";
  }

  // ====== Utilities ======
  function canvasToBlob() {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function postTo(endpoint, formFields) {
    const blob = await canvasToBlob();
    const fd = new FormData();
    fd.append("file", blob, "sketch.png");
    for (const [k, v] of Object.entries(formFields || {})) {
      fd.append(k, v);
    }
    const resp = await fetch(`${API_BASE}${endpoint}`, { method: "POST", body: fd });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      alert(`Error ${resp.status}\n${text}`);
      return null;
    }
    return await resp.blob();
  }

  function showPanel(which) {
    if (which === "icon") {
      iconPanel.style.display = "block";
      pixelPanel.style.display = "none";
    } else if (which === "pixel") {
      iconPanel.style.display = "none";
      pixelPanel.style.display = "block";
    }
  }

  // ====== Actions ======
  iconizeBtn?.addEventListener("click", async () => {
    showPanel("icon");
    const bgHex = bgPicker?.value || ""; // FastAPI accepts "" for transparent; a color hex sets a background
    const out = await postTo("/iconize", {
      fg_color: colorPicker?.value || "#111111",
      bg_color: bgHex, // use "" if you want transparent; change here if desired
      threshold: thSlider?.value || 200,
      stroke_px: strokeSlider?.value || 0,
    });
    if (out) setResultBlob(out);
  });

  pixelateBtn?.addEventListener("click", async () => {
    showPanel("pixel");
    const out = await postTo("/pixelate", {
      palette_size: palSlider?.value || 8,
      pixel_size:   pixSlider?.value || 8,
      dither:       dithering?.checked ? "true" : "false",
    });
    if (out) setResultBlob(out);
  });

  // Download result (falls back to raw canvas if no result yet)
  downloadBtn?.addEventListener("click", async () => {
    const a = document.createElement("a");
    a.download = "result.png";
    a.href = currentResultURL || canvas.toDataURL("image/png");
    a.click();
  });
})();


