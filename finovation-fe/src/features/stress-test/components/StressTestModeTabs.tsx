import { NavLink } from "react-router"

import styles from "@/features/stress-test/styles/StressTestModeTabs.module.css"

export default function StressTestModeTabs() {
    return (
        <nav
            className={styles.tabs}
            aria-label="Stres testi analiz türü"
        >
            <NavLink
                to="/stress-test"
                end
                className={({ isActive }) =>
                    `${styles.tab} ${isActive ? styles.active : ""}`
                }
            >
                Senaryo Bazlı Analiz
            </NavLink>

            <NavLink
                to="/stress-test/rl"
                className={({ isActive }) =>
                    `${styles.tab} ${isActive ? styles.active : ""}`
                }
            >
                RL Dinamik Analiz
            </NavLink>
        </nav>
    )
}