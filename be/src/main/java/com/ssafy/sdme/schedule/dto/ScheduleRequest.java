package com.ssafy.sdme.schedule.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.ssafy.sdme.schedule.domain.Schedule;

import java.time.LocalDate;
import java.time.LocalTime;

public record ScheduleRequest(
    String title,
    @JsonFormat(pattern = "yyyy-MM-dd") LocalDate date,
    @JsonFormat(pattern = "HH:mm[:ss]") LocalTime time,
    String location,
    String memo,
    Schedule.ScheduleCategory category
) {}
