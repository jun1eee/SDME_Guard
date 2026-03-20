package com.ssafy.sdme.schedule.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.schedule.dto.ScheduleRequest;
import com.ssafy.sdme.schedule.dto.ScheduleResponse;
import com.ssafy.sdme.schedule.dto.ScheduleStatusRequest;
import com.ssafy.sdme.schedule.service.ScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Schedule", description = "일정 API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    @Operation(summary = "일정 전체 조회")
    @GetMapping
    public ApiResponse<List<ScheduleResponse>> getSchedules(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(scheduleService.getSchedules(userId));
    }

    @Operation(summary = "일정 추가")
    @PostMapping
    public ApiResponse<ScheduleResponse> createSchedule(
        @RequestBody ScheduleRequest scheduleRequest,
        HttpServletRequest request
    ) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.created(scheduleService.createSchedule(userId, scheduleRequest));
    }

    @Operation(summary = "일정 수정")
    @PatchMapping("/{id}")
    public ApiResponse<ScheduleResponse> updateSchedule(
        @PathVariable Long id,
        @RequestBody ScheduleRequest scheduleRequest,
        HttpServletRequest request
    ) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(scheduleService.updateSchedule(userId, id, scheduleRequest));
    }

    @Operation(summary = "일정 삭제")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteSchedule(
        @PathVariable Long id,
        HttpServletRequest request
    ) {
        Long userId = (Long) request.getAttribute("userId");
        scheduleService.deleteSchedule(userId, id);
        return ApiResponse.ok(null);
    }

    @Operation(summary = "일정 상태 변경")
    @PutMapping("/{id}/status")
    public ApiResponse<ScheduleResponse> updateStatus(
        @PathVariable Long id,
        @RequestBody ScheduleStatusRequest statusRequest,
        HttpServletRequest request
    ) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(scheduleService.updateStatus(userId, id, statusRequest));
    }
}
