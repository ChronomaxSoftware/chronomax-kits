"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tecnico = { id: number; nome: string; telefone: string | null };
type Produto = { id: number; nome: string; quantidade: number };
type Kit = { id: number; nome: string; descricao: string | null; imagem_path: string | null };

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
  qtd_totens: number;
  qtd_notebooks: number;
  qtd_roteadores: number;
  qtd_celulares_grupo_online: number;
  qtd_celulares_produtos_online: number;
  nivel: string | null;
  data_entrega: string | null;
  hora_entrega: string | null;
  local_entrega: string | null;
  briefing_data: string | null;
  briefing_hora: string | null;
  observacoes: string | null;
  url_gestao: string | null;
  datas_horarios_retirada: string | null;
  endereco_retirada: string | null;
  avisos_retirada: string | null;
  obs_retirada: string | null;
  cronograma_evento: string | null;
  passo_a_passo_kits: string | null;
  entrega_locais_separados: string | null;
  links_evento: string | null;
  usuarios_evento: string | null;
  tecnicos: Tecnico[];
  produtos: Produto[];
};

function formatarDataIso(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function linhasNaoVazias(s: string | null): string[] {
  return (s || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function montarTexto(ev: Evento): string {
  const linhas: string[] = [];
  linhas.push(`📘 *BOOK ENTREGA DE KIT*`);
  linhas.push(``);
  linhas.push(`*${ev.nome}*`);
  if (ev.cidade) linhas.push(`${ev.cidade}${ev.uf ? "/" + ev.uf : ""}`);
  linhas.push(`Data: ${ev.data}`);
  linhas.push(``);

  if (ev.briefing_data || ev.briefing_hora) {
    linhas.push(`🕐 *BRIEFING*`);
    if (ev.briefing_data) linhas.push(`Data: ${formatarDataIso(ev.briefing_data)}`);
    if (ev.briefing_hora) linhas.push(`Hora: ${ev.briefing_hora}`);
    linhas.push(``);
  }

  const dh = linhasNaoVazias(ev.datas_horarios_retirada);
  if (dh.length > 0 || ev.endereco_retirada) {
    linhas.push(`📍 *LOCAL DA RETIRADA DE KIT*`);
    if (dh.length > 0) {
      linhas.push(`Datas e horários:`);
      dh.forEach((l) => linhas.push(`• ${l}`));
    }
    if (ev.endereco_retirada) {
      linhas.push(`Local:`);
      linhas.push(ev.endereco_retirada);
    }
    if (ev.avisos_retirada) {
      linhas.push(``);
      linhas.push(ev.avisos_retirada);
    }
    if (ev.obs_retirada) {
      linhas.push(``);
      linhas.push(`Obs: ${ev.obs_retirada}`);
    }
    linhas.push(``);
  }

  const tem = (n: number) => n > 0;
  if (
    tem(ev.qtd_celulares) ||
    tem(ev.qtd_celulares_grupo_online) ||
    tem(ev.qtd_celulares_produtos_online) ||
    tem(ev.qtd_totens) ||
    tem(ev.qtd_notebooks) ||
    tem(ev.qtd_roteadores)
  ) {
    linhas.push(`📦 *EQUIPAMENTOS*`);
    if (tem(ev.qtd_roteadores)) linhas.push(`• ${ev.qtd_roteadores} ROTEADORES`);
    if (tem(ev.qtd_celulares)) linhas.push(`• ${ev.qtd_celulares} CELULARES NÚMERO`);
    if (tem(ev.qtd_celulares_grupo_online)) linhas.push(`• ${ev.qtd_celulares_grupo_online} CELULAR GRUPO ONLINE`);
    if (tem(ev.qtd_celulares_produtos_online)) linhas.push(`• ${ev.qtd_celulares_produtos_online} CELULARES PRODUTOS ONLINE`);
    if (tem(ev.qtd_totens)) linhas.push(`• ${ev.qtd_totens} TOTENS`);
    if (tem(ev.qtd_notebooks)) linhas.push(`• ${ev.qtd_notebooks} NOTEBOOKS`);
    if (ev.entrega_locais_separados) {
      linhas.push(``);
      linhas.push(`Entrega de locais separados:`);
      linhas.push(ev.entrega_locais_separados);
    }
    linhas.push(``);
  }

  const cronograma = linhasNaoVazias(ev.cronograma_evento);
  if (cronograma.length > 0) {
    linhas.push(`🗓 *CRONOGRAMA DO EVENTO*`);
    cronograma.forEach((l) => linhas.push(`• ${l}`));
    linhas.push(``);
  }

  const passos = linhasNaoVazias(ev.passo_a_passo_kits);
  if (passos.length > 0) {
    linhas.push(`✅ *PASSO A PASSO ENTREGA DE KITS*`);
    passos.forEach((l) => {
      const destaque = l.startsWith("!");
      const texto = destaque ? l.slice(1).trim() : l;
      linhas.push(destaque ? `⚠️ ${texto}` : `• ${texto}`);
    });
    linhas.push(``);
  }

  if (ev.tecnicos.length > 0) {
    linhas.push(`👷 *EQUIPE*`);
    for (const t of ev.tecnicos) {
      linhas.push(`• ${t.nome}${t.telefone ? " — " + t.telefone : ""}`);
    }
    linhas.push(``);
  }

  if (ev.observacoes) {
    linhas.push(`📝 *OBSERVAÇÕES*`);
    linhas.push(ev.observacoes);
    linhas.push(``);
  }

  if (ev.url_gestao) linhas.push(`Gestão: ${ev.url_gestao}`);
  return linhas.join("\n").trim();
}

function digitos(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

export default function BookEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [kits, setKits] = useState<Kit[]>([]);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch(`/api/eventos/${id}`).then((r) => r.json()).then(setEvento);
    fetch(`/api/eventos/${id}/kits`).then((r) => r.json()).then(setKits);
  }, [id]);

  const texto = useMemo(() => (evento ? montarTexto(evento) : ""), [evento]);

  async function copiar() {
    if (!texto) return;
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function whatsappLink(telefone: string | null): string {
    const tel = digitos(telefone);
    const numero = tel.length >= 10 ? (tel.startsWith("55") ? tel : "55" + tel) : "";
    const t = encodeURIComponent(texto);
    return numero ? `https://wa.me/${numero}?text=${t}` : `https://wa.me/?text=${t}`;
  }

  if (!evento) return <p className="text-slate-400">Carregando...</p>;

  const tecnicosComTel = evento.tecnicos.filter((t) => digitos(t.telefone).length >= 10);
  const dh = linhasNaoVazias(evento.datas_horarios_retirada);
  const cronograma = linhasNaoVazias(evento.cronograma_evento);
  const passos = linhasNaoVazias(evento.passo_a_passo_kits);

  type EquipItem = { qtd: number; label: string };
  const equipamentos: EquipItem[] = [
    { qtd: evento.qtd_roteadores, label: "ROTEADORES" },
    { qtd: evento.qtd_celulares, label: "CELULARES NÚMERO" },
    { qtd: evento.qtd_celulares_grupo_online, label: "CELULAR GRUPO ONLINE" },
    { qtd: evento.qtd_celulares_produtos_online, label: "CELULARES PRODUTOS ONLINE" },
    { qtd: evento.qtd_totens, label: "TOTENS" },
    { qtd: evento.qtd_notebooks, label: "NOTEBOOKS" },
  ].filter((e) => e.qtd > 0);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link href={`/eventos/${id}`} className="text-sm text-slate-400 hover:text-white">
          ← Voltar ao evento
        </Link>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={copiar}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            {copiado ? "✓ Copiado" : "📋 Copiar texto"}
          </button>
          <a
            href={whatsappLink(null)}
            target="_blank"
            rel="noreferrer"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            📱 WhatsApp
          </a>
          <button
            onClick={() => window.print()}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {tecnicosComTel.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 mb-4 print:hidden">
          <p className="text-xs text-slate-400 mb-2">Enviar pra técnico específico:</p>
          <div className="flex flex-wrap gap-2">
            {tecnicosComTel.map((t) => (
              <a
                key={t.id}
                href={whatsappLink(t.telefone)}
                target="_blank"
                rel="noreferrer"
                className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded"
              >
                📱 {t.nome}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Estilo dark book — múltiplas páginas */}
      <style jsx>{`
        .book-page {
          background: linear-gradient(180deg, #050810 0%, #050810 25%, #082863 55%, #0F3FB5 90%, #1565D8 100%);
          color: #fff;
          width: 100%;
          min-height: 1100px;
          padding: 60px 50px 90px;
          position: relative;
          margin-bottom: 12px;
          border-radius: 18px;
          page-break-after: always;
        }
        .book-page:last-child { page-break-after: auto; }
        .book-page .pagina-num {
          position: absolute; left: 32px; bottom: 26px;
          color: #1FA0DC; font-size: 18px; font-weight: 700;
        }
        .book-page .logo-rodape {
          position: absolute; right: 32px; bottom: 22px;
          display: flex; align-items: center; gap: 8px;
          color: #fff; font-weight: 900; letter-spacing: 1px; font-size: 14px;
        }
        .book-page .logo-rodape img { width: 36px; height: 36px; border-radius: 50%; }
        .book-page .logo-rodape .azul { color: #1FA0DC; }
        .book-page .header-barra {
          display: flex; align-items: stretch; gap: 12px; margin-bottom: 18px;
        }
        .book-page .header-barra .barra {
          width: 6px; background: linear-gradient(180deg, #F5871F 0%, #1FA0DC 100%);
          border-radius: 3px;
        }
        .book-page .header-barra h3 {
          font-size: 1.5rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.5px; line-height: 1.15;
        }
        @media print {
          :global(body) { background: #050810 !important; }
          .book-page { box-shadow: none; border-radius: 0; margin: 0; min-height: 100vh; }
        }
      `}</style>

      {/* PÁGINA 1 — CAPA */}
      <section className="book-page">
        <header className="flex items-center justify-center gap-3 mb-12">
          <img src="/logo-chronomax.jpg" alt="Chronomax" className="w-14 h-14 rounded-full" />
          <div className="text-center">
            <div className="text-4xl font-black tracking-wide leading-none">
              <span className="text-white">CHRONO</span>
              <span style={{ color: "#1FA0DC" }}>MAX</span>
              <sup className="text-base">®</sup>
            </div>
            <p className="text-[11px] tracking-[0.4em] text-slate-300 mt-1">MUITO ALÉM DO SEU TEMPO</p>
          </div>
        </header>

        <h1 className="text-center text-5xl font-bold mb-2">BOOK ENTREGA DE</h1>
        <h1 className="text-center text-5xl font-bold mb-8">KIT</h1>
        <hr className="border-slate-500/40 my-6" />

        <div className="text-center text-xl mb-12">
          <p className="font-semibold tracking-wide">{evento.nome}</p>
          {evento.cidade && (
            <p className="text-slate-200 mt-2">
              {evento.cidade}{evento.uf ? "/" + evento.uf : ""}
            </p>
          )}
          <p className="text-slate-200 mt-1">{evento.data}</p>
        </div>

        {(dh.length > 0 || evento.endereco_retirada || evento.avisos_retirada) && (
          <>
            <div className="header-barra mt-8">
              <div className="barra"></div>
              <h3 style={{ fontSize: "1rem" }}>Local da retirada de kit</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 bg-black/40 border border-slate-700 rounded-lg p-4 text-sm">
                {dh.length > 0 && (
                  <>
                    <p className="font-bold mb-2">DATAS E HORÁRIOS</p>
                    {dh.map((l, i) => <p key={i} className="text-slate-200">{l}</p>)}
                  </>
                )}
                {evento.endereco_retirada && (
                  <>
                    <p className="font-bold mt-4 mb-2">LOCAL</p>
                    <p className="text-slate-200 whitespace-pre-line">{evento.endereco_retirada}</p>
                  </>
                )}
                {evento.avisos_retirada && (
                  <p className="text-slate-200 mt-4 whitespace-pre-line">{evento.avisos_retirada}</p>
                )}
              </div>
              {evento.obs_retirada && (
                <div className="text-sm text-slate-200 leading-relaxed">{evento.obs_retirada}</div>
              )}
            </div>
          </>
        )}

        <span className="logo-rodape">
          <img src="/logo-chronomax.jpg" alt="" />
          <span><span className="azul">C</span>HRONO<span className="azul">MAX</span>®</span>
        </span>
      </section>

      {/* PÁGINA 2 — EQUIPAMENTOS */}
      {(equipamentos.length > 0 || evento.entrega_locais_separados) && (
        <section className="book-page">
          <span className="pagina-num">4</span>

          <div className="grid grid-cols-2 gap-8 mt-8">
            <div className="border border-slate-600 rounded-lg p-6">
              <div className="header-barra">
                <div className="barra"></div>
                <h3>Equipamentos que serão utilizados na entrega</h3>
              </div>
              <ul className="space-y-2 text-sm mt-4">
                {equipamentos.map((e, i) => (
                  <li key={i} className="text-slate-100">
                    <span className="text-slate-500 mr-2">•</span> {e.qtd} {e.label}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              {evento.entrega_locais_separados && (
                <div className="bg-black/40 border border-slate-700 rounded-lg p-4 text-sm whitespace-pre-line">
                  <p className="font-semibold mb-2">Entrega de locais separados</p>
                  <p className="text-slate-200">{evento.entrega_locais_separados}</p>
                </div>
              )}
            </div>
          </div>

          <span className="logo-rodape">
            <span className="azul">C</span>HRONO<span className="azul">MAX</span>®
          </span>
        </section>
      )}

      {/* PÁGINA 3 — CRONOGRAMA */}
      {cronograma.length > 0 && (
        <section className="book-page">
          <span className="pagina-num">5</span>
          <div className="header-barra">
            <div className="barra"></div>
            <h3>Cronograma do evento</h3>
          </div>
          <ul className="space-y-3 text-sm mt-4">
            {cronograma.map((l, i) => (
              <li key={i} className="text-slate-100">
                <span className="text-slate-500 mr-2">•</span> {l}
              </li>
            ))}
          </ul>
          <span className="logo-rodape">
            <span className="azul">C</span>HRONO<span className="azul">MAX</span>®
          </span>
        </section>
      )}

      {/* PÁGINA 4 — PASSO A PASSO */}
      {passos.length > 0 && (
        <section className="book-page">
          <span className="pagina-num">6</span>
          <div className="header-barra">
            <div className="barra"></div>
            <h3>Passo a passo entrega de kits</h3>
          </div>
          <ul className="space-y-3 text-sm mt-4">
            {passos.map((l, i) => {
              const destaque = l.startsWith("!");
              const texto = destaque ? l.slice(1).trim() : l;
              return (
                <li key={i} className={destaque ? "text-red-400 font-semibold" : "text-slate-100"}>
                  <span className="text-slate-500 mr-2">•</span> {texto}
                </li>
              );
            })}
          </ul>
          <span className="logo-rodape">
            <span className="azul">C</span>HRONO<span className="azul">MAX</span>®
          </span>
        </section>
      )}

      {/* PÁGINA TIPO DE KITS */}
      {kits.length > 0 && (
        <section className="book-page">
          <span className="pagina-num">3</span>
          <div className="header-barra">
            <div className="barra"></div>
            <h3>Tipo de kits</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            {kits.map((k) => (
              <div key={k.id} className="bg-orange-700/30 border border-orange-600/50 rounded-lg overflow-hidden">
                {k.imagem_path && (
                  <img src={`/api/uploads/${k.imagem_path}`} alt={k.nome} className="w-full h-56 object-cover" />
                )}
                <div className="p-4">
                  <p className="text-white font-bold text-center mb-2">{k.nome}</p>
                  {k.descricao && <p className="text-xs text-slate-100 text-center">{k.descricao}</p>}
                </div>
              </div>
            ))}
          </div>
          <span className="logo-rodape">
            <img src="/logo-chronomax.jpg" alt="" />
            <span><span className="azul">C</span>HRONO<span className="azul">MAX</span>®</span>
          </span>
        </section>
      )}

      {/* PÁGINA LOGAR (template fixo) */}
      <section className="book-page">
        <span className="pagina-num">7</span>
        <div className="header-barra">
          <div className="barra"></div>
          <h3>Logar com usuários e senha enviado</h3>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-8">
          <FotoTemplate src="/templates/logar-1.jpg" legenda="Tela de login" />
          <FotoTemplate src="/templates/logar-2.jpg" legenda="Menu principal" />
        </div>
        <span className="logo-rodape">
          <img src="/logo-chronomax.jpg" alt="" />
          <span><span className="azul">C</span>HRONO<span className="azul">MAX</span>®</span>
        </span>
      </section>

      {/* PÁGINA SINCRONIZAR BASE (template fixo) */}
      <section className="book-page">
        <span className="pagina-num">8</span>
        <div className="header-barra">
          <div className="barra"></div>
          <h3>Sincronizar base em todos celulares</h3>
        </div>
        <p className="text-sm text-slate-200 mb-4">Após isso fazer os teste com a busca</p>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <FotoTemplate src="/templates/sync-1.jpg" legenda="Sincronizar base de dados" />
          <FotoTemplate src="/templates/sync-2.jpg" legenda="Buscar atletas" />
        </div>

        <div className="mt-8 border-t border-slate-700 pt-6">
          <h4 className="font-bold mb-3 uppercase tracking-wide text-sm">Último dia de entrega</h4>
          <ul className="space-y-2 text-sm">
            <li>• Após o término da entrega, sincronizar todos celulares</li>
            <li>• Exportar a base e enviar para o apurador da prova junto com o infokit</li>
            <li>• Conferir todos equipamentos e se estão de acordo com o recebido anteriormente</li>
          </ul>
        </div>

        <span className="logo-rodape">
          <img src="/logo-chronomax.jpg" alt="" />
          <span><span className="azul">C</span>HRONO<span className="azul">MAX</span>®</span>
        </span>
      </section>

      {/* PÁGINA LINKS + USUÁRIOS */}
      {(evento.links_evento || evento.usuarios_evento) && (
        <section className="book-page">
          <span className="pagina-num">9</span>

          {evento.links_evento && (
            <>
              <div className="header-barra">
                <div className="barra"></div>
                <h3>Links</h3>
              </div>
              <div className="mt-4 mb-6">
                {linhasNaoVazias(evento.links_evento).map((l, i) => (
                  <p key={i} className="text-sm text-blue-300 break-all mb-2">{l}</p>
                ))}
              </div>
            </>
          )}

          {evento.usuarios_evento && (
            <>
              <div className="header-barra">
                <div className="barra"></div>
                <h3>Usuários</h3>
              </div>
              <div className="mt-4 font-mono text-sm">
                {linhasNaoVazias(evento.usuarios_evento).map((l, i) => (
                  <p key={i} className="text-slate-100 mb-1">{l}</p>
                ))}
              </div>
            </>
          )}

          <span className="logo-rodape">
            <img src="/logo-chronomax.jpg" alt="" />
            <span><span className="azul">C</span>HRONO<span className="azul">MAX</span>®</span>
          </span>
        </section>
      )}

      {/* PÁGINA 5 — EQUIPE + BRIEFING + OBS */}
      {(evento.tecnicos.length > 0 ||
        evento.briefing_data ||
        evento.briefing_hora ||
        evento.observacoes) && (
        <section className="book-page">
          <span className="pagina-num">7</span>

          {(evento.briefing_data || evento.briefing_hora) && (
            <>
              <h3 className="text-base font-semibold uppercase tracking-wide mb-2">🕐 Briefing</h3>
              <p className="text-lg mb-6">
                {evento.briefing_data && <strong>{formatarDataIso(evento.briefing_data)}</strong>}
                {evento.briefing_hora && <span className="ml-2">às {evento.briefing_hora}</span>}
              </p>
            </>
          )}

          {evento.tecnicos.length > 0 && (
            <>
              <h3 className="text-base font-semibold uppercase tracking-wide mb-3">👷 Equipe</h3>
              <ul className="space-y-1 text-sm mb-6">
                {evento.tecnicos.map((t) => (
                  <li key={t.id} className="text-slate-100">
                    <span className="font-semibold">{t.nome}</span>
                    {t.telefone && <span className="text-slate-300"> — {t.telefone}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {evento.observacoes && (
            <>
              <h3 className="text-base font-semibold uppercase tracking-wide mb-3">📝 Observações</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-100">{evento.observacoes}</p>
            </>
          )}

          {evento.url_gestao && (
            <p className="text-xs text-slate-400 mt-8 break-all">
              Link no Gestão: {evento.url_gestao}
            </p>
          )}

          <span className="logo-rodape">
            <span className="azul">C</span>HRONO<span className="azul">MAX</span>®
          </span>
        </section>
      )}
    </div>
  );
}

function FotoTemplate({ src, legenda }: { src: string; legenda?: string }) {
  const [erro, setErro] = useState(false);
  return (
    <div>
      {!erro ? (
        <img
          src={src}
          alt={legenda || ""}
          onError={() => setErro(true)}
          className="w-full h-72 object-contain bg-black/30 rounded-lg border border-slate-700"
        />
      ) : (
        <div className="w-full h-72 flex items-center justify-center bg-black/40 border border-dashed border-slate-600 rounded-lg text-center text-xs text-slate-400 p-4">
          [ Adicione o screenshot em <span className="font-mono">public{src}</span> ]
        </div>
      )}
      {legenda && <p className="text-xs text-slate-400 mt-2 text-center">{legenda}</p>}
    </div>
  );
}
