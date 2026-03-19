package com.ssafy.sdme.schedule.dto;

import com.ssafy.sdme.schedule.domain.Schedule;

import java.time.LocalDate;
import java.time.LocalTime;

public record ScheduleResponse(
    Long id,
    String title,
    LocalDate date,
    LocalTime time,
    String location,
    String memo,
    Schedule.ScheduleCategory category,
    Schedule.ScheduleStatus status,
    Schedule.ScheduleSource source
) {
    public static ScheduleResponse from(Schedule schedule) {
        return new ScheduleResponse(
            schedule.getId(),
            schedule.getTitle(),
            schedule.getDate(),
            schedule.getTime(),
            schedule.getLocation(),
            schedule.getMemo(),
            schedule.getCategory(),
            schedule.getStatus(),
            schedule.getSource()
        );
    }
}
