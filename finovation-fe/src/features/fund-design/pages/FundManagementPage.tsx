import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router"

import {
  archiveFundDraft,
  listArchivedFundDrafts,
  searchFundDrafts,
  type FundDraftSummary,
} from "@/features/fund-design/api/fundDraftApi"
import ArchiveFundDialog, {
  type ArchiveTarget,
} from "@/features/fund-design/components/ArchiveFundDialog"
import FundCompositionPanel from "@/features/fund-design/components/FundCompositionPanel"
import ResumeDraftsDialog from "@/features/fund-design/components/ResumeDraftsDialog"
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

type Tab = "FUNDS" | "DRAFTS" | "ARCHIVE"

const TAB_LABELS: Record<Tab, string> = {
  FUNDS: "Fonlar",
  DRAFTS: "Taslaklar",
  ARCHIVE: "Kaldırılanlar",
}

const EMPTY_MESSAGES: Record<Tab, string> = {
  FUNDS: "Henüz tamamlanmış bir fonunuz yok.",
  DRAFTS: "Yarım kalan bir tasarımınız yok.",
  ARCHIVE: "Listenizden kaldırdığınız bir kayıt yok.",
}

function approachLabel(code: string | null | undefined): string {
  if (!code) return "—"
  return MANAGEMENT_APPROACHES.find((item) => item.code === code)?.label ?? code
}

