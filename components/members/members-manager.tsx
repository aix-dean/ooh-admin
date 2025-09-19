"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MembersTable } from "./members-table"
import { PaginationControls } from "./pagination-controls"
import { OHPlusMembersTable } from "./oh-plus-members-table"
import { SellahMembersTable } from "./sellah-members-table"
import {
  getPaginatedMembers,
  getPaginatedOHPlusMembers,
  getPaginatedSellahMembers,
  clearMembersCache,
  type Member,
  type OHPlusMember,
  type SellahMember,
  type PaginationInfo,
  type PaginatedMembersResult,
  type PaginatedOHPlusMembersResult,
  type PaginatedSellahMembersResult,
} from "@/lib/members-service"
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore"
import { ShoppingBag, Star, Store, Users, RefreshCw, List, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MembersListView } from "./members-list-view"
import { OHPlusMembersListView } from "./oh-plus-members-list-view"
import { SellahMembersListView } from "./sellah-members-list-view"
import type { ViewMode } from "@/types/view-mode"

type Platform = "ooh-shop" | "oh-plus" | "sellah"

interface PlatformState {
  members: Member[] | OHPlusMember[] | SellahMember[]
  pagination: PaginationInfo
  firstDoc?: QueryDocumentSnapshot<DocumentData>
  lastDoc?: QueryDocumentSnapshot<DocumentData>
  loading: boolean
  error: string | null
  lastFetchTime: number
  initialized: boolean
}

interface PageHistoryEntry {
  page: number
  firstDoc?: QueryDocumentSnapshot<DocumentData>
  lastDoc?: QueryDocumentSnapshot<DocumentData>
  members: any[]
  timestamp: number
}

const initialPaginationInfo: PaginationInfo = {
  currentPage: 1,
  totalPages: 0,
  totalMembers: 0,
  hasNextPage: false,
  hasPreviousPage: false,
  pageSize: 10,
}

const initialPlatformState: PlatformState = {
  members: [],
  pagination: initialPaginationInfo,
  loading: false,
  error: null,
  lastFetchTime: 0,
  initialized: false,
}

