package com.ssafy.sdme.schedule.dto;

import com.ssafy.sdme.schedule.domain.Schedule;

public record ScheduleStatusRequest(
    Schedule.ScheduleStatus status
) {}
