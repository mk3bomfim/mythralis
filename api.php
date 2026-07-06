<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$dbDir = __DIR__ . '/database';
$peopleDir = $dbDir . '/people';
$mediaDir = $dbDir . '/media';
$mediaFilesDir = $dbDir . '/media_files';
$usersDir = $dbDir . '/users';
$invitesDir = $dbDir . '/invites';
$foldersDir = $dbDir . '/folders';

if (!file_exists($dbDir)) mkdir($dbDir, 0777, true);
if (!file_exists($peopleDir)) mkdir($peopleDir, 0777, true);
if (!file_exists($mediaDir)) mkdir($mediaDir, 0777, true);
if (!file_exists($mediaFilesDir)) mkdir($mediaFilesDir, 0777, true);
if (!file_exists($usersDir)) mkdir($usersDir, 0777, true);
if (!file_exists($invitesDir)) mkdir($invitesDir, 0777, true);
if (!file_exists($foldersDir)) mkdir($foldersDir, 0777, true);

$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';

// Helper to list JSON files in a dir
function getJsonFiles($dir) {
    if (!is_dir($dir)) return [];
    $files = scandir($dir);
    $result = [];
    foreach ($files as $file) {
        if (substr($file, -5) === '.json') {
            $content = file_get_contents($dir . '/' . $file);
            if ($content !== false) {
                $decoded = json_decode($content, true);
                if ($decoded !== null) {
                    $result[] = $decoded;
                }
            }
        }
    }
    return $result;
}

if ($endpoint === 'people') {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        header('Content-Type: application/json');
        echo json_encode(getJsonFiles($peopleDir));
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = file_get_contents('php://input');
        $person = json_decode($body, true);
        if (!$person || !isset($person['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing target id']);
            exit;
        }
        
        file_put_contents($peopleDir . '/' . $person['id'] . '.json', json_encode($person, JSON_PRETTY_PRINT));
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'person' => $person]);
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $id = isset($_GET['id']) ? $_GET['id'] : '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing target id']);
            exit;
        }
        
        $file = $peopleDir . '/' . $id . '.json';
        if (file_exists($file)) {
            unlink($file);
        }
        
        // Clean up associated media
        $mediaFiles = scandir($mediaDir);
        foreach ($mediaFiles as $mFile) {
            if (substr($mFile, -5) === '.json') {
                $mPath = $mediaDir . '/' . $mFile;
                $media = json_decode(file_get_contents($mPath), true);
                if ($media && isset($media['personId']) && $media['personId'] === $id) {
                    if (isset($media['src']) && strpos($media['src'], '/surveillance_media/') === 0) {
                        $rawFileName = str_replace('/surveillance_media/', '', $media['src']);
                        $rawFilePath = $mediaFilesDir . '/' . $rawFileName;
                        if (file_exists($rawFilePath)) unlink($rawFilePath);
                    }
                    unlink($mPath);
                }
            }
        }
        
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
        exit;
    }
}

