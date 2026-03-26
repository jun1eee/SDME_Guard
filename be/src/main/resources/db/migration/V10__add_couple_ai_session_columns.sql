CREATE TABLE IF NOT EXISTS COUPLE_CHAT_ROOMS (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    couple_id BIGINT NOT NULL,
    ai_mode TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_couple_chat_rooms_couple (couple_id)
);

CREATE TABLE IF NOT EXISTS COUPLE_CHAT_MESSAGES (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    couple_chat_room_id BIGINT NOT NULL,
    sender_user_id BIGINT NOT NULL,
    content TEXT,
    message_type VARCHAR(30) DEFAULT 'text',
    vendor_id BIGINT,
    vendor_share_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_couple_chat_msg_room (couple_chat_room_id)
);

ALTER TABLE COUPLE_CHAT_ROOMS
    ADD COLUMN IF NOT EXISTS groom_ai_session_id VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS bride_ai_session_id VARCHAR(100) NULL;
