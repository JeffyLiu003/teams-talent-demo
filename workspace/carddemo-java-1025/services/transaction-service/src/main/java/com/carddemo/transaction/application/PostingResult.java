package com.carddemo.transaction.application;

import java.util.List;

/**
 * 入账运行结果。status = COMPLETED（全部通过）或 COMPLETED_WITH_REJECTS（部分拒付，对齐 BR-POST-08 返回码 4）。
 * duplicates 列出因同名交易号已存在而跳过的幂等命中（NR-POST-01）。
 */
public record PostingResult(
        String status,
        int processed,
        int posted,
        int rejected,
        List<PostingRejection> rejections,
        List<String> duplicates) {
}
