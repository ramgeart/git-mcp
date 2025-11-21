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
import { Plus, Trash2, RefreshCw } from "lucide-react";
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
      const url = baseURL.endsWith("/")
        ? `${baseURL}models`
        : `${baseURL}/models`;

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

        interface ModelsApiResponse {
          data?: ModelResponse[];
        }

        const data: ModelsApiResponse = await response.json();

        // OpenAI API format: { data: [ { id: "model-id", ... }, ... ] }
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((model) => ({
            id: model.id,
            name: model.id,
            description: model.description || "",
            capabilities: [],
          }));
        }

        return [];
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Request timed out. Please check your provider URL.");
        }
        console.error("Error fetching models:", error);
        throw error;
      }
    },
    [],
  );

  // Add or update provider
  const handleSaveProvider = useCallback(async () => {
    if (!formData.name || !formData.baseURL || !formData.apiKey) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoadingModels(true);
    try {
      // Fetch models from provider
      const models = await fetchModels(formData.baseURL, formData.apiKey);

      if (models.length === 0) {
        toast.error("No models found for this provider");
        setIsLoadingModels(false);
        return;
      }

      const newProvider: CustomProviderConfig = {
        id: editingProvider?.id || crypto.randomUUID(),
        name: formData.name,
        baseURL: formData.baseURL,
        apiKey: formData.apiKey,
        models,
        enabled: true,
      };

      let updatedProviders: CustomProviderConfig[];
      if (editingProvider) {
        // Update existing provider
        updatedProviders = providers.map((p) =>
          p.id === editingProvider.id ? newProvider : p,
        );
        toast.success(`Provider "${formData.name}" updated successfully`);
      } else {
        // Add new provider
        updatedProviders = [...providers, newProvider];
        toast.success(
          `Provider "${formData.name}" added with ${models.length} models`,
        );
      }

      onProvidersChange(updatedProviders);

      setShowAddDialog(false);
      setEditingProvider(null);
      setFormData({ name: "", baseURL: "", apiKey: "" });
    } catch (error) {
      console.error("Error saving provider:", error);
      toast.error(
        "Failed to fetch models from provider. Please check your URL and API key.",
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
                          Edit
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
