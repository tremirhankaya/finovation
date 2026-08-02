import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import UserSearchToolbar from "@/features/users/components/UserSearchToolbar"
import type { UserListFilters } from "@/features/users/model/user.types"

const FILTERS: UserListFilters = {
  q: "",
  role: "",
  status: "",
  companyId: null,
  createdFrom: "",
  createdTo: "",
}

describe("UserSearchToolbar", () => {
  it("rol filtresini arama metniyle birlikte uygular", async () => {
    const onApplyFilters = vi.fn()
    render(
      <UserSearchToolbar
        query="  batuhan  "
        filters={FILTERS}
        companies={[]}
        onQueryChange={vi.fn()}
        onSearch={vi.fn()}
        onApplyFilters={onApplyFilters}
      />,
    )

    await userEvent.selectOptions(screen.getByLabelText("Rol"), "ADMIN")

    expect(onApplyFilters).toHaveBeenCalledWith({
      ...FILTERS,
      q: "batuhan",
      role: "ADMIN",
    })
  })

  it("birden fazla şirket olduğunda şirket filtresini gösterir", () => {
    render(
      <UserSearchToolbar
        query=""
        filters={FILTERS}
        companies={[
          { id: 1, name: "Infina" },
          { id: 2, name: "Finovation" },
        ]}
        onQueryChange={vi.fn()}
        onSearch={vi.fn()}
        onApplyFilters={vi.fn()}
      />,
    )

    expect(screen.getByLabelText("Şirket")).toBeInTheDocument()
  })
})
