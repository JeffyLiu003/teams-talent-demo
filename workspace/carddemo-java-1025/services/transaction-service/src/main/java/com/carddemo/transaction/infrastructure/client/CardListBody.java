package com.carddemo.transaction.infrastructure.client;

import java.util.List;

/**
 * card-service GET /cards/by-account/{accountId} 的列表包装。
 */
record CardListBody(List<CardBody> items) {
}
