import { apiFetch } from "@/shared/api/httpClient"
import { getSystemLogsUrl } from "@/shared/api/apiConfig"

import type { SystemLog } from "../model/systemLogTypes"

export type SystemLogQuery = {
    service?: string
    level?: string
    search?: string
    limit?: number
}

export async function getSystemLogs(
    query: SystemLogQuery = {},
): Promise<SystemLog[]> {
    const params = new URLSearchParams()

    if (query.service) {
        params.set("service", query.service)
    }

    if (query.level) {
        params.set("level", query.level)
    }

    if (query.search) {
        params.set("search", query.search)
    }

    if (query.limit != null) {
        params.set("limit", String(query.limit))
    }

    const baseUrl = getSystemLogsUrl()
    const url = params.size > 0 ? `${baseUrl}?${params.toString()}` : baseUrl

    return apiFetch<SystemLog[]>(url, {
        method: "GET",
        errorMessage: "Log kayıtları alınamadı",
    })}