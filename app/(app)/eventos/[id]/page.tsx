"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Evento = {
  id: number;
  numero: string;
  nome: string;
  data: string;
  cidade: string | null;
  uf: string | null;
  qtd_celulares: number;
  dias_entrega: number;
  qtd_atletas: number;
  nivel: string | null;
  data_entrega: string | null;
  hora_entrega: string | null;
  status: string;
  observacoes: string | null;
  url_gestao: string | null;
  local_entrega: string | null;
  briefing_data: string | null;
  briefing_hora: string | null;
  datas_horarios_retirada: string | null;
  endereco_retirada: string | null;
  avisos_retirada: string | null;
  obs_retirada: string | null;
  cronograma_evento: string | null;
  passo_a_passo_kits: string | null;
  entrega_locais_separados: string | null;
  qtd_roteadores: number;
  qtd_celulares_grupo_online: number;
  qtd_celulares_produtos_online: number;
  qtd_notebooks: number;
  qtd_totens: number;
  url_site_oficial: string | null;
  links_evento: string | null;
  usuarios_evento: string | null;
  tecnicos: { id: number; nome: string; telefone: string | null; funcao?: string | null; atribuido_em?: string | null }[];
  produtos: { id: number; nome: string; quantidade: number; recebido?: number; qtd_recebida?: number | null; recebido_em?: string | null }[];
};

type Tecnico = { id: number; nome: string };
type Produto = { id: number; nome: string };

