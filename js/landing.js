/* Configuration and constants */
const WS_SERVER = 'ws://localhost:8080';
const API_ENDPOINT = '/php/session.php';

/* DOM elements */
const createSessionBtn = document.getElementById('createSessionHero');
const joinSessionBtn = document.getElementById('joinSession');
const sessionCodeInput = document.getElementById('sessionCode');
const userModal = document.getElementById('userModal');
const usernameInput = document.getElementById('username');
const confirmUsernameBtn = document.getElementById('confirmUsername');
const closeButton = document.querySelector('.close-button');
const activeUsersCountElement = document.getElementById('activeUsersCount');

/* Application state */
let currentSession = null;
let currentUser = null;
let ws = null;

/* User cursor initialization */
const users = ['Amine', 'Mouenis', 'Samy'];
const map = document.querySelector('.map');
const mapCanvas = document.getElementById('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
const starBackground = document.querySelector('.star-background');

/* Notification elements */
const notificationContainer = document.getElementById('notificationContainer');
const successChip = document.getElementById('successChip');
const errorChip = document.getElementById('errorChip');

/* WebSocket connection for landing page */
let landingPageWs = null;

/* Notification system */
function showNotification(message, type) {
    let chip;
    if (type === 'success') {
        chip = successChip;
    } else if (type === 'error') {
        chip = errorChip;
    } else {
        return;
    }

    chip.querySelector('.message').textContent = message;
    chip.classList.add('show');

    setTimeout(() => {
        chip.classList.remove('show');
    }, 3000);
}

/* Canvas management */
function resizeMapCanvas() {
    mapCanvas.width = map.clientWidth;
    mapCanvas.height = map.clientHeight;
}

window.addEventListener('resize', resizeMapCanvas);
resizeMapCanvas();

/* Drawing element creation and animation */
function createDrawingElement(type, x, y, content = '', color = '') {
    const element = document.createElement('div');
    element.className = 'drawing-element';
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;

    if (type === 'emoji') {
        element.classList.add('emoji');
        element.textContent = content;
    } else if (type === 'shape') {
        element.classList.add('shape');
        element.style.backgroundColor = color;
    } else if (type === 'rectangle') {
        element.classList.add('rectangle');
        element.style.backgroundColor = color;
    } else if (type === 'triangle') {
        element.classList.add('triangle');
        element.style.borderBottomColor = color;
    } else if (type === 'galileo-g') {
        element.classList.add('galileo-g');
    }

    map.appendChild(element);

    element.addEventListener('animationend', () => {
        element.remove();
    });
}

/* Background star effects */
function createBackgroundStars(numStars = 50) {
    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        const animationDelay = Math.random() * 10;
        const animationDuration = 3 + Math.random() * 5;
        star.style.animationDelay = `${animationDelay}s, ${animationDelay}s`;
        star.style.animationDuration = `${animationDuration}s, ${animationDuration}s`;
        starBackground.appendChild(star);
    }
}

function createClickStar(e) {
    const star = document.createElement('div');
    star.className = 'star click-star';
    
    const rect = starBackground.getBoundingClientRect();
    const clickX = e.clientX - rect.left - rect.width / 2;
    const clickY = e.clientY - rect.top - rect.height / 2;

    const rotatedX = clickX * Math.cos(-Math.PI / 4) - clickY * Math.sin(-Math.PI / 4);
    const rotatedY = clickX * Math.sin(-Math.PI / 4) + clickY * Math.cos(-Math.PI / 4);

    star.style.left = `${((rotatedX + rect.width / 2) / rect.width) * 100}%`;
    star.style.top = `${((rotatedY + rect.height / 2) / rect.height) * 100}%`;

    star.style.animationDuration = '1.5s, 1.5s';
    star.style.animationDelay = '0s, 0s';

    starBackground.appendChild(star);

    star.addEventListener('animationend', () => {
        star.remove();
    });
}

/* Initialize background effects */
createBackgroundStars();
starBackground.addEventListener('click', createClickStar);

/* Parallax effect */
document.addEventListener('mousemove', (e) => {
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const offsetX = (mouseX - centerX) * 0.02;
    const offsetY = (mouseY - centerY) * 0.02;

    starBackground.style.transform = `rotateZ(45deg) translate(${-offsetX}px, ${-offsetY}px)`;
});

