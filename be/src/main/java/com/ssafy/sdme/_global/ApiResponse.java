package com.ssafy.sdme._global;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import org.springframework.http.HttpStatus;
@Getter
@JsonPropertyOrder({"status", "message", "data"})
public class ApiResponse<T> {
    @Schema(example = "200")
    private final int status;
    @Schema(example = "success")
    private final String message;
    private final T data;

    private ApiResponse(int status, String message, T data) {
        this.status = status;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(HttpStatus.OK.value(), "success", data);
    }

    public static <T> ApiResponse<T> created(T data) {
        return new ApiResponse<>(HttpStatus.CREATED.value(), "success", data);
    }

    public static <T> ApiResponse<T> fail(HttpStatus status, String message) {
        return new ApiResponse<>(status.value(), message, null);
    }

    public static <T> ApiResponse<T> fail(HttpStatus status, String message, T data) {
        return new ApiResponse<>(status.value(), message, data);
    }
}
