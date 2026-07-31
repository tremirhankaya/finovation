import { useEffect, useId, useRef, useState, type ReactNode } from "react"

import type { CompanyListItem } from "@/type/company.types"
import type { UserListFilters, UserRole, UserStatus } from "@/type/user.types"
import { formatRoleLabel, formatStatusLabel } from "@/util/userLabels"
import styles from "@/pages/users/css/UserSearchToolbar.module.css"

type UserSearchToolbarProps = {
  query: string
  filters: UserListFilters
  companies: CompanyListItem[]
  onQueryChange: (value: string) => void
  onSearch: () => void
  onApplyFilters: (filters: UserListFilters) => void
}

const ROLE_OPTIONS: Array<"" | UserRole> = [
  "",
  "USER",
  "ADMIN",
  "SUPER_ADMIN",
]

const STATUS_OPTIONS: Array<"" | UserStatus> = ["", "ACTIVE", "INACTIVE"]

function roleLabel(role: "" | UserRole) {
  return role === "" ? "Tüm roller" : formatRoleLabel(role)
}

function statusLabel(status: "" | UserStatus) {
  return status === "" ? "Tüm durumlar" : formatStatusLabel(status)
}

function formatShortDate(value: string) {
  if (!value) {
    return ""
  }
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) {
    return value
  }
  return `${day}.${month}.${year}`
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

type MenuProps = {
  label: string
  value: string
  active?: boolean
  children: ReactNode
}

function FilterMenu({ label, value, active = false, children }: MenuProps) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div className={styles.menu} ref={rootRef}>
      <button
        className={`${styles.menuTrigger} ${active ? styles.menuTriggerActive : ""} ${open ? styles.menuTriggerOpen : ""}`}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.menuLabel}>{label}</span>
        <span className={styles.menuValue}>{value}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div className={styles.menuPanel} id={menuId} role="listbox">
          <div
            onClick={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                setOpen(false)
              }
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

type MenuOptionProps = {
  selected: boolean
  children: ReactNode
  onSelect: () => void
}

function MenuOption({ selected, children, onSelect }: MenuOptionProps) {
  return (
    <button
      className={`${styles.menuOption} ${selected ? styles.menuOptionSelected : ""}`}
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
    >
      <span>{children}</span>
      {selected && <span className={styles.check}>✓</span>}
    </button>
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

  const selectedCompanyName =
    filters.companyId === null
      ? "Tüm şirketler"
      : (companies.find((company) => company.id === filters.companyId)?.name ??
        "Şirket")

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
    if (!dateOpen) {
      return
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!dateRef.current?.contains(event.target as Node)) {
        setDateOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDateOpen(false)
      }
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
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
              if (event.key === "Enter") {
                onSearch()
              }
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

        <FilterMenu
          label="Rol"
          value={roleLabel(filters.role)}
          active={filters.role !== ""}
        >
          {ROLE_OPTIONS.map((role) => (
            <MenuOption
              key={role || "all"}
              selected={filters.role === role}
              onSelect={() => patchFilters({ role })}
            >
              {roleLabel(role)}
            </MenuOption>
          ))}
        </FilterMenu>

        <FilterMenu
          label="Durum"
          value={statusLabel(filters.status)}
          active={filters.status !== ""}
        >
          {STATUS_OPTIONS.map((status) => (
            <MenuOption
              key={status || "all"}
              selected={filters.status === status}
              onSelect={() => patchFilters({ status })}
            >
              {statusLabel(status)}
            </MenuOption>
          ))}
        </FilterMenu>

        {showCompanyFilter && (
          <FilterMenu
            label="Şirket"
            value={selectedCompanyName}
            active={filters.companyId !== null}
          >
            <MenuOption
              selected={filters.companyId === null}
              onSelect={() => patchFilters({ companyId: null })}
            >
              Tüm şirketler
            </MenuOption>
            {companies.map((company) => (
              <MenuOption
                key={company.id}
                selected={filters.companyId === company.id}
                onSelect={() => patchFilters({ companyId: company.id })}
              >
                {company.name}
              </MenuOption>
            ))}
          </FilterMenu>
        )}

        <div className={styles.menu} ref={dateRef}>
          <button
            className={`${styles.menuTrigger} ${filters.createdFrom || filters.createdTo ? styles.menuTriggerActive : ""} ${dateOpen ? styles.menuTriggerOpen : ""}`}
            type="button"
            aria-expanded={dateOpen}
            onClick={() => setDateOpen((current) => !current)}
          >
            <span className={styles.menuLabel}>Tarih</span>
            <span className={styles.menuValue}>{dateSummary}</span>
            <ChevronIcon />
          </button>

          {dateOpen && (
            <div className={`${styles.menuPanel} ${styles.datePanel}`}>
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
