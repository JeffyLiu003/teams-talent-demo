CREATE TABLE reward_credit (
    reward_id   VARCHAR(36) PRIMARY KEY,
    account_id  VARCHAR(11)   NOT NULL,
    campaign_id VARCHAR(36)   NOT NULL,
    amount      NUMERIC(12, 2) NOT NULL,
    created_at  TIMESTAMP      NOT NULL
);

CREATE INDEX idx_reward_credit_account ON reward_credit (account_id);
