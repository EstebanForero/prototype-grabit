import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { stageIndex, CLIENT_STAGES } from "@/lib/stages";
import type { Dossier, TrackingRow } from "@/lib/types";
import { ProductSheet } from "@/views/ProductSheet";

export function Board({ active }: { active: boolean }) {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [guide, setGuide] = useState("");
  const [trackNote, setTrackNote] = useState("");
  const [pulling, setPulling] = useState(false);

  async function load() {
    try {
      setRows(await api<TrackingRow[]>("/api/seguimiento"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer la cola.");
    }
  }

  useEffect(() => {
    if (!active) return;
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
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
      <Card>
        <CardHeader>
          <CardTitle>17TRACK</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Trae las guías que ya están en la cuenta de 17TRACK y las deja guardadas en esta cola.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={guide} onChange={(event) => setGuide(event.target.value)} placeholder="Número de guía real" />
            <Button type="button" disabled={pulling || guide.trim() === ""} onClick={() => void consultGuide(guide, setTrackNote, setError, setPulling, load)}>Consultar</Button>
            <Button type="button" variant="outline" disabled={pulling} onClick={() => void pullTracks(setTrackNote, setError, setPulling, load)}>Traer registradas</Button>
          </div>
          {trackNote && <p className="text-sm text-muted-foreground">{trackNote}</p>}
        </CardContent>
      </Card>
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
            <p className="text-sm text-muted-foreground">Registre la compra. La guía entra cuando el correo de despacho llega al email.</p>
          </CardContent>
        </Card>
      )}
      {rows.map((row) => {
        const open = selectedId === row.productId;
        const step = stageIndex(row.status);
        return (
          <Card key={row.productId} className={open ? "ring-2 ring-ring" : undefined}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void toggleProduct(row.productId, selectedId, setSelectedId, setDossier, setError)}>
                  <p className="font-semibold">{row.trackingNumber || row.clientLabel}</p>
                  <p className="text-sm text-muted-foreground">{row.clientLabel} · día {row.daysInStatus}{row.productId !== row.trackingNumber ? ` · ${row.productId}` : ""}</p>
                  {row.trackingNumber && <p className="text-sm">{row.carrier || "transportadora sin nombre"}</p>}
                  <span className="mt-2 flex gap-1" aria-label={CLIENT_STAGES[step]?.label ?? row.clientLabel}>
                    {CLIENT_STAGES.map((stage, index) => (
                      <span key={stage.id} className={index <= step ? "h-1.5 flex-1 rounded-full bg-navy" : "h-1.5 flex-1 rounded-full bg-muted"} />
                    ))}
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {row.held ? <Badge variant="hold">retenido</Badge> : <Badge variant="secondary">{row.clientLabel}</Badge>}
                  {row.alerts.map((alert) => <Badge key={alert.kind} variant="alert">{alertLabel(alert.kind)}</Badge>)}
                  {!row.alerts.length && <span className="text-sm text-muted-foreground">{row.holdReason || "Sin alertas"}</span>}
                  <Button type="button" variant="outline" size="sm" onClick={() => void removeProduct(row, setSelectedId, setDossier, setError, load)}>Quitar</Button>
                </div>
              </div>
              {open && dossier?.product.id === row.productId && <ProductSheet dossier={dossier} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function alertLabel(kind: string): string {
  const labels: Record<string, string> = {
    needs_review: "Revisión",
    destination_mismatch: "Destino",
    tracking_not_found: "Sin guía",
    stale: "Sin novedad",
    missing_next_guide: "Falta guía",
    partial_delivery: "Entrega parcial",
    ask_due: "Preguntar",
  };
  return labels[kind] ?? kind;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="border-l-4 border-l-accent">
        <p className="text-3xl font-semibold tracking-tight text-navy">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

async function pullTracks(setNote: (message: string) => void, setError: (message: string) => void, setPulling: (value: boolean) => void, reload: () => Promise<void>) {
  setPulling(true);
  setError("");
  try {
    const result = await api<{ total: number; saved: string[]; failed: string[] }>("/api/17track/traer", { method: "POST" });
    setNote(`17TRACK tiene ${result.total} guías. Quedaron guardadas ${result.saved.length}.`);
    await reload();
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : "No se pudo traer 17TRACK.");
  } finally {
    setPulling(false);
  }
}

async function consultGuide(number: string, setNote: (message: string) => void, setError: (message: string) => void, setPulling: (value: boolean) => void, reload: () => Promise<void>) {
  setPulling(true);
  setError("");
  try {
    const result = await api<{ number: string; status: string | null }>("/api/17track/consultar", { method: "POST", body: JSON.stringify({ number }) });
    setNote(`${result.number}: ${result.status ?? "sin estado"}.`);
    await reload();
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : "No se pudo consultar la guía.");
  } finally {
    setPulling(false);
  }
}

async function toggleProduct(
  id: string,
  selectedId: string | null,
  setSelectedId: (id: string | null) => void,
  setDossier: (dossier: Dossier | null) => void,
  setError: (message: string) => void,
) {
  if (selectedId === id) {
    setSelectedId(null);
    setDossier(null);
    return;
  }
  try {
    setDossier(await api<Dossier>(`/api/productos/${encodeURIComponent(id)}`));
    setSelectedId(id);
    setError("");
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : "No se pudo abrir el producto.");
  }
}

async function removeProduct(
  row: TrackingRow,
  setSelectedId: (id: string | null) => void,
  setDossier: (dossier: Dossier | null) => void,
  setError: (message: string) => void,
  reload: () => Promise<void>,
) {
  const name = row.trackingNumber || row.productId;
  if (!window.confirm(`Quitar ${name}? El pedido se puede registrar otra vez y el correo volverá a crear la guía.`)) return;
  try {
    await api(`/api/productos/${encodeURIComponent(row.productId)}`, { method: "DELETE" });
    setSelectedId(null);
    setDossier(null);
    setError("");
    await reload();
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : "No se pudo quitar el producto.");
  }
}
