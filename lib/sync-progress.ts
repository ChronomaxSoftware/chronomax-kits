// Estado compartilhado de progresso da sincronização do Gestão.
// Singleton em memória — basta pra uma sincronização por vez.

export type ProgressoSync = {
  emAndamento: boolean;
  fase: string;        // descrição do que está acontecendo agora
  atual: number;       // ex: 12 (eventos processados)
  total: number;       // ex: 30 (total a processar)
  porcentagem: number; // 0..100
  inicioEm: number | null;
  ultimaAtualizacao: number;
};

let estado: ProgressoSync = {
  emAndamento: false,
  fase: "",
  atual: 0,
  total: 0,
  porcentagem: 0,
  inicioEm: null,
  ultimaAtualizacao: 0,
};

export function getProgresso(): ProgressoSync {
  return estado;
}

export function iniciarSync(): void {
  estado = {
    emAndamento: true,
    fase: "Iniciando",
    atual: 0,
    total: 0,
    porcentagem: 0,
    inicioEm: Date.now(),
    ultimaAtualizacao: Date.now(),
  };
}

export function setProgresso(p: Partial<ProgressoSync>): void {
  estado = { ...estado, ...p, ultimaAtualizacao: Date.now() };
}

export function finalizarSync(sucesso: boolean, mensagem?: string): void {
  estado = {
    ...estado,
    emAndamento: false,
    fase: mensagem ?? (sucesso ? "Concluído" : "Erro"),
    porcentagem: sucesso ? 100 : estado.porcentagem,
    ultimaAtualizacao: Date.now(),
  };
}