if ($endpoint === 'media') {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $personId = isset($_GET['personId']) ? $_GET['personId'] : '';
        $allMedia = getJsonFiles($mediaDir);
        if ($personId) {
            $filtered = [];
            foreach ($allMedia as $m) {
                if (isset($m['personId']) && $m['personId'] === $personId) {
                    $filtered[] = $m;
                }
            }
            $allMedia = $filtered;
        }
        header('Content-Type: application/json');
        echo json_encode($allMedia);
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = file_get_contents('php://input');
        $media = json_decode($body, true);
        if (!$media || !isset($media['id']) || !isset($media['personId'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required media fields']);
            exit;
        }
        
        if (isset($media['src']) && strpos($media['src'], 'data:') === 0) {
            if (preg_match('/^data:([^;]+);base64,(.+)$/', $media['src'], $matches)) {
                $base64Data = $matches[2];
                $buffer = base64_decode($base64Data);
                
                $safeName = preg_replace('/[^a-zA-Z0-9.-]/', '_', $media['name']);
                $rawFileName = $media['id'] . '_' . $safeName;
                $rawFilePath = $mediaFilesDir . '/' . $rawFileName;
                
                file_put_contents($rawFilePath, $buffer);
                $media['src'] = '/surveillance_media/' . $rawFileName;
            }
        }
        
        file_put_contents($mediaDir . '/' . $media['id'] . '.json', json_encode($media, JSON_PRETTY_PRINT));
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'media' => $media]);
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $id = isset($_GET['id']) ? $_GET['id'] : '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing media id']);
            exit;
        }
        
        $mPath = $mediaDir . '/' . $id . '.json';
        if (file_exists($mPath)) {
            $media = json_decode(file_get_contents($mPath), true);
            if ($media && isset($media['src']) && strpos($media['src'], '/surveillance_media/') === 0) {
                $rawFileName = str_replace('/surveillance_media/', '', $media['src']);
                $rawFilePath = $mediaFilesDir . '/' . $rawFileName;
                if (file_exists($rawFilePath)) unlink($rawFilePath);
            }
            unlink($mPath);
        }
        
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
        exit;
    }
}

if ($endpoint === 'users') {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        header('Content-Type: application/json');
        echo json_encode(getJsonFiles($usersDir));
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = file_get_contents('php://input');
        $user = json_decode($body, true);
        if (!$user || !isset($user['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing user id']);
            exit;
        }
        
        file_put_contents($usersDir . '/' . $user['id'] . '.json', json_encode($user, JSON_PRETTY_PRINT));
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'user' => $user]);
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $id = isset($_GET['id']) ? $_GET['id'] : '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing user id']);
            exit;
        }
        
        $file = $usersDir . '/' . $id . '.json';
        if (file_exists($file)) {
            unlink($file);
        }
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
        exit;
    }
}

if ($endpoint === 'invites') {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        header('Content-Type: application/json');
        echo json_encode(getJsonFiles($invitesDir));
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = file_get_contents('php://input');
        $invite = json_decode($body, true);
        if (!$invite || !isset($invite['code'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing invite code']);
            exit;
        }
        
        file_put_contents($invitesDir . '/' . $invite['code'] . '.json', json_encode($invite, JSON_PRETTY_PRINT));
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'invite' => $invite]);
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $code = isset($_GET['code']) ? $_GET['code'] : '';
        if (!$code) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing invite code']);
            exit;
        }
        
        $file = $invitesDir . '/' . $code . '.json';
        if (file_exists($file)) {
            unlink($file);
        }
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
        exit;
    }

if ($endpoint === 'folders') {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        header('Content-Type: application/json');
        echo json_encode(getJsonFiles($foldersDir));
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = file_get_contents('php://input');
        $folder = json_decode($body, true);
        if (!$folder || !isset($folder['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing folder id']);
            exit;
        }
        
        file_put_contents($foldersDir . '/' . $folder['id'] . '.json', json_encode($folder, JSON_PRETTY_PRINT));
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'folder' => $folder]);
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $id = isset($_GET['id']) ? $_GET['id'] : '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing folder id']);
            exit;
        }
        
        $file = $foldersDir . '/' . $id . '.json';
        if (file_exists($file)) {
            unlink($file);
        }
        
        header('Content-Type: application/json');
        echo json_encode(['success' => true]);
        exit;
    }
}
}

