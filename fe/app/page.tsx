"use client"

import { useState, useCallback } from "react"
import { WeddingProvider } from "@/lib/wedding-store"
import { AppShell } from "@/components/app-shell"
import { BudgetDashboard } from "@/components/budget-dashboard"
import { AiChat } from "@/components/ai-chat"
import { VendorListing } from "@/components/vendor-listing"
import { WeddingCalendar } from "@/components/wedding-calendar"
import { MyPage } from "@/components/my-page"

type SubPage = "main" | "edit-profile" | "favorites" | "payments" | "reservations" | "my-reviews" | "my-cards"

function WeddingApp() {
  const [activeTab, setActiveTab] = useState("chat")
  const [myPageSub, setMyPageSub] = useState<SubPage>("main")

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    if (tab === "mypage") setMyPageSub("main")
  }, [])

  const handleNavigateMyPageSub = useCallback((page: SubPage) => {
    setMyPageSub(page)
  }, [])

  return (
    <AppShell activeTab={activeTab} onTabChange={handleTabChange} onNavigateMyPageSub={handleNavigateMyPageSub}>
      {activeTab === "budget" && <BudgetDashboard />}
      {activeTab === "chat" && <AiChat />}
      {activeTab === "vendors" && <VendorListing />}
      {activeTab === "calendar" && <WeddingCalendar />}
      {activeTab === "mypage" && <MyPage subPage={myPageSub} onSubPageChange={setMyPageSub} />}
    </AppShell>
  )
}

export default function Page() {
  return (
    <WeddingProvider>
      <WeddingApp />
    </WeddingProvider>
  )
}
