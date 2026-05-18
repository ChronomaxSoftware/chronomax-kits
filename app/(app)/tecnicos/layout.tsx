import TecnicosTabs from "./TecnicosTabs";

export default function TecnicosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Técnicos</h1>
      <TecnicosTabs />
      {children}
    </div>
  );
}
