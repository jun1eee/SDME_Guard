"use client"

import { useState, useRef, useCallback } from "react"
import { X, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

// ── 타입 ──────────────────────────────────────────────
export type PanelTabType = "chat" | "couple-chat" | "vendors" | "schedule" | "vote" | "budget" | "couple-wishlist"

export interface PanelTab {
  id: string
  type: PanelTabType
  title: string
  sessionId?: string
}

export interface PanelState {
  left: PanelTab[]
  right: PanelTab[]
  activeLeftId: string | null
  activeRightId: string | null
  splitRatio: number
}

const TAB_DOT_COLORS: Record<PanelTabType, string> = {
  chat: "bg-violet-500",
  "couple-chat": "bg-pink-500",
  vendors: "bg-emerald-500",
  schedule: "bg-blue-500",
  vote: "bg-amber-500",
  budget: "bg-teal-500",
  "couple-wishlist": "bg-red-500",
}

// ── 탭 바 ──────────────────────────────────────────────
function PanelTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  side,
  onTabDragStart,
  onTabDropOnBar,
}: {
  tabs: PanelTab[]
  activeTabId: string | null
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  side: "left" | "right"
  onTabDragStart: (tabId: string, fromSide: "left" | "right") => void
  onTabDropOnBar: (e: React.DragEvent, toSide: "left" | "right", beforeTabId?: string) => void
}) {
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  if (tabs.length === 0) return null

  return (
    <div
      className="flex h-9 shrink-0 items-center border-b border-border bg-muted/50 overflow-x-auto"
      onDragOver={(e) => {
        // 탭 드래그 또는 사이드바 드래그 모두 허용
        if (
          e.dataTransfer.types.includes("application/panel-tab") ||
          e.dataTransfer.types.includes("application/floating-window")
        ) {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
        }
      }}
      onDragLeave={() => setDragOverIdx(null)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOverIdx(null)
        onTabDropOnBar(e, side)
      }}
    >
      {tabs.map((tab, idx) => (
        <div
          key={tab.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/panel-tab", JSON.stringify({ tabId: tab.id, fromSide: side }))
            e.dataTransfer.effectAllowed = "move"
            onTabDragStart(tab.id, side)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragOverIdx(idx)
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragOverIdx(null)
            onTabDropOnBar(e, side, tab.id)
          }}
          className={cn(
            "group relative flex h-full cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs transition-colors select-none",
            activeTabId === tab.id
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
            dragOverIdx === idx && "ring-2 ring-inset ring-primary/40"
          )}
          onClick={() => onSelectTab(tab.id)}
        >
          {/* 활성 탭 하단 표시 */}
          {activeTabId === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
          <span className={cn("size-1.5 rounded-full shrink-0", TAB_DOT_COLORS[tab.type])} />
          <span className="truncate max-w-[120px] font-medium">{tab.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCloseTab(tab.id)
            }}
            className="ml-1 flex size-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── 리사이즈 핸들 ──────────────────────────────────────
function ResizeHandle({ onResize }: { onResize: (deltaX: number) => void }) {
  const isDraggingRef = useRef(false)
  const startX = useRef(0)
  const [active, setActive] = useState(false)
  // 항상 최신 onResize를 참조하도록 ref에 저장
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    startX.current = e.clientX
    setActive(true)

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const delta = e.clientX - startX.current
      startX.current = e.clientX
      onResizeRef.current(delta)
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      setActive(false)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }, [])

  return (
    <div
      className="group relative flex w-0 shrink-0 cursor-col-resize items-center justify-center"
      onMouseDown={handleMouseDown}
    >
      {/* 넓은 히트 영역 (투명) */}
      <div className="absolute inset-y-0 -left-2 -right-2 z-10" />
      {/* 시각적 바 — 호버/드래그 시 VSCode처럼 파란색 하이라이트 */}
      <div
        className={cn(
          "absolute inset-y-0 w-[3px] rounded-full transition-all duration-150",
          active
            ? "bg-primary shadow-[0_0_6px_rgba(var(--primary),0.4)]"
            : "bg-border group-hover:bg-primary/60"
        )}
      />
    </div>
  )
}

// ── 드롭존 ──────────────────────────────────────────────
function PanelDropZone({
  side,
  onDrop,
}: {
  side: "left" | "right"
  onDrop: (e: React.DragEvent, side: "left" | "right") => void
}) {
  const [over, setOver] = useState(false)

  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center border-2 border-dashed transition-all rounded-lg m-2",
        over
          ? "border-primary bg-primary/10"
          : "border-muted-foreground/30 bg-muted/30"
      )}
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes("application/panel-tab") ||
          e.dataTransfer.types.includes("application/floating-window")
        ) {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        onDrop(e, side)
      }}
    >
      <p className={cn("text-sm font-medium", over ? "text-primary" : "text-muted-foreground")}>
        {over ? "여기에 놓기" : `${side === "left" ? "왼쪽" : "오른쪽"}에 놓아서 열기`}
      </p>
    </div>
  )
}

