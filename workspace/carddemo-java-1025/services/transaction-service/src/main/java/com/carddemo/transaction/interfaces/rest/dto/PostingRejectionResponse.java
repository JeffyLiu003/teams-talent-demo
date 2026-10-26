package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.application.PostingRejection;

public record PostingRejectionResponse(String transactionId, int reasonCode, String reason) {

    public static PostingRejectionResponse from(PostingRejection rejection) {
        return new PostingRejectionResponse(rejection.transactionId(), rejection.reasonCode(),
                rejection.reason());
    }
}
