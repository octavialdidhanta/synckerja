import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Di bawah jam/baterai, di atas konten. env sering 0 di WebView; variabel plugin yang dipakai. */
const ANDROID_TOAST_TOP =
  "max(12px, env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [androidNative, setAndroidNative] = useState(false);

  useEffect(() => {
    setAndroidNative(Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");
  }, []);

  const androidOffset = androidNative
    ? { top: ANDROID_TOAST_TOP, right: "16px", bottom: "16px", left: "16px" }
    : undefined;

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={androidNative ? "top-center" : "bottom-right"}
      offset={androidOffset}
      mobileOffset={androidOffset}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
