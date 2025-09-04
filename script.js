class DrawingApp {
    constructor() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.currentResult = null;
        
        this.initializeCanvas();
        this.setupEventListeners();
        this.setupSliders();
    }
    
    initializeCanvas() {
        // Set canvas background to white
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set drawing properties
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }
    
    setupEventListeners() {
        // Canvas drawing events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.handleTouch.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouch.bind(this));
        this.canvas.addEventListener('touchend', this.stopDrawing.bind(this));
        
        // Button events
        document.getElementById('clearCanvas').addEventListener('click', this.clearCanvas.bind(this));
        document.getElementById('iconizeBtn').addEventListener('click', () => this.processImage('iconize'));
        document.getElementById('pixelateBtn').addEventListener('click', () => this.processImage('pixelate'));
        document.getElementById('downloadBtn').addEventListener('click', this.downloadResult.bind(this));
    }
    
    setupSliders() {
        // Iconize sliders
        const thresholdSlider = document.getElementById('thresholdSlider');
        const strokeSlider = document.getElementById('strokeSlider');
        const paletteSlider = document.getElementById('paletteSlider');
        const pixelSlider = document.getElementById('pixelSlider');
        
        thresholdSlider.addEventListener('input', (e) => {
            document.getElementById('thresholdValue').textContent = e.target.value;
        });
        
        strokeSlider.addEventListener('input', (e) => {
            document.getElementById('strokeValue').textContent = e.target.value;
        });
        
        paletteSlider.addEventListener('input', (e) => {
            document.getElementById('paletteValue').textContent = e.target.value;
        });
        
        pixelSlider.addEventListener('input', (e) => {
            document.getElementById('pixelValue').textContent = e.target.value;
        });
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    }
    
    stopDrawing() {
        this.isDrawing = false;
        this.ctx.beginPath();
    }
    
    handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                        e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.initializeCanvas();
        this.hideResult();
    }
    
    async processImage(mode) {
        // Check if canvas has content
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const hasContent = imageData.data.some((value, index) => {
            if (index % 4 === 3) return false; // Skip alpha channel
            return value !== 255; // Not white
        });
        
        if (!hasContent) {
            alert('Please draw something on the canvas first!');
            return;
        }
        
        this.showLoading();
        
        try {
            // Convert canvas to blob
            const blob = await this.canvasToBlob();
            
            // Create form data
            const formData = new FormData();
            formData.append('file', blob, 'sketch.png');
            
            // Add parameters based on mode
            if (mode === 'iconize') {
                formData.append('threshold', document.getElementById('thresholdSlider').value);
                formData.append('stroke_size', document.getElementById('strokeSlider').value);
                formData.append('color', document.getElementById('colorPicker').value);
                formData.append('background', document.getElementById('backgroundPicker').value);
            } else if (mode === 'pixelate') {
                formData.append('palette_size', document.getElementById('paletteSlider').value);
                formData.append('pixel_size', document.getElementById('pixelSlider').value);
                formData.append('dithering', document.getElementById('ditheringCheckbox').checked);
            }
            
            // Send request to API
            const response = await fetch(`/${mode}`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Get the result image
            const resultBlob = await response.blob();
            this.currentResult = resultBlob;
            
            // Display result
            this.displayResult(resultBlob);
            this.showControls(mode);
            
        } catch (error) {
            console.error('Error processing image:', error);
            alert('Error processing image. Please try again.');
        } finally {
            this.hideLoading();
        }
    }
    
    canvasToBlob() {
        return new Promise((resolve) => {
            this.canvas.toBlob(resolve, 'image/png');
        });
    }
    
    displayResult(blob) {
        const resultContainer = document.getElementById('resultContainer');
        const url = URL.createObjectURL(blob);
        
        resultContainer.innerHTML = `<img src="${url}" alt="Processed result">`;
        document.getElementById('downloadBtn').style.display = 'block';
    }
    
    showControls(mode) {
        // Hide all control panels
        document.getElementById('iconizeControls').style.display = 'none';
        document.getElementById('pixelateControls').style.display = 'none';
        
        // Show relevant control panel
        if (mode === 'iconize') {
            document.getElementById('iconizeControls').style.display = 'block';
        } else if (mode === 'pixelate') {
            document.getElementById('pixelateControls').style.display = 'block';
        }
    }
    
    hideResult() {
        const resultContainer = document.getElementById('resultContainer');
        resultContainer.innerHTML = '<p class="placeholder">Your processed image will appear here</p>';
        document.getElementById('downloadBtn').style.display = 'none';
        document.getElementById('iconizeControls').style.display = 'none';
        document.getElementById('pixelateControls').style.display = 'none';
        this.currentResult = null;
    }
    
    showLoading() {
        const resultContainer = document.getElementById('resultContainer');
        resultContainer.innerHTML = '<div class="loading show">Processing your image...</div>';
    }
    
    hideLoading() {
        const loading = document.querySelector('.loading');
        if (loading) {
            loading.classList.remove('show');
        }
    }
    
    downloadResult() {
        if (!this.currentResult) return;
        
        const url = URL.createObjectURL(this.currentResult);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'processed-image.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DrawingApp();
});
