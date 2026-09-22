<?php
declare(strict_types=1);

// Journal by siFia early-access endpoint for PHP 7.4+ / SiteGround MySQL.

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-store');

const MAX_BODY_BYTES = 20000;

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function clean_string($value, int $maxLength): string
{
    $value = trim((string) ($value ?? ''));
    $value = preg_replace('/\s+/u', ' ', $value) ?? '';
    return function_exists('mb_substr')
        ? mb_substr($value, 0, $maxLength)
        : substr($value, 0, $maxLength);
}

function clean_paragraph($value, int $maxLength): string
{
    $value = trim((string) ($value ?? ''));
    $value = preg_replace("/\r\n|\r/u", "\n", $value) ?? '';
    return function_exists('mb_substr')
        ? mb_substr($value, 0, $maxLength)
        : substr($value, 0, $maxLength);
}

function clean_enum($value, array $allowed): string
{
    $value = clean_string($value, 80);
    return in_array($value, $allowed, true) ? $value : '';
}

function clean_list($value, array $allowed, int $maxItems = 20): array
{
    if (!is_array($value)) {
        return [];
    }

    $result = [];
    foreach ($value as $item) {
        $item = clean_string($item, 80);
        if (in_array($item, $allowed, true) && !in_array($item, $result, true)) {
            $result[] = $item;
        }
        if (count($result) >= $maxItems) {
            break;
        }
    }
    return $result;
}

function boolean_value($value): bool
{
    return $value === true || $value === 1 || $value === '1' || $value === 'true';
}

function config_value(string $name): string
{
    $value = getenv($name);
    if ($value === false || $value === '') {
        $value = $_SERVER[$name] ?? '';
    }
    if (($value === false || $value === '') && defined($name)) {
        $value = constant($name);
    }
    return trim((string) $value);
}

function database(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = config_value('JOURNAL_DB_HOST') ?: 'localhost';
    $port = config_value('JOURNAL_DB_PORT') ?: '3306';
    $name = config_value('JOURNAL_DB_NAME');
    $user = config_value('JOURNAL_DB_USER');
    $password = config_value('JOURNAL_DB_PASSWORD');

    if ($name === '' || $user === '' || $password === '') {
        throw new RuntimeException('Database configuration is incomplete.');
    }

    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function load_configuration(): void
{
    $paths = [];
    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $paths[] = dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/journal-early-access-config.php';
    }
    // Useful for local testing. Do not upload config.php inside public_html.
    $paths[] = dirname(__DIR__) . '/config.php';

    foreach ($paths as $path) {
        if (is_readable($path)) {
            require_once $path;
            return;
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(['success' => false, 'error' => 'Method not allowed.'], 405);
}

if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > MAX_BODY_BYTES) {
    respond(['success' => false, 'error' => 'Submission is too large.'], 413);
}

$payload = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($payload)) {
    respond(['success' => false, 'error' => 'Invalid request.'], 400);
}

// Honeypot: return success without storing automated submissions.
if (clean_string($payload['website'] ?? '', 120) !== '') {
    respond(['success' => true, 'signup_token' => bin2hex(random_bytes(24))]);
}

load_configuration();
$action = clean_enum($payload['action'] ?? '', ['start', 'survey']);

