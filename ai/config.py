import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None
    kakao_rest_api_key: str | None
    openai_chat_model: str
    openai_embedding_model: str
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str | None
    mysql_host: str
    mysql_user: str
    mysql_password: str
    mysql_db: str
    mysql_port: int
    default_couple_id: int
    session_history_limit: int
    cors_origins: str

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        kakao_rest_api_key=os.getenv("KAKAO_REST_API_KEY"),
        openai_chat_model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o"),
        openai_embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
        neo4j_uri=os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687"),
        neo4j_user=os.getenv("NEO4J_USER", "neo4j"),
        neo4j_password=os.getenv("NEO4J_PW"),
        mysql_host=os.getenv("MYSQL_HOST", ""),
        mysql_user=os.getenv("MYSQL_USER", ""),
        mysql_password=os.getenv("MYSQL_PASSWORD", ""),
        mysql_db=os.getenv("MYSQL_DB", ""),
        mysql_port=int(os.getenv("MYSQL_PORT", "3306")),
        default_couple_id=int(os.getenv("DEFAULT_COUPLE_ID", "2")),
        session_history_limit=int(os.getenv("SESSION_HISTORY_LIMIT", "6")),
        cors_origins=os.getenv("CORS_ORIGINS", "*"),
    )
