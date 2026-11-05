import GerenciarTreinamento from "./GerenciarTreinamento";

/** Aba Treinamento: vídeos (YouTube/Drive) que os técnicos assistem no portal. */
export default function TreinamentoPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">🎓 Treinamento</h1>
      <p className="text-slate-400 text-sm mb-5">
        Vídeos que aparecem na aba <strong className="text-slate-200">Treinamento</strong> do portal do técnico. Cole o link do{" "}
        <strong className="text-slate-200">YouTube</strong> (de preferência &quot;Não listado&quot;) ou do{" "}
        <strong className="text-slate-200">Google Drive</strong> (compartilhado como &quot;Qualquer pessoa com o link&quot;).
      </p>
      <GerenciarTreinamento />
    </div>
  );
}
