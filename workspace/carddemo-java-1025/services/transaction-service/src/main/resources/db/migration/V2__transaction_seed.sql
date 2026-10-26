-- 交易参照数据与交易种子，逐条对齐 docs/design/05-api-catalog.md §0

-- 交易类型（CVTRA03Y / trantype.txt）
INSERT INTO tran_type (type_code, description) VALUES
    ('01', 'Purchase'),
    ('02', 'Payment'),
    ('03', 'Credit'),
    ('04', 'Authorization'),
    ('05', 'Refund'),
    ('06', 'Reversal'),
    ('07', 'Adjustment');

-- 交易类别（CVTRA04Y / trancatg.txt，契约 §0 列出的 11 组）
INSERT INTO tran_category (type_code, category_code, description) VALUES
    ('01', '0001', 'Regular Sales Draft'),
    ('01', '0002', 'Regular Cash Advance'),
    ('01', '0003', 'Convenience Check Debit'),
    ('01', '0004', 'ATM Cash Advance'),
    ('01', '0005', 'Interest Amount'),
    ('02', '0002', 'Payment'),
    ('03', '0001', 'Credit Adjustment'),
    ('04', '0001', 'Authorization'),
    ('05', '0001', 'Refund'),
    ('06', '0001', 'Reversal'),
    ('07', '0001', 'Adjustment');

-- 披露组（CVTRA02Y），A000000000 为契约账户组，DEFAULT 为利率回退组
INSERT INTO disclosure_group (group_id, type_code, category_code, interest_rate) VALUES
    ('A000000000', '01', '0001', 18.00),
    ('A000000000', '01', '0002', 24.00),
    ('A000000000', '01', '0003', 24.00),
    ('A000000000', '01', '0004', 24.00),
    ('A000000000', '01', '0005', 0.00),
    ('A000000000', '02', '0002', 0.00),
    ('A000000000', '03', '0001', 0.00),
    ('A000000000', '04', '0001', 0.00),
    ('A000000000', '05', '0001', 0.00),
    ('A000000000', '06', '0001', 0.00),
    ('A000000000', '07', '0001', 0.00),
    ('DEFAULT', '01', '0001', 20.00),
    ('DEFAULT', '01', '0002', 20.00),
    ('DEFAULT', '01', '0003', 20.00),
    ('DEFAULT', '01', '0004', 20.00),
    ('DEFAULT', '01', '0005', 0.00),
    ('DEFAULT', '02', '0002', 0.00),
    ('DEFAULT', '03', '0001', 0.00),
    ('DEFAULT', '04', '0001', 0.00),
    ('DEFAULT', '05', '0001', 0.00),
    ('DEFAULT', '06', '0001', 0.00),
    ('DEFAULT', '07', '0001', 0.00);

-- 类别累计（TCATBALF）
INSERT INTO tran_category_balance (account_id, type_code, category_code, balance, version) VALUES
    ('00000000001', '01', '0001', 1200.00, 0),
    ('00000000001', '01', '0002', 500.00, 0),
    ('00000000002', '01', '0001', 800.00, 0),
    ('00000000003', '01', '0001', 400.00, 0),
    ('00000000004', '01', '0001', 300.50, 0),
    ('00000000006', '01', '0001', 1500.00, 0),
    ('00000000008', '01', '0001', 2000.00, 0);

-- 交易种子（TRANSACT），账户号与卡号映射取自契约卡片表
INSERT INTO transaction (transaction_id, account_id, card_number, type_code, category_code, source, description,
                         amount, merchant_id, merchant_name, merchant_city, merchant_zip,
                         original_timestamp, processed_timestamp, status, version) VALUES
    ('0000000000000001', '00000000001', '0500024453765740', '01', '0001', 'POS TERM', 'Purchase at Abshire-Lowe',
     50.47, '800000001', 'Abshire-Lowe', 'Springfield', '10001',
     TIMESTAMP '2026-09-15 10:00:00', TIMESTAMP '2026-09-15 10:00:00', 'POSTED', 0),
    ('0000000000000002', '00000000002', '0683586198171516', '01', '0001', 'POS TERM', 'Return item at Nitzsche',
     91.90, '800000002', 'Nitzsche', 'West Bernita', '90002',
     TIMESTAMP '2026-09-16 11:30:00', TIMESTAMP '2026-09-16 11:30:00', 'POSTED', 0),
    ('0000000000000003', '00000000003', '0923877193247330', '02', '0002', 'POS TERM', 'BILL PAYMENT - ONLINE',
     1470.00, '999999999', 'BILL PAYMENT', 'N/A', 'N/A',
     TIMESTAMP '2026-09-20 09:00:00', TIMESTAMP '2026-09-20 09:00:00', 'POSTED', 0),
    ('0000000000000004', '00000000001', '0500024453765740', '01', '0002', 'ATM', 'ATM Cash Advance',
     200.00, '800000004', 'ATM NETWORK', 'Springfield', '10001',
     TIMESTAMP '2026-09-21 14:15:00', TIMESTAMP '2026-09-21 14:15:00', 'POSTED', 0),
    ('0000000000000005', '00000000006', '3344556677889900', '01', '0001', 'POS TERM', 'Purchase at Ernser-Roob',
     300.75, '800000005', 'Ernser-Roob', 'Miami', '33101',
     TIMESTAMP '2026-09-22 16:45:00', TIMESTAMP '2026-09-22 16:45:00', 'POSTED', 0),
    ('0000000000000006', '00000000008', '5566778899001122', '01', '0001', 'POS TERM', 'Purchase at Gleason',
     500.00, '800000006', 'Gleason', 'Chicago', '60601',
     TIMESTAMP '2026-09-25 08:20:00', TIMESTAMP '2026-09-25 08:20:00', 'POSTED', 0);
