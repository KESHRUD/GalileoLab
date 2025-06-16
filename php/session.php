<?php
/* Session management and API endpoints */
header('Content-Type: application/json');
require_once 'Logger.php';

/* Configuration */
const SESSION_CODE_LENGTH = 6;
const SESSION_EXPIRY = 3600; // 1 hour in seconds

/* Session storage */
$sessions = [];

/* Load existing sessions from file */
function loadSessions() {
    global $sessions;
    $sessionsFile = __DIR__ . '/../logs/sessions.json';
    
    if (file_exists($sessionsFile)) {
        $content = file_get_contents($sessionsFile);
        $data = json_decode($content, true);
        $sessions = $data['sessions'] ?? [];
    } else {
        $sessions = [];
    }
}

/* Save sessions to file */
function saveSessions() {
    global $sessions;
    $sessionsFile = __DIR__ . '/../logs/sessions.json';
    $sessionsDir = dirname($sessionsFile);
    
    if (!file_exists($sessionsDir)) {
        mkdir($sessionsDir, 0777, true);
    }
    
    $data = ['sessions' => $sessions];
    file_put_contents($sessionsFile, json_encode($data, JSON_PRETTY_PRINT));
}

/* Session code generation */
function generateSessionCode() {
    $characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $code = '';
    
    for ($i = 0; $i < SESSION_CODE_LENGTH; $i++) {
        $code .= $characters[rand(0, strlen($characters) - 1)];
    }
    
    return $code;
}

/* Session validation */
function validateSession($sessionCode) {
    global $sessions;
    return isset($sessions[$sessionCode]) && 
           time() - $sessions[$sessionCode]['created_at'] < SESSION_EXPIRY;
}

/* Session creation */
function createSession($username) {
    global $sessions;
    
    do {
        $sessionCode = generateSessionCode();
    } while (isset($sessions[$sessionCode]));
    
    $sessions[$sessionCode] = [
        'users' => [$username],
        'created_at' => time(),
        'last_activity' => time()
    ];
    
    saveSessions();
    return $sessionCode;
}

/* Session joining */
function joinSession($sessionCode, $username) {
    global $sessions;
    
    if (!validateSession($sessionCode)) {
        return false;
    }
    
    if (!in_array($username, $sessions[$sessionCode]['users'])) {
        $sessions[$sessionCode]['users'][] = $username;
        $sessions[$sessionCode]['last_activity'] = time();
        saveSessions();
    }
    
    return true;
}

/* Session cleanup */
function cleanupSessions() {
    global $sessions;
    $now = time();
    
    foreach ($sessions as $code => $session) {
        if ($now - $session['created_at'] > SESSION_EXPIRY) {
            unset($sessions[$code]);
        }
    }
    
    saveSessions();
}

/* Request handling */
$action = $_GET['action'] ?? '';
$logger = Logger::getInstance();

loadSessions();
cleanupSessions();

switch ($action) {
    case 'create':
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? '';
        
        if (empty($username)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Username is required']);
            break;
        }
        
        $sessionCode = createSession($username);
        $logger->info("Session created: {$sessionCode} by user: {$username}");
        
        echo json_encode([
            'success' => true,
            'sessionCode' => $sessionCode
        ]);
        break;
        
    case 'join':
        $data = json_decode(file_get_contents('php://input'), true);
        $sessionCode = $data['sessionCode'] ?? '';
        $username = $data['username'] ?? '';
        
        if (empty($sessionCode) || empty($username)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Session code and username are required']);
            break;
        }
        
        if (!validateSession($sessionCode)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Session not found or expired']);
            break;
        }
        
        if (joinSession($sessionCode, $username)) {
            $logger->info("User {$username} joined session {$sessionCode}");
            echo json_encode(['success' => true]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Failed to join session']);
        }
        break;
        
    case 'status':
        $sessionCode = $_GET['code'] ?? '';
        
        if (empty($sessionCode)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Session code is required']);
            break;
        }
        
        if (!validateSession($sessionCode)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Session not found or expired']);
            break;
        }
        
        echo json_encode([
            'success' => true,
            'users' => $sessions[$sessionCode]['users']
        ]);
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
} 