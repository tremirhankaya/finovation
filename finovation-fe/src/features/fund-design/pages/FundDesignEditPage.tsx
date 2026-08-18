import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate, useParams } from "react-router"

import {
  getFundDraftAnalysisState,
  getWorkingPortfolio,
  selectFundDraftProposal,
  updateWorkingPortfolio,
  type FundPositionResponse,
  type FundModelProposal,
} from "@/features/fund-design/api/fundDraftApi"
import FundDesignLayout from "@/features/fund-design/components/FundDesignLayout"
import FundDesignProgressRail from "@/features/fund-design/components/FundDesignProgressRail"
import ProspectusRulesPanel, {
  type LivePortfolioCompliance,
} from "@/features/fund-design/components/ProspectusRulesPanel"
import { useFundDraftInit } from "@/features/fund-design/hooks/useFundDraftInit"
import { FundLoader } from "@/shared/ui/FundLoader"
import Button from "@/shared/ui/Button"
import FormAlert from "@/shared/ui/FormAlert"
import styles from "@/features/fund-design/styles/FundDesignEditPage.module.css"

type EditablePosition = {
  assetCode: string
  sectorName: string | null
  assetType: "EQUITY" | "TPP"
  weightPct: number
  aiNote?: string | null
}

const WEIGHT_STEP_PCT = 0.01
// Ağırlık alanları iki ondalık basamakla gösterilir ve düzenlenir. Motorun
// yüksek hassasiyetli dağılımından kalan 0,004 gibi farklar ekranda %100
// görünür; bunlar kural ihlali değildir. %99,99 / %100,01 ise ihlaldir.
const TOTAL_WEIGHT_DISPLAY_TOLERANCE_PCT = 0.005

function assetLabelForCode(
  universe: { assetCode: string; displayName: string }[] | undefined,
  code: string,
) {
  const hit = universe?.find((asset) => asset.assetCode === code)
  if (!hit?.displayName || hit.displayName === code) return code
  return `${code} · ${hit.displayName}`
}

function toEditablePositions(
  assets: FundPositionResponse[],
): EditablePosition[] {
  const mapped = assets.map((a) => ({
    assetCode: a.asset_code,
    sectorName: a.sector_name ?? null,
    assetType: a.asset_type,
    // Hesaplarda motorun hassas değerini koruruz. Her satırı ayrı ayrı
    // yuvarlamak, çok hisseli portföylerde toplamın yapay olarak %99,9/%100,1
    // görünmesine neden olur.
    weightPct: a.weight,
    aiNote: a.ai_note,
  }))

  const nonTpp = mapped.filter((a) => a.assetType !== "TPP")
  const tpp = mapped.filter((a) => a.assetType === "TPP")
  return [...nonTpp, ...tpp]
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatPct(value: number): string {
  return value.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  })
}

function formatWeightInput(value: number): string {
  return value.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  })
}

function EditableWeightInput({
  value,
  onChange,
  className,
  hasError,
}: {
  value: number
  onChange: (newVal: number) => void
  className?: string
  hasError?: boolean
}) {
  const [localStr, setLocalStr] = useState<string | null>(null)

  const displayValue =
    localStr !== null ? localStr : value === 0 ? "" : formatWeightInput(value)

  return (
    <input
      type="text"
      inputMode="decimal"
      className={[className, hasError ? styles.inputError : ""]
        .filter(Boolean)
        .join(" ")}
      placeholder="0"
      value={displayValue}
      onFocus={(e) => {
        setLocalStr(value === 0 ? "" : formatWeightInput(value))
        e.target.select()
      }}
      onBlur={() => {
        setLocalStr(null)
      }}
      onChange={(e) => {
        const rawInput = e.target.value
        // Sadece rakamlar (0-9), nokta (.) ve virgüle (,) izin ver
        let filtered = rawInput.replace(/[^0-9.,]/g, "")

        // Birden fazla nokta/virgül girilmesini engelle
        const firstSepIndex = filtered.search(/[.,]/)
        if (firstSepIndex !== -1) {
          const firstPart = filtered.slice(0, firstSepIndex + 1)
          const rest = filtered.slice(firstSepIndex + 1).replace(/[.,]/g, "")
          filtered = firstPart + rest
        }

        setLocalStr(filtered)

        const normalized = filtered.replace(",", ".")
        if (normalized === "" || normalized === "." || normalized === ",") {
          onChange(0)
        } else {
          const parsed = parseFloat(normalized)
          if (!isNaN(parsed)) {
            onChange(parsed)
          }
        }
      }}
    />
  )
}

