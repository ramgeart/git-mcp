import { createContext, useContext } from "react";
import type { CustomProviderConfig } from "../ai/providers.shared";
import { STORAGE_KEYS } from "../lib/constants";
import { useLocalStorage } from "../lib/hooks/use-local-storage";

const CustomProvidersContext = createContext<{
  customProviders: CustomProviderConfig[];
  setCustomProviders: (providers: CustomProviderConfig[]) => void;
}>({
  customProviders: [],
  setCustomProviders: () => {},
});

export function CustomProvidersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [customProviders, setCustomProviders] = useLocalStorage<
    CustomProviderConfig[]
  >(STORAGE_KEYS.CUSTOM_PROVIDERS, []);

  return (
    <CustomProvidersContext.Provider
      value={{ customProviders, setCustomProviders }}
    >
      {children}
    </CustomProvidersContext.Provider>
  );
}

export function useCustomProviders() {
  return useContext(CustomProvidersContext);
}
