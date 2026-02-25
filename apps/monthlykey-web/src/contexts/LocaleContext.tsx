import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Locale = "ar" | "en";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: "rtl" | "ltr";
  t: (ar: string, en: string) => string;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "ar",
  setLocale: () => {},
  dir: "rtl",
  t: (ar) => ar,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem("mk_locale");
    return (saved === "en" ? "en" : "ar") as Locale;
  });

  const dir = locale === "ar" ? "rtl" : "ltr";

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("mk_locale", newLocale);
  };

  // Update document attributes when locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.title =
      locale === "ar"
        ? "المفتاح الشهري — منصة التأجير الشهري في السعودية"
        : "Monthly Key — Saudi Monthly Rental Platform";
  }, [locale, dir]);

  const t = (ar: string, en: string) => (locale === "ar" ? ar : en);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, dir, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
