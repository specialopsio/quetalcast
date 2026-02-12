import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  INTEGRATIONS,
  getIntegration,
  loadIntegrationConfig,
  saveIntegrationConfig,
  clearIntegrationConfig,
  type Integration,
  type IntegrationConfig,
  type IntegrationCredentials,
} from '@/lib/integrations';
import { Radio, ChevronLeft, Loader2, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

interface IntegrationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIntegration: IntegrationConfig | null;
  onSelectIntegration: (config: IntegrationConfig | null) => void;
}

export function IntegrationsSheet({
  open,
  onOpenChange,
  selectedIntegration,
  onSelectIntegration,
}: IntegrationsSheetProps) {
  const [activeIntegration, setActiveIntegration] = useState<Integration | null>(null);
  const [credentials, setCredentials] = useState<IntegrationCredentials>({});
  const [remember, setRemember] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  // When opening a specific integration, load saved creds if any
  const openIntegrationForm = (integration: Integration) => {
    setActiveIntegration(integration);
    setTestResult(null);

    const saved = loadIntegrationConfig(integration.id);
    if (saved) {
      setCredentials(saved.credentials);
      setRemember(saved.rememberCredentials);
    } else {
      // Pre-fill defaults from placeholders
      const defaults: IntegrationCredentials = {};
      integration.credentialFields.forEach((f) => {
        defaults[f.key] = '';
      });
      setCredentials(defaults);
      setRemember(false);
    }
  };

  // Reset to list view when sheet closes
  useEffect(() => {
    if (!open) {
      setActiveIntegration(null);
      setTestResult(null);
    }
  }, [open]);

  const handleFieldChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  const isFormValid = (): boolean => {
    if (!activeIntegration) return false;
    return activeIntegration.credentialFields
      .filter((f) => f.required)
      .every((f) => credentials[f.key]?.trim());
  };

  const handleTestConnection = async () => {
    if (!activeIntegration || !isFormValid()) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/integration-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: activeIntegration.type,
          credentials,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: 'Could not reach the server' });
    } finally {
      setTesting(false);
    }
  };

  const handleUseIntegration = () => {
    if (!activeIntegration || !isFormValid()) return;

    const config: IntegrationConfig = {
      integrationId: activeIntegration.id,
      credentials,
      rememberCredentials: remember,
    };

    saveIntegrationConfig(config);
    onSelectIntegration(config);
    onOpenChange(false);
  };

  const handleRemoveIntegration = () => {
    if (activeIntegration) {
      clearIntegrationConfig(activeIntegration.id);
    }
    onSelectIntegration(null);
    setActiveIntegration(null);
    onOpenChange(false);
  };

  const isCurrentlySelected = (id: string) =>
    selectedIntegration?.integrationId === id;

  // -------------------------------------------------------------------------
  // Render: integration list
  // -------------------------------------------------------------------------
  const renderList = () => (
    <div className="space-y-3 mt-4">
      {INTEGRATIONS.map((integration) => {
        const selected = isCurrentlySelected(integration.id);
        return (
          <button
            key={integration.id}
            onClick={() => openIntegrationForm(integration)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-md border text-left transition-colors ${
              selected
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-card text-foreground hover:bg-secondary'
            }`}
          >
            <div className="flex items-center gap-3">
              <Radio className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-sm font-semibold">{integration.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{integration.type === 'radio-co' ? 'Icecast-compatible' : integration.type}</div>
              </div>
            </div>
            {selected && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary">Active</span>
            )}
          </button>
        );
      })}

      {selectedIntegration && (
        <button
          onClick={() => {
            clearIntegrationConfig(selectedIntegration.integrationId);
            onSelectIntegration(null);
          }}
          className="w-full flex items-center justify-center gap-2 text-xs text-destructive hover:text-destructive/80 transition-colors mt-2"
        >
          <Trash2 className="h-3 w-3" />
          Remove active integration
        </button>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render: credential form for active integration
  // -------------------------------------------------------------------------
  const renderForm = () => {
    if (!activeIntegration) return null;

    return (
      <div className="space-y-4 mt-4">
        <button
          onClick={() => { setActiveIntegration(null); setTestResult(null); }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to integrations
        </button>

        {activeIntegration.description && (
          <p className="text-xs text-muted-foreground leading-relaxed bg-secondary/50 rounded-md px-3 py-2">
            {activeIntegration.description}
          </p>
        )}

        <div className="space-y-3">
          {activeIntegration.credentialFields.map((field) => (
            <div key={field.key}>
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1 block">
                {field.label}
                {field.required && <span className="text-destructive ml-0.5">*</span>}
              </label>
              <input
                type={field.type === 'number' ? 'text' : field.type}
                inputMode={field.type === 'number' ? 'numeric' : undefined}
                value={credentials[field.key] || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {field.hint && (
                <p className="text-[11px] text-muted-foreground/70 mt-0.5 ml-0.5">{field.hint}</p>
              )}
            </div>
          ))}
        </div>

        {/* Remember credentials */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-xs text-muted-foreground">Remember credentials</span>
        </label>

        {/* Test connection */}
        <button
          onClick={handleTestConnection}
          disabled={testing || !isFormValid()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold border border-border bg-secondary text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testing…
            </>
          ) : (
            'Test Connection'
          )}
        </button>

        {/* Test result */}
        {testResult && (
          <div className={`flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-md ${
            testResult.ok
              ? 'bg-primary/10 text-primary'
              : 'bg-destructive/10 text-destructive'
          }`}>
            {testResult.ok ? (
              <><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Connection successful</>
            ) : (
              <><XCircle className="h-3.5 w-3.5 shrink-0" /> {testResult.error || 'Connection failed'}</>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleUseIntegration}
            disabled={!isFormValid()}
            className="flex-1 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use {activeIntegration.name}
          </button>
          {isCurrentlySelected(activeIntegration.id) && (
            <button
              onClick={handleRemoveIntegration}
              className="px-3 py-2 rounded-md text-sm font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {activeIntegration ? activeIntegration.name : 'Integrations'}
          </SheetTitle>
          <SheetDescription>
            {activeIntegration
              ? `Enter your ${activeIntegration.name} streaming credentials.`
              : 'Stream to an external platform instead of a Quetalcast room.'}
          </SheetDescription>
        </SheetHeader>

        {activeIntegration ? renderForm() : renderList()}
      </SheetContent>
    </Sheet>
  );
}
