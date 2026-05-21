"use client";

import { useState } from "react";
import ScannerControl from "@/components/staff/ScannerControl";
import DashboardStaff from "@/components/staff/DashboardStaff";
import HistoricoStaff from "@/components/staff/HistoricoStaff";

type Aba = "scanner" | "uso" | "hist";

export default function PortalStaffPage() {
  const [aba, setAba] = useState<Aba>("scanner");

  const tab = (id: Aba, label: string) => (
    <button
      onClick={() => setAba(id)}
      className={`px-4 py-2 text-sm rounded-t-lg whitespace-nowrap ${
        aba === id ? "bg-slate-800 text-white border-b-2 border-blue-500" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Controle de Staff</h1>
      <div className="flex gap-1 border-b border-slate-700 overflow-x-auto">
        {tab("scanner", "Bipar QR")}
        {tab("uso", "Em uso")}
        {tab("hist", "Histórico")}
      </div>

      {aba === "scanner" && (
        <div className="max-w-xl">
          <p className="text-slate-300 text-sm mb-4">
            Bipe o QR Code que está na tela do aparelho para vincular, trocar ou finalizar o colaborador.
          </p>
          <ScannerControl />
        </div>
      )}
      {aba === "uso" && <DashboardStaff />}
      {aba === "hist" && <HistoricoStaff podeExportar={false} />}
    </div>
  );
}
