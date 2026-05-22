"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Device = { id: number; uuid: string; nome: string; patrimonio?: string | null };

export default function QRDisplay({ device, secureToken }: { device: Device; secureToken: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const [cheio, setCheio] = useState(false);

  useEffect(() => {
    const payload = JSON.stringify({ deviceId: device.id, uuid: device.uuid, secureToken });
    QRCode.toDataURL(payload, { width: 600, margin: 1, errorCorrectionLevel: "M" })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [device.id, device.uuid, secureToken]);

  const codigo = device.patrimonio || device.uuid.slice(0, 8).toUpperCase();

  const card = (grande: boolean) => (
    <div
      className={`bg-gradient-to-b from-blue-700 to-blue-950 rounded-2xl text-white flex flex-col items-center shadow-xl ${
        grande ? "w-full max-w-md p-8" : "w-full p-5"
      }`}
    >
      <div className="text-center mb-3">
        <p className="font-extrabold tracking-wide text-xl">CHRONOMAX</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-blue-200">Controle de Staff</p>
      </div>
      <p className={`font-bold text-center leading-tight ${grande ? "text-2xl" : "text-lg"}`}>{device.nome}</p>
      <p className="text-xs text-blue-200 mb-4">Código: {codigo}</p>
      <div className="bg-white rounded-xl p-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={`QR ${device.nome}`} className={grande ? "w-72 h-72" : "w-48 h-48"} />
        ) : (
          <div className={`bg-slate-100 ${grande ? "w-72 h-72" : "w-48 h-48"}`} />
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        {card(false)}
        <button
          onClick={() => setCheio(true)}
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          ⛶ Tela cheia
        </button>
      </div>

      {cheio && (
        <div className="fixed inset-0 z-50 bg-blue-950 flex flex-col items-center justify-center p-6 gap-4">
          {card(true)}
          <button onClick={() => setCheio(false)} className="text-blue-200 hover:text-white text-sm">
            Fechar ✕
          </button>
        </div>
      )}
    </>
  );
}
