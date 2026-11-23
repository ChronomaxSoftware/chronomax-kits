/**
 * Só no navegador: "print" da 1ª página de um PDF (arte do número de peito) como JPEG.
 * O pdf.js é carregado sob demanda; o worker fica em /public/pdfjs com a versão no nome
 * (ao atualizar o pdfjs-dist, copie o novo build/pdf.worker.min.mjs para lá).
 */

/** Lado maior da imagem gerada (o mesmo limite das fotos do card). */
const LADO_MAX = 1600;

export async function primeiraPaginaPdf(arquivo: File): Promise<File> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker-${pdfjs.version}.min.mjs`;

  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
  try {
    const doc = await tarefa.promise;
    const pagina = await doc.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const escala = LADO_MAX / Math.max(base.width, base.height);
    const viewport = pagina.getViewport({ scale: escala });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Navegador sem suporte a canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvas, canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (!blob) throw new Error("Não consegui gerar a imagem");
    const nome = arquivo.name.replace(/\.pdf$/i, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } finally {
    await tarefa.destroy(); // libera o worker e a memória do PDF
  }
}