/* Typing animation effects */
const taglineElement = document.querySelector('.tagline');
const taglineText = "Créez, partagez, et collaborez sur vos œuvres d'art numériques, ensemble.";
let charIndex = 0;

function typeTagline() {
    if (charIndex < taglineText.length) {
        taglineElement.textContent = taglineText.substring(0, charIndex + 1);
        charIndex++;
        setTimeout(typeTagline, 50);
    }
}

setTimeout(typeTagline, 1000);

/* Hero text animation */
const heroTextTitle = document.querySelector('.hero-text h2');
const heroTextParagraph = document.querySelector('.hero-text p');

const originalHeroTextTitle = heroTextTitle ? heroTextTitle.textContent : '';
const originalHeroTextParagraph = heroTextParagraph ? heroTextParagraph.textContent : '';

if (heroTextTitle) heroTextTitle.textContent = '';
if (heroTextParagraph) heroTextParagraph.textContent = '';

function typeWriter(element, text, i, speed, callback) {
    if (i < text.length) {
        element.textContent = text.substring(0, i + 1);
        setTimeout(() => typeWriter(element, text, i + 1, speed, callback), speed);
    } else if (callback) {
        callback();
    }
}

if (heroTextTitle) {
    typeWriter(heroTextTitle, originalHeroTextTitle, 0, 50, () => {
        if (heroTextParagraph) {
            typeWriter(heroTextParagraph, originalHeroTextParagraph, 0, 30);
        }
    });
}

/* User cursor animation */
users.forEach((user, index) => {
    const cursor = document.createElement('div');
    cursor.className = 'user-cursor';
    
    let lastX = Math.random() * map.clientWidth;
    let lastY = Math.random() * map.clientHeight;

    cursor.style.left = `${lastX}px`;
    cursor.style.top = `${lastY}px`;
    cursor.innerHTML = `<span>${user}</span>`;
    map.appendChild(cursor);

    let drawingStep = 0;
    const animationInterval = setInterval(() => {
        let newX, newY;
        const width = map.clientWidth;
        const height = map.clientHeight;

        if (user === 'Amine') {
            const size = Math.min(width, height) * 0.15;
            const centerX = width * 0.3;
            const centerY = height * 0.5;
            createDrawingElement('galileo-g', centerX - size / 2, centerY - size / 2);

            switch (drawingStep % 4) {
                case 0: newX = centerX; newY = centerY - size / 2; break;
                case 1: newX = centerX; newY = centerY + size / 2; break;
                case 2: newX = centerX + size / 2; newY = centerY; break;
                case 3: newX = centerX - size / 2; newY = centerY; break;
            }
        } else if (user === 'Mouenis') {
            const triSize = Math.min(width, height) * 0.08;
            const triX = width * 0.6;
            const triY = height * 0.2;
            createDrawingElement('triangle', triX + (drawingStep % 2) * triSize, triY + (Math.floor(drawingStep / 2) % 2) * triSize, '', 'rgba(0, 191, 255, 0.8)');

            switch (drawingStep % 4) {
                case 0: newX = triX + triSize / 2; newY = triY; break;
                case 1: newX = triX + triSize; newY = triY + triSize; break;
                case 2: newX = triX; newY = triY + triSize; break;
                case 3: newX = triX + triSize / 2; newY = triY + triSize / 2; break;
            }
        } else if (user === 'Samy') {
            const circleRadius = Math.min(width, height) * 0.05;
            const circleX = width * 0.7;
            const circleY = height * 0.7;
            createDrawingElement('shape', circleX - circleRadius, circleY - circleRadius, '', 'rgba(255, 215, 0, 0.8)');

            switch (drawingStep % 4) {
                case 0: newX = circleX + circleRadius; newY = circleY; break;
                case 1: newX = circleX - circleRadius; newY = circleY; break;
                case 2: newX = circleX; newY = circleY + circleRadius; break;
                case 3: newX = circleX; newY = circleY - circleRadius; break;
            }
        }
        
        cursor.style.left = `${newX}px`;
        cursor.style.top = `${newY}px`;
        
        lastX = newX;
        lastY = newY;
        drawingStep++;
    }, 2000 + index * 500);
});

