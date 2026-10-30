import CelularesDaProva from "@/components/staff/CelularesDaProva";

export default function StaffProvaPage() {
  return (
    <div className="max-w-3xl">
      <p className="text-slate-300 text-sm mb-4">
        Celulares alocados à prova no Inventário: toque em um para vincular, trocar ou finalizar o colaborador — sem
        precisar bipar o QR.
      </p>
      <CelularesDaProva />
    </div>
  );
}
