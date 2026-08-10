export type DashboardIconName = "home" | "fund" | "draft" | "performance" | "optimization" | "stress" | "create" | "arrow" | "refresh"

export default function DashboardIcon({ name }: { name: DashboardIconName }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }

  if (name === "fund") {
    return (
      <svg {...commonProps}>
        <path d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M12 3l9 5H3l9-5Z" />
      </svg>
    )
  }

  if (name === "draft") {
    return (
      <svg {...commonProps}>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M14 3v4h4M9 12h6m-6 4h4" />
      </svg>
    )
  }

  if (name === "performance") {
    return (
      <svg {...commonProps}>
        <path d="M3 19h18M5 16l4-5 4 3 6-8" />
        <path d="M16 6h3v3" />
      </svg>
    )
  }

  if (name === "optimization") {
    return (
      <svg {...commonProps}>
        <path d="M4 6h10m4 0h2M4 12h4m4 0h8M4 18h13m4 0h-1" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="19" cy="18" r="2" />
      </svg>
    )
  }

  if (name === "stress") {
    return (
      <svg {...commonProps}>
        <path d="M3 12h4l2-6 4 12 2-6h6" />
        <path d="M4 21h16" />
      </svg>
    )
  }

  if (name === "create") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8m-4-4h8" />
      </svg>
    )
  }

  if (name === "arrow") {
    return (
      <svg {...commonProps}>
        <path d="m9 18 6-6-6-6" />
      </svg>
    )
  }

  if (name === "refresh") {
    return (
      <svg {...commonProps}>
        <path d="M20 6v5h-5M4 18v-5h5" />
        <path d="M18.5 9A7 7 0 0 0 6 6.5L4 9m2 6a7 7 0 0 0 12 2.5L20 15" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  )
}
