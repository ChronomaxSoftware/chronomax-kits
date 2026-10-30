"use client";

import { useState } from "react";
import InstalarApp from "./InstalarApp";

const PASSOS = [
  {
    icone: "📅",
    titulo: "Suas provas",
    texto: "Aqui aparecem só as provas em que você está escalado, com data, cidade e local de entrega.",
  },
  {
    icone: "📦",
    titulo: "Confira o material",
    texto: "Em cada prova está a lista do material e os aparelhos (pelo patrimônio) que vão para você. Confira tudo ao receber.",
  },
  {
    icone: "✅",
    titulo: "Confirme o recebimento",
    texto: "Veio tudo certo? Toque em \"Recebi todo o material\". Faltou algo? Marque item a item, ajuste a quantidade e salve.",
  },
  {
    icone: "📝",
    titulo: "Observações",
    texto: "Se algo veio errado ou faltando, escreva no campo Observações e envie. A equipe Chronomax vê na hora.",
  },
  {
    icone: "📲",
    titulo: "Instale no celular",
    texto: "Deixe o ícone Chronomax na tela inicial e abra direto nas suas provas, sem precisar do link.",
    instalar: true,
  },
];

/** Tutorial curto do portal (primeiro acesso ou pelo botão "Como usar"). */
export default function TutorialPortal({ onFechar }: { onFechar: () => void }) {
  const [i, setI] = useState(0);
  const passo = PASSOS[i];
  const ultimo = i === PASSOS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div role="dialog" aria-label="Como usar o portal" className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6 text-center">
        <p className="text-xs text-slate-400 mb-4">
          Como usar · {i + 1} de {PASSOS.length}
        </p>
        <div className="text-5xl mb-3" aria-hidden="true">
          {passo.icone}
        </div>
        <h2 className="text-lg font-bold text-white mb-2">{passo.titulo}</h2>
        <p className="text-sm text-slate-300 mb-6">{passo.texto}</p>
        {"instalar" in passo && (
          <div className="text-left mb-5 -mt-2">
            <InstalarApp forcar />
          </div>
        )}
        <div className="flex justify-center gap-1.5 mb-5" aria-hidden="true">
          {PASSOS.map((_, k) => (
            <span key={k} className={`h-1.5 w-6 rounded-full ${k === i ? "bg-blue-500" : "bg-slate-600"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {i > 0 ? (
            <button onClick={() => setI(i - 1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm">
              Voltar
            </button>
          ) : (
            <button onClick={onFechar} className="flex-1 text-slate-400 hover:text-white py-2.5 text-sm">
              Pular
            </button>
          )}
          <button
            onClick={() => (ultimo ? onFechar() : setI(i + 1))}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm"
          >
            {ultimo ? "Entendi" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
