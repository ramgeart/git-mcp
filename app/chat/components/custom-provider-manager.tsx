import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/chat/components/ui/dialog";
import { Button } from "~/chat/components/ui/button";
import { Input } from "~/chat/components/ui/input";
import { Label } from "~/chat/components/ui/label";
import { toast } from "sonner";
import type {
  CustomProviderConfig,
  CustomModelInfo,
} from "../ai/providers.shared";
import { Plus, Trash2, RefreshCw, Edit } from "lucide-react";
import { Badge } from "~/chat/components/ui/badge";

interface CustomProviderManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: CustomProviderConfig[];
  onProvidersChange: (providers: CustomProviderConfig[]) => void;
}

export function CustomProviderManager({
  open,
  onOpenChange,
  providers,
  onProvidersChange,
}: CustomProviderManagerProps) {
  const [editingProvider, setEditingProvider] =
    useState<CustomProviderConfig | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    baseURL: "",
    apiKey: "",
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!showAddDialog && !editingProvider) {
      setFormData({ name: "", baseURL: "", apiKey: "" });
    }
  }, [showAddDialog, editingProvider]);

  // Load form data when editing a provider
  useEffect(() => {
    if (editingProvider) {
      setFormData({
        name: editingProvider.name,
        baseURL: editingProvider.baseURL,
        apiKey: editingProvider.apiKey,
      });
      setShowAddDialog(true);
    }
  }, [editingProvider]);

  // Fetch models from provider's /models endpoint
  const fetchModels = useCallback(
    async (baseURL: string, apiKey: string): Promise<CustomModelInfo[]> => {
      // Construct URL properly
      const urlObj = new URL(baseURL);
      urlObj.pathname = urlObj.pathname.replace(/\/+$/, "") + "/models";
      const url = urlObj.toString();

      // Create an AbortController with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }

        interface ModelResponse {
          id: string;
          description?: string;
        }

        const data: unknown = await response.json();

        // Validate response structure
        if (
          !data ||
          typeof data !== "object" ||
          !("data" in data) ||
          !Array.isArray((data as any).data)
        ) {
          throw new Error("Invalid response format from provider");
        }

        // OpenAI API format: { data: [ { id: "model-id", ... }, ... ] }
        const models = (data as any).data;
        return models
          .filter(
            (model: any): model is ModelResponse =>
              typeof model === "object" &&
              model !== null &&
              typeof model.id === "string" &&
              model.id.length > 0,
          )
          .map((model: ModelResponse) => ({
            id: model.id,
            name: model.id,
            description: model.description || "",
            capabilities: [],
          }));
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Request timed out. Please check your provider URL.");
        }
        if (error instanceof TypeError && error.message.includes("fetch")) {
          throw new Error(
            "Network error. This may be due to CORS restrictions or an invalid URL.",
          );
        }
        console.error("Error fetching models:", error);
        throw error;
      }
    },
    [],
  );

  // Add or update provider
  const handleSaveProvider = useCallback(async () => {
    // Validate and clean input
    const trimmedName = formData.name.trim();
    const trimmedBaseURL = formData.baseURL.trim();
    const trimmedApiKey = formData.apiKey.trim();

    if (!trimmedName || !trimmedBaseURL || !trimmedApiKey) {
      toast.error("Please fill in all fields");
      return;
    }

    // Validate URL format
    try {
      new URL(trimmedBaseURL);
    } catch {
      toast.error("Please enter a valid URL for the base URL");
      return;
    }

    // Check for duplicate provider names (excluding current if editing)
    const duplicateName = providers.find(
      (p) =>
        p.name.toLowerCase() === trimmedName.toLowerCase() &&
        p.id !== editingProvider?.id,
    );
    if (duplicateName) {
      toast.error("A provider with this name already exists");
      return;
    }

    // Validate reasonable length limits
    if (trimmedName.length > 100) {
      toast.error("Provider name is too long (max 100 characters)");
      return;
    }
    if (trimmedBaseURL.length > 500) {
      toast.error("Base URL is too long (max 500 characters)");
      return;
    }

    setIsLoadingModels(true);
    try {
      // Fetch models from provider
      const models = await fetchModels(trimmedBaseURL, trimmedApiKey);

      if (models.length === 0) {
        toast.error("No models found for this provider");
        setIsLoadingModels(false);
        return;
      }

      const newProvider: CustomProviderConfig = {
        id: editingProvider?.id || crypto.randomUUID(),
        name: trimmedName,
        baseURL: trimmedBaseURL,
        apiKey: trimmedApiKey,
        models,
        enabled: true,
      };

      let updatedProviders: CustomProviderConfig[];
      if (editingProvider) {
        // Update existing provider
        updatedProviders = providers.map((p) =>
          p.id === editingProvider.id ? newProvider : p,
        );
        toast.success(`Provider "${trimmedName}" updated successfully`);
      } else {
        // Add new provider
        updatedProviders = [...providers, newProvider];
        toast.success(
          `Provider "${trimmedName}" added with ${models.length} models`,
        );
      }

      onProvidersChange(updatedProviders);

      setShowAddDialog(false);
      setEditingProvider(null);
      setFormData({ name: "", baseURL: "", apiKey: "" });
    } catch (error) {
      console.error("Error saving provider:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to fetch models from provider. Please check your URL and API key.",
      );
    } finally {
      setIsLoadingModels(false);
    }
  }, [formData, editingProvider, providers, onProvidersChange, fetchModels]);

  // Delete provider
  const handleDeleteProvider = useCallback(
    (providerId: string) => {
      const updatedProviders = providers.filter((p) => p.id !== providerId);
      onProvidersChange(updatedProviders);
      toast.success("Provider deleted");
    },
    [providers, onProvidersChange],
  );

  // Refresh models for a provider
  const handleRefreshModels = useCallback(
    async (provider: CustomProviderConfig) => {
      setIsLoadingModels(true);
      try {
        const models = await fetchModels(provider.baseURL, provider.apiKey);

        if (models.length === 0) {
          toast.error("No models found for this provider");
          setIsLoadingModels(false);
          return;
        }

        const updatedProvider = { ...provider, models };
        const updatedProviders = providers.map((p) =>
          p.id === provider.id ? updatedProvider : p,
        );

        onProvidersChange(updatedProviders);
        toast.success(
          `Refreshed ${models.length} models for "${provider.name}"`,
        );
      } catch (error) {
        console.error("Error refreshing models:", error);
        toast.error("Failed to refresh models");
      } finally {
        setIsLoadingModels(false);
      }
    },
    [providers, onProvidersChange, fetchModels],
  );

  // Toggle provider enabled state
  const handleToggleProvider = useCallback(
    (providerId: string) => {
      const updatedProviders = providers.map((p) =>
        p.id === providerId ? { ...p, enabled: !p.enabled } : p,
      );
      onProvidersChange(updatedProviders);
    },
    [providers, onProvidersChange],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Custom LLM Providers</DialogTitle>
            <DialogDescription>
              Add custom OpenAI-compatible LLM providers. Models will be loaded
              automatically from the /models endpoint.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {providers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No custom providers added yet.
              </div>
            ) : (
              <div className="space-y-3">
                {providers.map((provider) => (
                  <div
                    key={provider.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{provider.name}</h4>
                          <Badge
                            variant={provider.enabled ? "default" : "secondary"}
                          >
                            {provider.enabled ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {provider.baseURL}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {provider.models.length} models available
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleProvider(provider.id)}
                          title={
                            provider.enabled
                              ? "Disable provider"
                              : "Enable provider"
                          }
                        >
                          {provider.enabled ? (
                            <span className="h-4 w-4">✓</span>
                          ) : (
                            <span className="h-4 w-4">○</span>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRefreshModels(provider)}
                          disabled={isLoadingModels}
                          title="Refresh models"
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${isLoadingModels ? "animate-spin" : ""}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingProvider(provider)}
                          title="Edit provider"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteProvider(provider.id)}
                          title="Delete provider"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {provider.models.slice(0, 5).map((model) => (
                        <Badge
                          key={model.id}
                          variant="outline"
                          className="text-xs"
                        >
                          {model.id}
                        </Badge>
                      ))}
                      {provider.models.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{provider.models.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="default"
              onClick={() => setShowAddDialog(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Provider Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) {
            setEditingProvider(null);
            setFormData({ name: "", baseURL: "", apiKey: "" });
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? "Edit Provider" : "Add Custom Provider"}
            </DialogTitle>
            <DialogDescription>
              Enter the details for your OpenAI-compatible LLM provider.
              <br />
              <strong className="text-amber-600 dark:text-amber-500">
                Security Warning:
              </strong>{" "}
              API keys are stored in your browser&apos;s localStorage without
              encryption and are accessible to JavaScript running on this page.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="provider-name">Provider Name</Label>
              <Input
                id="provider-name"
                placeholder="My Custom Provider"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-baseurl">Base URL</Label>
              <Input
                id="provider-baseurl"
                placeholder="https://api.example.com/v1"
                value={formData.baseURL}
                onChange={(e) =>
                  setFormData({ ...formData, baseURL: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                The base URL for the OpenAI-compatible API (e.g.,
                https://api.openai.com/v1)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-apikey">API Key</Label>
              <Input
                id="provider-apikey"
                type="password"
                placeholder="sk-..."
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setEditingProvider(null);
                setFormData({ name: "", baseURL: "", apiKey: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveProvider} disabled={isLoadingModels}>
              {isLoadingModels
                ? "Loading models..."
                : editingProvider
                  ? "Update Provider"
                  : "Add Provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
