package com.ssafy.sdme._global.common.util;

import com.ssafy.sdme._global.common.constant.ApiPath;
import jakarta.servlet.http.Cookie;

public class CookieUtil {

    public static Cookie createCookie(String key, String value, int maxAge) {
        Cookie cookie = new Cookie(key, value);
        cookie.setMaxAge(maxAge);
        cookie.setSecure(false); // TODO: 운영 환경에서는 true로 변경
        cookie.setHttpOnly(true);
        cookie.setPath("/");

        return cookie;
    }
}
