import { optimizationResultSchema } from "@/features/optimization/model/optimizationResultSchemas"
import type { OptimizationResult } from "@/features/optimization/model/optimizationResultSchemas"

export const PLACEHOLDER_OPTIMIZATION_RESULT: OptimizationResult =
  optimizationResultSchema.parse({
    generatedAt: "2026-08-07T09:00:00",
    assets: [
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
        rationale:
          "Son 3 ayda güçlü kazanç büyümesi ve sektör ortalamasının altında değerleme çarpanı nedeniyle ağırlık artırıldı.",
      },
      {
        assetCode: "ASELS",
        name: "Aselsan",
        sectorName: "Savunma",
        assetType: "EQUITY",
        currentWeight: 7,
        proposedWeight: 5,
        finalWeight: null,
        changeAmount: -2,
        actionType: "DECREASE",
        manuallyOverridden: false,
        rationale:
          "Sektör yoğunlaşma limitine yaklaşıldığı için ağırlık azaltıldı.",
      },
      {
        assetCode: "BIMAS",
        name: "BİM",
        sectorName: "Perakende Ticaret",
        assetType: "EQUITY",
        currentWeight: 6,
        proposedWeight: 6,
        finalWeight: null,
        changeAmount: 0,
        actionType: "KEEP",
        manuallyOverridden: false,
        rationale:
          "Mevcut ağırlık risk-getiri dengesini hâlihazırda optimum seviyede koruyor.",
      },
      {
        assetCode: "MGROS",
        name: "Migros",
        sectorName: "Perakende Ticaret",
        assetType: "EQUITY",
        currentWeight: 4,
        proposedWeight: 3,
        finalWeight: null,
        changeAmount: -1,
        actionType: "DECREASE",
        manuallyOverridden: false,
        rationale:
          "Perakende Ticaret sektöründeki toplam ağırlığı %30 sınırının altında tutmak için azaltıldı.",
      },
      {
        assetCode: "KOZAL",
        name: "Koza Altın",
        sectorName: "Madencilik",
        assetType: "EQUITY",
        currentWeight: 0,
        proposedWeight: 2,
        finalWeight: null,
        changeAmount: 2,
        actionType: "INCREASE",
        manuallyOverridden: false,
        rationale:
          "Zorunlu eklenecek hisseler arasında; sistem en az %1 ağırlık ayırıp portföy çeşitliliğini artırdı.",
      },
      {
        assetCode: "TPP1G",
        name: "TPP Getiri Endeksi",
        sectorName: null,
        assetType: "TPP",
        currentWeight: 8,
        proposedWeight: 10,
        finalWeight: null,
        changeAmount: 2,
        actionType: "INCREASE",
        manuallyOverridden: false,
        rationale:
          "TPP ağırlık aralığı kısıtı (%5–%15) gereği pay artırılarak orta noktaya yaklaştırıldı.",
      },
    ],
  })
