CREATE TABLE campaign (
    campaign_id              VARCHAR(36) PRIMARY KEY,
    name                     VARCHAR(80)  NOT NULL,
    description              VARCHAR(300),
    campaign_type            VARCHAR(32)  NOT NULL,
    status                   VARCHAR(16)  NOT NULL,
    start_at                 TIMESTAMP    NOT NULL,
    end_at                   TIMESTAMP    NOT NULL,
    target_group_id          VARCHAR(10),
    category_code            VARCHAR(4),
    min_transaction_amount   NUMERIC(12, 2) NOT NULL,
    reward_rate              NUMERIC(6, 4),
    fixed_reward_amount      NUMERIC(12, 2),
    max_reward_per_transaction NUMERIC(12, 2),
    max_rewards_per_card     INTEGER,
    budget                   NUMERIC(12, 2) NOT NULL,
    consumed_amount          NUMERIC(12, 2) NOT NULL,
    points_multiplier        NUMERIC(5, 2),
    enrollment_required      BOOLEAN      NOT NULL,
    created_at               TIMESTAMP    NOT NULL,
    updated_at               TIMESTAMP    NOT NULL,
    version                  BIGINT       NOT NULL DEFAULT 0
);

CREATE INDEX idx_campaign_status_period ON campaign (status, start_at, end_at);

CREATE TABLE enrollment (
    enrollment_id VARCHAR(36) PRIMARY KEY,
    campaign_id   VARCHAR(36) NOT NULL,
    card_number   VARCHAR(16) NOT NULL,
    account_id    VARCHAR(11) NOT NULL,
    customer_id   VARCHAR(9),
    enrolled_at   TIMESTAMP   NOT NULL,
    version       BIGINT      NOT NULL DEFAULT 0,
    CONSTRAINT uk_enrollment_campaign_card UNIQUE (campaign_id, card_number)
);

CREATE INDEX idx_enrollment_card ON enrollment (card_number);

CREATE TABLE reward_grant (
    reward_id       VARCHAR(36) PRIMARY KEY,
    campaign_id     VARCHAR(36) NOT NULL,
    transaction_id  VARCHAR(16) NOT NULL,
    card_number     VARCHAR(16) NOT NULL,
    account_id      VARCHAR(11) NOT NULL,
    customer_id     VARCHAR(9),
    reward_type     VARCHAR(16) NOT NULL,
    reward_amount   NUMERIC(12, 2) NOT NULL,
    reward_points   INTEGER       NOT NULL,
    status          VARCHAR(16)   NOT NULL,
    failure_reason  VARCHAR(200),
    created_at      TIMESTAMP     NOT NULL,
    granted_at      TIMESTAMP,
    version         BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT uk_reward_campaign_txn UNIQUE (campaign_id, transaction_id)
);

CREATE INDEX idx_reward_account ON reward_grant (account_id, created_at);
CREATE INDEX idx_reward_card ON reward_grant (card_number);
CREATE INDEX idx_reward_campaign ON reward_grant (campaign_id);