// ── 메인 Split Panel ──────────────────────────────────
interface SplitPanelProps {
  state: PanelState
  onStateChange: (stateOrUpdater: PanelState | ((prev: PanelState) => PanelState)) => void
  renderContent: (tab: PanelTab) => React.ReactNode
  isDraggingFromSidebar: boolean
}

export function SplitPanel({
  state,
  onStateChange,
  renderContent,
  isDraggingFromSidebar,
}: SplitPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDraggingTab, setIsDraggingTab] = useState(false)
  const hasLeft = state.left.length > 0
  const hasRight = state.right.length > 0
  const hasBoth = hasLeft && hasRight
  const isDragging = isDraggingFromSidebar || isDraggingTab

  // 탭 드래그 시작
  const handleTabDragStart = (tabId: string, fromSide: "left" | "right") => {
    setIsDraggingTab(true)
  }

  // 전역 dragend 감지
  const handleDragEnd = () => {
    setIsDraggingTab(false)
  }

  // 탭 드롭 처리 (탭바 위 또는 드롭존)
  const handleTabDrop = (e: React.DragEvent, toSide: "left" | "right", beforeTabId?: string) => {
    // 1) 사이드바에서 드래그한 경우 → page.tsx에서 처리되지만 여기서도 처리
    const sidebarType = e.dataTransfer.getData("application/floating-window")
    if (sidebarType) {
      // page.tsx의 handleMainDrop이 처리할 것이지만,
      // 드롭존에 직접 떨어진 경우를 위해 이벤트를 버블링시킴
      return
    }

    // 2) 패널 탭 드래그
    const data = e.dataTransfer.getData("application/panel-tab")
    if (!data) return

    const { tabId, fromSide } = JSON.parse(data) as { tabId: string; fromSide: "left" | "right" }

    const sourceList = fromSide === "left" ? [...state.left] : [...state.right]
    const tabIndex = sourceList.findIndex((t) => t.id === tabId)
    if (tabIndex === -1) return

    // 같은 패널 내 순서 변경
    if (fromSide === toSide) {
      if (!beforeTabId) return
      const targetIdx = sourceList.findIndex((t) => t.id === beforeTabId)
      if (targetIdx === -1 || targetIdx === tabIndex) return

      const [tab] = sourceList.splice(tabIndex, 1)
      const insertIdx = targetIdx > tabIndex ? targetIdx - 1 : targetIdx
      sourceList.splice(insertIdx, 0, tab)

      onStateChange({
        ...state,
        [fromSide === "left" ? "left" : "right"]: sourceList,
      })
      return
    }

    // 다른 패널로 이동
    const [tab] = sourceList.splice(tabIndex, 1)
    const targetList = toSide === "left" ? [...state.left] : [...state.right]

    if (beforeTabId) {
      const insertIdx = targetList.findIndex((t) => t.id === beforeTabId)
      if (insertIdx !== -1) {
        targetList.splice(insertIdx, 0, tab)
      } else {
        targetList.push(tab)
      }
    } else {
      targetList.push(tab)
    }

    const newState = { ...state }

    if (fromSide === "left") {
      newState.left = sourceList
      newState.activeLeftId = sourceList.length > 0 ? sourceList[0].id : null
    } else {
      newState.right = sourceList
      newState.activeRightId = sourceList.length > 0 ? sourceList[0].id : null
    }

    if (toSide === "left") {
      newState.left = targetList
      newState.activeLeftId = tab.id
    } else {
      newState.right = targetList
      newState.activeRightId = tab.id
    }

    onStateChange(newState)
  }

  // 탭 선택
  const handleSelectTab = (id: string, side: "left" | "right") => {
    if (side === "left") {
      onStateChange({ ...state, activeLeftId: id })
    } else {
      onStateChange({ ...state, activeRightId: id })
    }
  }

  // 탭 닫기
  const handleCloseTab = (id: string, side: "left" | "right") => {
    const list = side === "left" ? [...state.left] : [...state.right]
    const idx = list.findIndex((t) => t.id === id)
    if (idx === -1) return

    list.splice(idx, 1)
    const currentActive = side === "left" ? state.activeLeftId : state.activeRightId

    let newActive: string | null = currentActive
    if (currentActive === id) {
      newActive = list.length > 0 ? list[Math.min(idx, list.length - 1)].id : null
    }

    onStateChange({
      ...state,
      [side]: list,
      [side === "left" ? "activeLeftId" : "activeRightId"]: newActive,
    })
  }

  // 리사이즈 — 함수형 업데이트로 항상 최신 state 참조
  const onStateChangeRef = useRef(onStateChange)
  onStateChangeRef.current = onStateChange

  const handleResize = useCallback((deltaX: number) => {
    if (!containerRef.current) return
    const totalWidth = containerRef.current.offsetWidth
    const delta = deltaX / totalWidth
    onStateChangeRef.current((prev: PanelState) => ({
      ...prev,
      splitRatio: Math.max(0.2, Math.min(0.8, prev.splitRatio + delta)),
    }))
  }, [])

  // 활성 탭
  const activeLeftTab = state.left.find((t) => t.id === state.activeLeftId) ?? state.left[0]
  const activeRightTab = state.right.find((t) => t.id === state.activeRightId) ?? state.right[0]

  return (
    <div ref={containerRef} className="flex h-full" onDragEnd={handleDragEnd}>
      {/* 왼쪽 패널 */}
      {hasLeft ? (
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: hasBoth ? `${state.splitRatio * 100}%` : "100%" }}
        >
          <PanelTabBar
            tabs={state.left}
            activeTabId={state.activeLeftId}
            onSelectTab={(id) => handleSelectTab(id, "left")}
            onCloseTab={(id) => handleCloseTab(id, "left")}
            side="left"
            onTabDragStart={handleTabDragStart}
            onTabDropOnBar={handleTabDrop}
          />
          <div className="flex-1 overflow-y-auto">
            {activeLeftTab && renderContent(activeLeftTab)}
          </div>
        </div>
      ) : (
        isDragging && <PanelDropZone side="left" onDrop={handleTabDrop} />
      )}

      {/* 리사이즈 핸들 */}
      {hasBoth && <ResizeHandle onResize={handleResize} />}

      {/* 오른쪽 패널 */}
      {hasRight ? (
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: hasBoth ? `${(1 - state.splitRatio) * 100}%` : "100%" }}
        >
          <PanelTabBar
            tabs={state.right}
            activeTabId={state.activeRightId}
            onSelectTab={(id) => handleSelectTab(id, "right")}
            onCloseTab={(id) => handleCloseTab(id, "right")}
            side="right"
            onTabDragStart={handleTabDragStart}
            onTabDropOnBar={handleTabDrop}
          />
          <div className="flex-1 overflow-y-auto">
            {activeRightTab && renderContent(activeRightTab)}
          </div>
        </div>
      ) : (
        isDragging && hasLeft && <PanelDropZone side="right" onDrop={handleTabDrop} />
      )}
    </div>
  )
}
