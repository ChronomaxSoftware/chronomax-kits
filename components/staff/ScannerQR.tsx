"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

export default function ScannerQR({ onResult }: { onResult: (text: string) => void }) {
  const rawId = useId();
  const elementId = "qr-" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const doneRef = useRef(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new mod.Html5Qrcode(elementId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            if (doneRef.current) return;
            doneRef.current = true;
            onResult(decodedText);
          },
          () => {
            /* ignora erros de leitura por frame */
          }
        );
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível acessar a câmera");
      }
    })();
    return () => {
      cancelled = true;
      const sc = scannerRef.current;
      if (sc) {
        sc.stop()
          .then(() => sc.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div id={elementId} className="w-full max-w-sm mx-auto rounded-xl overflow-hidden bg-black" />
      {erro ? (
        <p className="text-red-400 text-sm mt-2 text-center">
          {erro}. Verifique a permissão da câmera no navegador.
        </p>
      ) : (
        <p className="text-xs text-slate-400 mt-2 text-center">Aponte a câmera para o QR Code do aparelho.</p>
      )}
    </div>
  );
}
