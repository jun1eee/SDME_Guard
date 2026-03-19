from dotenv import load_dotenv
load_dotenv()

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Neo4j
    neo4j_uri: str = "bolt://127.0.0.1:7687"
    neo4j_user: str = "neo4j"
    neo4j_pw: str = ""

    # OpenAI
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"

    # 카카오맵 API (지오코딩)
    kakao_api_key: str = ""

    # MySQL (사용자 데이터)
    mysql_host: str = ""
    mysql_user: str = ""
    mysql_password: str = ""
    mysql_db: str = ""
    mysql_port: int = 3306

    # Spring Boot API
    spring_url: str = "http://localhost:8080"

    # 세션
    session_max_age_hours: int = 24
    session_history_limit: int = 6
    default_couple_id: int = 2

    # CORS
    cors_origins: str = "*"

    # ai-jw 호환 alias
    @property
    def neo4j_password(self) -> str:
        return self.neo4j_pw

    @property
    def kakao_rest_api_key(self) -> str:
        return self.kakao_api_key

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
