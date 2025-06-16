<?php
/* Logger class for application-wide logging functionality */
class Logger {
    private $logFiles;
    private $logLevel;
    private static $instance = null;

    /* Log levels */
    const DEBUG = 'DEBUG';
    const INFO = 'INFO';
    const WARNING = 'WARNING';
    const ERROR = 'ERROR';

    /* Constructor */
    private function __construct() {
        $logDir = __DIR__ . '/../logs';
        $this->logFiles = [
            'connections' => $logDir . '/connections.json',
            'drawings' => $logDir . '/drawings.json',
            'errors' => $logDir . '/errors.json',
            'sessions' => $logDir . '/sessions.json'
        ];
        $this->logLevel = self::INFO;
        $this->ensureLogDirectory();
    }

    /* Singleton pattern implementation */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /* Log directory management */
    private function ensureLogDirectory() {
        $logDir = dirname($this->logFiles['connections']);
        if (!file_exists($logDir)) {
            mkdir($logDir, 0777, true);
        }
    }

    /* Log writing methods */
    public function debug($message, $type = 'errors') {
        $this->log(self::DEBUG, $message, $type);
    }

    public function info($message, $type = 'connections') {
        $this->log(self::INFO, $message, $type);
    }

    public function warning($message, $type = 'errors') {
        $this->log(self::WARNING, $message, $type);
    }

    public function error($message, $type = 'errors') {
        $this->log(self::ERROR, $message, $type);
    }

    /* Core logging functionality */
    private function log($level, $message, $type) {
        if ($this->shouldLog($level) && isset($this->logFiles[$type])) {
            $timestamp = date('Y-m-d H:i:s');
            $logEntry = [
                'timestamp' => $timestamp,
                'level' => $level,
                'message' => $message
            ];

            $logFile = $this->logFiles[$type];
            $existingLogs = [];
            
            if (file_exists($logFile)) {
                $content = file_get_contents($logFile);
                $data = json_decode($content, true);
                if ($type === 'drawings') {
                    $existingLogs = isset($data['drawings']) ? $data['drawings'] : [];
                } else {
                    $existingLogs = isset($data[$type]) ? $data[$type] : [];
                }
            }
            
            if (!is_array($existingLogs)) {
                $existingLogs = [];
            }
            
            $existingLogs[] = $logEntry;
            
            // Ensure the log directory exists and is writable
            $logDir = dirname($logFile);
            if (!file_exists($logDir)) {
                mkdir($logDir, 0777, true);
            }
            
            // Write the logs with proper structure
            if ($type === 'drawings') {
                $data = ['drawings' => $existingLogs];
            } else {
                $data = [$type => $existingLogs];
            }
            file_put_contents($logFile, json_encode($data, JSON_PRETTY_PRINT));
            
            // Ensure proper permissions
            chmod($logFile, 0666);
        }
    }

    /* Log level checking */
    private function shouldLog($level) {
        $levels = [
            self::DEBUG => 0,
            self::INFO => 1,
            self::WARNING => 2,
            self::ERROR => 3
        ];

        return $levels[$level] >= $levels[$this->logLevel];
    }

    /* Log level configuration */
    public function setLogLevel($level) {
        if (in_array($level, [self::DEBUG, self::INFO, self::WARNING, self::ERROR])) {
            $this->logLevel = $level;
        }
    }

    /* Log rotation */
    public function rotateLogs($maxSize = 5242880) { // 5MB default
        foreach ($this->logFiles as $type => $logFile) {
            if (file_exists($logFile) && filesize($logFile) > $maxSize) {
                $timestamp = date('Y-m-d_H-i-s');
                $newLogFile = $logFile . '.' . $timestamp;
                rename($logFile, $newLogFile);
                file_put_contents($logFile, json_encode([]));
            }
        }
    }
} 