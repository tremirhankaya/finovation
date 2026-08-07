import { type FormEvent, useEffect, useMemo, useState } from "react"

import FormAlert from "@/shared/ui/FormAlert"
import Dialog from "@/shared/ui/Dialog"
import type { CompanyListItem } from "@/features/users/model/company.types"
import styles from "@/features/users/styles/CompanyManagementCard.module.css"

const PAGE_SIZE = 10

type CompanyManagementCardProps = {
  companies: CompanyListItem[]
  isLoading: boolean
  loadError: string
  mutationError: string
  isCreating: boolean
  deletingCompanyId: number | null
  onRetry: () => void
  onCreate: (name: string) => Promise<boolean>
  onDelete: (companyId: number) => Promise<boolean>
  onDismissMutationError: () => void
}

export default function CompanyManagementCard({
  companies,
  isLoading,
  loadError,
  mutationError,
  isCreating,
  deletingCompanyId,
  onRetry,
  onCreate,
  onDelete,
  onDismissMutationError,
}: CompanyManagementCardProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [companyToDelete, setCompanyToDelete] =
    useState<CompanyListItem | null>(null)

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR")
    if (!normalizedQuery) return companies

    return companies.filter((company) =>
      company.name.toLocaleLowerCase("tr-TR").includes(normalizedQuery),
    )
  }, [companies, query])
  const totalPages = Math.ceil(filteredCompanies.length / PAGE_SIZE)
  const visibleCompanies = filteredCompanies.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  )

  useEffect(() => {
    const lastPage = Math.max(0, totalPages - 1)
    if (page > lastPage) setPage(lastPage)
  }, [page, totalPages])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedName = name.trim()

    if (!normalizedName) {
      setNameError("Şirket adı zorunludur.")
      return
    }

    setNameError("")
    if (await onCreate(normalizedName)) {
      setName("")
      setIsCreateOpen(false)
    }
  }

  const closeCreateModal = () => {
    if (isCreating) return
    setIsCreateOpen(false)
    setName("")
    setNameError("")
    onDismissMutationError()
  }

  const handleDelete = async () => {
    if (!companyToDelete) return
    if (await onDelete(companyToDelete.id)) {
      setCompanyToDelete(null)
    }
  }

  return (
    <section className={styles.card} aria-labelledby="companies-title">
      <div className={styles.header}>
        <div>
          <h2 id="companies-title">Şirketler</h2>
          <p>
            Sisteme şirket ekleyin veya şirket erişimini bağlı kullanıcılarıyla
            birlikte kaldırın.
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.count}>{companies.length} aktif şirket</span>
          <button
            className={styles.createButton}
            type="button"
            onClick={() => {
              setName("")
              setNameError("")
              onDismissMutationError()
              setIsCreateOpen(true)
            }}
          >
            + Yeni şirket
          </button>
        </div>
      </div>

      {!loadError && !isLoading && companies.length > 0 && (
        <div className={styles.searchBar}>
          <label htmlFor="company-search">Şirket adına göre ara</label>
          <input
            id="company-search"
            type="search"
            value={query}
            placeholder="Şirket adı ara"
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
          />
        </div>
      )}

      {loadError ? (
        <div className={styles.alert}>
          <FormAlert>
            {loadError}
            <button
              className={styles.retryButton}
              type="button"
              onClick={onRetry}
            >
              Tekrar dene
            </button>
          </FormAlert>
        </div>
      ) : isLoading ? (
        <p className={styles.state} role="status">
          Şirketler yükleniyor…
        </p>
      ) : companies.length === 0 ? (
        <p className={styles.state}>Henüz aktif bir şirket bulunmuyor.</p>
      ) : filteredCompanies.length === 0 ? (
        <p className={styles.state}>Aramanızla eşleşen şirket bulunamadı.</p>
      ) : (
        <>
          <ul className={styles.list}>
            {visibleCompanies.map((company) => (
              <li key={company.id}>
                <div className={styles.companyIdentity}>
                  <span className={styles.companyMark} aria-hidden="true">
                    {company.name.slice(0, 1).toLocaleUpperCase("tr-TR")}
                  </span>
                  <span>{company.name}</span>
                </div>
                <button
                  className={styles.deleteButton}
                  type="button"
                  aria-label={`${company.name} şirketini sil`}
                  disabled={deletingCompanyId !== null}
                  onClick={() => {
                    onDismissMutationError()
                    setCompanyToDelete(company)
                  }}
                >
                  Sil
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.pagination}>
            <p aria-live="polite">{filteredCompanies.length} şirket</p>
            <div>
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Önceki
              </button>
              <span>
                Sayfa {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Sonraki
              </button>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={isCreateOpen}
        className={styles.dialog}
        labelledBy="company-create-title"
        describedBy="company-create-description"
        isBusy={isCreating}
        onClose={closeCreateModal}
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.modalHead}>
            <div>
              <h2 id="company-create-title">Yeni şirket</h2>
              <p id="company-create-description">
                Sisteme eklenecek şirketin adını girin.
              </p>
            </div>
            <button
              className={styles.closeButton}
              type="button"
              aria-label="Kapat"
              disabled={isCreating}
              onClick={closeCreateModal}
            >
              ×
            </button>
          </div>

          {mutationError && (
            <div className={styles.alert}>
              <FormAlert>{mutationError}</FormAlert>
            </div>
          )}

          <div className={styles.inputGroup}>
            <label htmlFor="company-name">
              Şirket adı <span className={styles.required}>*</span>
            </label>
            <input
              id="company-name"
              value={name}
              maxLength={150}
              disabled={isCreating}
              autoComplete="organization"
              aria-invalid={nameError !== ""}
              aria-describedby={nameError ? "company-name-error" : undefined}
              placeholder="Örn. Finovation Portföy"
              onChange={(event) => {
                setName(event.target.value)
                setNameError("")
                onDismissMutationError()
              }}
            />
            {nameError && (
              <span id="company-name-error" className={styles.fieldError}>
                {nameError}
              </span>
            )}
          </div>

          <div className={styles.dialogActions}>
            <button
              className={styles.cancelButton}
              type="button"
              disabled={isCreating}
              onClick={closeCreateModal}
            >
              Vazgeç
            </button>
            <button
              className={styles.confirmCreateButton}
              type="submit"
              disabled={isCreating}
            >
              {isCreating ? "Ekleniyor…" : "Şirketi ekle"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={companyToDelete !== null}
        className={styles.dialog}
        role="alertdialog"
        labelledBy="company-delete-title"
        describedBy="company-delete-description"
        isBusy={deletingCompanyId !== null}
        onClose={() => setCompanyToDelete(null)}
      >
        <h2 id="company-delete-title">Şirketi sil</h2>
        <p id="company-delete-description">
          <strong>{companyToDelete?.name}</strong> şirketi ve bu şirkete bağlı
          tüm kullanıcılar silinecek. Bu kayıtlar yönetim ekranında tekrar
          gösterilmeyecek.
        </p>
        {mutationError && (
          <div className={styles.alert}>
            <FormAlert>{mutationError}</FormAlert>
          </div>
        )}
        <div className={styles.dialogActions}>
          <button
            className={styles.cancelButton}
            type="button"
            disabled={deletingCompanyId !== null}
            onClick={() => setCompanyToDelete(null)}
          >
            Vazgeç
          </button>
          <button
            className={styles.confirmDeleteButton}
            type="button"
            disabled={deletingCompanyId !== null}
            onClick={() => void handleDelete()}
          >
            {deletingCompanyId !== null ? "Siliniyor…" : "Şirketi sil"}
          </button>
        </div>
      </Dialog>
    </section>
  )
}
