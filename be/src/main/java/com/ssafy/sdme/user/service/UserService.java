package com.ssafy.sdme.user.service;

import com.ssafy.sdme.user.dto.request.UserEditRequest;
import com.ssafy.sdme.user.dto.request.UserPreferenceRequest;
import com.ssafy.sdme.user.dto.request.UserSharedInfoRequest;
import com.ssafy.sdme.user.dto.request.UserTastesRequest;
import com.ssafy.sdme.user.dto.response.UserEditResponse;
import com.ssafy.sdme.user.dto.response.UserPreferenceResponse;
import com.ssafy.sdme.user.dto.response.UserResponse;

public interface UserService {

    UserResponse getMyInfo(Long userId);

    UserEditResponse editUser(Long userId, UserEditRequest request);

    UserPreferenceResponse savePreference(Long userId, UserPreferenceRequest request);

    UserPreferenceResponse getPreference(Long userId);

    UserPreferenceResponse updateTastes(Long userId, UserTastesRequest request);

    UserPreferenceResponse getPartnerPreference(Long userId);

    UserPreferenceResponse updateSharedInfo(Long userId, UserSharedInfoRequest request);

    String updateProfileImage(Long userId, org.springframework.web.multipart.MultipartFile file);

    void deleteProfileImage(Long userId);
}
