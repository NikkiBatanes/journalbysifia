-- Run this once in SiteGround Site Tools → Site → MySQL → phpMyAdmin.

CREATE TABLE IF NOT EXISTS journal_early_access (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(254) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    email_consent TINYINT(1) NOT NULL DEFAULT 0,
    consent_at DATETIME NULL,

    current_journaling VARCHAR(50) NULL,
    consistency_challenges TEXT NULL,
    desired_outcomes TEXT NULL,
    feature_interests TEXT NULL,
    expected_price VARCHAR(50) NULL,
    price_reaction VARCHAR(50) NULL,
    tester_opt_in TINYINT(1) NOT NULL DEFAULT 0,
    anything_else TEXT NULL,
    survey_completed_at DATETIME NULL,

    source VARCHAR(100) NOT NULL DEFAULT 'journal-early-access',
    utm_source VARCHAR(120) NULL,
    utm_medium VARCHAR(120) NULL,
    utm_campaign VARCHAR(160) NULL,
    utm_content VARCHAR(160) NULL,
    user_agent VARCHAR(500) NULL,
    signup_token_hash CHAR(64) NOT NULL,
    unsubscribed_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_journal_early_access_email (email),
    UNIQUE KEY uq_journal_early_access_token (signup_token_hash),
    KEY idx_journal_early_access_tester (tester_opt_in),
    KEY idx_journal_early_access_platform (platform),
    KEY idx_journal_early_access_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

