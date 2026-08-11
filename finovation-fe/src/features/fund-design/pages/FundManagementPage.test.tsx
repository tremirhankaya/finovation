import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fundDraftApiMocks = vi.hoisted(() => ({
  archiveFundDraft: vi.fn(),
  cloneDeletedFundDraft: vi.fn(),
  listArchivedFundDrafts: vi.fn(),
  searchFundDrafts: vi.fn(),
  updateFundDraftPinStatus: vi.fn(),
}))

vi.mock("@/features/fund-design/api/fundDraftApi", () => fundDraftApiMocks)

import FundManagementPage from "@/features/fund-design/pages/FundManagementPage"

const EMPTY_PAGE = {
  content: [],
  page: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

describe("FundManagementPage dashboard deep link", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fundDraftApiMocks.searchFundDrafts.mockResolvedValue(EMPTY_PAGE)
    fundDraftApiMocks.listArchivedFundDrafts.mockResolvedValue([])
  })

  it("tab=drafts sorgusuyla taslakları açar ve sekme değişimini URL'ye yansıtır", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={["/fund-design?tab=drafts"]}>
        <Routes>
          <Route
            path="/fund-design"
            element={
              <>
                <FundManagementPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(fundDraftApiMocks.searchFundDrafts).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "IN_PROGRESS",
          sortBy: "UPDATED_AT",
        }),
        expect.any(AbortSignal),
      ),
    )
    expect(screen.getByTestId("location")).toHaveTextContent("?tab=drafts")

    await user.click(screen.getByRole("button", { name: /Fonlar/ }))
    expect(screen.getByTestId("location")).toHaveTextContent("")
  })
})
