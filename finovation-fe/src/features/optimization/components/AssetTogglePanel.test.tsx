import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import AssetTogglePanel from "@/features/optimization/components/AssetTogglePanel"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

const ASSETS = [
  {
    assetCode: "MGROS",
    symbol: "MGROS",
    name: "Migros",
    sectorName: "Perakende Ticaret",
  },
  {
    assetCode: "TTKOM",
    symbol: "TTKOM",
    name: "Türk Telekom",
    sectorName: "Telekomünikasyon",
  },
]

describe("AssetTogglePanel", () => {
  it("hisseleri hisse ve sektörle listeler", () => {
    render(
      <AssetTogglePanel
        title="C · Dahil Edilmeyecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set()}
        disabledAssetCodes={new Set()}
        toggleLabel="Hariç Tut"
        onToggle={vi.fn()}
      />,
    )

    const table = within(screen.getByRole("table"))
    expect(table.getByText("MGROS")).toBeInTheDocument()
    expect(table.getByText("Migros")).toBeInTheDocument()
    expect(table.getByText("Telekomünikasyon")).toBeInTheDocument()
  })

  it("arama sektör ve hisse adına göre filtreler", async () => {
    const user = userEvent.setup()

    render(
      <AssetTogglePanel
        title="C · Dahil Edilmeyecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set()}
        disabledAssetCodes={new Set()}
        toggleLabel="Hariç Tut"
        onToggle={vi.fn()}
      />,
    )

    await user.type(screen.getByRole("searchbox"), "telekom")

    expect(screen.getByText(/TTKOM/)).toBeInTheDocument()
    expect(screen.queryByText(/MGROS/)).not.toBeInTheDocument()
  })

  it("eşleşme yoksa bilgilendirme mesajı gösterir", async () => {
    const user = userEvent.setup()

    render(
      <AssetTogglePanel
        title="C · Dahil Edilmeyecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set()}
        disabledAssetCodes={new Set()}
        toggleLabel="Hariç Tut"
        onToggle={vi.fn()}
      />,
    )

    await user.type(screen.getByRole("searchbox"), "xyz-yok")

    expect(
      screen.getByText("Aramanızla eşleşen hisse bulunamadı."),
    ).toBeInTheDocument()
  })

  it("diğer panelde zaten seçili olan hisseyi devre dışı bırakır", () => {
    render(
      <AssetTogglePanel
        title="D · Zorunlu Eklenecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set()}
        disabledAssetCodes={new Set(["MGROS"])}
        toggleLabel="Ekle"
        onToggle={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("checkbox", { name: "MGROS hissesi için Ekle" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("checkbox", { name: "TTKOM hissesi için Ekle" }),
    ).toBeEnabled()
  })

  it("işareti tıklayınca onToggle'ı doğru hisse koduyla çağırır", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()

    render(
      <AssetTogglePanel
        title="C · Dahil Edilmeyecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set()}
        disabledAssetCodes={new Set()}
        toggleLabel="Hariç Tut"
        onToggle={onToggle}
      />,
    )

    await user.click(
      screen.getByRole("checkbox", { name: "MGROS hissesi için Hariç Tut" }),
    )

    expect(onToggle).toHaveBeenCalledWith("MGROS")
  })

  it("exclude variant'ında checkbox'a hariç tutma vurgu sınıfını ekler", () => {
    render(
      <AssetTogglePanel
        title="C · Dahil Edilmeyecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set()}
        disabledAssetCodes={new Set()}
        toggleLabel="Hariç Tut"
        variant="exclude"
        onToggle={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("checkbox", { name: "MGROS hissesi için Hariç Tut" }),
    ).toHaveClass(styles.assetToggleBoxExclude)
  })

  it("forceAdd variant'ında (varsayılan) hariç tutma vurgu sınıfını eklemez", () => {
    render(
      <AssetTogglePanel
        title="D · Zorunlu Eklenecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set()}
        disabledAssetCodes={new Set()}
        toggleLabel="Ekle"
        onToggle={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("checkbox", { name: "MGROS hissesi için Ekle" }),
    ).not.toHaveClass(styles.assetToggleBoxExclude)
  })

  it("seçili hisseleri listenin en üstüne sıralar", () => {
    render(
      <AssetTogglePanel
        title="C · Dahil Edilmeyecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set(["TTKOM"])}
        disabledAssetCodes={new Set()}
        toggleLabel="Hariç Tut"
        onToggle={vi.fn()}
      />,
    )

    const rows = screen.getAllByRole("row").slice(1)
    expect(within(rows[0]).getByText("TTKOM")).toBeInTheDocument()
    expect(within(rows[1]).getByText("MGROS")).toBeInTheDocument()
  })

  it("pinnedAssets satırlarını listenin en üstünde, rozetle ve her zaman işaretli gösterir", () => {
    render(
      <AssetTogglePanel
        title="C · Dahil Edilmeyecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set()}
        disabledAssetCodes={new Set()}
        toggleLabel="Hariç Tut"
        onToggle={vi.fn()}
        pinnedAssets={[
          {
            assetId: "101",
            symbol: "AKBNK",
            name: "Akbank",
            sectorName: "Bankacılık",
          },
        ]}
        pinnedBadgeLabel="Yukarıdan"
      />,
    )

    const rows = screen.getAllByRole("row").slice(1)
    expect(within(rows[0]).getByText("AKBNK")).toBeInTheDocument()
    expect(within(rows[0]).getByText("Yukarıdan")).toBeInTheDocument()
    expect(within(rows[1]).getByText("MGROS")).toBeInTheDocument()

    expect(
      screen.getByRole("checkbox", {
        name: "AKBNK hissesi için Hariç Tut (B panelinden)",
      }),
    ).toBeChecked()
  })

  it("pinnedAssets satırına tıklayınca onTogglePinned'ı doğru assetId ile çağırır", async () => {
    const user = userEvent.setup()
    const onTogglePinned = vi.fn()

    render(
      <AssetTogglePanel
        title="C · Dahil Edilmeyecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set()}
        disabledAssetCodes={new Set()}
        toggleLabel="Hariç Tut"
        onToggle={vi.fn()}
        pinnedAssets={[
          {
            assetId: "101",
            symbol: "AKBNK",
            name: "Akbank",
            sectorName: "Bankacılık",
          },
        ]}
        onTogglePinned={onTogglePinned}
      />,
    )

    await user.click(
      screen.getByRole("checkbox", {
        name: "AKBNK hissesi için Hariç Tut (B panelinden)",
      }),
    )

    expect(onTogglePinned).toHaveBeenCalledWith("101")
  })

  it("pinnedAssets varsa arama sonucu boş olsa bile tabloyu gösterir", async () => {
    const user = userEvent.setup()

    render(
      <AssetTogglePanel
        title="C · Dahil Edilmeyecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set()}
        disabledAssetCodes={new Set()}
        toggleLabel="Hariç Tut"
        onToggle={vi.fn()}
        pinnedAssets={[
          {
            assetId: "101",
            symbol: "AKBNK",
            name: "Akbank",
            sectorName: "Bankacılık",
          },
        ]}
      />,
    )

    await user.type(screen.getByRole("searchbox"), "xyz-yok")

    expect(screen.getByText("AKBNK")).toBeInTheDocument()
    expect(
      screen.queryByText("Aramanızla eşleşen hisse bulunamadı."),
    ).not.toBeInTheDocument()
  })

  it("Ayrılan Ağırlık sütununu göstermez", () => {
    render(
      <AssetTogglePanel
        title="D · Zorunlu Eklenecek Hisseler"
        description="açıklama"
        assets={ASSETS}
        selectedAssetCodes={new Set()}
        disabledAssetCodes={new Set()}
        toggleLabel="Ekle"
        variant="forceAdd"
        onToggle={vi.fn()}
      />,
    )

    expect(screen.queryByText("Ayrılan Ağırlık")).not.toBeInTheDocument()
  })
})
