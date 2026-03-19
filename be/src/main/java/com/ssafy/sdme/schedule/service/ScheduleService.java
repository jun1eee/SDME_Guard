package com.ssafy.sdme.schedule.service;

import com.ssafy.sdme._global.exception.ForbiddenException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.schedule.domain.Schedule;
import com.ssafy.sdme.schedule.dto.ScheduleRequest;
import com.ssafy.sdme.schedule.dto.ScheduleResponse;
import com.ssafy.sdme.schedule.dto.ScheduleStatusRequest;
import com.ssafy.sdme.schedule.repository.ScheduleRepository;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ScheduleResponse> getSchedules(Long userId) {
        User user = getUser(userId);
        List<Schedule> schedules = user.getCoupleId() != null
            ? scheduleRepository.findByCoupleIdAndDeletedAtIsNullOrderByDateAscCreatedAtDesc(user.getCoupleId())
            : scheduleRepository.findByUserIdAndDeletedAtIsNullOrderByDateAscCreatedAtDesc(userId);
        return schedules.stream().map(ScheduleResponse::from).toList();
    }

    @Transactional
    public ScheduleResponse createSchedule(Long userId, ScheduleRequest request) {
        User user = getUser(userId);
        Schedule schedule = Schedule.builder()
            .userId(userId)
            .coupleId(user.getCoupleId())
            .title(request.title())
            .date(request.date())
            .time(request.time())
            .location(request.location())
            .memo(request.memo())
            .category(request.category())
            .source(Schedule.ScheduleSource.USER)
            .build();
        log.info("[Schedule] 일정 생성 - userId: {}, title: {}", userId, request.title());
        return ScheduleResponse.from(scheduleRepository.save(schedule));
    }

    @Transactional
    public ScheduleResponse updateSchedule(Long userId, Long scheduleId, ScheduleRequest request) {
        Schedule schedule = getScheduleWithAuth(userId, scheduleId);
        schedule.update(request.title(), request.date(), request.time(), request.location(), request.memo(), request.category());
        log.info("[Schedule] 일정 수정 - scheduleId: {}", scheduleId);
        return ScheduleResponse.from(schedule);
    }

    @Transactional
    public void deleteSchedule(Long userId, Long scheduleId) {
        Schedule schedule = getScheduleWithAuth(userId, scheduleId);
        schedule.delete();
        log.info("[Schedule] 일정 삭제 - scheduleId: {}", scheduleId);
    }

    @Transactional
    public ScheduleResponse updateStatus(Long userId, Long scheduleId, ScheduleStatusRequest request) {
        Schedule schedule = getScheduleWithAuth(userId, scheduleId);
        schedule.updateStatus(request.status());
        log.info("[Schedule] 일정 상태 변경 - scheduleId: {}, status: {}", scheduleId, request.status());
        return ScheduleResponse.from(schedule);
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));
    }

    private Schedule getScheduleWithAuth(Long userId, Long scheduleId) {
        User user = getUser(userId);
        Schedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new NotFoundException("일정을 찾을 수 없습니다."));
        if (schedule.getDeletedAt() != null) {
            throw new NotFoundException("일정을 찾을 수 없습니다.");
        }
        boolean authorized;
        if (user.getCoupleId() != null && schedule.getCoupleId() != null) {
            // 둘 다 커플 연결 상태 → coupleId로 체크 (파트너도 수정 가능)
            authorized = user.getCoupleId().equals(schedule.getCoupleId());
        } else {
            // 커플 연결 전 만든 일정 → 본인만 수정 가능
            authorized = schedule.getUserId().equals(userId);
        }
        if (!authorized) {
            throw new ForbiddenException("해당 일정에 접근할 수 없습니다.");
        }
        return schedule;
    }
}
