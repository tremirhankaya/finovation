import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import AssetTogglePanel from "@/features/optimization/components/AssetTogglePanel"

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

    expect(screen.getByText(/MGROS Migros/)).toBeInTheDocument()
    expect(screen.getByText("Telekomünikasyon")).toBeInTheDocument()
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
})
