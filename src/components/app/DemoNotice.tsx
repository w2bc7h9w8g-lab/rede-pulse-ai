import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={className}>
      Dados de demonstração
    </Badge>
  );
}

export function DemoNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
      <p className="text-warning-foreground">
        <strong>Ambiente de demonstração.</strong> As interações mostradas são fictícias e servem
        apenas para você conhecer o sistema. Para usar dados reais, conecte a conta profissional do
        Instagram da campanha.
      </p>
    </div>
  );
}

export function PrivacyNotice() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      O RedePulse analisa apenas as informações disponibilizadas pelas integrações autorizadas
      (comentários e menções). Não é possível garantir a identificação de toda e qualquer forma de
      interação. Nunca pedimos nem armazenamos a senha do Instagram de ninguém.
    </p>
  );
}
