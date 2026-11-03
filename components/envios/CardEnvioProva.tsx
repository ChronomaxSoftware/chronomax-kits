"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ENDERECO_MAX, OBS_ENVIO_MAX, linkMapa, rotuloDataEnvio, situacaoEnvio } from "@/lib/envios";

type Envio = {
  evento_id: number;
  data_envio: string | null;
  endereco: string | null;
  material_em: string | null;
  material_por: string | null;
  numeros_em: string | null;
  numeros_por: string | null;
  obs: string | null;
};

type TecnicoProva = { id: number; nome: string; endereco?: string | null };

const campo = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm";

function quando(iso: string | null, por: string | null) {
  if (!iso) return "";
  const d = new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return por ? `${d} · ${por}` : d;
}

/**
 * Card "📦 Envio" da prova: inclui/tira a prova da aba Envios (quem manda o material e
 * os números para o técnico, ex.: o ajudante do Rio), com a data de envio, o endereço
 * desta entrega (em branco = o do cadastro do técnico) e uma observação.
 */
export default function CardEnvioProva({ eventoId, tecnicos }: { eventoId: number; tecnicos: TecnicoProva[] }) {
  const [envio, setEnvio] = useState<Envio | null | undefined>(undefined);
  const [dataEnvio, setDataEnvio] = useState("");
  const [endereco, setEndereco] = useState("");
  const [obs, setObs] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  function preencher(e: Envio | null) {
    setEnvio(e);
    setDataEnvio(e?.data_envio || "");
    setEndereco(e?.endereco || "");
    setObs(e?.obs || "");
  }

  useEffect(() => {
    fetch(`/api/eventos/${eventoId}/envio`)
      .then((r) => (r.ok ? r.json() : null))
      .then(preencher)
      .catch(() => setEnvio(null));
  }, [eventoId]);

  async function salvar(incluindo = false) {
    setMsg(null);
    setOcupado(true);
    try {
      const r = await fetch(`/api/eventos/${eventoId}/envio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Só o que mudou desde que a tela abriu: não apaga um recado que quem envia escreveu depois
        body: JSON.stringify({
          ...(dataEnvio !== (envio?.data_envio || "") ? { data_envio: dataEnvio } : {}),
          ...(endereco.trim() !== (envio?.endereco || "") ? { endereco } : {}),
          ...(obs.trim() !== (envio?.obs || "") ? { obs } : {}),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ tipo: "erro", texto: d.error || "Não foi possível salvar." });
      else {
        preencher(d);
        setMsg({ tipo: "ok", texto: incluindo ? "Incluída na aba Envios." : "Envio salvo." });
      }
    } catch {
      setMsg({ tipo: "erro", texto: "Falha de conexão." });
    } finally {
      setOcupado(false);
    }
  }

  async function tirar() {
    if (!confirm("Tirar esta prova da aba Envios? As marcações de enviado desta prova são apagadas.")) return;
    setMsg(null);
    setOcupado(true);
    try {
      const r = await fetch(`/api/eventos/${eventoId}/envio`, { method: "DELETE" });
      if (r.ok) {
        preencher(null);
        setMsg({ tipo: "ok", texto: "Tirada da aba Envios." });
      } else setMsg({ tipo: "erro", texto: "Não foi possível tirar." });
    } finally {
      setOcupado(false);
    }
  }

  if (envio === undefined) {
    return (
      <Moldura>
        <p className="text-sm text-slate-400">Carregando…</p>
      </Moldura>
    );
  }

  const aviso = msg && (
    <p className={`text-xs ${msg.tipo === "erro" ? "text-red-400" : "text-emerald-400"}`} role={msg.tipo === "erro" ? "alert" : "status"}>
      {msg.texto}
    </p>
  );

  if (!envio) {
    return (
      <Moldura>
        <p className="text-sm text-slate-400 mb-3">
          Esta prova não está na aba <strong className="text-slate-200">Envios</strong>. Inclua quando alguém (ex.: o ajudante do
          Rio) for mandar o material e os números para o técnico.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data de envio</label>
            <input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} className={campo} />
          </div>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => salvar(true)}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
          >
            📦 Incluir no envio
          </button>
        </div>
        <div className="mt-2">{aviso}</div>
      </Moldura>
    );
  }

  const situacao = situacaoEnvio(envio);
  const semEndereco = tecnicos.filter((t) => !String(t.endereco || "").trim());

  return (
    <Moldura>
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        <span
          className={`px-2 py-0.5 rounded-full ${
            situacao === "enviado"
              ? "bg-emerald-600/30 text-emerald-300"
              : situacao === "parcial"
                ? "bg-amber-500/20 text-amber-300"
                : "bg-slate-700 text-slate-300"
          }`}
        >
          {situacao === "enviado" ? "✅ Tudo enviado" : situacao === "parcial" ? "Enviado em parte" : "Aguardando envio"}
        </span>
        {envio.data_envio && <span className="text-slate-400">Envio em {rotuloDataEnvio(envio.data_envio)}</span>}
        <Link href="/envios" className="ml-auto text-blue-400 hover:text-blue-300">
          Abrir aba Envios →
        </Link>
      </div>

      <ul className="text-xs text-slate-400 mb-3 space-y-0.5">
        <li>
          ✅ Material: {envio.material_em ? <span className="text-emerald-300">{quando(envio.material_em, envio.material_por)}</span> : "ainda não"}
        </li>
        <li>
          ✅ Números: {envio.numeros_em ? <span className="text-emerald-300">{quando(envio.numeros_em, envio.numeros_por)}</span> : "ainda não"}
        </li>
      </ul>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Data de envio do material</label>
          <input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Endereço desta entrega (em branco = o do cadastro do técnico)</label>
          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            maxLength={ENDERECO_MAX}
            placeholder="Só se for outro lugar nesta prova"
            className={campo}
          />
          {!endereco.trim() &&
            tecnicos.map((t) =>
              t.endereco ? (
                <p key={t.id} className="mt-1 text-xs text-slate-500">
                  {t.nome}:{" "}
                  <a href={linkMapa(t.endereco) || "#"} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                    📍 {t.endereco}
                  </a>
                </p>
              ) : null
            )}
          {!endereco.trim() && (tecnicos.length === 0 || semEndereco.length > 0) && (
            <p className="mt-1 text-xs text-amber-300">
              {tecnicos.length === 0
                ? "Nenhum técnico atribuído ainda."
                : `Sem endereço no cadastro: ${semEndereco.map((t) => t.nome).join(", ")}. `}
              {tecnicos.length > 0 && (
                <Link href="/tecnicos" className="underline">
                  Cadastrar em Técnicos
                </Link>
              )}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Observação (aparece para quem envia)</label>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={2}
            maxLength={OBS_ENVIO_MAX}
            placeholder="Ex.: entregar na portaria, levar 2 caixas de números"
            className={campo}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => salvar()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
          >
            Salvar envio
          </button>
          <button type="button" disabled={ocupado} onClick={tirar} className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50">
            Tirar do envio
          </button>
          {aviso}
        </div>
      </div>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h2 className="font-bold mb-3 text-white">📦 Envio (material + números)</h2>
      {children}
    </div>
  );
}
