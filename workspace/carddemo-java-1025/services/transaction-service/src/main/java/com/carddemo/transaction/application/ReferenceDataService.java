package com.carddemo.transaction.application;

import com.carddemo.transaction.domain.exception.NotFoundException;
import com.carddemo.transaction.domain.model.TranCategory;
import com.carddemo.transaction.domain.model.TranType;
import com.carddemo.transaction.domain.repository.TranCategoryRepository;
import com.carddemo.transaction.domain.repository.TranTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 交易类型/类别参照数据（COTRTLIC、COTRTUPC）。BR-TT-01 本期仅支持查询与类型描述维护。
 */
@Service
@Transactional
public class ReferenceDataService {

    private final TranTypeRepository types;
    private final TranCategoryRepository categories;

    public ReferenceDataService(TranTypeRepository types, TranCategoryRepository categories) {
        this.types = types;
        this.categories = categories;
    }

    @Transactional(readOnly = true)
    public List<TranType> listTypes() {
        return types.findAllTypes();
    }

    @Transactional(readOnly = true)
    public List<TranCategory> listCategories(String typeCode) {
        String filter = TransactionApplicationService.trimToNull(typeCode);
        return filter == null ? categories.findAllCategories() : categories.findByTypeCode(filter);
    }

    public TranType updateTypeDescription(String typeCode, String description) {
        TranType type = types.findType(typeCode)
                .orElseThrow(() -> new NotFoundException("TRANSACTION_TYPE_NOT_FOUND",
                        "Transaction type " + typeCode + " not found"));
        type.updateDescription(description);
        return types.saveType(type);
    }
}
