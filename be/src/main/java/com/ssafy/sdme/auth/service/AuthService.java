package com.ssafy.sdme.auth.service;

import com.ssafy.sdme.auth.dto.request.SignupRequest;
import com.ssafy.sdme.auth.dto.response.LoginResponse;
import com.ssafy.sdme.auth.dto.response.SignupResponse;

public interface AuthService {

    LoginResponse kakaoLogin(String code);

    SignupResponse signup(Long userId, SignupRequest request);

    LoginResponse reissue(String refreshToken);

    void logout(String accessToken);

    void withdraw(Long userId);
}
