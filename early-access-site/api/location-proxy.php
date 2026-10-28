<?php
// Uses the same server-side ipwho.is lookup as siFia-launch/api/location-proxy.php.
// Return only country; do not retain full geolocation responses or cache across visitors.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

function getClientIp(): ?string
{
    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null,
        $_SERVER['HTTP_X_REAL_IP'] ?? null,
        $_SERVER['REMOTE_ADDR'] ?? null,
    ];

    foreach ($candidates as $candidate) {
        if (!$candidate) {
            continue;
        }

        // X-Forwarded-For may contain multiple addresses
        $parts = array_map('trim', explode(',', $candidate));
        foreach ($parts as $ip) {
            if (!filter_var($ip, FILTER_VALIDATE_IP)) {
                continue;
            }

            $isPublic = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
            if ($isPublic) {
                return $ip;
            }
        }
    }

    return null;
}


$clientIp = getClientIp();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}
if (!$clientIp || !function_exists('curl_init')) {
    // Never geolocate the hosting server when the visitor's public IP is unavailable.
    http_response_code(503);
    echo json_encode(['error' => 'location_unavailable']);
    exit;
}
$ch = curl_init('https://ipwho.is/' . rawurlencode($clientIp) . '?lang=en');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 2,
    CURLOPT_TIMEOUT => 5,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
]);
$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$data = is_string($response) ? json_decode($response, true) : null;
$country = is_array($data) ? ($data['country_code'] ?? '') : '';
if ($status !== 200 || !is_string($country) || !preg_match('/^[A-Z]{2}$/', $country)
    || $country === 'XX' || ($data['success'] ?? true) === false) {
    http_response_code(502);
    echo json_encode(['error' => 'location_lookup_failed']);
    exit;
}
echo json_encode(['country_code' => $country]);
