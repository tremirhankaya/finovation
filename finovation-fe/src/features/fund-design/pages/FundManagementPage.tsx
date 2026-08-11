import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"

import {
  archiveFundDraft,
  listArchivedFundDrafts,
  searchFundDrafts,
  cloneDeletedFundDraft,
  updateFundDraftPinStatus,
  type FundDraftSortField,
  type FundDraftSummary,
  type SortDirection,
} from "@/features/fund-design/api/fundDraftApi"
import ArchiveFundDialog, {
  type ArchiveTarget,
} from "@/features/fund-design/components/ArchiveFundDialog"
import CloneDraftModal from "@/features/fund-design/components/CloneDraftModal"
import FundCompositionPanel from "@/features/fund-design/components/FundCompositionPanel"
import FundDesignModeDialog from "@/features/fund-design/components/FundDesignModeDialog"
import FundDesignModeOptions, {
  type FundDesignMode,
} from "@/features/fund-design/components/FundDesignModeOptions"
import {
  MANAGEMENT_APPROACHES,
  type ManagementApproachCode,
} from "@/features/fund-design/model/managementApproach"
import type { ArchivedFundDraft } from "@/features/fund-design/model/fundDraftSchemas"
import Button from "@/shared/ui/Button"
import FormAlert from "@/shared/ui/FormAlert"
import styles from "@/features/fund-design/styles/FundManagementPage.module.css"

const TOTAL_WIZARD_STEPS = 6
const PAGE_SIZE = 10
const MIN_SKELETON_ROWS = 3

type SortState = {
  field: FundDraftSortField
  direction: SortDirection
}

const DEFAULT_SORT: SortState = { field: "CREATED_AT", direction: "DESC" }
const DRAFT_SORT: SortState = { field: "UPDATED_AT", direction: "DESC" }

type Tab = "FUNDS" | "DRAFTS" | "ARCHIVE"

const TAB_LABELS: Record<Tab, string> = {
  FUNDS: "Fonlar",
  DRAFTS: "Taslaklar",
  ARCHIVE: "Kaldırılanlar",
}

const EMPTY_MESSAGES: Record<Tab, string> = {
  FUNDS: "Henüz tamamlanmış bir fonunuz yok",
  DRAFTS: "Yarım kalan bir tasarımınız yok",
  ARCHIVE: "Listenizden kaldırdığınız bir kayıt yok",
}

const EMPTY_HINTS: Record<Tab, string> = {
  FUNDS: "Tasarımı tamamladığınız fonlar burada listelenir.",
  DRAFTS:
    "Yarıda bıraktığınız tasarımlar burada bekler, kaldığınız yerden devam edersiniz.",
  ARCHIVE: "Listenizden kaldırdığınız fon ve taslaklar burada saklanır.",
}

const PIN_PULSE_MS = 620

function useJustPinned(isPinned: boolean): boolean {
  const [justPinned, setJustPinned] = useState(false)
  const previousPinnedRef = useRef(isPinned)

  useEffect(() => {
    if (previousPinnedRef.current === isPinned) return
    previousPinnedRef.current = isPinned
    if (!isPinned) return

    setJustPinned(true)
    const timer = window.setTimeout(() => setJustPinned(false), PIN_PULSE_MS)
    return () => window.clearTimeout(timer)
  }, [isPinned])

  return justPinned
}

function approachLabel(code: string | null | undefined): string {
  if (!code) return "—"
  return MANAGEMENT_APPROACHES.find((item) => item.code === code)?.label ?? code
}