export default function FundDesignEditPage() {
  const navigate = useNavigate()
  const { draftId } = useParams<{ draftId: string }>()

  const [proposals, setProposals] = useState<FundModelProposal[]>([])
  const [positions, setPositions] = useState<EditablePosition[]>([])
  const [selectedProposalRank, setSelectedProposalRank] =
    useState<number | null>(null)
  const [formError, setFormError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [isAddingAsset, setIsAddingAsset] = useState(false)
  const [selectedAssetCodeToAdd, setSelectedAssetCodeToAdd] = useState("")
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false)
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)
  const [modalSearchText, setModalSearchText] = useState("")

  const [tableFilterText, setTableFilterText] = useState("")
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [tableSortKey, setTableSortKey] =
    useState<"NONE" | "WEIGHT_DESC" | "WEIGHT_ASC">("NONE")

  const [highlightedAssetCode, setHighlightedAssetCode] = useState("")
  const [isProposalDropdownOpen, setIsProposalDropdownOpen] = useState(false)
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)

  // Toplu hisse seçme & silme state'i
  const [selectedRowCodes, setSelectedRowCodes] = useState<string[]>([])

  // Silme onay modalı state'i
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    items: string[]
    onConfirm: () => void
  }>({
    isOpen: false,
    title: "",
    message: "",
    items: [],
    onConfirm: () => {},
  })

  const [modalSelectedSectors, setModalSelectedSectors] = useState<string[]>([])
  const [isModalSectorDropdownOpen, setIsModalSectorDropdownOpen] =
    useState(false)
  const [modalSelectedAssets, setModalSelectedAssets] =
    useState<Record<string, number>>({})
  const [showOnlySelectedModalAssets, setShowOnlySelectedModalAssets] =
    useState(false)

  const proposalRef = useRef<HTMLDivElement>(null)
  const sectorRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)

  const [debouncedFilterText, setDebouncedFilterText] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterText(tableFilterText)
    }, 180)
    return () => clearTimeout(timer)
  }, [tableFilterText])

  useEffect(() => {
    if (isAddStockModalOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isAddStockModalOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        proposalRef.current &&
        !proposalRef.current.contains(e.target as Node)
      ) {
        setIsProposalDropdownOpen(false)
      }
      if (sectorRef.current && !sectorRef.current.contains(e.target as Node)) {
        setIsSectorDropdownOpen(false)
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const availableSectors = useMemo(() => {
    const set = new Set<string>()
    positions.forEach((p) => {
      if (p.sectorName) set.add(p.sectorName)
    })
    return Array.from(set).sort()
  }, [positions])

  const filteredPositions = useMemo(() => {
    const allMapped = positions.map((pos, originalIndex) => ({
      pos,
      originalIndex,
    }))

    // TPP'yi her zaman ayırıyoruz
    const tppItem = allMapped.find(({ pos }) => pos.assetType === "TPP")
    const stocks = allMapped.filter(({ pos }) => pos.assetType !== "TPP")

    // Sadece hisseleri filtreliyoruz
    const filteredStocks = stocks.filter(({ pos }) => {
      if (debouncedFilterText) {
        const query = debouncedFilterText.toLocaleLowerCase("tr-TR").trim()
        const matchesCode = pos.assetCode
          .toLocaleLowerCase("tr-TR")
          .includes(query)
        const matchesSector =
          pos.sectorName?.toLocaleLowerCase("tr-TR").includes(query) ?? false
        if (!matchesCode && !matchesSector) return false
      }
      if (selectedSectors.length > 0) {
        if (!pos.sectorName || !selectedSectors.includes(pos.sectorName)) {
          return false
        }
      }
      return true
    })

    // Sadece hisseleri sıralıyoruz
    if (tableSortKey === "WEIGHT_DESC") {
      filteredStocks.sort((a, b) => b.pos.weightPct - a.pos.weightPct)
    } else if (tableSortKey === "WEIGHT_ASC") {
      filteredStocks.sort((a, b) => a.pos.weightPct - b.pos.weightPct)
    }

    // TPP'yi HER ZAMAN en sona sabitliyoruz!
    return tppItem ? [...filteredStocks, tppItem] : filteredStocks
  }, [positions, debouncedFilterText, selectedSectors, tableSortKey])

  const {
    init,
    error: initError,
    isLoading: isInitLoading,
    reload: reloadInit,
  } = useFundDraftInit({
    page: "EDIT",
    draftId,
  })
  const editInit = init?.page === "EDIT" ? init : null
  const editModelUniverse = editInit?.modelUniverse ?? []
  const editDraft = editInit?.draft ?? null
  const isManualDraft = editDraft?.designMode === "MANUAL"
  const isScreenLoading = isInitLoading || (editInit != null && isLoading)

  // Modalda görünen liste; seçim filtreden bağımsız tutulur ki kullanıcı
  // sektör/arama değiştirirken daha önce işaretlediklerini kaybetmesin.
  const modalAvailableAssets = useMemo(
    () =>
      editModelUniverse
        .filter(
          (asset) =>
            !positions.some((p) => p.assetCode === asset.assetCode),
        )
        .filter((asset) => {
          const query = modalSearchText.toLocaleLowerCase("tr-TR").trim()
          if (!query) return true
          return (
            asset.assetCode.toLocaleLowerCase("tr-TR").includes(query) ||
            asset.displayName?.toLocaleLowerCase("tr-TR").includes(query)
          )
        })
        .filter(
          (asset) =>
            modalSelectedSectors.length === 0 ||
            (!!asset.sectorName &&
              modalSelectedSectors.includes(asset.sectorName)),
        )
        .filter(
          (asset) =>
            !showOnlySelectedModalAssets ||
            asset.assetCode in modalSelectedAssets,
        )
        .sort((a, b) => {
          // Manuel tasarımda liste sabit kalır; seçim yapmak satırları yerinden
          // oynatmaz. Kullanıcı arama ve sektör filtreleriyle ilerler.
          if (isManualDraft) return a.assetCode.localeCompare(b.assetCode)
          const aSelected = a.assetCode in modalSelectedAssets ? 1 : 0
          const bSelected = b.assetCode in modalSelectedAssets ? 1 : 0
          if (aSelected !== bSelected) return bSelected - aSelected
          return a.assetCode.localeCompare(b.assetCode)
        }),
    [
      editModelUniverse,
      positions,
      modalSearchText,
      modalSelectedSectors,
      modalSelectedAssets,
      showOnlySelectedModalAssets,
      isManualDraft,
    ],
  )

  const areAllModalAssetsSelected =
    modalAvailableAssets.length > 0 &&
    modalAvailableAssets.every((asset) => asset.assetCode in modalSelectedAssets)

  useEffect(() => {
    if (!draftId || !editInit) return
    const controller = new AbortController()
    const workingPortfolio = editInit.workingPortfolio
    const isManualDraft = editInit.draft.designMode === "MANUAL"

    async function loadData() {
      try {
        if (isManualDraft || !workingPortfolio) {
          setProposals([])
          const initialPositions = workingPortfolio
            ? toEditablePositions(workingPortfolio.assets)
            : []
          setPositions(initialPositions)

          return
        }

        const analysisState = await getFundDraftAnalysisState(
          draftId!,
          controller.signal,
        )
        if (controller.signal.aborted) return

        setProposals(analysisState.proposals)
        const initialRank = analysisState.selectedRank ?? 1
        setSelectedProposalRank(initialRank)
        setPositions(toEditablePositions(workingPortfolio.assets))
      } catch (err) {
        if (controller.signal.aborted) return
        setFormError(
          err instanceof Error
            ? err.message
            : "Portföy verileri yüklenirken bir hata oluştu.",
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadData()
    return () => controller.abort()
  }, [draftId, editInit])

  async function handleProposalChange(rank: number) {
    if (!draftId) return
    setSelectedProposalRank(rank)
    setIsUpdating(true)
    setFormError("")
    try {
      await selectFundDraftProposal(draftId, rank)
      const working = await getWorkingPortfolio(draftId)
      const loadedPositions = toEditablePositions(working.assets)
      setPositions(loadedPositions)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Öneri değiştirilemedi")
    } finally {
      setIsUpdating(false)
    }
  }

  function handleWeightChange(index: number, newWeight: number) {
    const clamped = Math.max(
      0,
      Math.min(100, Math.round(newWeight * 100) / 100),
    )
    setPositions((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], weightPct: clamped }
      return next
    })
  }

  function adjustWeightByStep(currentWeight: number, direction: 1 | -1) {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round((currentWeight + direction * WEIGHT_STEP_PCT) * 100) / 100,
      ),
    )
  }

  function requestDeleteSingle(index: number) {
    const targetCode = positions[index]?.assetCode
    if (!targetCode) return
    setDeleteConfirmState({
      isOpen: true,
      title: "Hisseyi Çıkar",
      message: `${targetCode} hissesini portföyden çıkarmak istediğinize emin misiniz?`,
      items: [assetLabelForCode(editModelUniverse, targetCode)],
      onConfirm: () => {
        setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }))
        void handleDeletePosition(index)
      },
    })
  }

  function requestDeleteBulk() {
    const count = selectedRowCodes.length
    const items = selectedRowCodes.map((code) =>
      assetLabelForCode(editModelUniverse, code),
    )
    setDeleteConfirmState({
      isOpen: true,
      title: "Hisseleri Çıkar",
      message: `Seçilen ${count} hisseyi portföyden çıkarmak istediğinize emin misiniz?`,
      items,
      onConfirm: () => {
        setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }))
        void handleBulkDelete()
      },
    })
  }

  async function handleDeletePosition(index: number) {
    if (!draftId) return
    setIsUpdating(true)
    setFormError("")
    try {
      const nextPositions = positions.filter((_, i) => i !== index)
      const payload = nextPositions.map((p) => ({
        asset_code: p.assetCode,
        weight: p.weightPct,
        ai_note: p.aiNote ?? undefined,
      }))

      const res = await updateWorkingPortfolio(draftId, payload)
      const loadedPositions = toEditablePositions(res.assets)
      setPositions(loadedPositions)
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Hisse silinirken bir hata oluştu.",
      )
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleAddAsset(codeToAdd?: string) {
    const targetCode = codeToAdd || selectedAssetCodeToAdd
    if (!draftId || !targetCode) return
    setIsAddingAsset(true)
    setFormError("")
    try {
      const payload = [
        ...positions.map((p) => ({
          asset_code: p.assetCode,
          weight: p.weightPct,
          ai_note: p.aiNote ?? undefined,
        })),
        {
          asset_code: targetCode,
          // Backend sıfır ağırlıklı pozisyonları kabul etmez. Hisseyi en küçük
          // düzenleme adımıyla ekleyip kullanıcıya ağırlığı ayarlama imkânı ver.
          weight: 0.01,
        },
      ]

      const res = await updateWorkingPortfolio(draftId, payload)
      const loadedPositions = toEditablePositions(res.assets)
      setPositions(loadedPositions)
      setSelectedAssetCodeToAdd("")

      setHighlightedAssetCode(targetCode)
      setTimeout(() => setHighlightedAssetCode(""), 3500)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Hisse eklenemedi")
    } finally {
      setIsAddingAsset(false)
    }
  }

  async function handleBulkDelete() {
    if (!draftId || selectedRowCodes.length === 0) return
    setIsUpdating(true)
    setFormError("")
    try {
      const nextPositions = positions.filter(
        (p) => !selectedRowCodes.includes(p.assetCode),
      )
      const payload = nextPositions.map((p) => ({
        asset_code: p.assetCode,
        weight: p.weightPct,
        ai_note: p.aiNote ?? undefined,
      }))

      const res = await updateWorkingPortfolio(draftId, payload)
      const loadedPositions = toEditablePositions(res.assets)
      setPositions(loadedPositions)
      setSelectedRowCodes([])
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Toplu silme işleminde hata oluştu.",
      )
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleBatchAddModalAssets() {
    const entries = Object.entries(modalSelectedAssets)
    if (!draftId || entries.length === 0) return
    setIsAddingAsset(true)
    setFormError("")
    try {
      const newItems = entries.map(([code, weightPct]) => ({
        asset_code: code,
        weight: weightPct,
      }))

      const payload = [
        ...positions.map((p) => ({
          asset_code: p.assetCode,
          weight: p.weightPct,
          ai_note: p.aiNote ?? undefined,
        })),
        ...newItems,
      ]

      const res = await updateWorkingPortfolio(draftId, payload)
      const loadedPositions = toEditablePositions(res.assets)
      setPositions(loadedPositions)
      setIsAddStockModalOpen(false)
      setModalSelectedAssets({})
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Hisseler eklenemedi")
    } finally {
      setIsAddingAsset(false)
    }
  }

  function toggleModalAsset(assetCode: string, shouldSelect: boolean) {
    setModalSelectedAssets((prev) => {
      if (shouldSelect) return { ...prev, [assetCode]: prev[assetCode] ?? 3 }

      const next = { ...prev }
      delete next[assetCode]
      return next
    })
  }

  const totalWeight = useMemo(
    () => positions.reduce((sum, p) => sum + p.weightPct, 0),
    [positions],
  )

  const summary = useMemo(() => {
    let tppWeight = 0
    let equityWeight = 0
    let equityCount = 0
    let maxSingleStock = 0
    let above5Sum = 0
    const sectorWeights: Record<string, number> = {}

    for (const pos of positions) {
      if (pos.assetType === "TPP") {
        tppWeight += pos.weightPct
      } else {
        equityWeight += pos.weightPct
        equityCount += 1
        const sector = pos.sectorName ?? "Diğer"
        sectorWeights[sector] = (sectorWeights[sector] || 0) + pos.weightPct

        if (pos.weightPct > maxSingleStock) maxSingleStock = pos.weightPct
        if (init && pos.weightPct > init.aboveThresholdPct)
          above5Sum += pos.weightPct
      }
    }

    let maxSector = 0
    for (const sec in sectorWeights) {
      if (sectorWeights[sec] > maxSector) maxSector = sectorWeights[sec]
    }

    return {
      hisseOrani: equityWeight,
      tppOrani: tppWeight,
      hisseSayisi: equityCount,
      sektorSayisi: Object.keys(sectorWeights).length,
      maxSingleStockWeight: maxSingleStock,
      above5PctStockSum: above5Sum,
      maxSectorWeight: maxSector,
    }
  }, [positions])

  const heldEquityCodes = useMemo(
    () =>
      new Set(
        positions
          .filter((p) => p.assetType === "EQUITY")
          .map((p) => p.assetCode),
      ),
    [positions],
  )

  const liveCompliance: LivePortfolioCompliance = useMemo(
    () => ({
      equityWeightPct: summary.hisseOrani,
      tppWeightPct: summary.tppOrani,
      maxSingleStockWeightPct: summary.maxSingleStockWeight,
      above5PctStockSumWeightPct: summary.above5PctStockSum,
      maxSectorWeightPct: summary.maxSectorWeight,
      stockCount: summary.hisseSayisi,
      violatingStocks: init
        ? positions
            .filter(
              (p) =>
                p.assetType === "EQUITY" &&
                (p.weightPct <= 0 ||
                  p.weightPct > init.maxSingleStockMaxPct ||
                  (init.minSingleStockMaxPct > 0 &&
                    p.weightPct < init.minSingleStockMaxPct)),
            )
            .map((p) => ({
              code: p.assetCode,
              type: p.weightPct > init.maxSingleStockMaxPct ? "max" : "min",
            }))
        : [],
      missingForcedAssets: (editInit?.draft.forcedAssetCodes ?? []).filter(
        (code) => !heldEquityCodes.has(code),
      ),
      presentExcludedAssets: (editInit?.draft.excludedAssetCodes ?? []).filter(
        (code) => heldEquityCodes.has(code),
      ),
    }),
    [summary, positions, init, editInit, heldEquityCodes],
  )

  // Manuel portföy oluşturulurken henüz sunucuya kaydedilmemiş seçimleri de
  // izahname paneline dahil ederiz. Böylece kullanıcı ağırlık kutusunu
  // değiştirdiği anda sağdaki ölçümler gerçek zamanlı güncellenir.
  const manualPickerCompliance: LivePortfolioCompliance = useMemo(() => {
    const selectedAssets = Object.entries(modalSelectedAssets).map(
      ([assetCode, weightPct]) => {
        const asset = editModelUniverse.find(
          (candidate) => candidate.assetCode === assetCode,
        )
        return {
          assetCode,
          weightPct,
          assetType: "EQUITY" as const,
          sectorName: asset?.sectorName ?? "Diğer",
        }
      },
    )
    const previewPositions = [
      ...positions,
      ...selectedAssets.filter(
        (selected) =>
          !positions.some((position) => position.assetCode === selected.assetCode),
      ),
    ]
    const equityPositions = previewPositions.filter(
      (position) => position.assetType === "EQUITY",
    )
    const sectorWeights: Record<string, number> = {}
    let equityWeightPct = 0
    let tppWeightPct = 0
    let maxSingleStockWeightPct = 0
    let above5PctStockSumWeightPct = 0

    equityPositions.forEach((position) => {
      equityWeightPct += position.weightPct
      maxSingleStockWeightPct = Math.max(
        maxSingleStockWeightPct,
        position.weightPct,
      )
      sectorWeights[position.sectorName ?? "Diğer"] =
        (sectorWeights[position.sectorName ?? "Diğer"] ?? 0) +
        position.weightPct
      if (init && position.weightPct > init.aboveThresholdPct) {
        above5PctStockSumWeightPct += position.weightPct
      }
    })
    previewPositions
      .filter((position) => position.assetType === "TPP")
      .forEach((position) => {
        tppWeightPct += position.weightPct
      })

    const selectedCodes = new Set(equityPositions.map((position) => position.assetCode))
    const maxSectorWeightPct = Math.max(0, ...Object.values(sectorWeights))

    return {
      equityWeightPct: Math.round(equityWeightPct * 100) / 100,
      tppWeightPct: Math.round(tppWeightPct * 100) / 100,
      maxSingleStockWeightPct: Math.round(maxSingleStockWeightPct * 100) / 100,
      above5PctStockSumWeightPct:
        Math.round(above5PctStockSumWeightPct * 100) / 100,
      maxSectorWeightPct: Math.round(maxSectorWeightPct * 100) / 100,
      stockCount: equityPositions.length,
      violatingStocks: init
        ? equityPositions
            .filter(
              (position) =>
                position.weightPct <= 0 ||
                position.weightPct > init.maxSingleStockMaxPct ||
                (init.minSingleStockMaxPct > 0 &&
                  position.weightPct < init.minSingleStockMaxPct),
            )
            .map((position) => ({
              code: position.assetCode,
              type:
                position.weightPct > init.maxSingleStockMaxPct
                  ? ("max" as const)
                  : ("min" as const),
            }))
        : [],
      missingForcedAssets: (editInit?.draft.forcedAssetCodes ?? []).filter(
        (code) => !selectedCodes.has(code),
      ),
      presentExcludedAssets: (editInit?.draft.excludedAssetCodes ?? []).filter(
        (code) => selectedCodes.has(code),
      ),
    }
  }, [modalSelectedAssets, editModelUniverse, positions, init, editInit])

  const isProspectusCompliant = useMemo(() => {
    // Sıfır ağırlıklı bir hisse portföyde kalamaz. Toplam %100 olsa bile
    // bu satır gerçek bir pozisyon sayılmadığı için ilerlemeyi engelliyoruz.
    if (
      positions.some(
        (position) =>
          position.assetType === "EQUITY" && position.weightPct <= 0,
      )
    )
      return false
    if (!init) return true
    // Ekranda %100 olarak gösterilen yüksek hassasiyetli motor dağılımlarını
    // kabul et; iki ondalıkta %99,99 ya da %100,01 görünen değerlerde ilerleme
    // kapalı kalır.
    if (
      Math.abs(totalWeight - 100) > TOTAL_WEIGHT_DISPLAY_TOLERANCE_PCT
    )
      return false
    if (
      summary.hisseOrani < init.minEquityWeightPct ||
      summary.hisseOrani > init.maxEquityWeightPct
    )
      return false
    if (
      summary.tppOrani < init.minLiquidityTargetPct ||
      summary.tppOrani > init.maxLiquidityTargetPct
    )
      return false
    if (summary.maxSingleStockWeight > init.maxSingleStockMaxPct) return false
    if (summary.above5PctStockSum > init.aboveThresholdSumMax) return false
    if (summary.maxSectorWeight > init.sectorMaxPct) return false
    if (
      summary.hisseSayisi < init.minStockCount ||
      summary.hisseSayisi > init.maxStockCount
    )
      return false

    return true
  }, [init, totalWeight, summary, positions])

  async function handleSaveAndContinue() {
    if (!draftId) return
    if (!isProspectusCompliant) {
      const zeroWeightCodes = positions
        .filter(
          (position) =>
            position.assetType === "EQUITY" && position.weightPct <= 0,
        )
        .map((position) => position.assetCode)

      setFormError(
        zeroWeightCodes.length > 0
          ? `${zeroWeightCodes.join(", ")} için ağırlık %0. İlerlemeden önce her hisseye %0'dan büyük bir ağırlık giriniz.`
          : "İzahname kurallarına uymayan değerler var. Lütfen sağ paneldeki kırmızı kural ihlallerini düzeltip tekrar deneyiniz.",
      )
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    setIsSaving(true)
    setFormError("")
    try {
      const payload = positions.map((p) => ({
        asset_code: p.assetCode,
        weight: p.weightPct,
        ai_note: p.aiNote,
      }))

      await updateWorkingPortfolio(draftId, payload)
      void navigate(`/fund-design/${draftId}/approve`)
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Çalışma portföyü kaydedilemedi",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const designMode = editDraft?.designMode ?? "AI_ASSISTED"
  const isManualEmptyPortfolio =
    designMode === "MANUAL" && summary.hisseSayisi === 0

  return (
    <FundDesignLayout
      step={5}
      designMode={editDraft?.designMode ?? "AI_ASSISTED"}
      isLoading={isScreenLoading}
      wide
    >
      <section className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.sectionTitle}>
            {isManualEmptyPortfolio
              ? "2. Portföyünü Oluştur"
              : designMode === "MANUAL"
                ? "2. Portföy Düzenleme"
              : "5. Portföy Düzenleme"}
          </h2>
          <p className={styles.intro}>
            {isManualEmptyPortfolio
              ? "Hisselerini seçin, ağırlıklarını belirleyin ve portföyünüzü oluşturmaya başlayın."
              : "Seçtiğiniz portföyü düzenleyin ve tercihlerinize göre ince ayarlar yapın."}
          </p>
        </header>

        {formError ? <FormAlert>{formError}</FormAlert> : null}
        {initError ? (
          <FormAlert>
            {initError}
            <button className={styles.retry} type="button" onClick={reloadInit}>
              Tekrar dene
            </button>
          </FormAlert>
        ) : null}

        <div className={styles.grid}>
          <div className={styles.mainColumn} style={{ position: "relative" }}>
            {isLoading ? (
              <FundLoader message="Portföy verileri yükleniyor..." />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  opacity: isUpdating ? 0.5 : 1,
                  pointerEvents: isUpdating ? "none" : "auto",
                  transition: "opacity 0.2s ease",
                  height: "100%",
                }}
              >
                {isUpdating && (
                  <div className={styles.updatingOverlay}>
                    <div className={styles.spinner}></div>
                    <p>Güncelleniyor...</p>
                  </div>
                )}
                <div className={styles.summaryBar}>
                  <div className={styles.summaryCardItem}>
                    <p className={styles.summaryCardLabel}>
                      Hisse Senedi Oranı
                    </p>
                    <p className={styles.summaryCardValue}>
                      %{formatPct(summary.hisseOrani)}
                    </p>
                  </div>
                  <div className={styles.summaryCardItem}>
                    <p className={styles.summaryCardLabel}>
                      TPP (Para Piyasası)
                    </p>
                    <p className={styles.summaryCardValue}>
                      %{formatPct(summary.tppOrani)}
                    </p>
                  </div>
                  <div className={styles.summaryCardItem}>
                    <p className={styles.summaryCardLabel}>Hisse Sayısı</p>
                    <p className={styles.summaryCardValue}>
                      {summary.hisseSayisi}
                    </p>
                  </div>
                  <div className={styles.summaryCardItem}>
                    <p className={styles.summaryCardLabel}>Sektör Sayısı</p>
                    <p className={styles.summaryCardValue}>
                      {summary.sektorSayisi}
                    </p>
                  </div>
                </div>

                <div className={styles.totalWeightCard}>
                  <div className={styles.totalWeightHeader}>
                    <span className={styles.totalWeightLabel}>
                      Toplam Portföy Ağırlığı
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                      }}
                    >
                      {Math.abs(totalWeight - 100) >
                        TOTAL_WEIGHT_DISPLAY_TOLERANCE_PCT && (
                        <span className={styles.totalWeightHint}>
                          {totalWeight < 100
                            ? `%${formatPct(100 - totalWeight)} eksik`
                            : `%${formatPct(totalWeight - 100)} fazla`}
                        </span>
                      )}
                      <div
                        className={[
                          styles.statusBanner,
                          isProspectusCompliant
                            ? styles.statusBannerOk
                            : styles.statusBannerWarn,
                        ].join(" ")}
                      >
                        <span>
                          {isProspectusCompliant
                            ? "✓ Portföy İzahname ve Kurallara UYGUN"
                            : "⚠ İzahname / Kural İhlali Var"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.totalWeightThickTrack}>
                    <div
                      className={[
                        styles.totalWeightThickFill,
                        Math.abs(totalWeight - 100) <=
                        TOTAL_WEIGHT_DISPLAY_TOLERANCE_PCT
                          ? styles.totalWeightFillOk
                          : Math.abs(totalWeight - 100) <= 2
                            ? styles.totalWeightFillWarn
                            : styles.totalWeightFillBad,
                      ].join(" ")}
                      style={{ width: `${Math.min(totalWeight, 100)}%` }}
                    >
                      <span className={styles.totalWeightInnerPct}>
                        %{formatPct(totalWeight)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.tableCard}>
                  <div className={styles.toolbar}>
                    {editInit?.draft.designMode !== "MANUAL" && (
                      <div className={styles.selectWrap}>
                        <label className={styles.selectLabel}>
                          Düzenlenen Portföy:
                        </label>
                        <div ref={proposalRef} style={{ position: "relative" }}>
                          <button
                            type="button"
                            onClick={() =>
                              setIsProposalDropdownOpen((prev) => !prev)
                            }
                            className={styles.customProposalBtn}
                          >
                            <span>
                              {proposals.find(
                                (p) => p.rank === selectedProposalRank,
                              )?.label ||
                                `AI Önerisi (${selectedProposalRank})`}
                            </span>
                            <span
                              style={{ fontSize: "0.75rem", color: "#64748b" }}
                            >
                              ▼
                            </span>
                          </button>
                          {isProposalDropdownOpen && (
                            <div className={styles.customProposalMenu}>
                              {(proposals.length > 0
                                ? proposals
                                : [
                                    {
                                      rank: 1,
                                      label: "AI Birincil Önerisi (Agresif)",
                                    },
                                  ]
                              ).map((prop) => (
                                <div
                                  key={prop.rank}
                                  className={[
                                    styles.customProposalMenuItem,
                                    prop.rank === selectedProposalRank
                                      ? styles.activeMenuItem
                                      : "",
                                  ].join(" ")}
                                  onClick={() => {
                                    setIsProposalDropdownOpen(false)
                                    void handleProposalChange(prop.rank)
                                  }}
                                >
                                  <span>
                                    {prop.label || `AI Önerisi (${prop.rank})`}
                                  </span>
                                  {prop.rank === selectedProposalRank && (
                                    <span
                                      style={{
                                        color: "#2ec4a7",
                                        fontWeight: 700,
                                      }}
                                    >
                                      ✓
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className={styles.toolbarActions}>
                      <div className={styles.addStockQuick}>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={selectedAssetCodeToAdd}
                            onChange={(e) => {
                              setSelectedAssetCodeToAdd(
                                e.target.value.toUpperCase(),
                              )
                              setIsAutocompleteOpen(true)
                            }}
                            onFocus={() => setIsAutocompleteOpen(true)}
                            onBlur={() =>
                              setTimeout(
                                () => setIsAutocompleteOpen(false),
                                200,
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && selectedAssetCodeToAdd) {
                                e.preventDefault()
                                void handleAddAsset()
                                setIsAutocompleteOpen(false)
                              }
                            }}
                            placeholder="Hisse Kodu..."
                            className={styles.quickInput}
                            maxLength={6}
                          />
                          {isAutocompleteOpen && selectedAssetCodeToAdd && (
                            <div className={styles.autocompleteDropdown}>
                              {(() => {
                                const filtered = editModelUniverse
                                  .filter(
                                    (a) =>
                                      !positions.some(
                                        (p) => p.assetCode === a.assetCode,
                                      ) &&
                                      (a.assetCode
                                        .toLowerCase()
                                        .includes(
                                          selectedAssetCodeToAdd.toLowerCase(),
                                        ) ||
                                        a.displayName
                                          .toLowerCase()
                                          .includes(
                                            selectedAssetCodeToAdd.toLowerCase(),
                                          )),
                                  )
                                  .slice(0, 5)

                                if (filtered.length === 0) {
                                  return (
                                    <div
                                      className={styles.autocompleteItemEmpty}
                                    >
                                      Sonuç bulunamadı
                                    </div>
                                  )
                                }
                                return filtered.map((a) => (
                                  <div
                                    key={a.assetCode}
                                    className={styles.autocompleteItem}
                                    onClick={() => {
                                      setIsAutocompleteOpen(false)
                                      void handleAddAsset(a.assetCode)
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.75rem",
                                        flex: 1,
                                        minWidth: 0,
                                      }}
                                    >
                                      <span className={styles.autocompleteCode}>
                                        {a.assetCode}
                                      </span>
                                      <span className={styles.autocompleteName}>
                                        {a.displayName}
                                      </span>
                                    </div>
                                    <span
                                      style={{
                                        fontSize: "0.85rem",
                                        fontWeight: 700,
                                        color: "#2ec4a7",
                                        marginLeft: "auto",
                                      }}
                                    >
                                      + Ekle
                                    </span>
                                  </div>
                                ))
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddStockModalOpen(true)}
                        className={[
                          styles.openListBtn,
                          designMode === "MANUAL"
                            ? styles.manualOpenListBtn
                            : "",
                        ].join(" ")}
                      >
                        <span
                          aria-hidden="true"
                          className={styles.openListIcon}
                        >
                          +
                        </span>
                        {designMode === "MANUAL"
                          ? "Hisseleri Listele"
                          : "Listeden Seç"}
                      </button>
                    </div>
                  </div>

                  <div className={styles.tableFilterBar}>
                    <div className={styles.filterLeft}>
                      <div
                        className={styles.searchBox}
                        style={{ maxWidth: "320px" }}
                      >
                        <span className={styles.searchIcon}>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        </span>
                        <input
                          type="text"
                          placeholder="Tabloda hisse veya sektör ara..."
                          value={tableFilterText}
                          onChange={(e) => setTableFilterText(e.target.value)}
                          className={styles.tableSearchInput}
                        />
                        {tableFilterText && (
                          <button
                            type="button"
                            onClick={() => setTableFilterText("")}
                            className={styles.clearFilterBtn}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={styles.filterRight}>
                      {/* Clear All Filters Button - Always Visible */}
                      {(() => {
                        const hasActiveFilters = Boolean(
                          debouncedFilterText ||
                            selectedSectors.length > 0 ||
                            tableSortKey !== "NONE",
                        )
                        return (
                          <button
                            type="button"
                            disabled={!hasActiveFilters}
                            onClick={() => {
                              setTableFilterText("")
                              setSelectedSectors([])
                              setTableSortKey("NONE")
                            }}
                            className={[
                              styles.clearAllFiltersBtn,
                              !hasActiveFilters
                                ? styles.clearAllFiltersBtnDisabled
                                : "",
                            ].join(" ")}
                          >
                            Filtreleri Temizle ✕
                          </button>
                        )
                      })()}
                    </div>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ width: "40px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              className={styles.checkboxInput}
                              checked={
                                positions.filter((p) => p.assetType !== "TPP")
                                  .length > 0 &&
                                selectedRowCodes.length ===
                                  positions.filter((p) => p.assetType !== "TPP")
                                    .length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRowCodes(
                                    positions
                                      .filter((p) => p.assetType !== "TPP")
                                      .map((p) => p.assetCode),
                                  )
                                } else {
                                  setSelectedRowCodes([])
                                }
                              }}
                            />
                          </th>
                          <th>HİSSE</th>
                          <th>
                            {/* Sector Dropdown directly inside Column Header */}
                            <div
                              ref={sectorRef}
                              style={{
                                position: "relative",
                                display: "inline-block",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSectorDropdownOpen((prev) => !prev)
                                  setIsSortDropdownOpen(false)
                                }}
                                title={
                                  selectedSectors.length === 1
                                    ? selectedSectors[0]
                                    : selectedSectors.length > 1
                                      ? selectedSectors.join(", ")
                                      : undefined
                                }
                                className={[
                                  styles.thHeaderBtn,
                                  selectedSectors.length > 0
                                    ? styles.thHeaderBtnActive
                                    : "",
                                ].join(" ")}
                              >
                                <span>
                                  SEKTÖR{" "}
                                  {selectedSectors.length > 0
                                    ? `(${selectedSectors.length})`
                                    : ""}
                                </span>
                                <span style={{ fontSize: "0.65rem" }}>▼</span>
                              </button>
                              {isSectorDropdownOpen && (
                                <div
                                  className={styles.customFilterMenu}
                                  style={{ top: "calc(100% + 6px)", left: 0 }}
                                >
                                  <div
                                    className={styles.customFilterMenuHeader}
                                    onClick={() => setSelectedSectors([])}
                                  >
                                    <span
                                      style={{
                                        fontSize: "0.8125rem",
                                        fontWeight: 700,
                                        color: "#108e75",
                                      }}
                                    >
                                      ✓ Tüm Sektörler (Sıfırla)
                                    </span>
                                  </div>
                                  <div
                                    className={styles.customFilterMenuDivider}
                                  />
                                  {availableSectors.map((sec) => {
                                    const isChecked =
                                      selectedSectors.includes(sec)
                                    return (
                                      <div
                                        key={sec}
                                        className={[
                                          styles.customProposalMenuItem,
                                          isChecked
                                            ? styles.activeMenuItem
                                            : "",
                                        ].join(" ")}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedSectors((prev) =>
                                            prev.includes(sec)
                                              ? prev.filter((s) => s !== sec)
                                              : [...prev, sec],
                                          )
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.6rem",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {}}
                                            className={styles.checkboxInput}
                                          />
                                          <span>{sec}</span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </th>
                          <th>
                            {/* Sort Dropdown directly inside Weight Column Header */}
                            <div
                              ref={sortRef}
                              style={{
                                position: "relative",
                                display: "inline-block",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSortDropdownOpen((prev) => !prev)
                                  setIsSectorDropdownOpen(false)
                                }}
                                className={[
                                  styles.thHeaderBtn,
                                  tableSortKey !== "NONE"
                                    ? styles.thHeaderBtnActive
                                    : "",
                                ].join(" ")}
                              >
                                <span>
                                  AĞIRLIK (%){" "}
                                  {tableSortKey === "WEIGHT_DESC"
                                    ? "↓"
                                    : tableSortKey === "WEIGHT_ASC"
                                      ? "↑"
                                      : ""}
                                </span>
                                <span style={{ fontSize: "0.65rem" }}>▼</span>
                              </button>
                              {isSortDropdownOpen && (
                                <div
                                  className={styles.customFilterMenu}
                                  style={{
                                    top: "calc(100% + 6px)",
                                    left: 0,
                                    minWidth: "180px",
                                  }}
                                >
                                  {[
                                    { key: "NONE", label: "Varsayılan" },
                                    {
                                      key: "WEIGHT_DESC",
                                      label: "Ağırlık: Azalan (↓)",
                                    },
                                    {
                                      key: "WEIGHT_ASC",
                                      label: "Ağırlık: Artan (↑)",
                                    },
                                  ].map((opt) => (
                                    <div
                                      key={opt.key}
                                      className={[
                                        styles.customProposalMenuItem,
                                        tableSortKey === opt.key
                                          ? styles.activeMenuItem
                                          : "",
                                      ].join(" ")}
                                      onClick={() => {
                                        setTableSortKey(opt.key as any)
                                        setIsSortDropdownOpen(false)
                                      }}
                                    >
                                      <span>{opt.label}</span>
                                      {tableSortKey === opt.key && (
                                        <span
                                          style={{
                                            color: "#2ec4a7",
                                            fontWeight: 700,
                                          }}
                                        >
                                          ✓
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </th>
                          <th>HEDEF ARALIK</th>
                          <th>HEDEFE GÖRE</th>
                          <th style={{ textAlign: "center" }}>İŞLEM</th>
                        </tr>
                      </thead>
                      <tbody
                        key={`${debouncedFilterText}-${selectedSectors.join(",")}-${tableSortKey}`}
                      >
                        {filteredPositions.filter(
                          (p) => p.pos.assetType !== "TPP",
                        ).length === 0 && (
                          <tr>
                            <td colSpan={7} className={styles.emptyFilterRow}>
                              <div className={styles.emptyFilterBox}>
                                <span className={styles.emptyFilterText}>
                                  Arama kriterlerinize uygun hisse bulunamadı.
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTableFilterText("")
                                    setSelectedSectors([])
                                  }}
                                  className={styles.clearAllFiltersBtn}
                                  style={{ marginTop: "0.25rem" }}
                                >
                                  Filtreleri Temizle ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {filteredPositions.map(({ pos, originalIndex }) => {
                          let targetMin = 3
                          let targetMax = 10
                          let prospectusMax = 10
                          let targetText = ""

                          if (pos.assetType === "TPP") {
                            targetMin = editDraft?.tppMinPct ?? 3
                            targetMax = editDraft?.tppMaxPct ?? 15
                            prospectusMax = init?.maxLiquidityTargetPct ?? 15
                            targetText = `%${targetMin} - %${targetMax}`
                          } else {
                            targetMin = 0 // Tek hisse için özel minimum limit bulunmuyor
                            targetMax =
                              editDraft?.singleStockMaxPct ??
                              init?.maxSingleStockMaxPct ??
                              10
                            prospectusMax = init?.maxSingleStockMaxPct ?? 10
                            targetText =
                              editDraft?.singleStockMaxPct != null
                                ? `Maks %${targetMax}`
                                : `Maks %${targetMax}`
                          }

                          const isProspectusExceeded =
                            pos.weightPct > prospectusMax
                          const isZeroWeightEquity =
                            pos.assetType === "EQUITY" && pos.weightPct <= 0
                          const isCustomExceeded = pos.weightPct > targetMax
                          const isCustomMinViolated =
                            pos.weightPct > 0 &&
                            targetMin > 0 &&
                            pos.weightPct < targetMin

                          let statusClass = styles.statusOk
                          let statusLabel = "Uygun"

                          if (isZeroWeightEquity) {
                            statusClass = styles.statusBad
                            statusLabel = "Ağırlık Girin"
                          } else if (isProspectusExceeded) {
                            statusClass = styles.statusBad
                            statusLabel = "İhlal"
                          } else if (isCustomExceeded || isCustomMinViolated) {
                            statusClass = styles.statusWarn
                            statusLabel = "Hedef Dışı"
                          } else if (
                            pos.weightPct < targetMax &&
                            pos.weightPct >= targetMax * 0.85
                          ) {
                            statusClass = styles.statusWarn
                            statusLabel = "Sınıra Yakın"
                          }

                          return (
                            <tr
                              key={pos.assetCode}
                              className={
                                pos.assetCode === highlightedAssetCode
                                  ? styles.rowHighlightAdded
                                  : ""
                              }
                            >
                              <td style={{ textAlign: "center" }}>
                                {pos.assetType !== "TPP" && (
                                  <input
                                    type="checkbox"
                                    className={styles.checkboxInput}
                                    checked={selectedRowCodes.includes(
                                      pos.assetCode,
                                    )}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRowCodes((prev) => [
                                          ...prev,
                                          pos.assetCode,
                                        ])
                                      } else {
                                        setSelectedRowCodes((prev) =>
                                          prev.filter(
                                            (c) => c !== pos.assetCode,
                                          ),
                                        )
                                      }
                                    }}
                                  />
                                )}
                              </td>
                              <td>
                                <div className={styles.assetBadge}>
                                  <span className={styles.assetCodeText}>
                                    {pos.assetCode}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span
                                  className={styles.sectorTag}
                                  title={pos.sectorName ?? undefined}
                                >
                                  {pos.sectorName ?? "—"}
                                </span>
                              </td>
                              <td>
                                <div className={styles.weightCell}>
                                  <button
                                    type="button"
                                    className={[
                                      styles.stepBtn,
                                      styles.stepBtnMinus,
                                    ].join(" ")}
                                    title="0,01% Azalt"
                                    onClick={() =>
                                      handleWeightChange(
                                        originalIndex,
                                        adjustWeightByStep(pos.weightPct, -1),
                                      )
                                    }
                                  >
                                    -
                                  </button>
                                  <EditableWeightInput
                                    value={pos.weightPct}
                                    hasError={
                                      isZeroWeightEquity ||
                                      (init
                                        ? pos.weightPct >
                                            init.maxSingleStockMaxPct ||
                                          (init.minSingleStockMaxPct > 0 &&
                                            pos.weightPct <
                                              init.minSingleStockMaxPct)
                                        : false)
                                    }
                                    onChange={(newVal) =>
                                      handleWeightChange(originalIndex, newVal)
                                    }
                                    className={styles.weightInput}
                                  />
                                  <button
                                    type="button"
                                    className={styles.stepBtn}
                                    title="0,01% Artır"
                                    onClick={() =>
                                      handleWeightChange(
                                        originalIndex,
                                        adjustWeightByStep(pos.weightPct, 1),
                                      )
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td>
                                <span className={styles.targetRange}>
                                  {targetText}
                                </span>
                              </td>
                              <td>
                                <div
                                  className={[
                                    styles.statusPill,
                                    statusClass,
                                  ].join(" ")}
                                >
                                  <span className={styles.statusDot} />
                                  <span>{statusLabel}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                {pos.assetType !== "TPP" && (
                                  <button
                                    type="button"
                                    className={styles.deleteBtn}
                                    title="Hisseyi çıkar"
                                    onClick={() =>
                                      requestDeleteSingle(originalIndex)
                                    }
                                  >
                                    <TrashIcon />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <button
                className={styles.back}
                type="button"
                onClick={() => {
                  if (!draftId) return
                  void navigate(
                    designMode === "MANUAL"
                      ? "/fund-design"
                      : `/fund-design/${draftId}/alternatives`,
                  )
                }}
              >
                ← Geri
              </button>
              <Button
                className={styles.continue}
                type="button"
                disabled={!isProspectusCompliant || isLoading || isSaving}
                onClick={() => void handleSaveAndContinue()}
              >
                {isSaving ? "Kaydediliyor…" : "Kaydet ve İlerle →"}
              </Button>
            </div>
          </div>

          <aside className={styles.sideColumn}>
            <ProspectusRulesPanel init={init} liveCompliance={liveCompliance} />
            <FundDesignProgressRail
              currentStep={designMode === "MANUAL" ? 2 : 5}
              designMode={designMode}
            />
          </aside>
        </div>
      </section>

      {/* FULL LIST MODAL WITH BATCH WEIGHT INPUT */}
      {isAddStockModalOpen &&
        createPortal(
        <div
          className={[
            styles.modalOverlay,
            isManualEmptyPortfolio ? styles.manualAssetOverlay : "",
          ].join(" ")}
          onClick={() => setIsAddStockModalOpen(false)}
        >
          <div
            className={[
              styles.modalContent,
              isManualEmptyPortfolio ? styles.manualAssetModal : "",
            ].join(" ")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>
                  {isManualEmptyPortfolio
                    ? "Portföyünü Oluşturmaya Başla"
                    : "Hisse Seçin ve Ağırlık Belirleyin"}
                </h3>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "#64748b",
                    margin: "0.2rem 0 0 0",
                  }}
                >
                  {isManualEmptyPortfolio
                    ? "Soldaki kutulardan hisseleri seçin; ağırlıklarını belirleyip hepsini tek seferde portföyünüze ekleyin."
                    : "Hisseleri işaretleyip oranlarını (%) yanına yazarak topluca ekleyebilirsiniz."}
                </p>
              </div>
              <button
                className={styles.closeModalBtn}
                onClick={() => setIsAddStockModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalWorkArea}>
            <div
              className={styles.modalSearchBox}
              style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
            >
              <input
                type="text"
                placeholder="Kod veya isme göre ara..."
                value={modalSearchText}
                onChange={(e) => setModalSearchText(e.target.value)}
                className={styles.modalSearchInput}
                style={{ flex: 1, minWidth: "200px" }}
              />
              {/* Custom Multi-Select Sector Dropdown */}
              <div style={{ position: "relative", flex: 1, minWidth: "150px" }}>
                <div
                  className={styles.modalSearchInput}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsModalSectorDropdownOpen(!isModalSectorDropdownOpen)
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {modalSelectedSectors.length === 0
                      ? "Tüm Sektörler"
                      : `${modalSelectedSectors.length} Sektör Seçildi`}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>

                {isModalSectorDropdownOpen && (
                  <div
                    className={styles.customFilterMenu}
                    style={{
                      top: "calc(100% + 6px)",
                      left: 0,
                      width: "100%",
                      zIndex: 50,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={styles.customFilterMenuHeader}
                      onClick={() => setModalSelectedSectors([])}
                    >
                      <span
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: 700,
                          color: "#108e75",
                        }}
                      >
                        ✓ Tüm Sektörler (Sıfırla)
                      </span>
                    </div>
                    <div className={styles.customFilterMenuDivider} />
                    <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                      {Array.from(
                        new Set(
                          editModelUniverse
                            .map((a) => a.sectorName)
                            .filter((s): s is string => !!s),
                        ),
                      )
                        .sort()
                        .map((sec) => {
                          const isChecked = modalSelectedSectors.includes(sec)
                          return (
                            <div
                              key={sec}
                              className={[
                                styles.customProposalMenuItem,
                                isChecked ? styles.activeMenuItem : "",
                              ].join(" ")}
                              onClick={(e) => {
                                e.stopPropagation()
                                setModalSelectedSectors((prev) =>
                                  prev.includes(sec)
                                    ? prev.filter((s) => s !== sec)
                                    : [...prev, sec],
                                )
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.6rem",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className={styles.checkboxInput}
                                />
                                <span>{sec}</span>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {isManualEmptyPortfolio && (
              <div className={styles.manualFilterBar}>
                <span className={styles.manualFilterLabel}>Filtreler</span>
                <button
                  type="button"
                  className={[
                    styles.manualFilterChip,
                    showOnlySelectedModalAssets
                      ? styles.manualFilterChipActive
                      : "",
                  ].join(" ")}
                  onClick={() =>
                    setShowOnlySelectedModalAssets((current) => !current)
                  }
                >
                  Seçtiklerim ({Object.keys(modalSelectedAssets).length})
                </button>
                {(modalSearchText || modalSelectedSectors.length > 0) && (
                  <button
                    type="button"
                    className={styles.manualClearFilters}
                    onClick={() => {
                      setModalSearchText("")
                      setModalSelectedSectors([])
                      setShowOnlySelectedModalAssets(false)
                    }}
                  >
                    Filtreleri temizle
                  </button>
                )}
              </div>
            )}
            <div
              className={[
                styles.modalList,
                isManualEmptyPortfolio ? styles.manualAssetList : "",
              ].join(" ")}
              onClick={() => setIsModalSectorDropdownOpen(false)}
            >
              {modalAvailableAssets.length > 0 && (
                <div className={styles.modalListControls}>
                  <label className={styles.modalSelectAllLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={areAllModalAssetsSelected}
                      onChange={(event) => {
                        const visibleCodes = modalAvailableAssets.map(
                          (asset) => asset.assetCode,
                        )
                        setModalSelectedAssets((prev) => {
                          const next = { ...prev }
                          if (event.target.checked) {
                            visibleCodes.forEach((code) => {
                              if (!(code in next)) next[code] = 3
                            })
                          } else {
                            visibleCodes.forEach((code) => delete next[code])
                          }
                          return next
                        })
                      }}
                    />
                    <span>
                      {areAllModalAssetsSelected
                        ? "Görünenlerin seçimini kaldır"
                        : "Görünenleri seç"}
                    </span>
                  </label>
                  <span className={styles.modalResultCount}>
                    {modalAvailableAssets.length} hisse
                  </span>
                </div>
              )}
              {modalAvailableAssets.map((asset) => {
                  const isChecked = asset.assetCode in modalSelectedAssets
                  const currentWeight =
                    modalSelectedAssets[asset.assetCode] ?? 3.0

                  return (
                    <div
                      key={asset.assetCode}
                      className={[
                        styles.modalListItem,
                        isChecked ? styles.modalListItemActive : "",
                      ].join(" ")}
                      onClick={() =>
                        toggleModalAsset(asset.assetCode, !isChecked)
                      }
                    >
                      <div className={styles.modalAssetInfo}>
                        <input
                          type="checkbox"
                          className={styles.checkboxInput}
                          checked={isChecked}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            toggleModalAsset(asset.assetCode, event.target.checked)
                          }
                        />
                        <span className={styles.modalAssetCode}>
                          {asset.assetCode}
                        </span>
                        <span className={styles.modalAssetDesc}>
                          {asset.displayName}
                        </span>
                      </div>

                      {isChecked ? (
                        (() => {
                          const isMinViolated =
                            init &&
                            init.minSingleStockMaxPct > 0 &&
                            currentWeight < init.minSingleStockMaxPct
                          const isMaxViolated =
                            init && currentWeight > init.maxSingleStockMaxPct
                          const hasError =
                            currentWeight <= 0 ||
                            !!isMinViolated ||
                            !!isMaxViolated

                          return (
                            <div
                              className={styles.modalWeightBox}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  color: hasError ? "#ef4444" : "#64748b",
                                }}
                              >
                                Ağırlık %
                              </span>
                              <EditableWeightInput
                                value={currentWeight}
                                hasError={hasError}
                                onChange={(val) => {
                                  setModalSelectedAssets((prev) => ({
                                    ...prev,
                                    [asset.assetCode]: val,
                                  }))
                                }}
                                className={styles.modalWeightInput}
                              />
                            </div>
                          )
                        })()
                      ) : (
                        <span className={styles.modalSelectPrompt}>
                          Seç
                        </span>
                      )}
                    </div>
                  )
                })}
              {modalAvailableAssets.length === 0 && (
                <p
                  style={{
                    color: "#64748b",
                    textAlign: "center",
                    padding: "1rem",
                  }}
                >
                  Eklenebilecek yeni hisse bulunmuyor.
                </p>
              )}
            </div>

            <div className={styles.modalFooter}>
              {(() => {
                const entries = Object.entries(modalSelectedAssets)
                const invalidCodes = entries
                  .filter(([_, weight]) => {
                    if (weight <= 0) return true
                    if (!init) return false
                    return (
                      (init.minSingleStockMaxPct > 0 &&
                        weight < init.minSingleStockMaxPct) ||
                      weight > init.maxSingleStockMaxPct
                    )
                  })
                  .map(([code]) => code)

                const hasValidationError = invalidCodes.length > 0

                return (
                  <>
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        color: hasValidationError ? "#ef4444" : "#475569",
                        fontWeight: 600,
                      }}
                    >
                      {hasValidationError
                        ? `${invalidCodes.join(", ")} ağırlığı hatalı!`
                        : entries.length > 0
                          ? `Seçili: ${entries.length} hisse · Toplam %${formatPct(entries.reduce((sum, [, weight]) => sum + weight, 0))}`
                          : "Henüz hisse seçilmedi"}
                    </span>
                    <button
                      type="button"
                      className={styles.modalBatchSubmitBtn}
                      disabled={
                        entries.length === 0 ||
                        isAddingAsset ||
                        hasValidationError
                      }
                      onClick={() => void handleBatchAddModalAssets()}
                    >
                      {isAddingAsset
                        ? "Ekleniyor…"
                        : isManualEmptyPortfolio
                          ? `Portföyü Oluştur (${entries.length})`
                          : `Portföye Ekle (${entries.length})`}
                    </button>
                  </>
                )
              })()}
            </div>
            {isManualEmptyPortfolio ? (
              <aside className={styles.manualRulesPreview}>
                <p className={styles.manualRulesEyebrow}>İzahname sınırları</p>
                <p className={styles.manualRulesDescription}>
                  Hisse seçerken portföyünüzün uyması gereken limitleri buradan
                  takip edebilirsiniz.
                </p>
                <ProspectusRulesPanel
                  init={init}
                  liveCompliance={manualPickerCompliance}
                />
              </aside>
            ) : null}
            </div>
          </div>
        </div>
        ,
        document.body,
      )}
      {/* FLOATING BULK SELECTION ACTION BAR */}
      {selectedRowCodes.length > 0 && !deleteConfirmState.isOpen && (
        createPortal(
          <div className={styles.floatingBulkBar}>
            <div className={styles.floatingBulkText}>
              <span className={styles.floatingBulkBadge}>
                {selectedRowCodes.length}
              </span>
              <span>Hisse Seçildi</span>
            </div>
            <div className={styles.floatingBulkActions}>
              <button
                type="button"
                className={styles.floatingCancelBtn}
                onClick={() => setSelectedRowCodes([])}
              >
                Seçimi Temizle
              </button>
              <button
                type="button"
                className={styles.floatingDeleteBtn}
                onClick={() => requestDeleteBulk()}
              >
                Portföyden Çıkar ({selectedRowCodes.length})
              </button>
            </div>
          </div>,
          document.body,
        )
      )}

      {/* CONFIRMATION MODAL */}
      {deleteConfirmState.isOpen &&
        createPortal(
        <div
          className={[
            styles.modalOverlay,
            isManualDraft ? styles.manualConfirmationOverlay : "",
          ].join(" ")}
          onClick={() =>
            setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }))
          }
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "400px",
              height: "auto",
              maxHeight: "calc(100vh - 3rem)",
              padding: "1.5rem",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "#fee2e2",
                  color: "#ef4444",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  margin: "0 auto 0.75rem auto",
                }}
              >
                ?
              </div>
              <h3
                style={{
                  margin: "0 0 0.4rem 0",
                  color: "#0f1f3c",
                  fontSize: "1.125rem",
                  fontWeight: 700,
                }}
              >
                {deleteConfirmState.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  color: "#475569",
                  fontSize: "0.875rem",
                  lineHeight: "1.5",
                }}
              >
                {deleteConfirmState.message}
              </p>
              {deleteConfirmState.items.length > 0 && (
                <div
                  style={{
                    marginTop: "0.9rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                    alignItems: "center",
                    maxHeight: "220px",
                    overflowY: "auto",
                    padding: "0 0.5rem",
                  }}
                >
                  {deleteConfirmState.items.map((item) => (
                    <span
                      key={item}
                      style={{
                        display: "inline-flex",
                        maxWidth: "100%",
                        padding: "0.3rem 0.6rem",
                        borderRadius: "999px",
                        background: "#f8fafc",
                        color: "#0f1f3c",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        wordBreak: "break-word",
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }))
                }
                className={styles.floatingCancelBtn}
                style={{ flex: 1, height: "40px" }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => deleteConfirmState.onConfirm()}
                className={styles.floatingDeleteBtn}
                style={{ flex: 1, height: "40px" }}
              >
                Evet, Çıkar
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </FundDesignLayout>
  )
}
