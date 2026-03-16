package com.ssafy.sdme.user.domain;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum Role {
    g("GROOM"),
    b("BRIDE");

    private final String description;
}
