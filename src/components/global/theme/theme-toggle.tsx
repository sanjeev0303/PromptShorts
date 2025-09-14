"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("light")
    }
  }

  const getIcon = () => {
    if (theme === "light") {
      return <Sun className="h-[1.2rem] w-[1.2rem]" />
    } else if (theme === "dark") {
      return <Moon className="h-[1.2rem] w-[1.2rem]" />
    } else {
      return <Monitor className="h-[1.2rem] w-[1.2rem]" />
    }
  }

  const getTooltipText = () => {
    if (theme === "light") {
      return "Switch to dark theme"
    } else if (theme === "dark") {
      return "Switch to system theme"
    } else {
      return "Switch to light theme"
    }
  }

  if (!mounted) {
    return (
      <Button variant="outline" size="icon">
        <Sun className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={cycleTheme}
      title={getTooltipText()}
    >
      {getIcon()}
      <span className="sr-only">Toggle theme: {theme || "system"}</span>
    </Button>
  )
}