function initialsOf(name: string | null): string {
  if (!name) return "—"
  return name
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
  const [pageIndex, setPageIndex] = useState(0)

  const [funds, setFunds] = useState<FundDraftSummary[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [archived, setArchived] = useState<ArchivedFundDraft[]>([])
  const [draftCount, setDraftCount] = useState(0)

  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null)
  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [resumableDrafts, setResumableDrafts] = useState<FundDraftSummary[]>([])

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
            },
            controller.signal,
          )
          setFunds(result.content)
          setTotalPages(result.totalPages)
          setTotalElements(result.totalElements)
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
  }, [tab, pageIndex, query, approach, reloadKey])

  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      try {
        const drafts = await searchFundDrafts(
          { status: "IN_PROGRESS", size: PAGE_SIZE },
          controller.signal,
        )
        if (controller.signal.aborted) return
        setResumableDrafts(drafts.content)
        setDraftCount(drafts.totalElements)
      } catch {
        if (!controller.signal.aborted) setResumableDrafts([])
      }
    })()

    return () => controller.abort()
  }, [reloadKey])

  function changeTab(nextTab: Tab) {
    setTab(nextTab)
    setPageIndex(0)
    setExpandedDraftId(null)
  }

  function startFundDesign() {
    if (resumableDrafts.length > 0) {
      setIsResumeDialogOpen(true)
      return
    }
    void navigate("/fund-design/new")
  }

  function resumeDraft(draftId: string) {
    const draft = resumableDrafts.find((item) => item.draftId === draftId)
    void navigate(wizardPathFor(draftId, draft?.currentStep ?? 2))
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
        archiveError instanceof Error
          ? archiveError.message
          : "Kaldırılamadı.",
      )
    } finally {
      setIsArchiving(false)
    }
  }

  const rowCount = tab === "ARCHIVE" ? archived.length : funds.length
  const headers = headersFor(tab)

  const tabCounts: Record<Tab, number> = {
    FUNDS: tab === "FUNDS" ? totalElements : 0,
    DRAFTS: draftCount,
    ARCHIVE: archived.length,
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Fon Yönetimi</h1>
        <p className={styles.subtitle}>Fonlarınızı tasarlayın, yönetin.</p>
      </header>

      <section className={styles.callToAction}>
        <div className={styles.callToActionText}>
          <span className={styles.callToActionIcon} aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5 10.1 10.9 5.5 9l4.6-1.4L12 3z" />
              <path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
            </svg>
          </span>
          <div>
            <p className={styles.callToActionTitle}>Yeni bir fon tasarlayın</p>
            <p className={styles.callToActionHint}>
              Yapay zeka izahnameye uygun portföy önerileri üretsin, siz karar
              verin.
            </p>
          </div>
        </div>
        <Button onClick={startFundDesign}>Yeni Fon Tasarla</Button>
      </section>

      {error && <FormAlert>{error}</FormAlert>}

      <section className={styles.card}>
        <div className={styles.toolbar}>
          {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={[
                styles.tab,
                tab === key ? styles.tabActive : "",
              ].join(" ")}
              onClick={() => changeTab(key)}
            >
              {TAB_LABELS[key]}
              <span className={styles.tabCount}>{tabCounts[key]}</span>
            </button>
          ))}

          {tab !== "ARCHIVE" && (
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
              <select
                className={styles.approachSelect}
                value={approach}
                onChange={(event) => {
                  setApproach(event.target.value as ManagementApproachCode | "")
                  setPageIndex(0)
                }}
              >
                <option value="">Profil: Tümü</option>
                {MANAGEMENT_APPROACHES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isLoading && <p className={styles.emptyState}>Yükleniyor…</p>}

        {!isLoading && rowCount === 0 && (
          <p className={styles.emptyState}>{EMPTY_MESSAGES[tab]}</p>
        )}

        {!isLoading && rowCount > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {headers.map((header, index) => (
                    <th
                      key={header}
                      className={
                        index === headers.length - 1
                          ? styles.alignRight
                          : undefined
                      }
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tab === "ARCHIVE"
                  ? archived.map((item) => (
                      <ArchivedRow key={item.draftId} item={item} />
                    ))
                  : funds.map((item) => (
                      <FundRow
                        key={item.draftId}
                        item={item}
                        isDraft={tab === "DRAFTS"}
                        isExpanded={expandedDraftId === item.draftId}
                        onToggle={() =>
                          setExpandedDraftId(
                            expandedDraftId === item.draftId
                              ? null
                              : item.draftId,
                          )
                        }
                        onOpen={() =>
                          void navigate(
                            tab === "DRAFTS"
                              ? wizardPathFor(item.draftId, item.currentStep ?? 2)
                              : `/fund-design/${item.draftId}/completed`,
                          )
                        }
                        onArchive={() =>
                          setArchiveTarget({
                            draftId: item.draftId,
                            name: item.name,
                            isDraft: tab === "DRAFTS",
                          })
                        }
                      />
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {tab !== "ARCHIVE" && totalPages > 1 && (
          <div className={styles.footer}>
            <span className={styles.range}>
              Sayfa {pageIndex + 1} / {totalPages} · {totalElements} kayıt
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
          </div>
        )}
      </section>

      <ResumeDraftsDialog
        open={isResumeDialogOpen}
        drafts={resumableDrafts}
        totalSteps={TOTAL_WIZARD_STEPS}
        onResume={(draftId) => {
          setIsResumeDialogOpen(false)
          resumeDraft(draftId)
        }}
        onStartNew={() => {
          setIsResumeDialogOpen(false)
          void navigate("/fund-design/new")
        }}
        onClose={() => setIsResumeDialogOpen(false)}
      />

      <ArchiveFundDialog
        target={archiveTarget}
        isBusy={isArchiving}
        onConfirm={() => void confirmArchive()}
        onClose={() => setArchiveTarget(null)}
      />
    </div>
  )
}

function headersFor(tab: Tab): string[] {
  if (tab === "ARCHIVE") return ["Ad", "Tür", "Kaldırılma Tarihi"]
  if (tab === "DRAFTS") {
    return ["Taslak Adı", "Profil", "Kaldığı Adım", "Son Güncelleme", "İşlemler"]
  }
  return ["Fon Adı", "Profil", "Başlangıç Büyüklüğü", "Oluşturulma", "İşlemler"]
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

type ArchivedRowProps = {
  item: ArchivedFundDraft
}

function ArchivedRow({ item }: ArchivedRowProps) {
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
      <td className={styles.muted}>{formatDate(item.archivedAt)}</td>
    </tr>
  )
}

type FundRowProps = {
  item: FundDraftSummary
  isDraft: boolean
  isExpanded: boolean
  onToggle: () => void
  onOpen: () => void
  onArchive: () => void
}

function FundRow({
  item,
  isDraft,
  isExpanded,
  onToggle,
  onOpen,
  onArchive,
}: FundRowProps) {
  return (
    <>
      <tr>
        <td>
          <span className={styles.nameCell}>
            <span className={styles.initials}>{initialsOf(item.name)}</span>
            {isDraft ? (
              <span className={styles.nameText}>
                {item.name ?? "İsimsiz taslak"}
              </span>
            ) : (
              <button
                type="button"
                className={styles.nameButton}
                onClick={onToggle}
              >
                {item.name ?? "İsimsiz fon"}
              </button>
            )}
          </span>
        </td>
        <td>
          {item.managementApproach ? (
            <span className={[styles.badge, styles.badgeApproach].join(" ")}>
              {approachLabel(item.managementApproach)}
            </span>
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </td>
        {isDraft ? (
          <td>
            <span className={[styles.badge, styles.badgeStep].join(" ")}>
              Adım {item.currentStep ?? 1} / {TOTAL_WIZARD_STEPS}
            </span>
          </td>
        ) : (
          <td className={styles.amount}>
            {formatMoney(item.initialPortfolioSize)}
          </td>
        )}
        <td className={styles.muted}>
          {formatDate(isDraft ? item.updatedAt : item.createdAt)}
        </td>
        <td>
          <div className={styles.rowActions}>
            <button
              type="button"
              className={[
                styles.rowButton,
                isDraft ? styles.rowButtonPrimary : "",
              ].join(" ")}
              onClick={onOpen}
            >
              {isDraft ? "Devam Et" : "Görüntüle"}
            </button>
            <button
              type="button"
              className={[styles.rowButton, styles.rowButtonDanger].join(" ")}
              onClick={onArchive}
            >
              Kaldır
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td className={styles.compositionCell} colSpan={5}>
            <FundCompositionPanel draftId={item.draftId} />
          </td>
        </tr>
      )}
    </>
  )
}
