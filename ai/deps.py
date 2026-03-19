from neo4j import GraphDatabase
from openai import OpenAI
from config import settings

_neo4j_driver = None
_openai_client = None


def init_clients():
    """앱 시작 시 호출 - Neo4j, OpenAI 클라이언트 초기화"""
    global _neo4j_driver, _openai_client
    _neo4j_driver = GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_user, settings.neo4j_pw),
    )
    _openai_client = OpenAI()

    # 연결 확인
    with _neo4j_driver.session() as session:
        cnt = session.run("MATCH (n) RETURN count(n) AS cnt").single()["cnt"]
        print(f"Neo4j 연결 완료 - 노드 {cnt}개")


def close_clients():
    """앱 종료 시 호출 - 연결 해제"""
    global _neo4j_driver
    if _neo4j_driver:
        _neo4j_driver.close()
        print("Neo4j 연결 종료")


def get_driver():
    return _neo4j_driver


def get_openai():
    return _openai_client
