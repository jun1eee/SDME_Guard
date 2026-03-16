package com.ssafy.sdme.user.service;

import com.ssafy.sdme.user.dto.request.UserEditRequest;
import com.ssafy.sdme.user.dto.request.UserPreferenceRequest;
import com.ssafy.sdme.user.dto.response.UserEditResponse;
import com.ssafy.sdme.user.dto.response.UserPreferenceResponse;
import com.ssafy.sdme.user.dto.response.UserResponse;

public interface UserService {

    UserResponse getMyInfo(Long userId);

    UserEditResponse editUser(Long userId, UserEditRequest request);

    UserPreferenceResponse savePreference(Long userId, UserPreferenceRequest request);

    UserPreferenceResponse getPreference(Long userId);
}
