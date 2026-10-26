CREATE TABLE sec_user (
    user_id       VARCHAR(8)   PRIMARY KEY,
    first_name    VARCHAR(20)  NOT NULL,
    last_name     VARCHAR(20)  NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    user_type     VARCHAR(1)   NOT NULL,
    version       BIGINT       NOT NULL DEFAULT 0
);
