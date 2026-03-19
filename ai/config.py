from dotenv import load_dotenv
load_dotenv()

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    neo4j_uri: str = "bolt://127.0.0.1:7687"
    neo4j_user: str = "neo4j"
    neo4j_pw: str = ""
    openai_api_key: str = ""

    # 카카오맵 API (지오코딩)
    kakao_api_key: str = ""

    # Spring Boot API (프로덕션에서 사용)
    spring_url: str = "http://localhost:8080"

    # 세션 만료 시간 (시간)
    session_max_age_hours: int = 24

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
