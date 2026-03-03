import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const isRtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      dir={isRtl ? "rtl" : "ltr"}
      position={isRtl ? "bottom-left" : "bottom-right"}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