// ============================================
//  SEARCH — SISReg III Health Registry Proxy
// ============================================
if ($endpoint === 'search') {
    header('Content-Type: application/json');
    
    // Load config safely
    $configFile = __DIR__ . '/config.php';
    if (!file_exists($configFile)) {
        http_response_code(500);
        echo json_encode(['error' => 'Server configuration missing']);
        exit;
    }
    require_once $configFile;

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $body = file_get_contents('php://input');
    $payload = json_decode($body, true);
    $query = isset($payload['query']) ? trim($payload['query']) : '';

    if (empty($query)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing search query']);
        exit;
    }

    // Simple rate limiting per IP
    $rateLimitDir = $dbDir . '/rate_limit';
    if (!file_exists($rateLimitDir)) @mkdir($rateLimitDir, 0777, true);
    $ipHash = md5(isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown');
    $rateLimitFile = $rateLimitDir . '/' . $ipHash . '.json';
    if (file_exists($rateLimitFile)) {
        $lastRequest = json_decode(file_get_contents($rateLimitFile), true);
        if ($lastRequest && isset($lastRequest['ts'])) {
            $elapsed = time() - $lastRequest['ts'];
            if ($elapsed < SEARCH_RATE_LIMIT) {
                http_response_code(429);
                echo json_encode(['error' => 'Rate limit exceeded. Wait ' . (SEARCH_RATE_LIMIT - $elapsed) . ' seconds.']);
                exit;
            }
        }
    }
    @file_put_contents($rateLimitFile, json_encode(['ts' => time()]));

    // Detect available HTTP methods
    $hasCurl = function_exists('curl_init');
    $allowUrlFopen = ini_get('allow_url_fopen');
    
    $loginUrl = SISREG_URL . '/cgi-bin/index';
    $loginData = http_build_query([
        'usuario' => SISREG_USER,
        'senha'   => SISREG_PASS
    ]);

    $searchResponse = false;
    $sessionCookie = '';
    $method = 'none';
    $debugInfo = [];

    // ---- METHOD 1: cURL (preferred) ----
    if ($hasCurl) {
        $method = 'curl';
        $cookieJar = @tempnam(sys_get_temp_dir(), 'sisreg_');
        if (!$cookieJar) {
            // Fallback cookie jar location
            $cookieJar = $dbDir . '/tmp_cookie_' . md5(microtime()) . '.txt';
            @file_put_contents($cookieJar, '');
        }

        // Login
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $loginUrl,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $loginData,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_COOKIEJAR      => $cookieJar,
            CURLOPT_COOKIEFILE     => $cookieJar,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/x-www-form-urlencoded',
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            ]
        ]);

        $loginResponse = curl_exec($ch);
        $loginHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        $curlErrno = curl_errno($ch);
        curl_close($ch);

        $debugInfo['curl_login_code'] = $loginHttpCode;
        $debugInfo['curl_login_error'] = $curlError;
        $debugInfo['curl_errno'] = $curlErrno;

        if ($loginResponse !== false && $loginHttpCode >= 200 && $loginHttpCode < 400) {
            // Search
            $searchUrl = SISREG_URL . '/cgi-bin/cons_solicitacao_498';
            $searchData = http_build_query([
                'cns_paciente'  => $query,
                'nome_paciente' => $query
            ]);

            $ch2 = curl_init();
            curl_setopt_array($ch2, [
                CURLOPT_URL            => $searchUrl,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $searchData,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_COOKIEFILE     => $cookieJar,
                CURLOPT_TIMEOUT        => 20,
                CURLOPT_CONNECTTIMEOUT => 10,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => 0,
                CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ]);

            $searchResponse = curl_exec($ch2);
            $searchHttpCode = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
            $debugInfo['curl_search_code'] = $searchHttpCode;
            $debugInfo['curl_search_error'] = curl_error($ch2);
            curl_close($ch2);
        }

        @unlink($cookieJar);
    }

    // ---- METHOD 2: file_get_contents fallback ----
    if ($searchResponse === false && $allowUrlFopen) {
        $method = 'fopen';

        $loginContext = stream_context_create([
            'http' => [
                'method'  => 'POST',
                'header'  => "Content-Type: application/x-www-form-urlencoded\r\nUser-Agent: Mozilla/5.0\r\n",
                'content' => $loginData,
                'timeout' => 15,
                'follow_location' => 1
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false
            ]
        ]);

        $loginResponse = @file_get_contents($loginUrl, false, $loginContext);
        $debugInfo['fopen_login'] = ($loginResponse !== false) ? 'ok' : 'failed';

        if ($loginResponse !== false) {
            // Try to extract Set-Cookie from response headers
            $cookies = '';
            if (isset($http_response_header)) {
                foreach ($http_response_header as $hdr) {
                    if (stripos($hdr, 'Set-Cookie:') === 0) {
                        preg_match('/Set-Cookie:\s*([^;]+)/i', $hdr, $m);
                        if (isset($m[1])) {
                            $cookies .= ($cookies ? '; ' : '') . $m[1];
                        }
                    }
                }
            }

            $searchUrl = SISREG_URL . '/cgi-bin/cons_solicitacao_498';
            $searchData = http_build_query([
                'cns_paciente'  => $query,
                'nome_paciente' => $query
            ]);

            $searchContext = stream_context_create([
                'http' => [
                    'method'  => 'POST',
                    'header'  => "Content-Type: application/x-www-form-urlencoded\r\nUser-Agent: Mozilla/5.0\r\nCookie: $cookies\r\n",
                    'content' => $searchData,
                    'timeout' => 15,
                    'follow_location' => 1
                ],
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false
                ]
            ]);

            $searchResponse = @file_get_contents($searchUrl, false, $searchContext);
            $debugInfo['fopen_search'] = ($searchResponse !== false) ? 'ok' : 'failed';
        }
    }

    // ---- No method available or all failed ----
    if ($searchResponse === false) {
        $debugInfo['has_curl'] = $hasCurl;
        $debugInfo['allow_url_fopen'] = $allowUrlFopen ? true : false;
        $debugInfo['method_tried'] = $method;
        
        echo json_encode([
            'success'  => false,
            'error'    => 'Unable to connect to external registry. Your hosting may block outgoing HTTP requests.',
            'query'    => $query,
            'results'  => [],
            'messages' => ['The server could not reach sisregiii.saude.gov.br. This hosting may restrict outgoing connections.'],
            'debug'    => $debugInfo,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ---- Parse HTML response ----
    $results = [];
    $doc = new DOMDocument();
    @$doc->loadHTML('<?xml encoding="UTF-8">' . $searchResponse);
    $xpath = new DOMXPath($doc);

    // Try to find table rows with results
    $tables = $xpath->query('//table[@class="table_listagem" or contains(@class,"listagem")]');
    if ($tables->length > 0) {
        $rows = $tables->item(0)->getElementsByTagName('tr');
        for ($i = 1; $i < $rows->length; $i++) {
            $cells = $rows->item($i)->getElementsByTagName('td');
            if ($cells->length >= 2) {
                $row = [];
                for ($j = 0; $j < $cells->length; $j++) {
                    $row[] = trim($cells->item($j)->textContent);
                }
                $results[] = $row;
            }
        }
    }

    // Also try generic tables if no listagem class found
    if (empty($results)) {
        $allTables = $xpath->query('//table');
        foreach ($allTables as $table) {
            $rows = $table->getElementsByTagName('tr');
            for ($i = 0; $i < $rows->length; $i++) {
                $cells = $rows->item($i)->getElementsByTagName('td');
                if ($cells->length >= 2) {
                    $row = [];
                    for ($j = 0; $j < $cells->length; $j++) {
                        $cellText = trim($cells->item($j)->textContent);
                        if (!empty($cellText)) $row[] = $cellText;
                    }
                    if (!empty($row)) $results[] = $row;
                }
            }
            if (!empty($results)) break;
        }
    }

    // Extract page title for context
    $titleNodes = $xpath->query('//title');
    $pageTitle = $titleNodes->length > 0 ? trim($titleNodes->item(0)->textContent) : '';

    // Extract any visible messages / alerts
    $messages = [];
    $alertNodes = $xpath->query('//*[contains(@class,"msg") or contains(@class,"alert") or contains(@class,"erro")]');
    foreach ($alertNodes as $node) {
        $txt = trim($node->textContent);
        if (!empty($txt)) $messages[] = $txt;
    }

    echo json_encode([
        'success'   => true,
        'query'     => $query,
        'results'   => $results,
        'pageTitle' => $pageTitle,
        'messages'  => $messages,
        'method'    => $method,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Endpoint not found']);
