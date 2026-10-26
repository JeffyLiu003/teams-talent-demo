-- 演示活动（日期以 2026 年为基准；演示环境当前时间 2026-10）
INSERT INTO campaign (campaign_id, name, description, campaign_type, status, start_at, end_at,
                      target_group_id, category_code, min_transaction_amount, reward_rate,
                      fixed_reward_amount, max_reward_per_transaction, max_rewards_per_card,
                      budget, consumed_amount, points_multiplier, enrollment_required,
                      created_at, updated_at, version)
VALUES ('c0000000-0000-0000-0000-000000000001', '开卡首刷礼',
        '活动期内首笔消费满 100 返 20 元', 'FIRST_PURCHASE_CASHBACK', 'ACTIVE',
        TIMESTAMP '2026-01-01 00:00:00', TIMESTAMP '2026-12-31 23:59:59',
        NULL, NULL, 100.00, NULL, 20.00, NULL, 1, 50000.00, 0.00, NULL, FALSE,
        TIMESTAMP '2026-01-01 00:00:00', TIMESTAMP '2026-01-01 00:00:00', 0),
       ('c0000000-0000-0000-0000-000000000002', '餐饮消费 5% 返现',
        '餐饮类单笔满 50 返 5%，单笔上限 30，每卡最多 5 次', 'CATEGORY_CASHBACK', 'ACTIVE',
        TIMESTAMP '2026-09-01 00:00:00', TIMESTAMP '2026-12-31 23:59:59',
        NULL, '0001', 50.00, 0.0500, NULL, 30.00, 5, 10000.00, 0.00, NULL, TRUE,
        TIMESTAMP '2026-09-01 00:00:00', TIMESTAMP '2026-09-01 00:00:00', 0),
       ('c0000000-0000-0000-0000-000000000003', '现金预支双倍积分',
        '现金预支类交易积分 2 倍，每卡最多 10 次', 'POINTS_MULTIPLIER', 'ACTIVE',
        TIMESTAMP '2026-09-01 00:00:00', TIMESTAMP '2026-12-31 23:59:59',
        NULL, '0002', 0.00, NULL, NULL, NULL, 10, 0.00, 0.00, 2.00, FALSE,
        TIMESTAMP '2026-09-01 00:00:00', TIMESTAMP '2026-09-01 00:00:00', 0),
       ('c0000000-0000-0000-0000-000000000004', '双十一餐饮加码',
        '11/01–11/15 餐饮消费返 10%，单笔上限 50（草稿，演示发布流程）', 'CATEGORY_CASHBACK', 'DRAFT',
        TIMESTAMP '2026-11-01 00:00:00', TIMESTAMP '2026-11-15 23:59:59',
        NULL, '0001', 50.00, 0.1000, NULL, 50.00, 3, 20000.00, 0.00, NULL, TRUE,
        TIMESTAMP '2026-10-20 00:00:00', TIMESTAMP '2026-10-20 00:00:00', 0);

-- 卡 0500024453765740（账户 1）已报名餐饮返现，便于演示"已报名"状态
INSERT INTO enrollment (enrollment_id, campaign_id, card_number, account_id, customer_id,
                        enrolled_at, version)
VALUES ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
        '0500024453765740', '00000000001', '000000001', TIMESTAMP '2026-10-01 09:00:00', 0);
