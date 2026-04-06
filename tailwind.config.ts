import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        "auth-panel": {
          DEFAULT: "hsl(var(--auth-panel))",
          foreground: "hsl(var(--auth-panel-foreground))",
          muted: "hsl(var(--auth-panel-muted))",
        },
        brand: {
          blue: "hsl(var(--brand-blue))",
          red: "hsl(var(--brand-red))",
          /** Aksen merah brand (sama dengan --brand-red); pakai untuk tekanan visual selain destructive penuh */
          accent: "hsl(var(--brand-red))",
          white: "hsl(var(--brand-white))",
          "blue-deep": "hsl(var(--brand-blue-deep))",
          "blue-soft": "hsl(var(--brand-blue-soft))",
          "blue-on-soft": "hsl(var(--brand-blue-on-soft))",
        },
        surface: {
          subtle: "hsl(var(--surface-subtle))",
          muted: "hsl(var(--surface-muted))",
          raised: "hsl(var(--surface-raised))",
          border: "hsl(var(--surface-border))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          muted: "hsl(var(--success-muted))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          muted: "hsl(var(--warning-muted))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          muted: "hsl(var(--info-muted))",
        },
        "neutral-status": {
          DEFAULT: "hsl(var(--neutral-status))",
          muted: "hsl(var(--neutral-muted))",
        },
        okr: {
          company: "hsl(var(--okr-company))",
          department: "hsl(var(--okr-department))",
          individual: "hsl(var(--okr-individual))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
            opacity: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
            opacity: "1",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
            opacity: "1",
          },
          to: {
            height: "0",
            opacity: "0",
          },
        },
        "dialog-overlay-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "dialog-overlay-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "dialog-content-in": {
          from: {
            opacity: "0",
            transform: "translate(-50%, -50%) translateY(10px) scale(0.96)",
          },
          to: {
            opacity: "1",
            transform: "translate(-50%, -50%) translateY(0) scale(1)",
          },
        },
        "dialog-content-out": {
          from: {
            opacity: "1",
            transform: "translate(-50%, -50%) translateY(0) scale(1)",
          },
          to: {
            opacity: "0",
            transform: "translate(-50%, -50%) translateY(6px) scale(0.98)",
          },
        },
        "dialog-content-in-fs": {
          from: {
            opacity: "0",
            transform: "translateY(12px) scale(0.98)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0) scale(1)",
          },
        },
        "dialog-content-out-fs": {
          from: {
            opacity: "1",
            transform: "translateY(0) scale(1)",
          },
          to: {
            opacity: "0",
            transform: "translateY(8px) scale(0.98)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        "accordion-up": "accordion-up 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        "dialog-overlay-in": "dialog-overlay-in 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        "dialog-overlay-out": "dialog-overlay-out 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
        "dialog-content-in": "dialog-content-in 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "dialog-content-out": "dialog-content-out 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        "dialog-content-in-fs": "dialog-content-in-fs 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "dialog-content-out-fs": "dialog-content-out-fs 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
