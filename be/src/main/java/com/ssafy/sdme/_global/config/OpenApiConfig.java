package com.ssafy.sdme._global.config;

import com.ssafy.sdme._global.common.constant.ApiPath;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    public static final String SECURITY_SCHEME_NAME = "JWT";

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .addServersItem(new Server().url("http://localhost:8080").description("Local"))
                .info(new Info()
                        .title("SDME API")
                        .description("SDME Guard - AI 웨딩 플래너 API 문서")
                        .version("v1"))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components().addSecuritySchemes(
                        SECURITY_SCHEME_NAME,
                        new SecurityScheme()
                                .name("Authorization")
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                ));
    }

    @Bean
    public GroupedOpenApi authApi() {
        return GroupedOpenApi.builder()
                .group("1. AUTH API")
                .pathsToMatch(ApiPath.PATH + "/auth/**")
                .build();
    }

    @Bean
    public GroupedOpenApi userApi() {
        return GroupedOpenApi.builder()
                .group("2. USER API")
                .pathsToMatch(ApiPath.PATH + "/user/**")
                .build();
    }

    @Bean
    public GroupedOpenApi coupleApi() {
        return GroupedOpenApi.builder()
                .group("3. COUPLE API")
                .pathsToMatch(ApiPath.PATH + "/couples/**")
                .build();
    }
}
