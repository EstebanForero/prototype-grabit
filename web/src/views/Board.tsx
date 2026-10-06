import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Dossier, TrackingRow } from "@/lib/types";

export function Board({ active }: { active: boolean }) {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [error, setError] = useState("");
  const [dossier, setDossier] = useState<Dossier | null>(null);

  async function load() {
    try {
      setRows(await api<TrackingRow[]>("/api/seguimiento"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer la cola.");
    }
  }

  useEffect(() => {
    if (active) void load();
  }, [active]);

  const attention = rows.filter((row) => row.alerts.length || row.held).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operación</p>
          <h2 className="text-2xl font-semibold">Lo que necesita atención</h2>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()}>Actualizar</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Productos" value={rows.length} />
        <Metric label="Con alerta o retención" value={attention} />
        <Metric label="Al día" value={rows.length - attention} />
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}
      {rows.length === 0 && !error && (
        <Card>
          <CardContent>
            <p className="font-medium">Todavía no hay productos.</p>
            <p className="text-sm text-muted-foreground">Registre la compra. La guía entra cuando el correo de despacho llega al buzón.</p>
          </CardContent>
        </Card>
      )}
      {rows.map((row) => (
        <Card key={row.productId}>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{row.productId}</p>
              <p className="text-sm text-muted-foreground">{row.statusLabel} · día {row.daysInStatus}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {row.held ? <Badge variant="hold">retenido</Badge> : <Badge variant="secondary">{row.clientLabel}</Badge>}
              {row.alerts.map((alert) => <Badge key={alert.kind} variant="alert">{alert.kind}</Badge>)}
              {!row.alerts.length && <span className="text-sm text-muted-foreground">{row.holdReason || "Sin alertas"}</span>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void openDossier(row.productId, setDossier, setError)}>Ficha</Button>
          </CardContent>
        </Card>
      ))}
      {dossier && (
        <Card>
          <CardHeader>
            <CardTitle>{dossier.product.id}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">Estado interno: {dossier.product.status}. El cliente ve <strong>{dossier.clientLabel}</strong>.</p>
            {dossier.shipments.map((shipment) => (
              <div key={shipment.id} className="border-l-2 border-accent pl-3">
                <p className="font-medium">{shipment.trackingNumber || shipment.contactName || shipment.id}</p>
                <p className="text-sm text-muted-foreground">{shipment.destination} · {shipment.mode} · {shipment.recordStatus} · entró por {shipment.intake}</p>
              </div>
            ))}
            {!dossier.shipments.length && <p className="text-sm text-muted-foreground">Sin envíos.</p>}
            <h3 className="font-semibold">Decisiones</h3>
            {dossier.decisions.map((decision, index) => (
              <div key={`${decision.outcome}-${index}`} className="border-l-2 border-border pl-3">
                <p className="font-medium">{decision.outcome} {decision.status}</p>
                <p className="text-sm text-muted-foreground">{decision.reason}</p>
              </div>
            ))}
            {!dossier.decisions.length && <p className="text-sm text-muted-foreground">Todavía no hay una decisión.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent>
        <p className="text-3xl font-semibold text-navy">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

async function openDossier(id: string, setDossier: (dossier: Dossier) => void, setError: (message: string) => void) {
  try {
    setDossier(await api<Dossier>(`/api/productos/${encodeURIComponent(id)}`));
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : "No se pudo abrir la ficha.");
  }
}