/* Event handlers */
createSessionBtn.addEventListener('click', () => {
    userModal.classList.add('active');
});

if (closeButton) {
    closeButton.addEventListener('click', () => {
        userModal.classList.remove('active');
    });
}

joinSessionBtn.addEventListener('click', () => {
    const code = sessionCodeInput.value.trim();
    if (code.length === 6) {
        userModal.classList.add('active');
    } else {
        showNotification('Veuillez entrer un code de session valide (6 caractères)', 'error');
    }
});

confirmUsernameBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username.length >= 2) {
        currentUser = username;
        if (sessionCodeInput.value) {
            joinExistingSession(sessionCodeInput.value);
        } else {
            createNewSession();
        }
    } else {
        showNotification('Le nom d\'utilisateur doit contenir au moins 2 caractères', 'error');
    }
});

/* Session management */
async function createNewSession() {
    try {
        const response = await fetch(`${API_ENDPOINT}?action=create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: currentUser })
        });

        const data = await response.json();
        if (data.success) {
            currentSession = data.sessionCode;
            showNotification('Session créée avec succès!', 'success');
            connectToWebSocket();
            window.location.href = `studio.html?session=${currentSession}&user=${currentUser}`;
        } else {
            showNotification(`Erreur: ${data.message || 'lors de la création de la session'}`, 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur de connexion au serveur', 'error');
    }
}

async function joinExistingSession(code) {
    try {
        const response = await fetch(`${API_ENDPOINT}?action=join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionCode: code,
                username: currentUser
            })
        });

        const data = await response.json();
        if (data.success) {
            currentSession = code;
            showNotification('Session rejointe avec succès!', 'success');
            connectToWebSocket();
            window.location.href = `studio.html?session=${currentSession}&user=${currentUser}`;
        } else {
            showNotification(`Erreur: ${data.message || 'Session non trouvée ou invalide'}`, 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur de connexion au serveur', 'error');
    }
}

/* WebSocket connection */
function connectToWebSocket() {
    ws = new WebSocket(WS_SERVER);
    
    ws.onopen = () => {
        console.log('Connecté au serveur WebSocket');
        ws.send(JSON.stringify({
            type: 'join',
            session: currentSession,
            user: currentUser
        }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Message reçu:', data);
    };

    ws.onerror = (error) => {
        console.error('Erreur WebSocket:', error);
    };

    ws.onclose = () => {
        console.log('Déconnecté du serveur WebSocket');
    };
}

/* Keyboard text animation */
function initKeyboardText() {
    const keyboardTexts = document.querySelectorAll('.keyboard-text');
    let currentIndex = 0;

    function typeText(element, text, speed = 50) {
        let i = 0;
        element.textContent = '';
        
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        
        type();
    }

    function animateNext() {
        if (currentIndex < keyboardTexts.length) {
            const element = keyboardTexts[currentIndex];
            const text = element.getAttribute('data-text') || element.textContent;
            element.setAttribute('data-text', text);
            
            typeText(element, text, 50);
            currentIndex++;
            
            setTimeout(animateNext, text.length * 50 + 500);
        }
    }

    animateNext();
}

/* Landing page WebSocket connection */
function connectLandingPageWebSocket() {
    landingPageWs = new WebSocket(WS_SERVER);

    landingPageWs.onopen = () => {
        console.log('Connecté au serveur WebSocket depuis la page d\'accueil');
        landingPageWs.send(JSON.stringify({ type: 'landing_page_connect' }));
    };

    landingPageWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'global_user_count') {
            updateActiveUsersCount(data.count);
        }
    };

    landingPageWs.onerror = (error) => {
        console.error('Erreur WebSocket sur la page d\'accueil:', error);
    };

    landingPageWs.onclose = () => {
        console.log('Déconnecté du serveur WebSocket sur la page d\'accueil');
        setTimeout(connectLandingPageWebSocket, 3000);
    };
}

function updateActiveUsersCount(count) {
    if (activeUsersCountElement) {
        activeUsersCountElement.textContent = count;
    }
}

/* Initialize on page load */
document.addEventListener('DOMContentLoaded', () => {
    initKeyboardText();
    connectLandingPageWebSocket();
});