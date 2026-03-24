CREATE TABLE AI_CHAT_MESSAGES (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    couple_id BIGINT NOT NULL,
    user_id BIGINT,
    session_id VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL COMMENT 'user | assistant',
    content TEXT NOT NULL,
    recommendations JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_chat_session (session_id),
    INDEX idx_ai_chat_couple (couple_id, created_at)
);
