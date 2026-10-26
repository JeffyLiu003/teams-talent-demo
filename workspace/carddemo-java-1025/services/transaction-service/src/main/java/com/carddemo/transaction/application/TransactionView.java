package com.carddemo.transaction.application;

import com.carddemo.transaction.domain.model.TransactionRecord;

/**
 * 交易视图：交易实体 + 参照表中的类型/类别描述（COTRN01C 展示用）。
 */
public record TransactionView(TransactionRecord transaction, String typeDescription, String categoryDescription) {
}
