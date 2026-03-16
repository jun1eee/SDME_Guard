package com.ssafy.sdme._global.exception;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ErrorMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.HttpClientErrorException;

import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ApiResponse<Map<String, String>> handleMethodArgumentNotValidException(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        fe -> fe.getField(),
                        fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Invalid value",
                        (msg1, msg2) -> msg1
                ));
        log.warn("[ValidationError] {}", fieldErrors);
        return ApiResponse.fail(HttpStatus.BAD_REQUEST, "Invalid input format", fieldErrors);
    }

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(BadRequestException.class)
    public ApiResponse<Void> handleBadRequestException(BadRequestException ex) {
        log.warn("[BadRequest] {}", ex.getMessage());
        return ApiResponse.fail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    @ExceptionHandler(UnauthorizedException.class)
    public ApiResponse<Void> handleUnauthorizedException(UnauthorizedException ex) {
        log.warn("[Unauthorized] {}", ex.getMessage());
        return ApiResponse.fail(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ResponseStatus(HttpStatus.FORBIDDEN)
    @ExceptionHandler(ForbiddenException.class)
    public ApiResponse<Void> handleForbiddenException(ForbiddenException ex) {
        log.warn("[Forbidden] {}", ex.getMessage());
        return ApiResponse.fail(HttpStatus.FORBIDDEN, ex.getMessage());
    }

    @ResponseStatus(HttpStatus.NOT_FOUND)
    @ExceptionHandler(NotFoundException.class)
    public ApiResponse<Void> handleNotFoundException(NotFoundException ex) {
        log.warn("[NotFound] {}", ex.getMessage());
        return ApiResponse.fail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ResponseStatus(HttpStatus.CONFLICT)
    @ExceptionHandler(ConflictException.class)
    public ApiResponse<Void> handleConflictException(ConflictException ex) {
        log.warn("[Conflict] {}", ex.getMessage());
        return ApiResponse.fail(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    @ExceptionHandler(HttpClientErrorException.class)
    public ApiResponse<Void> handleHttpClientErrorException(HttpClientErrorException ex) {
        log.error("[ExternalApiError] {} - {}", ex.getStatusCode(), ex.getResponseBodyAsString());
        return ApiResponse.fail(HttpStatus.BAD_GATEWAY, ErrorMessage.EXTERNAL_API_FAILED);
    }

    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    @ExceptionHandler(RuntimeException.class)
    public ApiResponse<Void> handleRuntimeException(RuntimeException ex) {
        log.error("[InternalError] {}", ex.getMessage(), ex);
        return ApiResponse.fail(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error");
    }

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(IllegalArgumentException.class)
    public ApiResponse<Void> handleIllegalArgumentException(IllegalArgumentException ex) {
        log.warn("[IllegalArgument] {}", ex.getMessage());
        return ApiResponse.fail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }
}
