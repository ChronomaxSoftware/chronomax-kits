import { getSession } from "@/lib/session";
import AlterarSenha from "../config/AlterarSenha";
import InstalarApp from "../../(portal)/InstalarApp";
import ListaEnvios from "./ListaEnvios";
import { ComoInstalarApp } from "../telao/InstalarAppTelao";

/** Aba Envios: mandar o material e os números para o técnico (ex.: ajudante do Rio). */
export default async function EnviosPage() {
  const session = await getSession();
  const soEnvios = session.role === "envios";
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Envios</h1>
      <p className="text-slate-400 text-sm mb-5">
        Provas em que o material e os números vão para o técnico, pela data de envio. Toque no 📍 endereço para abrir o mapa e
        marque <strong className="text-slate-200">📦 Material enviado</strong> e{" "}
        <strong className="text-slate-200">🔢 Números enviados</strong> quando mandar.
      </p>
      {soEnvios && (
        <div className="mb-5">
          <InstalarApp publico="envios" />
        </div>
      )}
      <ListaEnvios podeAbrirProva={!soEnvios} />
      {soEnvios && <ComoInstalarApp publico="envios" />}
      {/* Quem é Só Envios não tem Configurações: a troca da própria senha fica aqui */}
      {soEnvios && <AlterarSenha />}
    </div>
  );
}
