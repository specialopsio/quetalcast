// ---------------------------------------------------------------------------
// Integration types, registry, and credential persistence
// ---------------------------------------------------------------------------

export type IntegrationType = 'icecast' | 'shoutcast' | 'radio-co';

export interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'number' | 'password';
  required: boolean;
}

export interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  credentialFields: CredentialField[];
}

export interface IntegrationCredentials {
  [key: string]: string;
}

export interface IntegrationConfig {
  integrationId: string;
  credentials: IntegrationCredentials;
  rememberCredentials: boolean;
}

// ---------------------------------------------------------------------------
// Integration registry
// ---------------------------------------------------------------------------

export const INTEGRATIONS: Integration[] = [
  {
    id: 'internet-radio',
    name: 'internet-radio.com',
    type: 'icecast',
    credentialFields: [
      { key: 'host', label: 'Server Host', placeholder: 'uk3.internet-radio.com', type: 'text', required: true },
      { key: 'port', label: 'Port', placeholder: '8000', type: 'number', required: true },
      { key: 'mount', label: 'Mount Point', placeholder: '/live', type: 'text', required: true },
      { key: 'password', label: 'Source Password', placeholder: '', type: 'password', required: true },
    ],
  },
  {
    id: 'shoutcast',
    name: 'Shoutcast',
    type: 'shoutcast',
    credentialFields: [
      { key: 'host', label: 'Server Host', placeholder: 'host.example.com', type: 'text', required: true },
      { key: 'port', label: 'Source Port', placeholder: '8001', type: 'number', required: true },
      { key: 'password', label: 'Password', placeholder: '', type: 'password', required: true },
      { key: 'streamId', label: 'Stream ID (optional)', placeholder: '1', type: 'text', required: false },
    ],
  },
  {
    id: 'radio-co',
    name: 'Radio.co',
    type: 'radio-co',
    credentialFields: [
      { key: 'host', label: 'DJ Host', placeholder: 'dj.radio.co', type: 'text', required: true },
      { key: 'port', label: 'Port', placeholder: '80', type: 'number', required: true },
      { key: 'mount', label: 'Mount Point', placeholder: '/stream', type: 'text', required: true },
      { key: 'password', label: 'DJ Password', placeholder: '', type: 'password', required: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Look-ups
// ---------------------------------------------------------------------------

export function getIntegration(id: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'quetalcast-integration-';

export function loadIntegrationConfig(id: string): IntegrationConfig | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as IntegrationConfig;
  } catch {
    return null;
  }
}

export function saveIntegrationConfig(config: IntegrationConfig): void {
  if (config.rememberCredentials) {
    localStorage.setItem(`${STORAGE_PREFIX}${config.integrationId}`, JSON.stringify(config));
  } else {
    // Remove any previously persisted credentials when "remember" is off
    localStorage.removeItem(`${STORAGE_PREFIX}${config.integrationId}`);
  }
}

export function clearIntegrationConfig(id: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
}
