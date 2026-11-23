"use client";

import { useEffect, useRef, useState } from "react";
import {
  DESCRICAO_KIT_MAX,
  NOME_KIT_MAX,
  ehPdf,
  nomeKitDoArquivo,
  nomeNumeroDoPdf,
  pastaProducaoAno,
  type CategoriaFoto,
} from "@/lib/kits-foto";
import FotoAmpliada from "./FotoAmpliada";

type Kit = { id: number; nome: string; descricao: string | null; foto_url: string | null };

/** Foto escolhida, ainda não salva. */
type Rascunho = { chave: string; arquivo: File; previa: string; nome: string; descricao: string; erro?: string };

const campo = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm";

/** Lado maior da foto salva: o bastante para o book e leve para o banco/celular. */
const LADO_MAX = 1600;

/** Reduz a foto no navegador (JPEG). Se não der (formato que o navegador não abre), manda a original. */
async function reduzirFoto(arquivo: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * escala);
    const h = Math.round(bmp.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.fillStyle = "#fff"; // PNG transparente não vira fundo preto no JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    return blob && blob.size < arquivo.size ? blob : arquivo;
  } catch {
    return arquivo;
  }
}

/**
 * Card "📘 Book — Tipos de Kit (com fotos)": escolhe várias fotos de uma vez; o nome do
 * kit vem do nome do arquivo (editável antes de salvar). Os kits aparecem no book da
 * prova e no portal do técnico.
 */
/** Textos do card por categoria (o comportamento é o mesmo). */
const TEXTOS: Record<CategoriaFoto, { titulo: string; botao: string; exemplo: string; nomeExemplo: string; item: string; placeholderNome: string; placeholderDescricao: string }> = {
  kit: {
    titulo: "📘 Book — Tipos de Kit (com fotos)",
    botao: "📷 Selecionar fotos dos kits",
    exemplo: "KIT-PREMIUM.jpg",
    nomeExemplo: "KIT PREMIUM",
    item: "kit",
    placeholderNome: "Nome do kit (ex: INSCRIÇÃO ESSENCIAL)",
    placeholderDescricao: "Descrição (ex: Camiseta Runner + Número de peito (chip) + Medalha conclusão...)",
  },
  numero: {
    titulo: "📘 Book — Números de peito (com fotos)",
    botao: "📷 Selecionar fotos dos números",
    exemplo: "NUMERO-10K.jpg",
    nomeExemplo: "NUMERO 10K",
    item: "número",
    placeholderNome: "Nome (ex: NÚMERO 10K, NÚMERO KIDS)",
    placeholderDescricao: "Descrição (ex: faixa de numeração 1 a 2000, cor, chip no verso...)",
  },
};

