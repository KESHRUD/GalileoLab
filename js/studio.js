/* Configuration and constants */
const WS_SERVER = 'ws://localhost:8080';
const API_ENDPOINT = '/php/session.php';

/* DOM elements */
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas?.getContext('2d');
const brushSizeSlider = document.getElementById('brushSize');
const brushSizeValue = document.getElementById('brushSizeValue');
const userList = document.getElementById('usersChips');
const sessionCodeDisplay = document.getElementById('sessionCode');

/* Application state */
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = '#000000';
let currentBrushSize = 5;
let currentUser = null;
let currentSession = null;
let ws = null;
let isEraser = false;
let currentTool = 'brush';
let startX = 0;
let startY = 0;
let isDrawingShape = false;
let savedCanvas = null;
let tempCanvas = null;

/* Canvas setup */
function setupCanvas() {
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentBrushSize;
}

/* Drawing functions */
function startDrawing(e) {
    if (!canvas || !ctx) return;
    isDrawing = true;
    [lastX, lastY] = getMousePos(canvas, e);
    [startX, startY] = [lastX, lastY];
    
    if (currentTool === 'brush' || currentTool === 'pencil' || currentTool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
    } else {
        isDrawingShape = true;
        // Sauvegarder l'état actuel du canvas
        savedCanvas = document.createElement('canvas');
        savedCanvas.width = canvas.width;
        savedCanvas.height = canvas.height;
        savedCanvas.getContext('2d').drawImage(canvas, 0, 0);
        
        // Créer un canvas temporaire pour le dessin de la forme
        tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
    }
}

function draw(e) {
    if (!isDrawing || !canvas || !ctx) return;
    
    const [x, y] = getMousePos(canvas, e);
    
    if (currentTool === 'brush' || currentTool === 'pencil' || currentTool === 'eraser') {
        ctx.lineTo(x, y);
        ctx.stroke();
        lastX = x;
        lastY = y;
    } else if (isDrawingShape) {
        // Restaurer l'état sauvegardé
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(savedCanvas, 0, 0);
        
        // Dessiner la nouvelle forme
        ctx.beginPath();
        switch (currentTool) {
            case 'line':
                ctx.moveTo(startX, startY);
                ctx.lineTo(x, y);
                break;
            case 'rectangle':
                ctx.rect(startX, startY, x - startX, y - startY);
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                ctx.arc(startX, startY, radius, 0, Math.PI * 2);
                break;
        }
        ctx.stroke();
    }
}

function stopDrawing() {
    if (!isDrawing || !canvas || !ctx) return;
    
    isDrawing = false;
    
    if (currentTool === 'brush' || currentTool === 'pencil' || currentTool === 'eraser') {
        ctx.closePath();
    } else if (isDrawingShape) {
        isDrawingShape = false;
        // La forme est déjà dessinée sur le canvas principal
        savedCanvas = null;
        tempCanvas = null;
    }
    
    sendDrawingData();
}

function getMousePos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    return [
        e.clientX - rect.left,
        e.clientY - rect.top
    ];
}

/* Drawing data management */
function loadDrawing(imageData) {
    if (!canvas || !ctx) return;
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    img.src = imageData;
}

/* WebSocket communication */
function connectToWebSocket() {
    ws = new WebSocket(WS_SERVER);
    
    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        ws.send(JSON.stringify({
            type: 'join',
            session: currentSession,
            user: currentUser
        }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
        setTimeout(connectToWebSocket, 2000);
    };
}

function sendDrawingData() {
    if (!canvas || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    const imageData = canvas.toDataURL('image/png');
    ws.send(JSON.stringify({
        type: 'drawing',
        session: currentSession,
        user: currentUser,
        data: imageData
    }));
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'user_joined':
            if (data.session === currentSession) {
                updateUserList(data.users);
            }
            break;
        case 'user_left':
            if (data.session === currentSession) {
                updateUserList(data.users);
            }
            break;
        case 'drawing':
            if (data.user !== currentUser && data.session === currentSession) {
                loadDrawing(data.data);
            }
            break;
        case 'clear':
            if (data.user !== currentUser && data.session === currentSession) {
                clearCanvas();
            }
            break;
    }
}

/* User interface updates */
function updateUserList(users) {
    if (!userList) return;
    userList.innerHTML = '';
    
    const otherUsers = users.filter(user => user !== currentUser);
    
    if (otherUsers.length === 0) {
        const noUsersElement = document.createElement('div');
        noUsersElement.className = 'no-users';
        noUsersElement.textContent = 'Aucun autre utilisateur connecté';
        userList.appendChild(noUsersElement);
        return;
    }

    otherUsers.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-chip';
        userElement.innerHTML = `
            <span class="user-icon">👤</span>
            <span class="user-name">${user}</span>
        `;
        userList.appendChild(userElement);
    });
}

/* Canvas operations */
function clearCanvas() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'clear',
            session: currentSession,
            user: currentUser
        }));
    }
}

function saveCanvas() {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `drawing-${currentSession}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

/* Tool management */
function handleToolSelection(tool) {
    if (!ctx) return;
    currentTool = tool;
    
    switch (tool) {
        case 'brush':
        case 'pencil':
            isEraser = false;
            ctx.strokeStyle = currentColor;
            break;
        case 'eraser':
            isEraser = true;
            ctx.strokeStyle = '#FFFFFF';
            break;
        case 'line':
        case 'rectangle':
        case 'circle':
            isEraser = false;
            ctx.strokeStyle = currentColor;
            break;
    }
}

function setColor(color) {
    currentColor = color;
    if (!isEraser && ctx) {
        ctx.strokeStyle = color;
    }
}

function setBrushSize(size) {
    currentBrushSize = size;
    if (ctx) {
        ctx.lineWidth = size;
    }
    if (brushSizeValue) {
        brushSizeValue.textContent = `${size}px`;
    }
}

/* Event listeners setup */
function setupEventListeners() {
    if (!canvas) return;

    // Canvas events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tool = button.dataset.tool;
            handleToolSelection(tool);
        });
    });

    // Color buttons
    document.querySelectorAll('.color-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const color = button.dataset.color;
            setColor(color);
        });
    });

    // Brush size
    if (brushSizeSlider) {
        brushSizeSlider.addEventListener('input', (e) => setBrushSize(e.target.value));
    }

    // Clear button
    const clearBtn = document.querySelector('[data-tool="clear"]');
    if (clearBtn) clearBtn.addEventListener('click', clearCanvas);

    // Save button
    const saveBtn = document.querySelector('[data-tool="save"]');
    if (saveBtn) saveBtn.addEventListener('click', saveCanvas);
}

/* Initialize application */
function init() {
    const urlParams = new URLSearchParams(window.location.search);
    currentSession = urlParams.get('session');
    currentUser = urlParams.get('user');
    
    if (!currentSession || !currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    if (sessionCodeDisplay) {
        sessionCodeDisplay.textContent = `Session: ${currentSession}`;
    }
    
    setupCanvas();
    connectToWebSocket();
    setupEventListeners();
}

window.addEventListener('load', init);
window.addEventListener('resize', setupCanvas);

// Ajouter un gestionnaire pour la fermeture de la fenêtre
window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'leave',
            session: currentSession,
            user: currentUser
        }));
    }
}); 