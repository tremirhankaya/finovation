import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import UserEditModal from "@/features/users/components/UserEditModal"

const COMPANY_MANAGER_USER = {
  id: 2,
  username: "admin",
  firstName: "Admin",
  lastName: "User",
  fullName: "Admin User",
  email: "admin@example.com",
  companyId: 7,
  companyName: "Infina",
  role: "COMPANY_MANAGER" as const,
  status: "ACTIVE" as const,
  createdAt: "2026-08-03T00:00:00",
}

describe("UserEditModal", () => {
  it("şirketli COMPANY_MANAGER için desteklenmeyen ADMIN geçişini sunmaz", () => {
    render(
      <UserEditModal
        open
        user={COMPANY_MANAGER_USER}
        currentUserId={1}
        actorRole="ADMIN"
        assignableRoles={["COMPANY_MANAGER", "ADMIN"]}
        companies={[{ id: 7, name: "Infina" }]}
        companiesLoading={false}
        companiesError=""
        onClose={vi.fn()}
        onSave={vi.fn()}
        onErrorDismiss={vi.fn()}
        onRetryCompanies={vi.fn()}
      />,
    )

    const roleSelect = screen.getByLabelText(/Rol/)
    expect(roleSelect).toHaveValue("COMPANY_MANAGER")
    expect(
      screen.queryByRole("option", { name: "Admin" }),
    ).not.toBeInTheDocument()
  })
})
