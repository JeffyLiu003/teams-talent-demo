package com.carddemo.authorization.domain.exception;

/**
 * 下游服务不可用（5xx、超时、连接失败）。映射为 HTTP 503 DEPENDENCY_UNAVAILABLE。
 * 授权场景必须失败关闭：无法判断额度时不批准。
 * 调用与失败语义见 docs/design/03-service-decomposition.md §4。
 */
public class RemoteServiceException extends RuntimeException {

    public RemoteServiceException(String message) {
        super(message);
    }

    public RemoteServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
