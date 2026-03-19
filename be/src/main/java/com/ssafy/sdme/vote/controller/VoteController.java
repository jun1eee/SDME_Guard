package com.ssafy.sdme.vote.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.vote.domain.Vote;
import com.ssafy.sdme.vote.domain.VoteItem;
import com.ssafy.sdme.vote.dto.VoteItemRequest;
import com.ssafy.sdme.vote.dto.VoteItemResponse;
import com.ssafy.sdme.vote.dto.VoteRequest;
import com.ssafy.sdme.vote.service.VoteService;

import java.util.List;
import java.util.Map;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Vote", description = "업체 투표 API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/votes")
@RequiredArgsConstructor
public class VoteController {

    private final VoteService voteService;
    private final SimpMessagingTemplate messagingTemplate;

    @Operation(summary = "투표 항목 목록 조회", description = "커플의 투표 항목 목록을 조회합니다.")
    @GetMapping("/items")
    public ApiResponse<List<VoteItemResponse>> getVoteItems(HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        return ApiResponse.ok(voteService.getVoteItems(userId));
    }

    @Operation(summary = "투표 항목 생성", description = "공유된 업체를 투표 항목으로 생성합니다.")
    @PostMapping("/items")
    public ApiResponse<VoteItem> createVoteItem(@RequestBody VoteItemRequest request,
                                                 HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        VoteItem item = voteService.createVoteItem(userId, request);
        // WebSocket으로 커플에게 투표 알림
        String voteNotify = "{\"type\":\"vote_notify\",\"senderId\":" + userId + ",\"voteItemId\":" + item.getId() + "}";
        messagingTemplate.convertAndSend("/topic/vote/" + item.getCoupleId(), voteNotify);
        return ApiResponse.created(item);
    }

    @Operation(summary = "투표", description = "투표 항목에 투표합니다.")
    @PostMapping("/{voteItemId}/votes")
    public ApiResponse<Vote> vote(@PathVariable Long voteItemId,
                                   @RequestBody VoteRequest request,
                                   HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        return ApiResponse.ok(voteService.vote(userId, voteItemId, request));
    }

    @Operation(summary = "투표 삭제", description = "투표를 삭제합니다.")
    @DeleteMapping("/{voteItemId}/votes")
    public ApiResponse<Void> deleteVote(@PathVariable Long voteItemId,
                                         HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        voteService.deleteVote(userId, voteItemId);
        return ApiResponse.ok(null);
    }

    @Operation(summary = "투표 항목 삭제", description = "투표 항목을 삭제합니다.")
    @DeleteMapping("/items/{voteItemId}")
    public ApiResponse<Void> deleteVoteItem(@PathVariable Long voteItemId,
                                             HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        voteService.deleteVoteItem(userId, voteItemId);
        return ApiResponse.ok(null);
    }
}
