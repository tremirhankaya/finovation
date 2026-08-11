import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import AssetComparisonPanel from "@/features/optimization/components/AssetComparisonPanel"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"

const ASSETS: OptimizationResultAsset[] = [
  {
    assetCode: "AKBNK",
    name: "Akbank",
    sectorName: "Bankacılık",
    assetType: "EQUITY",
    currentWeight: 8,
    proposedWeight: 9.5,
    finalWeight: null,
    changeAmount: 1.5,
    actionType: "INCREASE",
    manuallyOverridden: false,
    rationale: "Güçlü kazanç büyümesi.",
    userLocked: false,
  },
  {
    assetCode: "ASELS",
    name: "Aselsan",
    sectorName: "Savunma",
    assetType: "EQUITY",
    currentWeight: 7,
    proposedWeight: 5,
    finalWeight: 4,
    changeAmount: -2,
    actionType: "DECREASE",
    manuallyOverridden: true,
    rationale: "Sektör yoğunlaşma limiti.",
    userLocked: false,
  },
  {
    assetCode: "THYAO",
    name: "Türk Hava Yolları",
    sectorName: "Ulaştırma",
    assetType: "EQUITY",
    currentWeight: 6,
    proposedWeight: 6,
    finalWeight: null,
    changeAmount: 0,
    actionType: "KEEP",
    manuallyOverridden: false,
    rationale: null,
    userLocked: true,
  },
]

const ROUNDING_MISMATCH_ASSETS: OptimizationResultAsset[] = [
  {
    assetCode: "TCELL",
    name: "Turkcell",
    sectorName: "Telekomünikasyon",
    assetType: "EQUITY",
    currentWeight: 6.3,
    proposedWeight: 6.4,
    finalWeight: null,
    changeAmount: 0.1,
    actionType: "INCREASE",
    manuallyOverridden: false,
    rationale: "Model içi küçük yeniden dengeleme.",
    userLocked: false,
  },
  {
    assetCode: "HALKB",
    name: "T. Halk Bankası",
    sectorName: "Bankalar",
    assetType: "EQUITY",
    currentWeight: 6.4,
    proposedWeight: 6.9,
    finalWeight: null,
    changeAmount: 0.5,
    actionType: "KEEP",
    manuallyOverridden: false,
    rationale: null,
    userLocked: true,
  },
]

