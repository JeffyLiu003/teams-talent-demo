CREATE TABLE card (
    card_number     VARCHAR(16) PRIMARY KEY,
    account_id      VARCHAR(11) NOT NULL,
    customer_id     VARCHAR(9)  NOT NULL,
    cvv             VARCHAR(3)  NOT NULL,
    embossed_name   VARCHAR(50) NOT NULL,
    expiration_date DATE        NOT NULL,
    active_status   VARCHAR(1)  NOT NULL,
    version         BIGINT      NOT NULL DEFAULT 0
);

CREATE INDEX idx_card_account ON card (account_id);
CREATE INDEX idx_card_customer ON card (customer_id);

CREATE TABLE card_xref (
    card_number VARCHAR(16) PRIMARY KEY,
    customer_id VARCHAR(9)  NOT NULL,
    account_id  VARCHAR(11) NOT NULL
);
