export type RunRlStressTestRequest = {
    fundId: string
    scenarioCode: string
}

export type RlInferenceDay = {
    day_number: number
    date: string
    total_new_nav: number
    passive_nav: number
    weights: Record<string, number>
}

export type RlInferenceResponse = {
    model: string
    scenario: string
    scenario_start_date: string
    scenario_end_date: string
    trading_day_count: number
    initial_nav: number
    days: RlInferenceDay[]
    final_nav: number
    return_pct: number
    passive_final_nav: number
    passive_return_pct: number
    outperformance_amount: number
    outperformance_pct: number
    total_commission: number
}
export type RlStressTestHistoryItem = {
    id: string
    model: string
    scenarioCode: string
    initialNav: number
    finalNav: number
    returnPct: number
    passiveReturnPct: number
    outperformancePct: number
    createdAt: string
}

export type RlStressTestDayResponse = {
    dayNumber: number
    date: string
    rlNav: number
    passiveNav: number
    weights: Record<string, number>
}

export type RlStressTestDetailResponse = {
    id: string
    model: string
    scenarioCode: string
    scenarioStartDate: string
    scenarioEndDate: string
    tradingDayCount: number
    initialNav: number
    finalNav: number
    returnPct: number
    passiveFinalNav: number
    passiveReturnPct: number
    outperformanceAmount: number
    outperformancePct: number
    totalCommission: number
    days: RlStressTestDayResponse[]
    createdAt: string
}