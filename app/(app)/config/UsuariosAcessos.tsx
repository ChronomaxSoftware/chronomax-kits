"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { normalizarNome } from "@/lib/tecnico-match";
import BotaoConviteTecnico from "@/components/BotaoConviteTecnico";

type Usuario = { id: number; username: string; name: string; ativo: number; created_at: string | null };
type Tecnico = { id: number; nome: string; telefone: string | null; login: string | null; tem_senha: number; ativo: number };

const campo = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm";

/**
 * Configurações → Usuários e acessos:
 * - usuários do escritório (acesso total): criar, trocar senha, desativar/reativar;
 * - técnicos: definir/trocar senha do portal (só vê as provas dele) ou tirar o acesso.
 */
export default function UsuariosAcessos() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [novo, setNovo] = useState({ name: "", username: "", password: "" });
  const [senhaDe, setSenhaDe] = useState<{ tipo: "u" | "t"; id: number; nome: string } | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [busca, setBusca] = useState("");
  const [soComAcesso, setSoComAcesso] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const [ru, rt] = await Promise.all([fetch("/api/usuarios"), fetch("/api/tecnicos")]);
    if (ru.ok) setUsuarios(await ru.json());
    if (rt.ok) setTecnicos(await rt.json());
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function chamar(url: string, method: string, body: unknown, sucesso: string) {
    setMsg(null);
    setOcupado(true);
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: d.error || "Não foi possível salvar." });
        return false;
      }
      setMsg({ tipo: "ok", texto: sucesso });
      await carregar();
      return true;
    } catch {
      setMsg({ tipo: "erro", texto: "Falha de conexão." });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (await chamar("/api/usuarios", "POST", novo, `Usuário ${novo.username.trim().toLowerCase()} criado.`)) {
      setNovo({ name: "", username: "", password: "" });
    }
  }

  async function salvarSenha(e: FormEvent) {
    e.preventDefault();
    if (!senhaDe) return;
    const ok =
      senhaDe.tipo === "u"
        ? await chamar(`/api/usuarios/${senhaDe.id}`, "PUT", { password: novaSenha }, `Senha de ${senhaDe.nome} alterada.`)
        : await chamar(`/api/tecnicos/${senhaDe.id}`, "PUT", { senha: novaSenha }, `Acesso de ${senhaDe.nome} salvo.`);
    if (ok) {
      setSenhaDe(null);
      setNovaSenha("");
    }
  }

  const tecnicosFiltrados = useMemo(() => {
    const q = normalizarNome(busca);
    return tecnicos.filter(
      (t) =>
        (!soComAcesso || t.tem_senha) &&
        (!q || normalizarNome(t.nome).includes(q) || (t.telefone || "").includes(busca.trim()))
    );
  }, [tecnicos, busca, soComAcesso]);

  return (
    <section id="usuarios" className="bg-slate-800 rounded-xl p-6 mt-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Usuários e acessos</h2>
        <p className="text-xs text-slate-400">
          Usuário do escritório tem acesso total. Técnico entra pelo telefone e vê só as provas dele, com o material e o
          botão de confirmar o recebimento. Para o técnico, o mais fácil é mandar o 🔗 link de acesso: ele mesmo cria a
          senha.
        </p>
      </div>

      {msg && (
        <p
          role={msg.tipo === "erro" ? "alert" : "status"}
          className={`rounded-lg border px-3 py-2 text-sm ${
            msg.tipo === "erro"
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {msg.texto}
        </p>
      )}

      {senhaDe && (
        <form onSubmit={salvarSenha} className="rounded-lg border border-blue-500/40 bg-slate-900/60 p-3 space-y-2">
          <p className="text-sm text-white">
            {senhaDe.tipo === "u" ? "Nova senha de" : "Senha do portal de"} <strong>{senhaDe.nome}</strong>
          </p>
          <input
            type="password"
            autoFocus
            className={campo}
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder={senhaDe.tipo === "u" ? "Mínimo de 10 caracteres" : "Mínimo de 8 caracteres"}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setSenhaDe(null)} className="text-sm text-slate-400 px-3 py-2">
              Cancelar
            </button>
            <button disabled={!novaSenha || ocupado} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
              Salvar senha
            </button>
          </div>
        </form>
      )}

      {/* Usuários do escritório */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Usuários do escritório (acesso total)</h3>
        <form onSubmit={criar} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <input aria-label="Nome" className={campo} placeholder="Nome" value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} />
          <input aria-label="Login" className={campo} placeholder="Login (ex.: maria)" value={novo.username} onChange={(e) => setNovo({ ...novo, username: e.target.value })} />
          <input
            aria-label="Senha"
            type="password"
            className={campo}
            placeholder="Senha (mín. 10)"
            value={novo.password}
            onChange={(e) => setNovo({ ...novo, password: e.target.value })}
          />
          <button
            disabled={ocupado || !novo.name || !novo.username || !novo.password}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg whitespace-nowrap"
          >
            + Criar
          </button>
        </form>
        <ul className="divide-y divide-slate-700 rounded-lg border border-slate-700">
          {usuarios.map((u) => (
            <li key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0">
                <span className={u.ativo ? "text-white" : "text-slate-500 line-through"}>{u.name}</span>{" "}
                <span className="text-xs text-slate-400 font-mono">{u.username}</span>
                {!u.ativo && <span className="ml-2 text-xs text-amber-300">desativado</span>}
              </div>
              <div className="flex gap-3 text-xs">
                <button onClick={() => { setSenhaDe({ tipo: "u", id: u.id, nome: u.name }); setNovaSenha(""); }} className="text-blue-400 hover:text-blue-300">
                  Trocar senha
                </button>
                <button
                  disabled={ocupado}
                  onClick={() =>
                    (u.ativo ? confirm(`Desativar ${u.name}? Ele perde o acesso em até 1 minuto.`) : true) &&
                    chamar(`/api/usuarios/${u.id}`, "PUT", { ativo: !u.ativo }, u.ativo ? `${u.name} desativado.` : `${u.name} reativado.`)
                  }
                  className={u.ativo ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"}
                >
                  {u.ativo ? "Desativar" : "Reativar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Técnicos */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Técnicos (portal)</h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" className="accent-blue-600" checked={soComAcesso} onChange={(e) => setSoComAcesso(e.target.checked)} />
              Só quem tem acesso
            </label>
            <input aria-label="Buscar técnico" className={`${campo} sm:w-48`} placeholder="Buscar nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        {tecnicosFiltrados.length === 0 ? (
          <p className="text-sm text-slate-400">
            {soComAcesso ? "Nenhum técnico com acesso ainda. Desmarque \"Só quem tem acesso\" para dar acesso." : "Nenhum técnico encontrado."}{" "}
            <Link href="/tecnicos" className="text-blue-400 hover:underline">
              Cadastro de técnicos
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-700 rounded-lg border border-slate-700 max-h-96 overflow-y-auto">
            {tecnicosFiltrados.map((t) => (
              <li key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="text-white">{t.nome}</span>{" "}
                  {t.tem_senha ? (
                    <span className="text-xs text-green-400">✓ login {t.login}</span>
                  ) : (
                    <span className="text-xs text-slate-500">sem acesso{t.telefone ? "" : " · sem telefone"}</span>
                  )}
                  <div className="mt-1">
                    <BotaoConviteTecnico tecnico={t} />
                  </div>
                </div>
                <div className="flex gap-3 text-xs">
                  <button
                    onClick={() => { setSenhaDe({ tipo: "t", id: t.id, nome: t.nome }); setNovaSenha(""); }}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {t.tem_senha ? "Trocar senha" : "Definir senha"}
                  </button>
                  {t.tem_senha ? (
                    <button
                      disabled={ocupado}
                      onClick={() =>
                        confirm(`Tirar o acesso de ${t.nome} ao portal?`) &&
                        chamar(`/api/tecnicos/${t.id}`, "PUT", { remover_acesso: true }, `Acesso de ${t.nome} removido.`)
                      }
                      className="text-red-400 hover:text-red-300"
                    >
                      Tirar acesso
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
