package com.carddemo.webui;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Web 界面入口：托管静态 SPA，并把 /api/** 同源代理到各微服务（避免浏览器 CORS 与多端口）。
 */
@SpringBootApplication
public class WebUiApplication {

    public static void main(String[] args) {
        SpringApplication.run(WebUiApplication.class, args);
    }
}