export default function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [tecnicosSel, setTecnicosSel] = useState<Set<number>>(new Set());
  const [produtosSel, setProdutosSel] = useState<Map<number, number>>(new Map());
  const [dataEntrega, setDataEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [localEntrega, setLocalEntrega] = useState("");
  const [briefingData, setBriefingData] = useState("");
  const [briefingHora, setBriefingHora] = useState("");
  const [status, setStatus] = useState("pendente");
  const [observacoes, setObservacoes] = useState("");
  const [qtdCelulares, setQtdCelulares] = useState(0);
  const [diasEntrega, setDiasEntrega] = useState(0);
  // Campos do book
  const [datasHorariosRetirada, setDatasHorariosRetirada] = useState("");
  const [enderecoRetirada, setEnderecoRetirada] = useState("");
  const [avisosRetirada, setAvisosRetirada] = useState("");
  const [obsRetirada, setObsRetirada] = useState("");
  const [cronogramaEvento, setCronogramaEvento] = useState("");
  const [passoAPasso, setPassoAPasso] = useState("");
  const [entregaLocaisSeparados, setEntregaLocaisSeparados] = useState("");
  const [qtdRoteadores, setQtdRoteadores] = useState(0);
  const [qtdCelGrupo, setQtdCelGrupo] = useState(0);
  const [qtdCelProdutos, setQtdCelProdutos] = useState(0);
  const [qtdNotebooks, setQtdNotebooks] = useState(0);
  const [qtdTotens, setQtdTotens] = useState(0);
  const [urlSiteOficial, setUrlSiteOficial] = useState("");
  const [linksEvento, setLinksEvento] = useState("");
  const [usuariosEvento, setUsuariosEvento] = useState("");
  type Kit = { id: number; nome: string; descricao: string | null; imagem_path: string | null };
  const [kits, setKits] = useState<Kit[]>([]);
  const [novoKitNome, setNovoKitNome] = useState("");
  const [novoKitDescricao, setNovoKitDescricao] = useState("");
  const [novoKitImagem, setNovoKitImagem] = useState<File | null>(null);
  const [enviandoKit, setEnviandoKit] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/eventos/${id}`).then((r) => r.json()),
      fetch("/api/tecnicos").then((r) => r.json()),
      fetch("/api/produtos").then((r) => r.json()),
    ]).then(([ev, tcs, prs]) => {
      setEvento(ev);
      setTecnicos(tcs);
      setProdutos(prs);
      setTecnicosSel(new Set(ev.tecnicos.map((t: Tecnico) => t.id)));
      const map = new Map<number, number>();
      ev.produtos.forEach((p: { id: number; quantidade: number }) => map.set(p.id, p.quantidade));
      setProdutosSel(map);
      setDataEntrega(ev.data_entrega || "");
      setHoraEntrega(ev.hora_entrega || "");
      setLocalEntrega(ev.local_entrega || "");
      setBriefingData(ev.briefing_data || "");
      setBriefingHora(ev.briefing_hora || "");
      setStatus(ev.status || "pendente");
      setObservacoes(ev.observacoes || "");
      setQtdCelulares(ev.qtd_celulares || 0);
      setDiasEntrega(ev.dias_entrega || 0);
      setDatasHorariosRetirada(ev.datas_horarios_retirada || "");
      setEnderecoRetirada(ev.endereco_retirada || "");
      setAvisosRetirada(ev.avisos_retirada || "");
      setObsRetirada(ev.obs_retirada || "");
      setCronogramaEvento(ev.cronograma_evento || "");
      setPassoAPasso(ev.passo_a_passo_kits || "");
      setEntregaLocaisSeparados(ev.entrega_locais_separados || "");
      setQtdRoteadores(ev.qtd_roteadores || 0);
      setQtdCelGrupo(ev.qtd_celulares_grupo_online || 0);
      setQtdCelProdutos(ev.qtd_celulares_produtos_online || 0);
      setQtdNotebooks(ev.qtd_notebooks || 0);
      setQtdTotens(ev.qtd_totens || 0);
      setUrlSiteOficial(ev.url_site_oficial || "");
      setLinksEvento(ev.links_evento || "");
      setUsuariosEvento(ev.usuarios_evento || "");
    });
    fetch(`/api/eventos/${id}/kits`).then((r) => r.json()).then(setKits);
  }, [id]);

  async function carregarKits() {
    const r = await fetch(`/api/eventos/${id}/kits`);
    setKits(await r.json());
  }

  async function adicionarKit(e: React.FormEvent) {
    e.preventDefault();
    if (!novoKitNome.trim()) return;
    setEnviandoKit(true);
    const fd = new FormData();
    fd.append("nome", novoKitNome.trim());
    if (novoKitDescricao.trim()) fd.append("descricao", novoKitDescricao.trim());
    if (novoKitImagem) fd.append("imagem", novoKitImagem);
    await fetch(`/api/eventos/${id}/kits`, { method: "POST", body: fd });
    setNovoKitNome("");
    setNovoKitDescricao("");
    setNovoKitImagem(null);
    setEnviandoKit(false);
    carregarKits();
  }

  async function removerKit(kitId: number) {
    if (!confirm("Remover este kit?")) return;
    await fetch(`/api/eventos/${id}/kits/${kitId}`, { method: "DELETE" });
    carregarKits();
  }

  function toggleTecnico(tid: number) {
    const novo = new Set(tecnicosSel);
    if (novo.has(tid)) novo.delete(tid);
    else novo.add(tid);
    setTecnicosSel(novo);
  }

  function setQtdProduto(pid: number, qtd: number) {
    const novo = new Map(produtosSel);
    if (qtd <= 0) novo.delete(pid);
    else novo.set(pid, qtd);
    setProdutosSel(novo);
  }

  async function salvar() {
    setSalvando(true);
    setSalvo(false);
    await fetch(`/api/eventos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data_entrega: dataEntrega || null,
        hora_entrega: horaEntrega || null,
        local_entrega: localEntrega || null,
        briefing_data: briefingData || null,
        briefing_hora: briefingHora || null,
        status,
        observacoes: observacoes || null,
        qtd_celulares: qtdCelulares,
        dias_entrega: diasEntrega,
        datas_horarios_retirada: datasHorariosRetirada || null,
        endereco_retirada: enderecoRetirada || null,
        avisos_retirada: avisosRetirada || null,
        obs_retirada: obsRetirada || null,
        cronograma_evento: cronogramaEvento || null,
        passo_a_passo_kits: passoAPasso || null,
        entrega_locais_separados: entregaLocaisSeparados || null,
        qtd_roteadores: qtdRoteadores,
        qtd_celulares_grupo_online: qtdCelGrupo,
        qtd_celulares_produtos_online: qtdCelProdutos,
        qtd_notebooks: qtdNotebooks,
        qtd_totens: qtdTotens,
        url_site_oficial: urlSiteOficial || null,
        links_evento: linksEvento || null,
        usuarios_evento: usuariosEvento || null,
        tecnicos: Array.from(tecnicosSel),
        produtos: Array.from(produtosSel.entries()).map(([id, quantidade]) => ({ id, quantidade })),
      }),
    });
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  async function remover() {
    if (!confirm("Remover este evento?")) return;
    await fetch(`/api/eventos/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (!evento) return <p className="text-slate-400">Carregando...</p>;

  return (
    <div className="max-w-5xl">
      <Link href="/" className="text-sm text-slate-400 hover:text-white">
        ← Voltar
      </Link>

      <div className="flex items-start justify-between mt-2 mb-6">
        <div>
          <p className="text-sm text-slate-400">
            #{evento.numero} · {evento.data} · {evento.cidade}
            {evento.uf ? "/" + evento.uf : ""}
          </p>
          <h1 className="text-2xl font-bold">{evento.nome}</h1>
          <div className="flex gap-3 items-center mt-1">
            {evento.url_gestao && (
              <a
                href={evento.url_gestao}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:underline"
              >
                Abrir no Gestão ↗
              </a>
            )}
            <Link
              href={`/eventos/${evento.id}/book`}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded"
            >
              📘 Gerar book
            </Link>
          </div>
        </div>
        <button onClick={remover} className="text-red-400 hover:text-red-300 text-sm">
          Remover evento
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card titulo="Dados da entrega">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Celulares</label>
                <input
                  type="number"
                  min={0}
                  value={qtdCelulares}
                  onChange={(e) => setQtdCelulares(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Dias de entrega</label>
                <input
                  type="number"
                  min={0}
                  value={diasEntrega}
                  onChange={(e) => setDiasEntrega(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Data da entrega</label>
                <input
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hora</label>
                <input
                  type="time"
                  value={horaEntrega}
                  onChange={(e) => setHoraEntrega(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-amber-400 mb-1">📘 Data do briefing</label>
                <input
                  type="date"
                  value={briefingData}
                  onChange={(e) => setBriefingData(e.target.value)}
                  className="w-full bg-slate-900 border border-amber-700/50 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-amber-400 mb-1">📘 Hora do briefing</label>
                <input
                  type="time"
                  value={briefingHora}
                  onChange={(e) => setBriefingHora(e.target.value)}
                  className="w-full bg-slate-900 border border-amber-700/50 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Local de entrega</label>
                <input
                  value={localEntrega}
                  onChange={(e) => setLocalEntrega(e.target.value)}
                  placeholder="Ex: Hotel X, Sede do cliente, Arena..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluido">Concluído</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Observações</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
          </Card>

          <Card titulo="🔍 Site oficial do evento">
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Cole aqui a URL do site oficial pra consultar e copiar informações pro book (datas/horários, kit, etc.)
              </p>
              <div className="flex gap-2">
                <input
                  value={urlSiteOficial}
                  onChange={(e) => setUrlSiteOficial(e.target.value)}
                  placeholder="https://siteoficial.com.br/evento"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                {urlSiteOficial && (
                  <a
                    href={urlSiteOficial}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap"
                  >
                    🔗 Abrir
                  </a>
                )}
              </div>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(
                  `${evento.nome} ${evento.cidade || ""} site oficial inscrições retirada de kit`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                🔍 Buscar no Google
              </a>
            </div>
          </Card>

          <Card titulo="📘 Book — Local da retirada">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Datas e horários (1 por linha)</label>
                <textarea
                  value={datasHorariosRetirada}
                  onChange={(e) => setDatasHorariosRetirada(e.target.value)}
                  rows={4}
                  placeholder="28 Agosto: 10h às 19h&#10;29 Agosto: 10h às 19h&#10;30 Agosto: 10h às 18h"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Endereço da retirada</label>
                <textarea
                  value={enderecoRetirada}
                  onChange={(e) => setEnderecoRetirada(e.target.value)}
                  rows={2}
                  placeholder="Shopping Market Place&#10;Av. Dr. Chucri Zaidan, 902 - Piso Térreo"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Avisos da retirada</label>
                <textarea
                  value={avisosRetirada}
                  onChange={(e) => setAvisosRetirada(e.target.value)}
                  rows={3}
                  placeholder="Não serão entregues número e kit em data, horário e local diferentes...&#10;Apresente um documento com foto..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Observação lateral (curta)</label>
                <input
                  value={obsRetirada}
                  onChange={(e) => setObsRetirada(e.target.value)}
                  placeholder="Ex: Entrega separada; Número em um local e produtos em outro"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
          </Card>

          <Card titulo="📘 Book — Equipamentos">
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Roteadores" value={qtdRoteadores} onChange={setQtdRoteadores} />
              <NumField label="Celulares número" value={qtdCelulares} onChange={setQtdCelulares} />
              <NumField label="Celular grupo online" value={qtdCelGrupo} onChange={setQtdCelGrupo} />
              <NumField label="Celulares produtos online" value={qtdCelProdutos} onChange={setQtdCelProdutos} />
              <NumField label="Totens" value={qtdTotens} onChange={setQtdTotens} />
              <NumField label="Notebooks" value={qtdNotebooks} onChange={setQtdNotebooks} />
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Entrega de locais separados (texto livre)</label>
                <textarea
                  value={entregaLocaisSeparados}
                  onChange={(e) => setEntregaLocaisSeparados(e.target.value)}
                  rows={3}
                  placeholder="Credenciamento: 1 dia 6 / 2 dia 8 / ultimo dia 14&#10;Grupos: 1/1/1&#10;Kits: 1 dia 4 / 2 dia 5 / ultimo dia 6"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
          </Card>

          <Card titulo="📘 Book — Cronograma e Passo a passo">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cronograma do evento (1 por linha)</label>
                <textarea
                  value={cronogramaEvento}
                  onChange={(e) => setCronogramaEvento(e.target.value)}
                  rows={4}
                  placeholder="TESTAR SINAL DE INTERNET&#10;COLOCAR CELULARES PARA CARREGAR FINAL DE CADA DIA&#10;CHEGAR NO PRIMEIRO DIA 2H ANTES..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Passo a passo entrega de kits (1 por linha — comece com <span className="text-red-400 font-mono">!</span> pra destacar em vermelho)
                </label>
                <textarea
                  value={passoAPasso}
                  onChange={(e) => setPassoAPasso(e.target.value)}
                  rows={5}
                  placeholder="CONFERIR TODOS EQUIPAMENTOS RECEBIDOS&#10;LOGAR COM EMAIL E SENHA NOS CELULARES E SINCRONIZAR&#10;FAZER TESTE (PROCURAR POR PROTOCOLO, POR CPF E DAR BAIXA)&#10;PASSAR O TREINAMENTO PARA OS STAFF E APÓS APAGAR OS TESTES&#10;!ATENÇÃO APAGAR BAIXAS APENAS NO PRIMEIRO DIA DE TREINAMENTO"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
          </Card>

          <Card titulo="📘 Book — Tipos de Kit (com fotos)">
            <form onSubmit={adicionarKit} className="space-y-2 mb-3">
              <input
                value={novoKitNome}
                onChange={(e) => setNovoKitNome(e.target.value)}
                placeholder="Nome do kit (ex: INSCRIÇÃO ESSENCIAL)"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <textarea
                value={novoKitDescricao}
                onChange={(e) => setNovoKitDescricao(e.target.value)}
                placeholder="Descrição (ex: Camiseta Runner + Número de peito (chip) + Medalha conclusão...)"
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNovoKitImagem(e.target.files?.[0] || null)}
                  className="text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-slate-700 file:text-white file:cursor-pointer"
                />
                <button
                  type="submit"
                  disabled={enviandoKit || !novoKitNome.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-1.5 rounded text-sm whitespace-nowrap"
                >
                  {enviandoKit ? "Enviando..." : "+ Adicionar"}
                </button>
              </div>
            </form>

            {kits.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum kit cadastrado ainda</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {kits.map((k) => (
                  <div key={k.id} className="bg-slate-900 rounded-lg p-2 relative">
                    {k.imagem_path && (
                      <img
                        src={`/api/uploads/${k.imagem_path}`}
                        alt={k.nome}
                        className="w-full h-32 object-cover rounded mb-2"
                      />
                    )}
                    <p className="text-sm text-white font-semibold">{k.nome}</p>
                    {k.descricao && <p className="text-xs text-slate-400 line-clamp-2 mt-1">{k.descricao}</p>}
                    <button
                      onClick={() => removerKit(k.id)}
                      className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white text-xs px-2 py-0.5 rounded"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card titulo="📘 Book — Links e Usuários">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Links (1 por linha)</label>
                <textarea
                  value={linksEvento}
                  onChange={(e) => setLinksEvento(e.target.value)}
                  rows={3}
                  placeholder="https://go.runking.com.br/login&#10;https://servicos.runking.com.br/run-the-bridge"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Usuários (1 por linha — formato livre, ex: <span className="font-mono">Master - email@x.com - 123456</span>)
                </label>
                <textarea
                  value={usuariosEvento}
                  onChange={(e) => setUsuariosEvento(e.target.value)}
                  rows={4}
                  placeholder="Master - master@iguana.com.br - 123456&#10;Numero - staff@iguana.com.br - 01&#10;Produto - produto@iguana.com.br - 02"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono"
                />
              </div>
            </div>
          </Card>

          <Card titulo={`Técnicos (${tecnicosSel.size})`}>
            {evento.tecnicos.length > 0 && (
              <div className="mb-3 space-y-1">
                <p className="text-[10px] text-slate-500 uppercase">Atribuídos a este evento</p>
                {evento.tecnicos.map((t) => (
                  <div
                    key={t.id}
                    className="text-sm text-slate-200 flex items-center justify-between gap-2 bg-slate-900/60 rounded px-2 py-1"
                  >
                    <span>
                      {t.nome}
                      {t.funcao ? <span className="text-slate-400"> · {t.funcao}</span> : null}
                    </span>
                    {t.atribuido_em && (
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {new Date(t.atribuido_em).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {tecnicos.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nenhum técnico cadastrado.{" "}
                <Link href="/tecnicos" className="text-blue-400 hover:underline">
                  Cadastrar agora
                </Link>
              </p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-auto">
                {tecnicos.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-3 p-2 hover:bg-slate-700 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={tecnicosSel.has(t.id)}
                      onChange={() => toggleTecnico(t.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-white">{t.nome}</span>
                  </label>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card titulo="Produtos">
            {produtos.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nenhum produto cadastrado.{" "}
                <Link href="/produtos" className="text-blue-400 hover:underline">
                  Cadastrar agora
                </Link>
              </p>
            ) : (
              <div className="space-y-2">
                {produtos.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 bg-slate-900 rounded">
                    <span className="flex-1 text-white">{p.nome}</span>
                    <input
                      type="number"
                      min={0}
                      value={produtosSel.get(p.id) || 0}
                      onChange={(e) => setQtdProduto(p.id, parseInt(e.target.value) || 0)}
                      className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-right"
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card titulo="Resumo">
            <ul className="text-sm text-slate-300 space-y-1">
              <li>
                <strong className="text-white">{evento.qtd_atletas || "-"}</strong> atletas estimados
              </li>
              <li>
                <strong className="text-white">{qtdCelulares}</strong> celulares · {diasEntrega} dias
              </li>
              <li>
                <strong className="text-white">{tecnicosSel.size}</strong> técnicos atribuídos
              </li>
              <li>
                <strong className="text-white">{Array.from(produtosSel.values()).reduce((a, b) => a + b, 0)}</strong>{" "}
                produtos no total
              </li>
            </ul>
          </Card>

          <Card titulo="📦 Recebimento do material (técnico)">
            {evento.produtos.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum material atribuído a este evento.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {evento.produtos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-200">{p.nome}</span>
                    {p.recebido ? (
                      <span className="text-green-400 text-xs whitespace-nowrap">
                        ✓ {p.qtd_recebida ?? p.quantidade}/{p.quantidade}
                        {p.recebido_em ? ` · ${new Date(p.recebido_em).toLocaleDateString("pt-BR")}` : ""}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">pendente</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 sticky bottom-4 bg-slate-900/90 backdrop-blur p-3 rounded-xl border border-slate-700">
        <button
          onClick={salvar}
          disabled={salvando}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
        {salvo && <span className="text-green-400 text-sm">✓ Salvo</span>}
      </div>
    </div>
  );
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h2 className="font-bold mb-3 text-white">{titulo}</h2>
      {children}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
      />
    </div>
  );
}
