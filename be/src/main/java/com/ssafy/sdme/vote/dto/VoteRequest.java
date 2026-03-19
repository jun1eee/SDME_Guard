package com.ssafy.sdme.vote.dto;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VoteRequest {
    private String score; // great, good, neutral, bad, notinterested
    private String reason;
}
