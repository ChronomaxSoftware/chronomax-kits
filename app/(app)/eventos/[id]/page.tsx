"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PainelConferencia from "@/components/staff/PainelConferencia";
import { TipoEquipamento, tipoDeProduto } from "@/lib/equipamentos";
import SeletorEquipamentosProduto, { EquipamentoResumo } from "@/components/equipamentos/SeletorEquipamentosProduto";
import CardEnvioProva from "@/components/envios/CardEnvioProva";
import CardKitsProva from "@/components/kits/CardKitsProva";
import { equipamentosBook } from "@/lib/book-equipamentos";
import EditorDatasRetirada from "@/components/book/EditorDatasRetirada";
import { diaDaEntregaAntiga, entregaDoPrimeiroDia } from "@/lib/datas-retirada";

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
  qtd_notebook_atendimento: number;
  tecnicos: {
    id: number;
    nome: string;
    telefone: string | null;
    endereco?: string | null;
    funcao?: string | null;
    atribuido_em?: string | null;
    obs_recebimento?: string | null;
    obs_em?: string | null;
    confirmado_em?: string | null;
    login_individual?: string | null;
    devolvido_em?: string | null;
    obs_devolucao?: string | null;
  }[];
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
  const [qtdCelGrupo, setQtdCelGrupo] = useState(0);
  const [qtdCelProdutos, setQtdCelProdutos] = useState(0);
  const [urlSiteOficial, setUrlSiteOficial] = useState("");
  const [linksEvento, setLinksEvento] = useState("");
  const [usuariosEvento, setUsuariosEvento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [loginsCopiados, setLoginsCopiados] = useState(false);
  /** Login individual de cada técnico atribuído (tecnico_id → texto) */
  const [loginsTecnicos, setLoginsTecnicos] = useState<Record<number, string>>({});
  const [inventario, setInventario] = useState<EquipamentoResumo[]>([]);

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
      setLocalEntrega(ev.local_entrega || "");
      setBriefingData(ev.briefing_data || "");
      setBriefingHora(ev.briefing_hora || "");
      setStatus(ev.status || "pendente");
      setObservacoes(ev.observacoes || "");
      setQtdCelulares(ev.qtd_celulares || 0);
      setDiasEntrega(ev.dias_entrega || 0);
      // prova antiga só com data/hora da entrega: vira o 1º dia do editor
      setDatasHorariosRetirada(ev.datas_horarios_retirada || diaDaEntregaAntiga(ev.data_entrega, ev.hora_entrega));
      setEnderecoRetirada(ev.endereco_retirada || "");
      setAvisosRetirada(ev.avisos_retirada || "");
      setObsRetirada(ev.obs_retirada || "");
      setCronogramaEvento(ev.cronograma_evento || "");
      setPassoAPasso(ev.passo_a_passo_kits || "");
      setEntregaLocaisSeparados(ev.entrega_locais_separados || "");
      setQtdCelGrupo(ev.qtd_celulares_grupo_online || 0);
      setQtdCelProdutos(ev.qtd_celulares_produtos_online || 0);
      setUrlSiteOficial(ev.url_site_oficial || "");
      setLinksEvento(ev.links_evento || "");
      setUsuariosEvento(ev.usuarios_evento || "");
      setLoginsTecnicos(
        Object.fromEntries(ev.tecnicos.map((t: { id: number; login_individual?: string | null }) => [t.id, t.login_individual || ""]))
      );
    });
    carregarInventario();
  }, [id]);

  async function carregarInventario() {
    try {
      const r = await fetch("/api/equipamentos");
      if (r.ok) setInventario(await r.json());
    } catch {
      // sem inventário o card Produtos continua funcionando só com quantidades
    }
  }

  // Quantidade pedida por tipo do inventário (soma produtos do mesmo tipo, ex.: "Celular" + "Celular reserva");
  // o seletor de patrimônios aparece só na primeira linha de cada tipo.
  const pedidoPorTipo = new Map<TipoEquipamento, { qtd: number; primeiroProduto: number }>();
  for (const p of produtos) {
    const t = tipoDeProduto(p.nome);
    const q = produtosSel.get(p.id) || 0;
    if (!t || q <= 0) continue;
    const atual = pedidoPorTipo.get(t);
    pedidoPorTipo.set(t, { qtd: (atual?.qtd || 0) + q, primeiroProduto: atual?.primeiroProduto ?? p.id });
  }

  // "📘 Book — Equipamentos" ao vivo, do que está no card Produtos (mesmo antes de salvar)
  const book = equipamentosBook(
    produtos.map((p) => ({ nome: p.nome, quantidade: produtosSel.get(p.id) || 0 })),
    { qtd_celulares_grupo_online: qtdCelGrupo, qtd_celulares_produtos_online: qtdCelProdutos }
  );

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

  /**
   * Local que veio no texto colado das datas → Local de entrega. O Endereço da retirada
   * (book) acompanha se estava igual ao local antigo; vazio continua vazio (o book usa o
   * Local de entrega) e um endereço diferente, escolhido só para o book, fica como está.
   */
  function aplicarLocalColado(novo: string) {
    const antigo = localEntrega.trim();
    setLocalEntrega(novo);
    setEnderecoRetirada((e) => (e.trim() && e.trim() === antigo ? novo : e));
  }

  async function salvar() {
    setSalvando(true);
    setSalvo(false);
    await fetch(`/api/eventos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // data e hora da entrega = 1º dia dos Datas e horários (home, portal e TXT usam esses campos)
        ...entregaDoPrimeiroDia(datasHorariosRetirada),
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
        qtd_celulares_grupo_online: qtdCelGrupo,
        qtd_celulares_produtos_online: qtdCelProdutos,
        url_site_oficial: urlSiteOficial || null,
        links_evento: linksEvento || null,
        usuarios_evento: usuariosEvento || null,
        tecnicos: Array.from(tecnicosSel),
        // só de quem continua atribuído (quem saiu perde o vínculo e o login junto)
        logins_tecnicos: Object.fromEntries(Object.entries(loginsTecnicos).filter(([tid]) => tecnicosSel.has(Number(tid)))),
        produtos: Array.from(produtosSel.entries()).map(([id, quantidade]) => ({ id, quantidade })),
      }),
    });
    // recarrega os técnicos: quem acabou de ser atribuído ganha o campo do login individual
    try {
      const ev = await fetch(`/api/eventos/${id}`).then((r) => r.json());
      if (ev?.tecnicos) {
        setEvento((atual) => (atual ? { ...atual, tecnicos: ev.tecnicos } : atual));
        setLoginsTecnicos((m) =>
          Object.fromEntries(
            ev.tecnicos.map((t: { id: number; login_individual?: string | null }) => [t.id, m[t.id] ?? t.login_individual ?? ""])
          )
        );
      }
    } catch {
      /* mantém a tela como está */
    }
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
            <Link
              href={`/eventos/${evento.id}/equipamentos`}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
            >
              📦 Equipamentos da prova
            </Link>
          </div>
        </div>
        <button onClick={remover} className="text-red-400 hover:text-red-300 text-sm">
          Remover evento
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {evento.qtd_notebook_atendimento > 0 && (
            <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4">
              <p className="text-xs text-cyan-200 uppercase tracking-wide">💻 Notebook para atendimento (Gestão)</p>
              <p className="mt-1 text-white">
                <span className="text-2xl font-bold">{evento.qtd_notebook_atendimento}</span>{" "}
                {evento.qtd_notebook_atendimento === 1 ? "unidade" : "unidades"}
                <span className="text-xs text-slate-400"> · Locação de Notebook para Eventos - Atendimento</span>
              </p>
            </div>
          )}
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
                <textarea
                  value={localEntrega}
                  onChange={(e) => setLocalEntrega(e.target.value)}
                  rows={2}
                  placeholder="Ex: Hotel X, Sede do cliente, Arena..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Datas e horários da entrega/retirada{" "}
                  <span className="text-slate-500">(o 1º dia é a data e hora da entrega; o mesmo do 📘 Book — Local da retirada)</span>
                </label>
                <EditorDatasRetirada
                  value={datasHorariosRetirada}
                  onChange={setDatasHorariosRetirada}
                  localAtual={localEntrega}
                  onLocal={aplicarLocalColado}
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
                <label className="block text-xs text-slate-400 mb-1">Datas e horários</label>
                <EditorDatasRetirada
                  value={datasHorariosRetirada}
                  onChange={setDatasHorariosRetirada}
                  localAtual={localEntrega}
                  onLocal={aplicarLocalColado}
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs text-slate-400">Endereço da retirada</label>
                  {localEntrega.trim() && enderecoRetirada.trim() !== localEntrega.trim() && (
                    <button
                      type="button"
                      onClick={() => setEnderecoRetirada(localEntrega)}
                      className="text-[11px] text-blue-400 hover:text-blue-300"
                    >
                      Copiar do Local de entrega
                    </button>
                  )}
                </div>
                <textarea
                  value={enderecoRetirada}
                  onChange={(e) => setEnderecoRetirada(e.target.value)}
                  rows={2}
                  placeholder={localEntrega.trim() ? "Vazio = usa o Local de entrega" : "Shopping Market Place — Av. Dr. Chucri Zaidan, 902"}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                {!enderecoRetirada.trim() && localEntrega.trim() && (
                  <p className="mt-1 text-[11px] text-slate-500 whitespace-pre-line">
                    No book vai o <strong className="text-slate-300">Local de entrega</strong>: {localEntrega.trim()}
                  </p>
                )}
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
              <p className="col-span-2 text-[11px] text-slate-500">
                Roteadores, celulares número, totens e notebooks vêm do card <strong className="text-slate-300">Produtos</strong>.
              </p>
              <NumAuto label="Roteadores" value={book.roteadores} />
              <NumAuto
                label="Celulares número"
                value={book.celulares_numero}
                dica={book.celulares_total > 0 ? `${book.celulares_total} celulares − online` : undefined}
              />
              <NumField label="Celular grupo online" value={qtdCelGrupo} onChange={setQtdCelGrupo} />
              <NumField label="Celulares produtos online" value={qtdCelProdutos} onChange={setQtdCelProdutos} />
              {book.online_excede && (
                <p className="col-span-2 text-xs text-amber-300">
                  ⚠️ Os celulares online ({book.celulares_grupo_online + book.celulares_produtos_online}) passam do total de celulares no
                  Produtos ({book.celulares_total}).
                </p>
              )}
              <NumAuto label="Totens" value={book.totens} />
              <NumAuto label="Notebooks" value={book.notebooks} />
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

          <CardKitsProva eventoId={Number(id)} />
          <CardKitsProva eventoId={Number(id)} categoria="numero" />

          <Card titulo="📘 Book — Links">
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
            </div>
          </Card>

          <CardEnvioProva eventoId={evento.id} tecnicos={evento.tecnicos} />

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
          <Card titulo="🔑 Logins da entrega de kit">
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                <strong className="text-slate-200">Todos os técnicos da prova veem</strong> (ex.: logins dos celulares). 1 por linha,
                formato livre (ex.: <span className="font-mono">Numero - staff@x.com - 01</span>). Também sai no book.
              </p>
              <textarea
                value={usuariosEvento}
                onChange={(e) => setUsuariosEvento(e.target.value)}
                rows={5}
                placeholder="Master - master@iguana.com.br - 123456&#10;Numero - staff@iguana.com.br - 01&#10;Produto - produto@iguana.com.br - 02"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">Grava em &quot;Salvar alterações&quot;.</span>
                <button
                  type="button"
                  disabled={!usuariosEvento.trim()}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(usuariosEvento);
                      setLoginsCopiados(true);
                      setTimeout(() => setLoginsCopiados(false), 2000);
                    } catch {
                      // sem permissão de clipboard: dá pra selecionar o texto na caixa
                    }
                  }}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg"
                >
                  {loginsCopiados ? "✓ Copiado" : "Copiar logins"}
                </button>
              </div>

              <div className="pt-3 mt-1 border-t border-slate-700 space-y-2">
                <p className="text-sm font-semibold text-white">🔒 Login individual de cada técnico</p>
                <p className="text-xs text-slate-400">
                  Só o próprio técnico vê no portal dele (ex.: <span className="font-mono">Master - email@x.com - 123456</span>).
                  Não sai no book nem para os outros técnicos da prova.
                </p>
                {evento.tecnicos.filter((t) => tecnicosSel.has(t.id)).length === 0 ? (
                  <p className="text-xs text-slate-500">Atribua e salve os técnicos da prova para preencher o login de cada um.</p>
                ) : (
                  evento.tecnicos
                    .filter((t) => tecnicosSel.has(t.id))
                    .map((t) => (
                      <label key={t.id} className="block">
                        <span className="text-xs text-slate-300">{t.nome}</span>
                        <input
                          value={loginsTecnicos[t.id] ?? ""}
                          onChange={(e) => setLoginsTecnicos((m) => ({ ...m, [t.id]: e.target.value }))}
                          maxLength={500}
                          placeholder="Master - email@x.com - senha"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono"
                        />
                      </label>
                    ))
                )}
                {[...tecnicosSel].some((tid) => !evento.tecnicos.some((t) => t.id === tid)) && (
                  <p className="text-xs text-amber-300">Técnico recém-marcado: salve as alterações para aparecer o campo do login dele.</p>
                )}
              </div>
            </div>
          </Card>

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
                {produtos.map((p) => {
                  const t = tipoDeProduto(p.nome);
                  const pedido = t ? pedidoPorTipo.get(t) : undefined;
                  return (
                    <div key={p.id} className="p-2 bg-slate-900 rounded">
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-white">{p.nome}</span>
                        <input
                          type="number"
                          min={0}
                          value={produtosSel.get(p.id) || 0}
                          onChange={(e) => setQtdProduto(p.id, parseInt(e.target.value) || 0)}
                          className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-right"
                        />
                      </div>
                      {t && pedido && pedido.primeiroProduto === p.id && (
                        <SeletorEquipamentosProduto
                          eventoId={evento.id}
                          tipo={t}
                          quantidade={pedido.qtd}
                          lista={inventario}
                          onMudou={carregarInventario}
                        />
                      )}
                    </div>
                  );
                })}
                {pedidoPorTipo.size > 0 && (
                  <p className="text-[11px] text-slate-500">
                    A escolha dos patrimônios é gravada na hora. Saída e retorno em{" "}
                    <Link href={`/eventos/${evento.id}/equipamentos`} className="text-blue-400 hover:underline">
                      📦 Equipamentos da prova
                    </Link>
                    .
                  </p>
                )}
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

          <Card titulo="📋 Conferência diária dos celulares">
            <PainelConferencia eventoId={evento.id} />
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
            {evento.tecnicos.some((t) => t.confirmado_em || t.obs_recebimento || t.devolvido_em) && (
              <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                {evento.tecnicos
                  .filter((t) => t.confirmado_em || t.obs_recebimento || t.devolvido_em)
                  .map((t) => (
                    <div key={t.id} className="text-sm">
                      <p className="text-slate-200">
                        {t.nome}
                        {t.confirmado_em && (
                          <span className="text-green-400 text-xs">
                            {" "}
                            · ✓ recebeu tudo em {new Date(t.confirmado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        )}
                      </p>
                      {t.obs_recebimento && (
                        <p className="mt-1 whitespace-pre-wrap rounded bg-amber-500/10 border border-amber-500/30 px-2 py-1 text-xs text-amber-200">
                          📝 {t.obs_recebimento}
                        </p>
                      )}
                      {t.devolvido_em && (
                        <p className="mt-1 text-xs text-cyan-300">
                          ↩ devolveu tudo em {new Date(t.devolvido_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      )}
                      {t.obs_devolucao && (
                        <p className="mt-1 whitespace-pre-wrap rounded bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 text-xs text-cyan-200">
                          📝 Devolução: {t.obs_devolucao}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
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

/** Número do book calculado do card Produtos (só leitura). */
function NumAuto({ label, value, dica }: { label: string; value: number; dica?: string }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="w-full bg-slate-900/50 border border-dashed border-slate-700 rounded-lg px-3 py-2 text-sm flex items-baseline justify-between gap-2">
        <span className="text-white font-semibold">{value}</span>
        <span className="text-[10px] text-slate-500 truncate">{dica || "do Produtos"}</span>
      </div>
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