export default function CardKitsProva({
  eventoId,
  categoria = "kit",
  numeroProva,
  dataProva,
}: {
  eventoId: number;
  categoria?: CategoriaFoto;
  /** Só no card de números: para mostrar onde fica a arte (PDF) na produção. */
  numeroProva?: string;
  dataProva?: string | null;
}) {
  const t = TEXTOS[categoria];
  const [kits, setKits] = useState<Kit[]>([]);
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([]);
  const [salvando, setSalvando] = useState<{ feitos: number; total: number } | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [semFoto, setSemFoto] = useState({ nome: "", descricao: "" });
  const [editando, setEditando] = useState<{ id: number; nome: string; descricao: string } | null>(null);
  const [ampliada, setAmpliada] = useState<Kit | null>(null);
  const inputFotos = useRef<HTMLInputElement>(null);
  /** Lendo a 1ª página dos PDFs escolhidos */
  const [convertendo, setConvertendo] = useState<{ feitos: number; total: number } | null>(null);
  const [pastaCopiada, setPastaCopiada] = useState(false);
  const aceitaPdf = categoria === "numero";
  const pasta = pastaProducaoAno(dataProva);

  async function carregar() {
    const r = await fetch(`/api/eventos/${eventoId}/kits?categoria=${categoria}`);
    if (r.ok) setKits(await r.json());
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId, categoria]);

  // libera as prévias da memória quando o card sai da tela
  const rascunhosRef = useRef(rascunhos);
  rascunhosRef.current = rascunhos;
  useEffect(() => () => rascunhosRef.current.forEach((r) => URL.revokeObjectURL(r.previa)), []);

  async function escolher(lista: FileList | null) {
    if (!lista) return;
    const arquivos = Array.from(lista);
    if (inputFotos.current) inputFotos.current.value = "";
    setMsg(null);
    const agora = Date.now();
    const novo = (f: File, nome: string, i: number): Rascunho => ({
      chave: `${agora}-${i}-${f.name}`,
      arquivo: f,
      previa: URL.createObjectURL(f),
      nome,
      descricao: "",
    });

    // fotos entram na hora
    const fotos = arquivos.filter((f) => f.type.startsWith("image/"));
    setRascunhos((r) => [...r, ...fotos.map((f, i) => novo(f, nomeKitDoArquivo(f.name), i))]);

    // PDF (arte do número): "print" da 1ª página, nome = modalidade do arquivo
    const pdfs = aceitaPdf ? arquivos.filter(ehPdf) : [];
    if (pdfs.length === 0) return;
    setConvertendo({ feitos: 0, total: pdfs.length });
    const { primeiraPaginaPdf } = await import("@/lib/pdf-primeira-pagina");
    const falhas: string[] = [];
    for (let i = 0; i < pdfs.length; i++) {
      try {
        const img = await primeiraPaginaPdf(pdfs[i]);
        const r = novo(img, nomeNumeroDoPdf(pdfs[i].name), fotos.length + i);
        setRascunhos((lista) => [...lista, r]);
      } catch {
        falhas.push(pdfs[i].name);
      }
      setConvertendo({ feitos: i + 1, total: pdfs.length });
    }
    setConvertendo(null);
    if (falhas.length) setMsg({ tipo: "erro", texto: `Não consegui ler: ${falhas.join(", ")}` });
  }

  async function copiarPasta() {
    try {
      await navigator.clipboard.writeText(pasta);
      setPastaCopiada(true);
      setTimeout(() => setPastaCopiada(false), 2000);
    } catch {
      /* sem permissão de copiar: o caminho continua na tela */
    }
  }

  function mudar(chave: string, campo: "nome" | "descricao", valor: string) {
    setRascunhos((r) => r.map((x) => (x.chave === chave ? { ...x, [campo]: valor, erro: undefined } : x)));
  }

  function descartar(chave: string) {
    setRascunhos((r) => {
      const x = r.find((y) => y.chave === chave);
      if (x) URL.revokeObjectURL(x.previa);
      return r.filter((y) => y.chave !== chave);
    });
  }

  async function enviarKit(nome: string, descricao: string, foto?: Blob, nomeArquivo?: string) {
    const fd = new FormData();
    fd.append("nome", nome.trim());
    fd.append("categoria", categoria);
    if (descricao.trim()) fd.append("descricao", descricao.trim());
    if (foto) fd.append("imagem", foto, nomeArquivo || "kit.jpg");
    const r = await fetch(`/api/eventos/${eventoId}/kits`, { method: "POST", body: fd });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Falha ao salvar");
  }

  async function salvarTodos() {
    const semNome = rascunhos.filter((x) => !x.nome.trim());
    if (semNome.length) {
      setRascunhos((r) => r.map((x) => (x.nome.trim() ? x : { ...x, erro: `Dê um nome ao ${t.item}` })));
      setMsg({ tipo: "erro", texto: `Falta o nome em ${semNome.length} foto${semNome.length > 1 ? "s" : ""}.` });
      return;
    }
    setMsg(null);
    const fila = [...rascunhos];
    let ok = 0;
    setSalvando({ feitos: 0, total: fila.length });
    for (const x of fila) {
      try {
        const foto = await reduzirFoto(x.arquivo);
        await enviarKit(x.nome, x.descricao, foto, foto === x.arquivo ? x.arquivo.name : "kit.jpg");
        ok++;
        descartar(x.chave);
      } catch (e) {
        setRascunhos((r) => r.map((y) => (y.chave === x.chave ? { ...y, erro: (e as Error).message } : y)));
      }
      setSalvando({ feitos: ok, total: fila.length });
    }
    setSalvando(null);
    await carregar();
    const falhas = fila.length - ok;
    setMsg(
      falhas
        ? { tipo: "erro", texto: `${ok} salvo${ok === 1 ? "" : "s"}; ${falhas} com erro (veja abaixo).` }
        : { tipo: "ok", texto: `${ok} ${ok === 1 ? "foto salva" : "fotos salvas"}.` }
    );
  }

  async function adicionarSemFoto(e: React.FormEvent) {
    e.preventDefault();
    if (!semFoto.nome.trim()) return;
    try {
      await enviarKit(semFoto.nome, semFoto.descricao);
      setSemFoto({ nome: "", descricao: "" });
      await carregar();
    } catch (err) {
      setMsg({ tipo: "erro", texto: (err as Error).message });
    }
  }

  async function salvarEdicao() {
    if (!editando || !editando.nome.trim()) return;
    const r = await fetch(`/api/eventos/${eventoId}/kits/${editando.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: editando.nome, descricao: editando.descricao }),
    });
    if (r.ok) {
      setEditando(null);
      await carregar();
    } else setMsg({ tipo: "erro", texto: (await r.json().catch(() => ({}))).error || "Não foi possível salvar." });
  }

  async function remover(id: number) {
    if (!confirm(`Remover este ${t.item}?`)) return;
    await fetch(`/api/eventos/${eventoId}/kits/${id}`, { method: "DELETE" });
    await carregar();
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h2 className="font-bold mb-3 text-white">{t.titulo}</h2>

      {/* Várias fotos de uma vez */}
      <div className="mb-3">
        <input
          ref={inputFotos}
          type="file"
          accept={aceitaPdf ? "image/jpeg,image/png,image/webp,application/pdf,.pdf" : "image/jpeg,image/png,image/webp"}
          multiple
          onChange={(e) => escolher(e.target.files)}
          className="hidden"
          id={`fotos-${categoria}-${eventoId}`}
        />
        <label
          htmlFor={`fotos-${categoria}-${eventoId}`}
          className={`inline-block cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg ${
            convertendo ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {convertendo ? `📄 Lendo PDF ${convertendo.feitos}/${convertendo.total}…` : t.botao}
        </label>
        {aceitaPdf && (
          <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/60 p-2.5 text-xs text-slate-300 space-y-1">
            <p>
              📄 <strong className="text-white">Arte em PDF:</strong> escolha os PDFs da pasta{" "}
              <strong className="text-white">ARTE IMPRESSÃO</strong> (Ctrl+A seleciona todos). A 1ª página de cada PDF vira
              a foto e o nome vem do arquivo (<em>5K PCD - ELETRIC.pdf</em> → 5K PCD).
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <span>Pasta:</span>
              <code className="bg-black/40 px-1.5 py-0.5 rounded text-slate-200 break-all">{pasta}</code>
              <button
                type="button"
                onClick={copiarPasta}
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white"
              >
                {pastaCopiada ? "Copiado ✓" : "Copiar"}
              </button>
            </p>
            {numeroProva && (
              <p className="text-slate-400">
                Cole no campo do endereço da janela de abrir arquivo e entre na pasta que tem{" "}
                <strong className="text-amber-300">{numeroProva}</strong> no nome → ARTE IMPRESSÃO.
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-1">
          Pode escolher várias. O nome vem do nome do arquivo (ex.: <em>{t.exemplo}</em> → {t.nomeExemplo}) — confira antes
          de salvar.
        </p>
      </div>

      {rascunhos.length > 0 && (
        <div className="mb-4 rounded-lg border border-blue-500/40 bg-blue-500/5 p-3 space-y-3">
          <p className="text-xs font-semibold text-blue-200">
            {rascunhos.length} foto{rascunhos.length > 1 ? "s" : ""} para salvar
          </p>
          {rascunhos.map((x) => (
            <div key={x.chave} className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.previa} alt="" className={`h-20 rounded flex-shrink-0 ${categoria === "numero" ? "w-28 object-contain bg-white" : "w-20 object-cover"}`} />
              <div className="flex-1 min-w-0 space-y-1.5">
                <input
                  value={x.nome}
                  onChange={(e) => mudar(x.chave, "nome", e.target.value)}
                  maxLength={NOME_KIT_MAX}
                  placeholder={`Nome do ${t.item}`}
                  aria-label={`Nome do ${t.item} (${x.arquivo.name})`}
                  className={`${campo} ${x.erro && !x.nome.trim() ? "border-red-500" : ""}`}
                />
                <textarea
                  value={x.descricao}
                  onChange={(e) => mudar(x.chave, "descricao", e.target.value)}
                  maxLength={DESCRICAO_KIT_MAX}
                  rows={1}
                  placeholder="Descrição (opcional): camiseta + número de peito + medalha…"
                  className={campo}
                />
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-slate-500 truncate">{x.arquivo.name}</span>
                  {x.erro && <span className="text-red-400">{x.erro}</span>}
                  <button
                    type="button"
                    onClick={() => descartar(x.chave)}
                    disabled={!!salvando}
                    className="ml-auto text-red-400 hover:text-red-300 disabled:opacity-40"
                  >
                    Tirar
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={salvarTodos}
              disabled={!!salvando}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
            >
              {salvando ? `Salvando ${salvando.feitos}/${salvando.total}…` : `Salvar todos (${rascunhos.length})`}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`text-xs mb-3 ${msg.tipo === "erro" ? "text-red-400" : "text-emerald-400"}`} role={msg.tipo === "erro" ? "alert" : "status"}>
          {msg.texto}
        </p>
      )}

      {kits.length === 0 ? (
        <p className="text-xs text-slate-400 mb-3">Nenhum {t.item} cadastrado ainda</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {kits.map((k) =>
            editando?.id === k.id ? (
              <div key={k.id} className="bg-slate-900 rounded-lg p-2 space-y-1.5 col-span-2 sm:col-span-1">
                <input
                  value={editando.nome}
                  onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                  maxLength={NOME_KIT_MAX}
                  aria-label="Nome do kit"
                  className={campo}
                />
                <textarea
                  value={editando.descricao}
                  onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
                  maxLength={DESCRICAO_KIT_MAX}
                  rows={2}
                  aria-label="Descrição do kit"
                  className={campo}
                />
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={salvarEdicao}
                    disabled={!editando.nome.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded"
                  >
                    Salvar
                  </button>
                  <button type="button" onClick={() => setEditando(null)} className="text-slate-400 hover:text-white">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div key={k.id} className="bg-slate-900 rounded-lg p-2 relative">
                {k.foto_url && (
                  <button type="button" onClick={() => setAmpliada(k)} className="block w-full mb-2" title="Ampliar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={k.foto_url} alt={k.nome} loading="lazy" className="w-full h-32 object-cover rounded" />
                  </button>
                )}
                <p className="text-sm text-white font-semibold pr-12">{k.nome}</p>
                {k.descricao && <p className="text-xs text-slate-400 line-clamp-2 mt-1">{k.descricao}</p>}
                <div className="absolute top-1 right-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditando({ id: k.id, nome: k.nome, descricao: k.descricao || "" })}
                    title="Editar nome/descrição"
                    className="bg-slate-700/90 hover:bg-slate-600 text-white text-xs px-2 py-0.5 rounded"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(k.id)}
                    title="Remover kit"
                    className="bg-red-600/80 hover:bg-red-600 text-white text-xs px-2 py-0.5 rounded"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Kit sem foto */}
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-white">+ Adicionar {t.item} sem foto</summary>
        <form onSubmit={adicionarSemFoto} className="space-y-2 mt-2">
          <input
            value={semFoto.nome}
            onChange={(e) => setSemFoto({ ...semFoto, nome: e.target.value })}
            maxLength={NOME_KIT_MAX}
            placeholder={t.placeholderNome}
            className={campo}
          />
          <textarea
            value={semFoto.descricao}
            onChange={(e) => setSemFoto({ ...semFoto, descricao: e.target.value })}
            maxLength={DESCRICAO_KIT_MAX}
            rows={2}
            placeholder={t.placeholderDescricao}
            className={campo}
          />
          <button
            type="submit"
            disabled={!semFoto.nome.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-1.5 rounded text-sm"
          >
            + Adicionar
          </button>
        </form>
      </details>

      {ampliada?.foto_url && <FotoAmpliada kit={ampliada} onFechar={() => setAmpliada(null)} />}
    </div>
  );
}
