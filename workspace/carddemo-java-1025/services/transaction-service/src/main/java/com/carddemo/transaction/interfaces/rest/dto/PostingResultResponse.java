package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.application.PostingResult;

import java.util.List;

/**
 * 入账运行结果。status = COMPLETED / COMPLETED_WITH_REJECTS；
 * duplicates = 因同名交易号已存在而幂等跳过的交易号（NR-POST-01）。
 */
public record PostingResultResponse(
        String status,
        int processed,
        int posted,
        int rejected,
        List<PostingRejectionResponse> rejections,
        List<String> duplicates) {

    public static PostingResultResponse from(PostingResult result) {
        return new PostingResultResponse(result.status(), result.processed(), result.posted(),
                result.rejected(),
                result.rejections().stream().map(PostingRejectionResponse::from).toList(),
                result.duplicates());
    }
}