describe("AssetComparisonPanel", () => {
  it("mevcut, önerilen ve değişim değerlerini gösterir", () => {
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    expect(screen.getByText("AKBNK")).toBeInTheDocument()
    expect(screen.getAllByText("%8")[0]).toBeInTheDocument()
    expect(screen.getByText("+%2")).toBeInTheDocument()
    expect(screen.getByText("-%3")).toBeInTheDocument()
  })

  it("sabit tutulan hissede SABİT rozetini gösterir", () => {
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    expect(screen.getByText("SABİT")).toBeInTheDocument()
  })

  it("actionType KEEP olsa da kullanıcı Koru ile seçmediyse SABİT rozeti göstermez", () => {
    const notUserLockedButUnchanged: OptimizationResultAsset[] = [
      {
        assetCode: "EREGL",
        name: "Ereğli Demir Çelik",
        sectorName: "Ana Metal Sanayi",
        assetType: "EQUITY",
        currentWeight: 4,
        proposedWeight: 4,
        finalWeight: null,
        changeAmount: 0,
        actionType: "KEEP",
        manuallyOverridden: false,
        rationale: null,
        userLocked: false,
      },
    ]

    render(
      <AssetComparisonPanel
        assets={notUserLockedButUnchanged}
        fundName="Test Fonu"
      />,
    )

    expect(screen.queryByText("SABİT")).not.toBeInTheDocument()
  })

  it("varlık başlığı Hisse değil Varlık yazar", () => {
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    expect(
      screen.getByRole("columnheader", { name: "Varlık" }),
    ).toBeInTheDocument()
  })

  it("filtre çipleri ile listeyi daraltır", async () => {
    const user = userEvent.setup()
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    await user.click(
      screen.getByRole("tab", { name: /Artırılanlar/ }),
    )

    expect(screen.getByText("AKBNK")).toBeInTheDocument()
    expect(screen.queryByText("ASELS")).not.toBeInTheDocument()
  })

  it("toplam satırını gösterir", () => {
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    expect(screen.getByText("TOPLAM")).toBeInTheDocument()
  })

  it("düzenlenebilir modda final ağırlık kutusu değiştiğinde onFinalWeightChange'i çağırır", () => {
    const onFinalWeightChange = vi.fn()

    render(
      <AssetComparisonPanel
        assets={ASSETS}
        fundName="Test Fonu"
        editable
        onFinalWeightChange={onFinalWeightChange}
        onResetFinalWeight={vi.fn()}
      />,
    )

    const input = screen.getByRole("spinbutton", {
      name: "AKBNK final ağırlığı",
    })
    fireEvent.change(input, { target: { value: "11" } })

    expect(onFinalWeightChange).toHaveBeenCalledWith("AKBNK", 11)
  })

  it("düzenlenebilir modda sıfırla butonuna tıklanınca onResetFinalWeight'i doğru kodla çağırır", async () => {
    const user = userEvent.setup()
    const onResetFinalWeight = vi.fn()

    render(
      <AssetComparisonPanel
        assets={ASSETS}
        fundName="Test Fonu"
        editable
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={onResetFinalWeight}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Manuel · Sıfırla" }))

    expect(onResetFinalWeight).toHaveBeenCalledWith("ASELS")
  })

  it("düzenlenebilir modda final ağırlık kutusu ham ondalık yerine 1 haneye yuvarlanmış gösterir", () => {
    const rawWeightAssets: OptimizationResultAsset[] = [
      {
        assetCode: "MGROS",
        name: "Migros",
        sectorName: "Perakende Ticaret",
        assetType: "EQUITY",
        currentWeight: 9,
        proposedWeight: 9.5657,
        finalWeight: null,
        changeAmount: 0.5657,
        actionType: "INCREASE",
        manuallyOverridden: false,
        rationale: null,
        userLocked: false,
      },
    ]

    render(
      <AssetComparisonPanel
        assets={rawWeightAssets}
        fundName="Test Fonu"
        editable
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("spinbutton", { name: "MGROS final ağırlığı" }),
    ).toHaveValue(9.6)
  })

  it("final ağırlık kutusunda min/max sınırları vardır", () => {
    render(
      <AssetComparisonPanel
        assets={ASSETS}
        fundName="Test Fonu"
        editable
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={vi.fn()}
      />,
    )

    const input = screen.getByRole("spinbutton", {
      name: "AKBNK final ağırlığı",
    })
    expect(input).toHaveAttribute("min", "0")
    expect(input).toHaveAttribute("max", "100")
  })

  it("odaklıyken yazdığın ondalık değer anlık yuvarlanıp elinden alınmaz", async () => {
    const user = userEvent.setup()

    render(
      <AssetComparisonPanel
        assets={ASSETS}
        fundName="Test Fonu"
        editable
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={vi.fn()}
      />,
    )

    const input = screen.getByRole("spinbutton", {
      name: "AKBNK final ağırlığı",
    })
    await user.clear(input)
    await user.type(input, "9.55")

    expect(input).toHaveValue(9.55)
  })

  it("toplam %100'den saptığında düzenleme modunda uyarı gösterir, düzenleme dışında göstermez", () => {
    const { rerender } = render(
      <AssetComparisonPanel
        assets={ASSETS}
        fundName="Test Fonu"
        editable
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={vi.fn()}
      />,
    )

    expect(screen.getByText("Toplam %100 olmalı")).toBeInTheDocument()

    rerender(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    expect(screen.queryByText("Toplam %100 olmalı")).not.toBeInTheDocument()
  })

  it("Tümünü Sıfırla butonu sadece manuel değişiklik varken görünür ve onResetAllFinalWeights'i çağırır", async () => {
    const user = userEvent.setup()
    const onResetAllFinalWeights = vi.fn()

    const { rerender } = render(
      <AssetComparisonPanel
        assets={ASSETS.map((asset) => ({
          ...asset,
          manuallyOverridden: false,
        }))}
        fundName="Test Fonu"
        editable
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={vi.fn()}
        onResetAllFinalWeights={onResetAllFinalWeights}
      />,
    )

    expect(
      screen.queryByRole("button", { name: "Tümünü Sıfırla" }),
    ).not.toBeInTheDocument()

    rerender(
      <AssetComparisonPanel
        assets={ASSETS}
        fundName="Test Fonu"
        editable
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={vi.fn()}
        onResetAllFinalWeights={onResetAllFinalWeights}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Tümünü Sıfırla" }))

    expect(onResetAllFinalWeights).toHaveBeenCalledTimes(1)
  })

  it("düzenlenebilir değilken final ağırlık salt metin olarak görünür", () => {
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
  })

  it("grafik görünümüne geçince sektör tablosunu gösterir", async () => {
    const user = userEvent.setup()
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    await user.click(screen.getByRole("button", { name: "Grafik" }))

    expect(screen.getByText("Mevcut Portföy")).toBeInTheDocument()
    expect(screen.getByText("Optimize Edilmiş Portföy")).toBeInTheDocument()
  })

  it("sektör filtresiyle sadece seçilen sektördeki hisseleri gösterir", async () => {
    const user = userEvent.setup()
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    await user.selectOptions(
      screen.getByLabelText("Sektöre göre filtrele"),
      "Savunma",
    )

    expect(screen.getByText("ASELS")).toBeInTheDocument()
    expect(screen.queryByText("AKBNK")).not.toBeInTheDocument()
    expect(screen.queryByText("THYAO")).not.toBeInTheDocument()
  })

  it("Mevcut Ağırlık başlığına tıklayınca artan, tekrar tıklayınca azalan sıralar", async () => {
    const user = userEvent.setup()
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    const bodyRows = () => screen.getAllByRole("row").slice(1, -1)

    await user.click(
      screen.getByRole("button", { name: /Mevcut Ağırlık/ }),
    )
    let rows = bodyRows()
    expect(rows[0]?.textContent).toContain("THYAO")
    expect(rows[1]?.textContent).toContain("ASELS")
    expect(rows[2]?.textContent).toContain("AKBNK")

    await user.click(
      screen.getByRole("button", { name: /Mevcut Ağırlık/ }),
    )
    rows = bodyRows()
    expect(rows[0]?.textContent).toContain("AKBNK")
    expect(rows[1]?.textContent).toContain("ASELS")
    expect(rows[2]?.textContent).toContain("THYAO")
  })

  it("kilitli (Koru) hisse Sabit Kalanlar sekmesinde görünür, Değişmeyenler'de görünmez", async () => {
    const user = userEvent.setup()
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    await user.click(screen.getByRole("tab", { name: /Sabit Kalanlar/ }))
    expect(screen.getByText("THYAO")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /Değişmeyenler/ }))
    expect(screen.queryByText("THYAO")).not.toBeInTheDocument()
  })

  it("kullanıcı Koru ile seçmediği ama ağırlığı değişmeyen hisse Değişmeyenler'de görünür, Sabit Kalanlar'da görünmez", async () => {
    const user = userEvent.setup()
    const notUserLockedButUnchanged: OptimizationResultAsset[] = [
      {
        assetCode: "EREGL",
        name: "Ereğli Demir Çelik",
        sectorName: "Ana Metal Sanayi",
        assetType: "EQUITY",
        currentWeight: 4,
        proposedWeight: 4,
        finalWeight: null,
        changeAmount: 0,
        actionType: "KEEP",
        manuallyOverridden: false,
        rationale: null,
        userLocked: false,
      },
    ]
    render(
      <AssetComparisonPanel
        assets={notUserLockedButUnchanged}
        fundName="Test Fonu"
      />,
    )

    await user.click(screen.getByRole("tab", { name: /Değişmeyenler/ }))
    expect(screen.getByText("EREGL")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /Sabit Kalanlar/ }))
    expect(screen.queryByText("EREGL")).not.toBeInTheDocument()
  })

  it("görünen ağırlığı değişmeyen hisse actionType INCREASE olsa bile Değişmeyenler'de görünür", async () => {
    const user = userEvent.setup()
    render(
      <AssetComparisonPanel
        assets={ROUNDING_MISMATCH_ASSETS}
        fundName="Test Fonu"
      />,
    )

    await user.click(screen.getByRole("tab", { name: /Artırılanlar/ }))
    expect(screen.queryByText("TCELL")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /Değişmeyenler/ }))
    expect(screen.getByText("TCELL")).toBeInTheDocument()
  })

  it("kilitli (Koru) hisse gerçek bir ağırlık farkı taşısa bile Artırılanlar'da değil Sabit Kalanlar'da görünür", async () => {
    const user = userEvent.setup()
    render(
      <AssetComparisonPanel
        assets={ROUNDING_MISMATCH_ASSETS}
        fundName="Test Fonu"
      />,
    )

    await user.click(screen.getByRole("tab", { name: /Artırılanlar/ }))
    expect(screen.queryByText("HALKB")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /Değişmeyenler/ }))
    expect(screen.queryByText("HALKB")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /Sabit Kalanlar/ }))
    expect(screen.getByText("HALKB")).toBeInTheDocument()
  })

  it("TPP varlığı sıralamadan bağımsız olarak her zaman listenin en altında görünür", async () => {
    const user = userEvent.setup()
    const assetsWithTpp: OptimizationResultAsset[] = [
      {
        assetCode: "TPP1G",
        name: "TPP",
        sectorName: null,
        assetType: "TPP",
        currentWeight: 12,
        proposedWeight: 10,
        finalWeight: null,
        changeAmount: -2,
        actionType: "DECREASE",
        manuallyOverridden: false,
        rationale: null,
        userLocked: false,
      },
      ...ASSETS,
    ]

    render(<AssetComparisonPanel assets={assetsWithTpp} fundName="Test Fonu" />)

    const bodyRows = () => screen.getAllByRole("row").slice(1, -1)
    expect(bodyRows().at(-1)?.textContent).toContain("TPP1G")

    await user.click(screen.getByRole("button", { name: /Mevcut Ağırlık/ }))
    expect(bodyRows().at(-1)?.textContent).toContain("TPP1G")

    await user.click(screen.getByRole("button", { name: /Değişim/ }))
    expect(bodyRows().at(-1)?.textContent).toContain("TPP1G")
  })

  it("Değişim başlığına tıklayınca değişim değerine göre sıralar", async () => {
    const user = userEvent.setup()
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    await user.click(screen.getByRole("button", { name: /Değişim/ }))

    const rows = screen.getAllByRole("row").slice(1, -1)
    expect(rows[0]?.textContent).toContain("ASELS")
    expect(rows[rows.length - 1]?.textContent).toContain("AKBNK")
  })
})
