package com.ssafy.sdme._global.common.constant;

public class ExpiredTime {
    public static final Long ACCESS_TOKEN_EXPIRED_TIME = 2 * 60 * 60 * 1000L;      // 2시간
    public static final Long REFRESH_TOKEN_EXPIRED_TIME = 14 * 24 * 60 * 60 * 1000L; // 14일

    public static final int COOKIE_DELETE_AGE = 0;
    public static final int COOKIE_REFRESH_MAX_AGE = -1;                             // 세션 쿠키 (브라우저 닫으면 삭제)
}
