import EquipamentosTabs from "./EquipamentosTabs";

export default function EquipamentosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-4">Inventário</h1>
      <EquipamentosTabs />
      {children}
    </div>
  );
}
