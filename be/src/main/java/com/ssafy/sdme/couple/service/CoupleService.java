package com.ssafy.sdme.couple.service;

import com.ssafy.sdme.couple.dto.response.CoupleConnectResponse;
import com.ssafy.sdme.couple.dto.response.CoupleInviteResponse;
import com.ssafy.sdme.couple.dto.response.CoupleResponse;

public interface CoupleService {

    CoupleInviteResponse createInviteCode(Long userId);

    CoupleConnectResponse connect(Long userId, String inviteCode);

    CoupleResponse getMyCouple(Long userId);
}
