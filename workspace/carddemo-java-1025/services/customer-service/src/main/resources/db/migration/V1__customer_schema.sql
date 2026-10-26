CREATE TABLE customer (
    customer_id         VARCHAR(9)  PRIMARY KEY,
    first_name          VARCHAR(25) NOT NULL,
    middle_name         VARCHAR(25),
    last_name           VARCHAR(25) NOT NULL,
    address_line1       VARCHAR(50) NOT NULL,
    address_line2       VARCHAR(50),
    address_line3       VARCHAR(50) NOT NULL,
    state_code          VARCHAR(2)  NOT NULL,
    country_code        VARCHAR(3)  NOT NULL,
    zip_code            VARCHAR(10) NOT NULL,
    phone_number1       VARCHAR(15),
    phone_number2       VARCHAR(15),
    ssn                 VARCHAR(9)  NOT NULL,
    date_of_birth       DATE,
    eft_account_id      VARCHAR(10) NOT NULL,
    primary_card_holder VARCHAR(1)  NOT NULL,
    fico_score          INTEGER     NOT NULL,
    version             BIGINT      NOT NULL DEFAULT 0
);

CREATE INDEX idx_customer_state ON customer (state_code);
CREATE INDEX idx_customer_name ON customer (last_name, first_name);
