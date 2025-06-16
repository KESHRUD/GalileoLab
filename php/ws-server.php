<?php
/* WebSocket server configuration */
require 'vendor/autoload.php';
require_once 'Logger.php';

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use React\EventLoop\Factory;

/* WebSocket server class */
class DrawingServer implements \Ratchet\MessageComponentInterface {
    protected $clients;
    protected $sessions;
    protected $logger;

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        $this->sessions = [];
        $this->logger = Logger::getInstance();
    }

    /* Connection management */
    public function onOpen(\Ratchet\ConnectionInterface $conn) {
        $this->clients->attach($conn);
        $this->logger->info("New connection! ({$conn->resourceId})", 'connections');
    }

    public function onMessage(\Ratchet\ConnectionInterface $from, $msg) {
        $data = json_decode($msg);
        
        if (!$data || !isset($data->type)) {
            return;
        }

        switch ($data->type) {
            case 'join':
                $this->handleJoin($from, $data);
                break;
            case 'leave':
                $this->handleLeave($from, $data);
                break;
            case 'drawing':
                $this->handleDrawing($from, $data);
                break;
            case 'clear':
                $this->handleClear($from, $data);
                break;
            case 'landing_page_connect':
                $this->handleLandingPageConnect($from);
                break;
        }
    }

    public function onClose(\Ratchet\ConnectionInterface $conn) {
        // Trouver la session de l'utilisateur qui se déconnecte
        foreach ($this->sessions as $sessionCode => $session) {
            if (isset($session['users'][$conn->resourceId])) {
                $this->removeUserFromSession($conn, $sessionCode);
                break;
            }
        }
    }
                    
    public function onError(\Ratchet\ConnectionInterface $conn, \Exception $e) {
        $this->logger->error("An error has occurred: {$e->getMessage()}", 'errors');
        $conn->close();
    }

    /* Session management */
    protected function handleJoin($conn, $data) {
        if (!isset($data->session) || !isset($data->user)) {
            return;
        }

        $sessionCode = $data->session;
        $username = $data->user;

        if (!isset($this->sessions[$sessionCode])) {
            $this->sessions[$sessionCode] = [
                'users' => [],
                'connections' => new \SplObjectStorage,
                'drawing' => null
            ];
        }

        // Ajouter l'utilisateur à la session
        $this->sessions[$sessionCode]['users'][$conn->resourceId] = $username;
        $this->sessions[$sessionCode]['connections']->attach($conn);
        
        // Notifier tous les utilisateurs de la session
        $this->broadcastToSession($sessionCode, [
            'type' => 'user_joined',
            'session' => $sessionCode,
            'users' => array_values($this->sessions[$sessionCode]['users'])
        ]);

        // Envoyer l'état actuel du dessin au nouvel utilisateur
        if ($this->sessions[$sessionCode]['drawing']) {
            $conn->send(json_encode([
                'type' => 'drawing',
                'session' => $sessionCode,
                'data' => $this->sessions[$sessionCode]['drawing']
            ]));
        }

        $this->logger->info("User {$username} joined session {$sessionCode}", 'connections');
    }

    protected function handleLeave($conn, $data) {
        if (!isset($data->session)) {
            return;
        }

        $sessionCode = $data->session;
        $this->removeUserFromSession($conn, $sessionCode);
        
        // Notifier tous les utilisateurs de la session
        if (isset($this->sessions[$sessionCode])) {
            $this->broadcastToSession($sessionCode, [
                'type' => 'user_left',
                'session' => $sessionCode,
                'users' => array_values($this->sessions[$sessionCode]['users'])
            ]);
        }
    }

    protected function removeUserFromSession($conn, $sessionCode) {
        if (!isset($this->sessions[$sessionCode])) {
            return;
        }

        if (isset($this->sessions[$sessionCode]['users'][$conn->resourceId])) {
            $username = $this->sessions[$sessionCode]['users'][$conn->resourceId];
            unset($this->sessions[$sessionCode]['users'][$conn->resourceId]);
            $this->sessions[$sessionCode]['connections']->detach($conn);
            
            // Notifier tous les utilisateurs de la session
            $this->broadcastToSession($sessionCode, [
                'type' => 'user_left',
                'session' => $sessionCode,
                'users' => array_values($this->sessions[$sessionCode]['users'])
            ]);
            
            $this->logger->info("User {$username} left session {$sessionCode}", 'connections');

            // Supprimer la session si elle est vide
            if (empty($this->sessions[$sessionCode]['users'])) {
                unset($this->sessions[$sessionCode]);
                $this->logger->info("Session {$sessionCode} closed", 'sessions');
            }
        }
    }

    /* Drawing operations */
    protected function handleDrawing($from, $data) {
        if (!isset($data->session) || !isset($data->data)) {
            $this->logger->error("Invalid drawing data received", 'errors');
            return;
        }

        $sessionCode = $data->session;
        if (isset($this->sessions[$sessionCode])) {
            // Stocker le dessin actuel dans la session
            $this->sessions[$sessionCode]['drawing'] = $data->data;
            
            $this->broadcastToSession($sessionCode, [
                'type' => 'drawing',
                'session' => $sessionCode,
                'user' => $this->sessions[$sessionCode]['users'][$from->resourceId],
                'data' => $data->data
            ], $from);
            
            // Log the drawing with more details
            $this->logger->info(json_encode([
                'session' => $sessionCode,
                'user' => $this->sessions[$sessionCode]['users'][$from->resourceId],
                'timestamp' => date('Y-m-d H:i:s')
            ]), 'drawings');
        } else {
            $this->logger->error("Drawing attempt in non-existent session: {$sessionCode}", 'errors');
        }
    }

    protected function handleClear($from, $data) {
        if (!isset($data->session)) {
            $this->logger->error("Invalid clear request received", 'errors');
            return;
        }

        $sessionCode = $data->session;
        if (isset($this->sessions[$sessionCode])) {
            // Effacer le dessin stocké
            $this->sessions[$sessionCode]['drawing'] = null;
            
            $this->broadcastToSession($sessionCode, [
                'type' => 'clear',
                'session' => $sessionCode,
                'user' => $this->sessions[$sessionCode]['users'][$from->resourceId]
            ], $from);
            
            // Log the clear action
            $this->logger->info(json_encode([
                'session' => $sessionCode,
                'user' => $this->sessions[$sessionCode]['users'][$from->resourceId],
                'action' => 'clear',
                'timestamp' => date('Y-m-d H:i:s')
            ]), 'drawings');
        } else {
            $this->logger->error("Clear attempt in non-existent session: {$sessionCode}", 'errors');
        }
    }

    /* Landing page connection */
    protected function handleLandingPageConnect($conn) {
        $totalUsers = 0;
        foreach ($this->sessions as $session) {
            $totalUsers += count($session['users']);
        }

        $conn->send(json_encode([
            'type' => 'global_user_count',
            'count' => $totalUsers
        ]));
    }

    /* Broadcasting utilities */
    protected function broadcastToSession($sessionCode, $data, $exclude = null) {
        if (!isset($this->sessions[$sessionCode])) {
            return;
        }

        foreach ($this->sessions[$sessionCode]['connections'] as $client) {
            if ($exclude !== $client) {
                $client->send(json_encode($data));
            }
        }
    }
}

/* Server initialization */
$loop = Factory::create();
$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new DrawingServer()
        )
    ),
    8080,
    '0.0.0.0',
    $loop
);

$server->run(); 