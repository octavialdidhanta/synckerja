import * as React from "react"
import { Capacitor } from "@capacitor/core"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false
    // Capacitor Android/iOS: WebView innerWidth can exceed 768 in edge cases; sidebar must use sheet mode.
    if (Capacitor.isNativePlatform()) return true
    return window.innerWidth < MOBILE_BREAKPOINT
  })

  React.useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setIsMobile(true)
      return
    }
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
