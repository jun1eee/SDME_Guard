package com.ssafy.sdme;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@EnableJpaAuditing
@SpringBootApplication
public class SdmeApplication {

    public static void main(String[] args) {
        SpringApplication.run(SdmeApplication.class, args);
    }

}
