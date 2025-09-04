/* =========================================================
   Iconize & Pixelate — Drawing Pad + API wiring (DROP-IN)
   Requirements in your HTML (by id):
     - <canvas id="pad"></canvas>
     - Buttons: #draw #erase #clear #doIcon #doPixel (optional #download)
     - Sliders/inputs (optional but supported):
         #size (brush px)
         #fg (color), #bg (text), #th (0-255), #stroke (0-8)
         #pal (2-32), #pix (2-32), #dither (select "true"/"false")
     - Result image: <img id="out">
   ========================================================= */

(() => {
  // ---------- Config ----------
  const LOGICAL_SIZE = 512;      // logical drawing units (square canvas)
  const API_BASE = "";           // same-origin; set to "https://your-api" if needed

  // ---------- Elements ----------
  const pad = document.getElementById("pad");
  if (!pad) {
    console.error("Missing <canvas id='pad'> in your HTML.");
    return;
  }
  const ctx = pad.getContext("2d", { willReadFrequently: true });

  const btnDraw   = document.getElementById("draw");
  const btnErase  = document.getElementById("erase");
  const btnClear  = document.getElementById("clear");
  const btnIcon   = document.getElementById("doIcon");
  const btnPixel  = document.getElementById("doPixel");
  const btnDl     = document.getElementById("download"); // optional

  const sizeEl    = document.getElementById("size");

  // Icon controls (optional)
  const fgEl      = document.getElementById("fg");
  const bgEl      = document.getElementById("bg");
  const thEl      = document.getElementById("th");
  const strokeEl  = document.getElementById("stroke");

  // Pixel controls (optional)
  const palEl     = document.getElementById("pal");
  const pixEl     = document.getElementById("pix");
  const ditherEl  = document.getElementById("dither");

  const outImg    = document.getElementById("out");

  // ---------- Canvas sizing (DPR-aware; fixes cursor offset) ----------
  function fitCanvasToDisplaySize() {
    const dpr = window.devicePixelRatio || 1;

    // CSS size (how big it looks)
    pad.style.width  = LOGICAL_SIZE + "px";
    pad.style.height = LOGICAL_SIZE + "px";

    // Internal bitmap size (real pixels)
    const targetW = Math.floor(LOGICAL_SIZE * dpr);
    const targetH = Math.floor(LOGICAL_SIZE * dpr);
    if (pad.width !== targetW || pad.height !== targetH) {
      pad.width = targetW;
      pad.height = targetH;
    }

    // Scale back to logical units so lineWidth etc use "px" you expect
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  fitCanvasToDisplaySize();
  window.addEventListener("resize", fitCanvasToDisplaySize);

  // ---------- Initialize background ----------
  function resetCanvas() {
    // Fill background in device pixels (identity transform)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pad.width, pad.height);
    ctx.restore();
  }
  resetCanvas();

  // ---------- Drawing state ----------
  let mode = "draw"; // 'draw' | 'erase'
  let drawing = false;
  let last = null;

  function getPos(e) {
    const r = pad.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - r.left) / r.width) * LOGICAL_SIZE;
    const y = ((clientY - r.top) / r.height) * LOGICAL_SIZE;
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
    const w = Number(sizeEl?.value || 8);
    const color = mode === "draw" ? "#000000" : "#ffffff";
    strokeLine(last, p, color, w);
    last = p;
    e.preventDefault();
  }
  function onEnd() {
    drawing = false;
    last = null;
  }

  pad.addEventListener("mousedown", onStart);
  pad.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onEnd);

  pad.addEventListener("touchstart", onStart, { passive: false });
  pad.addEventListener("touchmove", onMove, { passive: false });
  pad.addEventListener("touchend", onEnd);

  // ---------- Tool buttons ----------
  btnDraw && (btnDraw.onclick = () => {
    mode = "draw";
    btnDraw.classList.add("is-active");
    btnErase?.classList.remove("is-active");
  });

  btnErase && (btnErase.onclick = () => {
    mode = "erase";
    btnErase.classList.add("is-active");
    btnDraw