export function MembersManager() {
  const [viewModes, setViewModes] = useState<Record<Platform, ViewMode>>({
    "ooh-shop": "card",
    "oh-plus": "card",
    sellah: "card",
  })

  const [platformStates, setPlatformStates] = useState<Record<Platform, PlatformState>>({
    "ooh-shop": { ...initialPlatformState },
    "oh-plus": { ...initialPlatformState },
    sellah: { ...initialPlatformState },
  })

  const [pageHistory, setPageHistory] = useState<Record<Platform, PageHistoryEntry[]>>({
    "ooh-shop": [],
    "oh-plus": [],
    sellah: [],
  })

  const isMountedRef = useRef(true)
  const [activePlatform, setActivePlatform] = useState<Platform>("ooh-shop")

  const updatePlatformState = useCallback((platform: Platform, updates: Partial<PlatformState>) => {
    setPlatformStates((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        ...updates,
      },
    }))
  }, [])

  const toggleViewMode = useCallback((platform: Platform) => {
    setViewModes((prev) => ({
      ...prev,
      [platform]: prev[platform] === "list" ? "card" : "list",
    }))
  }, [])

  // Fetch OOH! Shop members (filtered by type only)
  const fetchMembers = useCallback(
    async (
      page = 1,
      pageSize = 10,
      direction: "next" | "previous" | "direct" = "direct",
      startAfterDoc?: QueryDocumentSnapshot<DocumentData>,
      endBeforeDoc?: QueryDocumentSnapshot<DocumentData>,
    ) => {
      if (!isMountedRef.current) return

      console.log(`fetchMembers called: page=${page}, direction=${direction}`)
      updatePlatformState("ooh-shop", { loading: true, error: null })

      try {
        const result: PaginatedMembersResult = await getPaginatedMembers({
          page,
          pageSize,
          startAfterDoc,
          endBeforeDoc,
          direction: direction === "direct" ? "next" : direction,
        })

        if (!isMountedRef.current) return

        console.log(`fetchMembers result:`, result)

        updatePlatformState("ooh-shop", {
          members: result.members,
          pagination: result.pagination,
          firstDoc: result.firstDoc,
          lastDoc: result.lastDoc,
          loading: false,
          lastFetchTime: Date.now(),
          initialized: true,
        })

        setPageHistory((prev) => ({
          ...prev,
          "ooh-shop": [
            ...prev["ooh-shop"].filter((p) => p.page !== page),
            {
              page,
              firstDoc: result.firstDoc,
              lastDoc: result.lastDoc,
              members: result.members,
              timestamp: Date.now(),
            },
          ].slice(-10),
        }))

        console.log(`Successfully fetched ${result.members.length} OOH! Shop members for page ${page}`)
      } catch (err) {
        if (!isMountedRef.current) return

        console.error("Error fetching OOH! Shop members:", err)
        updatePlatformState("ooh-shop", {
          error: "Failed to load OOH! Shop members. Please try again.",
          loading: false,
          initialized: true,
        })
      }
    },
    [updatePlatformState],
  )

  // Fetch OH! Plus members (filtered by type only)
  const fetchOHPlusMembers = useCallback(
    async (
      page = 1,
      pageSize = 10,
      direction: "next" | "previous" | "direct" = "direct",
      startAfterDoc?: QueryDocumentSnapshot<DocumentData>,
      endBeforeDoc?: QueryDocumentSnapshot<DocumentData>,
    ) => {
      if (!isMountedRef.current) return

      console.log(`fetchOHPlusMembers called: page=${page}, direction=${direction}`)
      updatePlatformState("oh-plus", { loading: true, error: null })

      try {
        const result: PaginatedOHPlusMembersResult = await getPaginatedOHPlusMembers({
          page,
          pageSize,
          startAfterDoc,
          endBeforeDoc,
          direction: direction === "direct" ? "next" : direction,
        })

        if (!isMountedRef.current) return

        console.log(`fetchOHPlusMembers result:`, result)

        updatePlatformState("oh-plus", {
          members: result.members,
          pagination: result.pagination,
          firstDoc: result.firstDoc,
          lastDoc: result.lastDoc,
          loading: false,
          lastFetchTime: Date.now(),
          initialized: true,
        })

        setPageHistory((prev) => ({
          ...prev,
          "oh-plus": [
            ...prev["oh-plus"].filter((p) => p.page !== page),
            {
              page,
              firstDoc: result.firstDoc,
              lastDoc: result.lastDoc,
              members: result.members,
              timestamp: Date.now(),
            },
          ].slice(-10),
        }))

        console.log(`Successfully fetched ${result.members.length} OH! Plus members for page ${page}`)
      } catch (err) {
        if (!isMountedRef.current) return

        console.error("Error fetching OH! Plus members:", err)
        updatePlatformState("oh-plus", {
          error: "Failed to load OH! Plus members. Please try again.",
          loading: false,
          initialized: true,
        })
      }
    },
    [updatePlatformState],
  )

  // Fetch Sellah members (filtered by type only)
  const fetchSellahMembers = useCallback(
    async (
      page = 1,
      pageSize = 10,
      direction: "next" | "previous" | "direct" = "direct",
      startAfterDoc?: QueryDocumentSnapshot<DocumentData>,
      endBeforeDoc?: QueryDocumentSnapshot<DocumentData>,
    ) => {
      if (!isMountedRef.current) return

      console.log(`fetchSellahMembers called: page=${page}, direction=${direction}`)
      updatePlatformState("sellah", { loading: true, error: null })

      try {
        const result: PaginatedSellahMembersResult = await getPaginatedSellahMembers({
          page,
          pageSize,
          startAfterDoc,
          endBeforeDoc,
          direction: direction === "direct" ? "next" : direction,
        })

        if (!isMountedRef.current) return

        console.log(`fetchSellahMembers result:`, result)

        updatePlatformState("sellah", {
          members: result.members,
          pagination: result.pagination,
          firstDoc: result.firstDoc,
          lastDoc: result.lastDoc,
          loading: false,
          lastFetchTime: Date.now(),
          initialized: true,
        })

        setPageHistory((prev) => ({
          ...prev,
          sellah: [
            ...prev["sellah"].filter((p) => p.page !== page),
            {
              page,
              firstDoc: result.firstDoc,
              lastDoc: result.lastDoc,
              members: result.members,
              timestamp: Date.now(),
            },
          ].slice(-10),
        }))

        console.log(`Successfully fetched ${result.members.length} Sellah members for page ${page}`)
      } catch (err) {
        if (!isMountedRef.current) return

        console.error("Error fetching Sellah members:", err)
        updatePlatformState("sellah", {
          error: "Failed to load Sellah members. Please try again.",
          loading: false,
          initialized: true,
        })
      }
    },
    [updatePlatformState],
  )

  // Initial load effect - loads members based on type filter only
  useEffect(() => {
    const currentState = platformStates[activePlatform]

    if (!currentState.initialized && !currentState.loading) {
      console.log(`Initializing platform: ${activePlatform} (type-based filtering only)`)

      if (activePlatform === "ooh-shop") {
        fetchMembers(1, currentState.pagination.pageSize)
      } else if (activePlatform === "oh-plus") {
        fetchOHPlusMembers(1, currentState.pagination.pageSize)
      } else if (activePlatform === "sellah") {
        fetchSellahMembers(1, currentState.pagination.pageSize)
      }
    }
  }, [activePlatform, platformStates, fetchMembers, fetchOHPlusMembers, fetchSellahMembers])

  // Enhanced page change with proper cursor handling
  const handlePageChange = useCallback(
    (newPage: number) => {
      const currentState = platformStates[activePlatform]
      const currentPage = currentState.pagination.currentPage

      if (newPage === currentPage) return

      console.log(`Navigating from page ${currentPage} to page ${newPage} on platform ${activePlatform}`)

      // Determine direction and cursor documents
      let direction: "next" | "previous" | "direct" = "direct"
      let startAfterDoc: QueryDocumentSnapshot<DocumentData> | undefined
      let endBeforeDoc: QueryDocumentSnapshot<DocumentData> | undefined

      if (newPage === currentPage + 1) {
        // Next page
        direction = "next"
        startAfterDoc = currentState.lastDoc
        console.log("Using next page navigation with cursor")
      } else if (newPage === currentPage - 1) {
        // Previous page
        direction = "previous"
        endBeforeDoc = currentState.firstDoc
        console.log("Using previous page navigation with cursor")
      } else {
        // Direct page access
        direction = "direct"
        console.log("Using direct page access")
      }

      // Navigate using appropriate method
      if (activePlatform === "ooh-shop") {
        fetchMembers(newPage, currentState.pagination.pageSize, direction, startAfterDoc, endBeforeDoc)
      } else if (activePlatform === "oh-plus") {
        fetchOHPlusMembers(newPage, currentState.pagination.pageSize, direction, startAfterDoc, endBeforeDoc)
      } else if (activePlatform === "sellah") {
        fetchSellahMembers(newPage, currentState.pagination.pageSize, direction, startAfterDoc, endBeforeDoc)
      }
    },
    [activePlatform, platformStates, fetchMembers, fetchOHPlusMembers, fetchSellahMembers],
  )

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      console.log(`Changing page size to ${newPageSize} for platform ${activePlatform}`)

      setPageHistory((prev) => ({
        ...prev,
        [activePlatform]: [],
      }))

      updatePlatformState(activePlatform, {
        ...initialPlatformState,
        pagination: {
          ...initialPaginationInfo,
          pageSize: newPageSize,
        },
      })

      clearMembersCache()

      if (activePlatform === "ooh-shop") {
        fetchMembers(1, newPageSize, "direct")
      } else if (activePlatform === "oh-plus") {
        fetchOHPlusMembers(1, newPageSize, "direct")
      } else if (activePlatform === "sellah") {
        fetchSellahMembers(1, newPageSize, "direct")
      }
    },
    [activePlatform, fetchMembers, fetchOHPlusMembers, fetchSellahMembers, updatePlatformState],
  )

  const handleRefresh = useCallback(() => {
    const currentState = platformStates[activePlatform]
    clearMembersCache()

    setPageHistory((prev) => ({
      ...prev,
      [activePlatform]: [],
    }))

    updatePlatformState(activePlatform, {
      initialized: false,
      error: null,
    })

    if (activePlatform === "ooh-shop") {
      fetchMembers(currentState.pagination.currentPage, currentState.pagination.pageSize, "direct")
    } else if (activePlatform === "oh-plus") {
      fetchOHPlusMembers(currentState.pagination.currentPage, currentState.pagination.pageSize, "direct")
    } else if (activePlatform === "sellah") {
      fetchSellahMembers(currentState.pagination.currentPage, currentState.pagination.pageSize, "direct")
    }
  }, [activePlatform, platformStates, fetchMembers, fetchOHPlusMembers, fetchSellahMembers, updatePlatformState])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const currentState = platformStates[activePlatform]

  if (currentState.error) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
            <Users className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-red-600 mb-2 font-medium">{currentState.error}</p>
          <Button onClick={handleRefresh} className="mt-2">
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50 rounded-lg">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Members</h1>
            <p className="text-muted-foreground mt-1">Manage and view members by type across all platforms</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-200 p-1">
              <Button
                variant={viewModes[activePlatform] === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => toggleViewMode(activePlatform)}
                className="h-8 px-3"
              >
                <List className="h-4 w-4 mr-1" />
                List
              </Button>
              <Button
                variant={viewModes[activePlatform] === "card" ? "default" : "ghost"}
                size="sm"
                onClick={() => toggleViewMode(activePlatform)}
                className="h-8 px-3"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Card
              </Button>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="icon" disabled={currentState.loading}>
              <RefreshCw className={`h-4 w-4 ${currentState.loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        value={activePlatform}
        onValueChange={(value) => setActivePlatform(value as Platform)}
        className="flex flex-col flex-1 w-full overflow-hidden"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-1 mx-6 mt-6">
          <TabsList className="w-full grid grid-cols-3 h-auto p-0 bg-transparent">
            <TabsTrigger
              value="ooh-shop"
              className="flex items-center gap-2 py-3 px-4 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white transition-all"
            >
              <ShoppingBag className="h-5 w-5" />
              <span className="font-medium">OOH! Shop</span>
            </TabsTrigger>
            <TabsTrigger
              value="oh-plus"
              className="flex items-center gap-2 py-3 px-4 rounded-md data-[state=active]:bg-secondary data-[state=active]:text-white transition-all"
            >
              <Star className="h-5 w-5" />
              <span className="font-medium">OH! Plus</span>
            </TabsTrigger>
            <TabsTrigger
              value="sellah"
              className="flex items-center gap-2 py-3 px-4 rounded-md data-[state=active]:bg-purple-500 data-[state=active]:text-white transition-all"
            >
              <Store className="h-5 w-5" />
              <span className="font-medium">Sellah</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ooh-shop" className="flex-1 overflow-auto p-6 pt-6">
          {viewModes["ooh-shop"] === "list" ? (
            <MembersListView
              members={platformStates["ooh-shop"].members as Member[]}
              loading={platformStates["ooh-shop"].loading}
            />
          ) : (
            <MembersTable
              members={platformStates["ooh-shop"].members as Member[]}
              loading={platformStates["ooh-shop"].loading}
            />
          )}
          <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100 sticky bottom-0">
            <PaginationControls
              pagination={platformStates["ooh-shop"].pagination}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              loading={platformStates["ooh-shop"].loading}
            />
          </div>
        </TabsContent>

        <TabsContent value="oh-plus" className="flex-1 overflow-auto p-6 pt-6">
          {viewModes["oh-plus"] === "list" ? (
            <OHPlusMembersListView
              members={platformStates["oh-plus"].members as OHPlusMember[]}
              loading={platformStates["oh-plus"].loading}
            />
          ) : (
            <OHPlusMembersTable
              members={platformStates["oh-plus"].members as OHPlusMember[]}
              loading={platformStates["oh-plus"].loading}
            />
          )}
          <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100 sticky bottom-0">
            <PaginationControls
              pagination={platformStates["oh-plus"].pagination}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              loading={platformStates["oh-plus"].loading}
            />
          </div>
        </TabsContent>

        <TabsContent value="sellah" className="flex-1 overflow-auto p-6 pt-6">
          {viewModes["sellah"] === "list" ? (
            <SellahMembersListView
              members={platformStates["sellah"].members as SellahMember[]}
              loading={platformStates["sellah"].loading}
            />
          ) : (
            <SellahMembersTable
              members={platformStates["sellah"].members as SellahMember[]}
              loading={platformStates["sellah"].loading}
            />
          )}
          <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100 sticky bottom-0">
            <PaginationControls
              pagination={platformStates["sellah"].pagination}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              loading={platformStates["sellah"].loading}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
