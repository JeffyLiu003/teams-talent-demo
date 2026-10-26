CREATE TABLE transaction (
    transaction_id      VARCHAR(16) PRIMARY KEY,
    account_id          VARCHAR(11)    NOT NULL,
    card_number         VARCHAR(16),
    type_code           VARCHAR(2)     NOT NULL,
    category_code       VARCHAR(4)     NOT NULL,
    source              VARCHAR(10)    NOT NULL,
    description         VARCHAR(100)   NOT NULL,
    amount              NUMERIC(12, 2) NOT NULL,
    merchant_id         VARCHAR(9)     NOT NULL,
    merchant_name       VARCHAR(50)    NOT NULL,
    merchant_city       VARCHAR(50)    NOT NULL,
    merchant_zip        VARCHAR(10)    NOT NULL,
    original_timestamp  TIMESTAMP      NOT NULL,
    processed_timestamp TIMESTAMP      NOT NULL,
    status              VARCHAR(10)    NOT NULL,
    version             BIGINT         NOT NULL DEFAULT 0
);

CREATE INDEX idx_transaction_account ON transaction (account_id);
CREATE INDEX idx_transaction_card ON transaction (card_number);
CREATE INDEX idx_transaction_processed ON transaction (processed_timestamp);

CREATE TABLE daily_transaction (
    transaction_id      VARCHAR(16) PRIMARY KEY,
    card_number         VARCHAR(16),
    type_code           VARCHAR(2)     NOT NULL,
    category_code       VARCHAR(4)     NOT NULL,
    source              VARCHAR(10)    NOT NULL,
    description         VARCHAR(100)   NOT NULL,
    amount              NUMERIC(12, 2) NOT NULL,
    merchant_id         VARCHAR(9)     NOT NULL,
    merchant_name       VARCHAR(50)    NOT NULL,
    merchant_city       VARCHAR(50)    NOT NULL,
    merchant_zip        VARCHAR(10)    NOT NULL,
    original_timestamp  TIMESTAMP      NOT NULL,
    processed_timestamp TIMESTAMP      NOT NULL,
    status              VARCHAR(10)    NOT NULL,
    reject_reason_code  INT,
    reject_reason       VARCHAR(76),
    version             BIGINT         NOT NULL DEFAULT 0
);

CREATE TABLE tran_category_balance (
    account_id    VARCHAR(11)    NOT NULL,
    type_code     VARCHAR(2)     NOT NULL,
    category_code VARCHAR(4)     NOT NULL,
    balance       NUMERIC(12, 2) NOT NULL,
    version       BIGINT         NOT NULL DEFAULT 0,
    PRIMARY KEY (account_id, type_code, category_code)
);

CREATE TABLE tran_type (
    type_code   VARCHAR(2) PRIMARY KEY,
    description VARCHAR(50) NOT NULL
);

CREATE TABLE tran_category (
    type_code     VARCHAR(2)  NOT NULL,
    category_code VARCHAR(4)  NOT NULL,
    description   VARCHAR(50) NOT NULL,
    PRIMARY KEY (type_code, category_code)
);

CREATE TABLE disclosure_group (
    group_id      VARCHAR(10)    NOT NULL,
    type_code     VARCHAR(2)     NOT NULL,
    category_code VARCHAR(4)     NOT NULL,
    interest_rate NUMERIC(6, 2)  NOT NULL,
    PRIMARY KEY (group_id, type_code, category_code)
);
