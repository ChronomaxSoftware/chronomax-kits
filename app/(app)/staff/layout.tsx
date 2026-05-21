import StaffTabs from "./StaffTabs";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Controle de Staff</h1>
      <p className="text-slate-400 text-sm mb-4">
        Controle em tempo real de qual colaborador está usando cada celular nos eventos, via QR Code.
      </p>
      <StaffTabs />
      {children}
    </div>
  );
}