function initialsOf(name: string | null): string {
  if (!name) return "—"
  return name
    .replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9\s]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`
}

export default function FundManagementPage() {
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>("FUNDS")
  const [query, setQuery] = useState("")
  const [approach, setApproach] = useState<ManagementApproachCode | "">("")
  const [designMode, setDesignMode] = useState<"AI_ASSISTED" | "MANUAL" | "">(
    "",
  )
  const [pageIndex, setPageIndex] = useState(0)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)

  const [funds, setFunds] = useState<FundDraftSummary[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [archived, setArchived] = useState<ArchivedFundDraft[]>([])
  const [draftCount, setDraftCount] = useState(0)

  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null)
  const hasInitializedExpansion = useRef(false)
  const [pinnedIds, setPinnedIds] = useState<string[]>([])

  const [isModeDialogOpen, setIsModeDialogOpen] = useState(false)
  const [emptyStateMode, setEmptyStateMode] =
    useState<FundDesignMode>("AI_ASSISTED")
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [cloneTarget, setCloneTarget] = useState<ArchivedFundDraft | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)

    void (async () => {
      try {
        if (tab === "ARCHIVE") {
          setArchived(await listArchivedFundDrafts(controller.signal))
        } else {
          const result = await searchFundDrafts(
            {
              page: pageIndex,
              size: PAGE_SIZE,
              q: query,
              status: tab === "FUNDS" ? "COMPLETED" : "IN_PROGRESS",
              managementApproach: approach || undefined,
              designMode: designMode || undefined,
              sortBy: sort.field,
              direction: sort.direction,
            },
            controller.signal,
          )
          setFunds(result.content)
          setTotalPages(result.totalPages)
          setTotalElements(result.totalElements)

          // Auto-expand the first pinned draft on load
          if (!hasInitializedExpansion.current) {
            const firstPinned = result?.content?.find((f) => f.pinned)
            if (firstPinned) {
              setExpandedDraftId(firstPinned.draftId)
            }
            hasInitializedExpansion.current = true
          }

          if (tab === "FUNDS") {
            setPinnedIds(
              result.content
                .filter((item) => item.pinned)
                .map((item) => item.draftId),
            )
          }
        }
        if (controller.signal.aborted) return
        setError("")
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(
          loadError instanceof Error ? loadError.message : "Liste alınamadı.",
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [tab, pageIndex, query, approach, designMode, sort, reloadKey])

  const [fundsCount, setFundsCount] = useState(0)
  const [archiveCount, setArchiveCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      try {
        const [drafts, funds, archivedData] = await Promise.all([
          searchFundDrafts({ status: "IN_PROGRESS", size: PAGE_SIZE }, controller.signal).catch(() => null),
          searchFundDrafts({ status: "COMPLETED", size: 1 }, controller.signal).catch(() => null),
          listArchivedFundDrafts(controller.signal).catch(() => null),
        ])
        if (controller.signal.aborted) return
        
        if (drafts) {
            setDraftCount(drafts.totalElements)
        }
        if (funds) {
          setFundsCount(funds.totalElements)
        }
        if (archivedData) {
          setArchiveCount(archivedData.length)
        }
      } catch {
        if (controller.signal.aborted) return
      }
    })()

    return () => controller.abort()
  }, [reloadKey])

  function changeTab(nextTab: Tab) {
    setTab(nextTab)
    setPageIndex(0)
    setExpandedDraftId(null)
    hasInitializedExpansion.current = false
    setSort(nextTab === "DRAFTS" ? DRAFT_SORT : DEFAULT_SORT)
  }

  function toggleSort(field: FundDraftSortField) {
    setPageIndex(0)
    setSort((current) => {
      if (current.field !== field) {
        return { field, direction: "ASC" }
      }
      return {
        field,
        direction: current.direction === "ASC" ? "DESC" : "ASC",
      }
    })
  }

  function startFundDesign() {
    setIsModeDialogOpen(true)
  }

  function startFundDesignWith(mode: FundDesignMode) {
    setIsModeDialogOpen(false)
    void navigate(`/fund-design/new?mode=${mode}`)
  }

  async function confirmArchive() {
    if (!archiveTarget) return
    setIsArchiving(true)
    try {
      await archiveFundDraft(archiveTarget.draftId)
      setArchiveTarget(null)
      reload()
    } catch (archiveError) {
      setError(
        archiveError instanceof Error ? archiveError.message : "Kaldırılamadı.",
      )
    } finally {
      setIsArchiving(false)
    }
  }

  const displayedArchived = archived.filter(
    (a) =>
      !query || (a.name && a.name.toLowerCase().includes(query.toLowerCase())),
  )
  const rowCount = tab === "ARCHIVE" ? displayedArchived.length : funds.length
  const columns = columnsFor(tab)
  const hasActionsColumn = tab !== "ARCHIVE"

  const sortedFunds =
    tab === "FUNDS"
      ? [...funds].sort((left, right) => {
          const leftPinned = pinnedIds.includes(left.draftId)
          const rightPinned = pinnedIds.includes(right.draftId)
          if (leftPinned === rightPinned) return 0
          return leftPinned ? -1 : 1
        })
      : funds

  const skeletonRowCount = Math.max(rowCount, MIN_SKELETON_ROWS)

  const tabCounts: Record<Tab, number> = {
    FUNDS: tab === "FUNDS" ? totalElements : fundsCount,
    DRAFTS: tab === "DRAFTS" ? totalElements : draftCount,
    ARCHIVE: tab === "ARCHIVE" ? displayedArchived.length : archiveCount,
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>Fon Yönetimi</h1>
          <p>PORTFÖY TASARIM MERKEZİ</p>
        </div>

        <div>
          <Button className={styles.primaryCta} onClick={startFundDesign}>
            Yeni Fon Tasarla
          </Button>
        </div>
      </header>

      {error && <FormAlert>{error}</FormAlert>}

      <section className={styles.card}>
        <div className={styles.toolbar}>
          {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={[styles.tab, tab === key ? styles.tabActive : ""].join(
                " ",
              )}
              onClick={() => changeTab(key)}
            >
              {TAB_LABELS[key]}
              <span className={styles.tabCount}>{tabCounts[key]}</span>
            </button>
          ))}

          <div className={styles.filters}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Fon adı ara…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPageIndex(0)
              }}
            />
            {tab !== "ARCHIVE" && (
              <>
                <label className={styles.filterField}>
                  <span>Profil</span>
                  <select
                    value={approach}
                    onChange={(event) => {
                      setApproach(
                        event.target.value as ManagementApproachCode | "",
                      )
                      setPageIndex(0)
                    }}
                  >
                    <option value="">Tümü</option>
                    {MANAGEMENT_APPROACHES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.filterField}>
                  <span>Üretim Tipi</span>
                  <select
                    value={designMode}
                    onChange={(event) => {
                      setDesignMode(
                        event.target.value as "AI_ASSISTED" | "MANUAL" | "",
                      )
                      setPageIndex(0)
                    }}
                  >
                    <option value="">Tümü</option>
                    <option value="AI_ASSISTED">AI Destekli</option>
                    <option value="MANUAL">Manuel</option>
                  </select>
                </label>
              </>
            )}
          </div>
        </div>

        <div className={styles.tableWrapper}>
          {!isLoading && rowCount === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9v9z" />
                  <path d="M12 3a9 9 0 0 1 9 9h-9z" />
                </svg>
              </span>
              <p className={styles.emptyTitle}>{EMPTY_MESSAGES[tab]}</p>
              <p className={styles.emptyHint}>{EMPTY_HINTS[tab]}</p>
              {tab === "FUNDS" && (
                <div className={styles.emptyModes}>
                  <FundDesignModeOptions
                    selectedMode={emptyStateMode}
                    onSelect={setEmptyStateMode}
                  />
                  <button
                    type="button"
                    className={styles.emptyAction}
                    onClick={() => startFundDesignWith(emptyStateMode)}
                  >
                    Devam Et
                  </button>
                </div>
              )}
              {tab === "DRAFTS" && (
                <button
                  type="button"
                  className={styles.emptyAction}
                  onClick={startFundDesign}
                >
                  Yeni fon tasarlamaya başla
                </button>
              )}
            </div>
          ) : (
            <div
              className={styles.tableWrap}
              key={`${tab}-${pageIndex}-${isLoading ? "loading" : "ready"}`}
            >
              <table className={styles.table}>
                <thead>
                  <tr>
                    {columns.map((column) => {
                      const isSorted = column.sortBy === sort.field
                      return (
                        <th
                          key={column.label}
                          className={
                            column.align === "right"
                              ? styles.alignRight
                              : undefined
                          }
                          aria-sort={
                            isSorted
                              ? sort.direction === "ASC"
                                ? "ascending"
                                : "descending"
                              : undefined
                          }
                        >
                          {column.sortBy ? (
                            <button
                              type="button"
                              className={[
                                styles.sortButton,
                                isSorted ? styles.sortButtonActive : "",
                              ].join(" ")}
                              onClick={() => toggleSort(column.sortBy!)}
                            >
                              {column.label}
                              <SortIcon
                                direction={isSorted ? sort.direction : null}
                              />
                            </button>
                          ) : (
                            column.label
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows
                      rowCount={skeletonRowCount}
                      columnCount={columns.length}
                      hasActionsColumn={hasActionsColumn}
                    />
                  ) : tab === "ARCHIVE" ? (
                    displayedArchived.map((item) => (
                      <ArchivedRow
                        key={item.draftId}
                        item={item}
                        onClone={() => setCloneTarget(item)}
                      />
                    ))
                  ) : (
                    sortedFunds.map((item) => {
                      const isPinned = pinnedIds.includes(item.draftId)
                      return (
                        <FundRow
                          key={item.draftId}
                          item={item}
                          isDraft={tab === "DRAFTS"}
                          isExpanded={expandedDraftId === item.draftId}
                          isPinned={isPinned}
                          onTogglePin={async () => {
                            const newPinned = !isPinned
                            setPinnedIds((prev) =>
                              newPinned
                                ? [...prev, item.draftId]
                                : prev.filter((id) => id !== item.draftId),
                            )
                            try {
                              await updateFundDraftPinStatus(
                                item.draftId,
                                newPinned,
                              )
                            } catch {
                              setPinnedIds((prev) =>
                                !newPinned
                                  ? [...prev, item.draftId]
                                  : prev.filter((id) => id !== item.draftId),
                              )
                            }
                          }}
                          onToggle={() =>
                            setExpandedDraftId(
                              expandedDraftId === item.draftId
                                ? null
                                : item.draftId,
                            )
                          }
                          onOpen={() =>
                            void navigate(
                              wizardPathFor(
                                item.draftId,
                                item.currentStep ?? 2,
                              ),
                            )
                          }
                          onArchive={() =>
                            setArchiveTarget({
                              draftId: item.draftId,
                              name: item.name,
                              isDraft: tab === "DRAFTS",
                            })
                          }
                          onNavigate={(path) => void navigate(path)}
                        />
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {tab !== "ARCHIVE" && !isLoading && totalElements > 0 && (
            <>
              <span className={styles.range}>
                Sayfa {pageIndex + 1} / {Math.max(totalPages, 1)} ·{" "}
                {totalElements} kayıt
              </span>
              <div className={styles.pager}>
                <button
                  type="button"
                  className={styles.pagerButton}
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((current) => current - 1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={styles.pagerButton}
                  disabled={pageIndex + 1 >= totalPages}
                  onClick={() => setPageIndex((current) => current + 1)}
                >
                  ›
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <FundDesignModeDialog
        open={isModeDialogOpen}
        onConfirm={startFundDesignWith}
        onClose={() => setIsModeDialogOpen(false)}
      />

      <ArchiveFundDialog
        target={archiveTarget}
        isBusy={isArchiving}
        onConfirm={() => void confirmArchive()}
        onClose={() => setArchiveTarget(null)}
      />

      <CloneDraftModal
        isOpen={cloneTarget !== null}
        onClose={() => setCloneTarget(null)}
        initialName=""
        initialSize={cloneTarget?.initialPortfolioSize ?? undefined}
        initialPrice={cloneTarget?.unitPrice ?? undefined}
        onSubmit={async (payload) => {
          if (!cloneTarget) return
          const newDraft = await cloneDeletedFundDraft(
            cloneTarget.draftId,
            payload,
          )
          setCloneTarget(null)
          void navigate(
            wizardPathFor(newDraft.draftId, newDraft.currentStep ?? 2),
          )
        }}
      />
    </div>
  )
}

type Column = {
  label: string
  align?: "right"
  sortBy?: FundDraftSortField
}

function columnsFor(tab: Tab): Column[] {
  if (tab === "ARCHIVE") {
    return [
      { label: "Ad" },
      { label: "Tür" },
      { label: "Kaldırılma Tarihi", align: "right" },
      { label: "Silen Kullanıcı", align: "right" },
      { label: "İşlemler", align: "right" },
    ]
  }
  if (tab === "DRAFTS") {
    return [
      { label: "Taslak Adı", sortBy: "NAME" },
      { label: "Tasarım Modu" },
      { label: "Profil" },
      { label: "Kaldığı Adım" },
      { label: "Son Güncelleme", align: "right", sortBy: "UPDATED_AT" },
      { label: "İşlemler", align: "right" },
    ]
  }
  return [
    { label: "Fon Adı", sortBy: "NAME" },
    { label: "Tasarım Modu" },
    { label: "Profil" },
    {
      label: "Başlangıç Büyüklüğü",
      align: "right",
      sortBy: "INITIAL_PORTFOLIO_SIZE",
    },
    { label: "Oluşturulma", align: "right", sortBy: "CREATED_AT" },
    { label: "İşlemler", align: "right" },
  ]
}

function wizardPathFor(draftId: string, step: number): string {
  const paths: Record<number, string> = {
    2: `/fund-design/${draftId}/strategy`,
    3: `/fund-design/${draftId}/analysis`,
    4: `/fund-design/${draftId}/alternatives`,
    5: `/fund-design/${draftId}/edit`,
    6: `/fund-design/${draftId}/approve`,
  }
  return paths[step] ?? paths[2]
}

type SortIconProps = {
  direction: SortDirection | null
}

function SortIcon({ direction }: SortIconProps) {
  return (
    <svg
      className={[
        styles.sortIcon,
        direction === "ASC" ? styles.sortIconAsc : "",
      ].join(" ")}
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

type SkeletonRowsProps = {
  rowCount: number
  columnCount: number
  hasActionsColumn: boolean
}

function SkeletonRows({
  rowCount,
  columnCount,
  hasActionsColumn,
}: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <tr key={rowIndex} aria-hidden="true">
          {Array.from({ length: columnCount }, (_, columnIndex) => {
            const isFirst = columnIndex === 0
            const isActions =
              hasActionsColumn && columnIndex === columnCount - 1

            if (isFirst) {
              return (
                <td key={columnIndex}>
                  <span className={styles.nameCell}>
                    <span className={styles.chevronSpacer} />
                    <span
                      className={[styles.shimmer, styles.shimmerAvatar].join(
                        " ",
                      )}
                    />
                    <span
                      className={[styles.shimmer, styles.shimmerName].join(" ")}
                    />
                  </span>
                </td>
              )
            }

            if (isActions) {
              return (
                <td key={columnIndex}>
                  <div className={styles.rowActions}>
                    <span
                      className={[styles.shimmer, styles.shimmerButton].join(
                        " ",
                      )}
                    />
                    <span
                      className={[styles.shimmer, styles.shimmerButton].join(
                        " ",
                      )}
                    />
                  </div>
                </td>
              )
            }

            return (
              <td key={columnIndex}>
                <span
                  className={[styles.shimmer, styles.shimmerCell].join(" ")}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

type ArchivedRowProps = {
  item: ArchivedFundDraft
  onClone: () => void
}

function ArchivedRow({ item, onClone }: ArchivedRowProps) {
  return (
    <tr>
      <td>
        <span className={styles.nameCell}>
          <span className={styles.initials}>{initialsOf(item.name)}</span>
          <span className={styles.nameText}>{item.name ?? "İsimsiz"}</span>
        </span>
      </td>
      <td>
        <span className={[styles.badge, styles.badgeKind].join(" ")}>
          {item.status === "COMPLETED" ? "Fon" : "Taslak"}
        </span>
      </td>
      <td className={[styles.muted, styles.alignRight].join(" ")}>
        {formatDate(item.archivedAt)}
      </td>
      <td className={[styles.muted, styles.alignRight].join(" ")}>
        {item.deletedBy ?? "—"}
      </td>
      <td className={styles.alignRight}>
        <button
          type="button"
          className={[styles.rowButton, styles.rowButtonClone].join(" ")}
          onClick={onClone}
        >
          <span className={styles.cloneButtonContent}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Taslağı Kullanarak Yeni Fon Oluştur
          </span>
        </button>
      </td>
    </tr>
  )
}

type FundRowProps = {
  item: FundDraftSummary
  isDraft: boolean
  isExpanded: boolean
  isPinned: boolean
  onTogglePin: () => void
  onToggle: () => void
  onOpen: () => void
  onArchive: () => void
  onNavigate: (path: string) => void
}

function FundRow({
  item,
  isDraft,
  isExpanded,
  isPinned,
  onTogglePin,
  onToggle,
  onOpen,
  onArchive,
  onNavigate,
}: FundRowProps) {
  const justPinned = useJustPinned(isPinned)

  return (
    <>
      <tr
        className={[
          !isDraft ? styles.clickableRow : "",
          isExpanded ? styles.expandedRow : "",
          justPinned ? styles.rowJustPinned : "",
        ].join(" ")}
        onClick={!isDraft ? onToggle : undefined}
      >
        <td>
          <span className={styles.nameCell}>
            {isDraft ? (
              <span className={styles.chevronSpacer} />
            ) : (
              <button
                type="button"
                className={[
                  styles.chevron,
                  isExpanded ? styles.chevronOpen : "",
                ].join(" ")}
                onClick={(event) => {
                  event.stopPropagation()
                  onToggle()
                }}
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded ? "Portföy detayını kapat" : "Portföy detayını aç"
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}

            {!isDraft && (
              <button
                type="button"
                className={[
                  styles.pinButton,
                  isPinned ? styles.pinButtonActive : "",
                  justPinned ? styles.pinButtonPulse : "",
                ].join(" ")}
                onClick={(event) => {
                  event.stopPropagation()
                  onTogglePin()
                }}
                aria-pressed={isPinned}
                title={isPinned ? "Sabitlemeyi kaldır" : "Üste sabitle"}
                aria-label={isPinned ? "Sabitlemeyi kaldır" : "Üste sabitle"}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={isPinned ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9.5 3h5a1 1 0 0 1 .9 1.45L14.5 6.5v3.2l3.1 2.4a1.5 1.5 0 0 1 .55 1.15V14a1 1 0 0 1-1 1h-4.4v6l-.75.75L11.25 21v-6H6.85a1 1 0 0 1-1-1v-.75c0-.45.2-.87.55-1.15l3.1-2.4V6.5L8.6 4.45A1 1 0 0 1 9.5 3z" />
                </svg>
              </button>
            )}

            <span className={styles.initials}>{initialsOf(item.name)}</span>
            <span className={styles.nameText}>
              {item.name ?? (isDraft ? "İsimsiz taslak" : "İsimsiz fon")}
            </span>
          </span>
        </td>
        <td>
          <div className={styles.designModeCell}>
            {item.designMode === "AI_ASSISTED" && (
              <span
                className={[
                  styles.badge,
                  styles.badgeAi,
                ].join(" ")}
              >
                AI Destekli
              </span>
            )}
            {item.designMode === "MANUAL" && (
              <span
                className={[
                  styles.badge,
                  styles.badgeManual,
                ].join(" ")}
              >
                Kullanıcı Tasarımı
              </span>
            )}
          </div>
        </td>
        <td>
          <div className={styles.profileCell}>
            {item.managementApproach ? (
              <span className={[styles.badge, styles.badgeApproach].join(" ")}>
                {approachLabel(item.managementApproach)}
              </span>
            ) : (
              <span className={styles.muted}>—</span>
            )}
          </div>
        </td>
        {isDraft ? (
          <td>
            <span className={[styles.badge, styles.badgeStep].join(" ")}>
              Adım {item.currentStep ?? 1} / {TOTAL_WIZARD_STEPS}
            </span>
          </td>
        ) : (
          <td className={[styles.amount, styles.alignRight].join(" ")}>
            {formatMoney(item.initialPortfolioSize)}
          </td>
        )}
        <td className={[styles.muted, styles.alignRight].join(" ")}>
          {formatDate(isDraft ? item.updatedAt : item.createdAt)}
        </td>
        <td>
          <div className={styles.rowActions}>
            <button
              type="button"
              className={[
                styles.rowButton,
                styles.rowButtonDanger,
                styles.rowButtonSecondary,
              ].join(" ")}
              onClick={(e) => {
                e.stopPropagation()
                onArchive()
              }}
            >
              Kaldır
            </button>
            {isDraft && (
              <button
                type="button"
                className={[styles.rowButton, styles.rowButtonPrimary].join(
                  " ",
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  onOpen()
                }}
              >
                Devam Et
              </button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td className={styles.compositionCell} colSpan={5}>
            <div className={styles.compositionReveal}>
              <div>
                <FundCompositionPanel
                  draftId={item.draftId}
                  fundName={item.name ?? "İsimsiz fon"}
                  initialPortfolioSize={item.initialPortfolioSize ?? null}
                  onNavigate={onNavigate}
                  designMode={item.designMode}
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
