package com.carddemo.transaction.interfaces.rest;

import com.carddemo.transaction.application.TransactionReportService;
import com.carddemo.transaction.interfaces.rest.dto.TransactionReportResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final TransactionReportService reportService;

    public ReportController(TransactionReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/transactions")
    public TransactionReportResponse transactions(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String cardNumber,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return TransactionReportResponse.from(
                reportService.report(startDate, endDate, cardNumber, page, size));
    }
}
