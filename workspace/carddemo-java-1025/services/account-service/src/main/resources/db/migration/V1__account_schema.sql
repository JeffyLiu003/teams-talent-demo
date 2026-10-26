CREATE TABLE account (
    account_id          VARCHAR(11) PRIMARY KEY,
    active_status       VARCHAR(1)    NOT NULL,
    current_balance     NUMERIC(12, 2) NOT NULL,
    credit_limit        NUMERIC(12, 2) NOT NULL,
    cash_credit_limit   NUMERIC(12, 2) NOT NULL,
    open_date           DATE          NOT NULL,
    expiration_date     DATE          NOT NULL,
    reissue_date        DATE          NOT NULL,
    current_cycle_credit NUMERIC(12, 2) NOT NULL,
    current_cycle_debit  NUMERIC(12, 2) NOT NULL,
    address_zip         VARCHAR(10),
    group_id            VARCHAR(10),
    version             BIGINT        NOT NULL DEFAULT 0
);

CREATE INDEX idx_account_group ON account (group_id);
