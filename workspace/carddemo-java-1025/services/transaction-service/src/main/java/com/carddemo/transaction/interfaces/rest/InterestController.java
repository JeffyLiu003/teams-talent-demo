package com.carddemo.transaction.interfaces.rest;

import com.carddemo.transaction.application.InterestService;
import com.carddemo.transaction.interfaces.rest.dto.InterestRunRequest;
import com.carddemo.transaction.interfaces.rest.dto.InterestRunResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "利息", description = "循环利息计提（遗留 CBACT04C）")
@RestController
@RequestMapping("/api/v1/interest-runs")
public class InterestController {

    private final InterestService interestService;

    public InterestController(InterestService interestService) {
        this.interestService = interestService;
    }

    @Operation(summary = "运行利息计提",
            description = "按账户+类型+类别计算月息（累计额 × 年利率 ÷ 1200），按账户汇总生成利息交易并结算账户余额。")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(examples = @ExampleObject(
            name = "以 2026-10-25 为账单日",
            value = """
                    {"statementDate":"2026-10-25"}
                    """)))
    @PostMapping
    public InterestRunResponse run(@Valid @RequestBody InterestRunRequest request) {
        return InterestRunResponse.from(interestService.run(request.statementDate()));
    }
}
