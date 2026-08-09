import { useEffect, useRef, useState } from "react"

import {
  formatRoleLabel,
  formatStatusLabel,
} from "@/features/users/lib/userLabels"
import type { CompanyListItem } from "@/features/users/model/company.types"
import type {
  UserListFilters,
  UserRole,
  UserStatus,
} from "@/features/users/model/user.types"
import styles from "@/features/users/styles/UserSearchToolbar.module.css"

type UserSearchToolbarProps = {
  query: string
  filters: UserListFilters
  companies: CompanyListItem[]
  onQueryChange: (value: string) => void
  onSearch: () => void
  onApplyFilters: (filters: UserListFilters) => void
}

const ROLE_OPTIONS: UserRole[] = ["USER", "COMPANY_MANAGER", "ADMIN"]
const STATUS_OPTIONS: UserStatus[] = ["ACTIVE", "INACTIVE"]

function formatShortDate(value: string) {
  if (!value) return ""

  const [year, month, day] = value.split("-")
  return year && month && day ? `${day}.${month}.${year}` : value
}

function ChevronIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export default function UserSearchToolbar({
  query,
  filters,
  companies,
  onQueryChange,
  onSearch,
  onApplyFilters,
}: UserSearchToolbarProps) {
  const [dateOpen, setDateOpen] = useState(false)
  const dateRef = useRef<HTMLDivElement>(null)

  const hasActiveFilters =
    filters.role !== "" ||
    filters.status !== "" ||
    filters.companyId !== null ||
    filters.createdFrom !== "" ||
    filters.createdTo !== ""
  const showCompanyFilter = companies.length > 1
  const dateSummary =
    filters.createdFrom || filters.createdTo
      ? `${formatShortDate(filters.createdFrom) || "…"} – ${formatShortDate(filters.createdTo) || "…"}`
      : "Tüm tarihler"

  const patchFilters = (patch: Partial<UserListFilters>) => {
    onApplyFilters({
      ...filters,
      q: query.trim(),
      ...patch,
    })
  }

  const clearFilters = () => {
    onApplyFilters({
      q: query.trim(),
      role: "",
      status: "",
      companyId: null,
      createdFrom: "",
      createdTo: "",
    })
  }

  useEffect(() => {
    if (!dateOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (!dateRef.current?.contains(event.target as Node)) {
        setDateOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDateOpen(false)
    }

    document.addEventListener("mousedown", handleOutsideClick)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [dateOpen])

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <label className={styles.search}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch()
            }}
            placeholder="Kullanıcı ara"
            aria-label="Kullanıcı ara"
          />
        </label>

        <button
          className={styles.searchButton}
          type="button"
          onClick={onSearch}
        >
          Ara
        </button>

        <div className={styles.divider} aria-hidden="true" />

        <label className={styles.filterField}>
          <span>Rol</span>
          <select
            value={filters.role}
            onChange={(event) =>
              patchFilters({ role: event.target.value as "" | UserRole })
            }
          >
            <option value="">Tüm roller</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {formatRoleLabel(role)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Durum</span>
          <select
            value={filters.status}
            onChange={(event) =>
              patchFilters({ status: event.target.value as "" | UserStatus })
            }
          >
            <option value="">Tüm durumlar</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>

        {showCompanyFilter && (
          <label className={styles.filterField}>
            <span>Şirket</span>
            <select
              value={filters.companyId ?? ""}
              onChange={(event) =>
                patchFilters({
                  companyId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            >
              <option value="">Tüm şirketler</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className={styles.menu} ref={dateRef}>
          <button
            className={`${styles.menuTrigger} ${
              filters.createdFrom || filters.createdTo
                ? styles.menuTriggerActive
                : ""
            } ${dateOpen ? styles.menuTriggerOpen : ""}`}
            type="button"
            aria-expanded={dateOpen}
            aria-controls="user-date-filter"
            onClick={() => setDateOpen((current) => !current)}
          >
            <span className={styles.menuLabel}>Tarih</span>
            <span className={styles.menuValue}>{dateSummary}</span>
            <ChevronIcon />
          </button>

          {dateOpen && (
            <div
              className={`${styles.menuPanel} ${styles.datePanel}`}
              id="user-date-filter"
            >
              <label className={styles.dateField}>
                <span>Başlangıç</span>
                <input
                  type="date"
                  value={filters.createdFrom}
                  max={filters.createdTo || undefined}
                  onChange={(event) =>
                    patchFilters({ createdFrom: event.target.value })
                  }
                />
              </label>
              <label className={styles.dateField}>
                <span>Bitiş</span>
                <input
                  type="date"
                  value={filters.createdTo}
                  min={filters.createdFrom || undefined}
                  onChange={(event) =>
                    patchFilters({ createdTo: event.target.value })
                  }
                />
              </label>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button
            className={styles.clearButton}
            type="button"
            onClick={clearFilters}
          >
            Temizle
          </button>
        )}
      </div>
    </div>
  )
}
