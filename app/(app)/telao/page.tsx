import { getSession } from "@/lib/session";
import AlterarSenha from "../config/AlterarSenha";
import ListaTelao from "./ListaTelao";
import { CardInstalarTelao, ComoInstalarTelao } from "./InstalarAppTelao";

/** Aba Telão: provas com telão no pedido — cobrar a arte do cliente e dar o ok do telão pronto. */
export default async function TelaoPage() {
  const session = await getSession();
  const soTelao = session.role === "telao";
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Telão</h1>
      <p className="text-slate-400 text-sm mb-5">
        Provas com Foto Resultados Arena, Foto Certificado Arena ou Output ao vivo no pedido do Gestão. A arte é do cliente:
        marque <strong className="text-slate-200">🎨 Arte cobrada</strong> quando cobrar e{" "}
        <strong className="text-slate-200">📺 Telão pronto</strong> quando estiver tudo certo.
      </p>
      {soTelao && (
        <div className="mb-5">
          <CardInstalarTelao />
        </div>
      )}
      <ListaTelao podeAbrirProva={!soTelao} />
      {soTelao && <ComoInstalarTelao />}
      {/* Quem é Só Telão não tem Configurações: a troca da própria senha fica aqui */}
      {soTelao && <AlterarSenha />}
    </div>
  );
}
