import ScannerControl from "@/components/staff/ScannerControl";

export default function StaffScannerPage() {
  return (
    <div className="max-w-xl">
      <p className="text-slate-300 text-sm mb-4">
        Bipe o QR Code que está na tela do aparelho para vincular, trocar ou finalizar o colaborador responsável.
      </p>
      <ScannerControl />
    </div>
  );
}
