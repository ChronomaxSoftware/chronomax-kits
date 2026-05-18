/**
 * Client HTTP para a API REST do Gestão Chronomax.
 * Substitui o scraping via Playwright por chamadas diretas à API.
 *
 * Auth: JWT Bearer Token (POST /api/auth/login)
 */

// ── Tipos de resposta da API ──────────────────────────────────────────

export type GestaoLoginResponse = {
  message: string;
  token: string;
  user: { id: string; name: string; email: string; role: string };
};

export type GestaoProposalItem = {
  id?: string;
  productId?: string;
  name?: string;
  description?: string;
  quantity?: number;
  actualQuantity?: number;
  unit?: string;
  price?: number;
  category?: string;
  assignedCategory?: string;
  type?: string;
};

export type GestaoProposal = {
  id: string;
  number: string;
  title: string;
  eventName: string | null;
  eventDate: string | null;
  eventCity: string | null;
  eventType: string | null;
  athleteCount: number | null;
  level: number | null;
  status: string;
  items: GestaoProposalItem[];
  Client?: { id: string; name: string; email?: string; phone?: string } | null;
  [key: string]: unknown;
};

export type GestaoProposalsResponse = {
  proposals: GestaoProposal[];
  pagination: { total: number; pages: number; currentPage: number; limit: number };
};

export type GestaoAllocationTechnician = {
  id: string;
  companyName: string;
  email?: string;
  phone?: string;
  level?: number;
  category?: string[];
  photoUrl?: string;
  paymentMethod?: string;
  document?: string;
  documentType?: string;
  city?: string;
  birthDate?: string;
};

export type GestaoAllocation = {
  id: string;
  eventId: string;
  eventType: string;
  technicianId: string;
  technicianName: string;
  funcao: string | null;
  baseFee: number;
  entregaKitsQty: number;
  kitDeliveryRate: number;
  kitDeliveryAmount: number;
  status: string;
  technician?: GestaoAllocationTechnician | null;
  [key: string]: unknown;
};

export type GestaoAllocationsResponse = {
  success: boolean;
  data: {
    allocations: GestaoAllocation[];
    eventConfiguration: unknown;
  };
};

export type GestaoBulkAllocationsResponse = {
  success: boolean;
  data: Record<string, {
    totalAllocated: number;
    totalConfirmed: number;
    totalCancelled: number;
    allTechnicians: { id: string; name: string; status: string; funcao: string | null }[];
  }>;
};

export type GestaoSupplier = {
  id: string;
  companyName: string;
  tradeName?: string;
  document?: string;
  documentType?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  category?: string[];
  level?: number;
  specialties?: string[];
  photoUrl?: string;
  birthDate?: string;
  gender?: string;
  isActive?: boolean;
};

// ── Client ────────────────────────────────────────────────────────────

export class GestaoAPI {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private url(path: string) {
    return `${this.baseUrl}/api${path}`;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  /** POST /api/auth/login → JWT token */
  async login(email: string, password: string): Promise<GestaoLoginResponse> {
    const res = await fetch(this.url("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Login falhou (HTTP ${res.status})`);
    }
    const data: GestaoLoginResponse = await res.json();
    this.token = data.token;
    return data;
  }

  /** GET /api/proposals?limit=10000&status=aprovada&includeItems=true */
  async getProposals(params?: Record<string, string>): Promise<GestaoProposalsResponse> {
    const query = new URLSearchParams({
      limit: "10000",
      includeItems: "true",
      ...params,
    });
    const res = await fetch(this.url(`/proposals?${query}`), { headers: this.headers() });
    if (!res.ok) throw new Error(`GET /proposals falhou (HTTP ${res.status})`);
    return res.json();
  }

  /** GET /api/proposals/:id */
  async getProposalById(id: string): Promise<GestaoProposal> {
    const res = await fetch(this.url(`/proposals/${id}`), { headers: this.headers() });
    if (!res.ok) throw new Error(`GET /proposals/${id} falhou (HTTP ${res.status})`);
    return res.json();
  }

  /** GET /api/event-allocations/:eventId/:eventType/allocations */
  async getEventAllocations(eventId: string, eventType = "proposal"): Promise<GestaoAllocationsResponse> {
    const res = await fetch(this.url(`/event-allocations/${eventId}/${eventType}/allocations`), {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GET allocations ${eventId} falhou (HTTP ${res.status})`);
    return res.json();
  }

  /** POST /api/event-allocations/bulk — alocações de múltiplos eventos de uma vez */
  async getBulkAllocations(eventIds: string[], eventType = "proposal"): Promise<GestaoBulkAllocationsResponse> {
    const res = await fetch(this.url("/event-allocations/bulk"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ eventIds, eventType }),
    });
    if (!res.ok) throw new Error(`POST bulk allocations falhou (HTTP ${res.status})`);
    return res.json();
  }

  /** GET /api/financial/suppliers/technicians */
  async getTechnicians(): Promise<{ data: GestaoSupplier[] }> {
    const res = await fetch(this.url("/financial/suppliers/technicians"), { headers: this.headers() });
    if (!res.ok) throw new Error(`GET technicians falhou (HTTP ${res.status})`);
    return res.json();
  }

  /** GET /api/financial/suppliers?category=freelancers&limit=1000 */
  async getSuppliers(params?: Record<string, string>): Promise<{ suppliers: GestaoSupplier[] }> {
    const query = new URLSearchParams({ limit: "1000", ...params });
    const res = await fetch(this.url(`/financial/suppliers?${query}`), { headers: this.headers() });
    if (!res.ok) throw new Error(`GET suppliers falhou (HTTP ${res.status})`);
    return res.json();
  }
}