try {
    $db = database();

    if ($action === 'start') {
        $email = strtolower(clean_string($payload['email'] ?? '', 254));
        $platform = clean_enum($payload['platform'] ?? '', ['iphone', 'android']);
        $consent = boolean_value($payload['email_consent'] ?? false);

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respond(['success' => false, 'error' => 'Enter a valid email address.'], 422);
        }
        if ($platform === '') {
            respond(['success' => false, 'error' => 'Choose iPhone or Android.'], 422);
        }
        if (!$consent) {
            respond(['success' => false, 'error' => 'Email consent is required to join.'], 422);
        }

        $token = bin2hex(random_bytes(24));
        $tokenHash = hash('sha256', $token);
        $source = clean_string($payload['source'] ?? 'journal-early-access', 100);
        $utmSource = clean_string($payload['utm_source'] ?? '', 120);
        $utmMedium = clean_string($payload['utm_medium'] ?? '', 120);
        $utmCampaign = clean_string($payload['utm_campaign'] ?? '', 160);
        $utmContent = clean_string($payload['utm_content'] ?? '', 160);
        $userAgent = clean_string($_SERVER['HTTP_USER_AGENT'] ?? '', 500);

        $statement = $db->prepare(
            'INSERT INTO journal_early_access
                (email, platform, email_consent, consent_at, source, utm_source, utm_medium,
                 utm_campaign, utm_content, user_agent, signup_token_hash, created_at, updated_at)
             VALUES
                (:email, :platform, 1, UTC_TIMESTAMP(), :source, :utm_source, :utm_medium,
                 :utm_campaign, :utm_content, :user_agent, :token_hash, UTC_TIMESTAMP(), UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE
                platform = VALUES(platform),
                email_consent = 1,
                consent_at = UTC_TIMESTAMP(),
                source = VALUES(source),
                utm_source = VALUES(utm_source),
                utm_medium = VALUES(utm_medium),
                utm_campaign = VALUES(utm_campaign),
                utm_content = VALUES(utm_content),
                user_agent = VALUES(user_agent),
                signup_token_hash = VALUES(signup_token_hash),
                updated_at = UTC_TIMESTAMP()'
        );
        $statement->execute([
            ':email' => $email,
            ':platform' => $platform,
            ':source' => $source,
            ':utm_source' => $utmSource,
            ':utm_medium' => $utmMedium,
            ':utm_campaign' => $utmCampaign,
            ':utm_content' => $utmContent,
            ':user_agent' => $userAgent,
            ':token_hash' => $tokenHash,
        ]);

        respond(['success' => true, 'signup_token' => $token]);
    }

    if ($action === 'survey') {
        $token = clean_string($payload['signup_token'] ?? '', 96);
        if (!preg_match('/^[a-f0-9]{48}$/', $token)) {
            respond(['success' => false, 'error' => 'Your signup session expired. Please start again.'], 422);
        }

        $currentJournaling = clean_enum($payload['current_journaling'] ?? '', [
            'paper', 'notes', 'journal-app', 'mix', 'not-consistent', 'not-currently',
        ]);
        $consistencyChallenges = clean_list($payload['consistency_challenges'] ?? [], [
            'forget', 'not-know-what-to-write', 'not-enough-time', 'scattered',
            'hard-to-look-back', 'privacy',
        ]);
        $desiredOutcomes = clean_list($payload['desired_outcomes'] ?? [], [
            'consistent', 'remember-prayers', 'answered-prayers', 'notice-god',
            'scripture', 'reflect',
        ]);
        $featureInterests = clean_list($payload['feature_interests'] ?? [], [
            'guided-prompts', 'prayer-tracking', 'reviews', 'scripture-notes',
            'search', 'privacy',
        ], 3);
        $expectedPrice = clean_enum($payload['expected_price'] ?? '', [
            'free', 'under-299', '300-599', '600-999', '1000-plus', 'subscription',
        ]);
        $priceReaction = clean_enum($payload['price_reaction'] ?? '', [
            'surprisingly-inexpensive', 'reasonable', 'a-little-expensive', 'too-expensive',
        ]);
        $testerOptIn = boolean_value($payload['tester_opt_in'] ?? false) ? 1 : 0;
        $anythingElse = clean_paragraph($payload['anything_else'] ?? '', 1000);

        $statement = $db->prepare(
            'UPDATE journal_early_access SET
                current_journaling = :current_journaling,
                consistency_challenges = :consistency_challenges,
                desired_outcomes = :desired_outcomes,
                feature_interests = :feature_interests,
                expected_price = :expected_price,
                price_reaction = :price_reaction,
                tester_opt_in = :tester_opt_in,
                anything_else = :anything_else,
                survey_completed_at = UTC_TIMESTAMP(),
                updated_at = UTC_TIMESTAMP()
             WHERE signup_token_hash = :token_hash'
        );
        $statement->execute([
            ':current_journaling' => $currentJournaling !== '' ? $currentJournaling : null,
            ':consistency_challenges' => json_encode($consistencyChallenges),
            ':desired_outcomes' => json_encode($desiredOutcomes),
            ':feature_interests' => json_encode($featureInterests),
            ':expected_price' => $expectedPrice !== '' ? $expectedPrice : null,
            ':price_reaction' => $priceReaction !== '' ? $priceReaction : null,
            ':tester_opt_in' => $testerOptIn,
            ':anything_else' => $anythingElse !== '' ? $anythingElse : null,
            ':token_hash' => hash('sha256', $token),
        ]);

        if ($statement->rowCount() < 1) {
            respond(['success' => false, 'error' => 'Your signup session expired. Please start again.'], 422);
        }

        respond(['success' => true]);
    }

    respond(['success' => false, 'error' => 'Invalid action.'], 400);
} catch (Throwable $error) {
    error_log('Journal early-access error: ' . $error->getMessage());
    respond([
        'success' => false,
        'error' => 'The signup service is temporarily unavailable. Please try again shortly.',
    ], 503);
}
