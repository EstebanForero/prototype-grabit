import { useEffect, useRef, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { ExtractionRun, MailPublic, Outcome, ParsedDispatch, ScanItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type FormState = {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  password: string;
  mailbox: string;
  sinceDays: string;
};

type Arrival = ScanItem & { key: string; fresh: boolean };

const EMPTY: FormState = { host: "imap.gmail.com", port: "993", secure: true, user: "", password: "", mailbox: "INBOX", sinceDays: "21" };

const PRESETS: Record<string, Pick<FormState, "host" | "port" | "secure">> = {
  gmail: { host: "imap.gmail.com", port: "993", secure: true },
  yahoo: { host: "imap.mail.yahoo.com", port: "993", secure: true },
  gmx: { host: "imap.gmx.com", port: "993", secure: true },
};

const outcomeLabel: Record<Outcome, string> = {
  creado: "asociada",
  "ya-estaba": "ya estaba",
  "sin-producto": "sin producto",
  ignorado: "no es despacho",
};

export function Mail({ onLinked }: { onLinked: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [runs, setRuns] = useState<ExtractionRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const formRef = useRef(form);
  const seen = useRef<Set<string> | null>(null);
  formRef.current = form;

  async function refresh() {
    const data = await api<{ watching: boolean; runs: ExtractionRun[] }>("/api/correo/procesos");
    setWatching(data.watching);
    setRuns(data.runs);
    if (seen.current === null) {
      seen.current = new Set(data.runs.map((run) => run.id));
    } else {
      const arrived = data.runs.find((run) => run.status === "done" && !seen.current?.has(run.id));
      for (const run of data.runs) seen.current.add(run.id);
      if (arrived) {
        setFreshId(arrived.id);
        setSelectedId(arrived.id);
      }
    }
    setSelectedId((current) => current ?? data.runs.find((run) => run.status !== "running")?.id ?? null);
  }

  useEffect(() => {
    api<MailPublic>("/api/correo")
      .then((config) => {
        if (!config.configured || !config.host || !config.user) return;
        setForm((current) => ({
          ...current,
          host: config.host ?? current.host,
          port: String(config.port ?? current.port),
          secure: config.secure !== false,
          user: config.user ?? "",
          mailbox: config.mailbox ?? "INBOX",
          password: "",
        }));
        setWatching(Boolean(config.watching));
        setStatus(`Buzón guardado para ${config.user}. La clave no se muestra.`);
      })
      .catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : "No se pudo leer el buzón."));
    void refresh().catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : "No se pudo leer los procesos."));
    const timer = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 3_000);
    return () => clearInterval(timer);
  }, []);

  function patch(partial: Partial<FormState>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function payload(): Record<string, unknown> {
    const current = formRef.current;
    const body: Record<string, unknown> = {
      host: current.host,
      port: Number(current.port),
      secure: current.secure,
      user: current.user,
      mailbox: current.mailbox || "INBOX",
    };
    if (current.password) body.password = current.password;
    return body;
  }

  async function ensureSaved() {
    if (!formRef.current.password) return;
    await api("/api/correo", { method: "POST", body: JSON.stringify(payload()) });
    const next = { ...formRef.current, password: "" };
    formRef.current = next;
    setForm(next);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("Probando la conexión…");
    try {
      await api("/api/correo", { method: "POST", body: JSON.stringify(payload()) });
      const result = await api<{ user: string }>("/api/correo/probar", { method: "POST" });
      const next = { ...formRef.current, password: "" };
      formRef.current = next;
      setForm(next);
      setStatus(`Conexión correcta con ${result.user}. Ya se puede vigilar el buzón y enviar el aviso.`);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "La conexión falló.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleWatch() {
    setBusy(true);
    try {
      await ensureSaved();
      const view = await api<MailPublic>("/api/correo/vigilar", {
        method: "POST",
        body: JSON.stringify({ active: !watching, sinceDays: Number(formRef.current.sinceDays || 21) }),
      });
      setWatching(Boolean(view.watching));
      setStatus(view.watching
        ? "El servidor vigila el buzón. Cada 45 segundos abre IMAP y deja el proceso en la lista."
        : "Vigilancia detenida. La clave sigue en el servidor.");
      await refresh();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "No se pudo cambiar la vigilancia.");
    } finally {
      setBusy(false);
    }
  }

  async function scan() {
    setBusy(true);
    setStatus("Leyendo el buzón…");
    try {
      await ensureSaved();
      const run = await api<ExtractionRun>("/api/correo/escanear", {
        method: "POST",
        body: JSON.stringify({ sinceDays: Number(formRef.current.sinceDays || 21) }),
      });
      seen.current?.add(run.id);
      setSelectedId(run.id);
      setFreshId(run.id);
      setStatus(runLine(run));
      await refresh();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "No se pudo leer.");
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function sendNotice() {
    setBusy(true);
    setStatus("Entregando el aviso por el SMTP del proveedor…");
    try {
      await ensureSaved();
      const sent = await api<{ to: string; host: string; port: number }>("/api/correo/enviar", { method: "POST" });
      if (!watching) {
        const view = await api<MailPublic>("/api/correo/vigilar", {
          method: "POST",
          body: JSON.stringify({ active: true, sinceDays: Number(formRef.current.sinceDays || 21) }),
        });
        setWatching(Boolean(view.watching));
      }
      setStatus(`El proveedor aceptó el mensaje para ${sent.to} (${sent.host}:${sent.port}). La próxima extracción lo lee por IMAP.`);
      await refresh();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "No se pudo enviar el aviso.");
    } finally {
      setBusy(false);
    }
  }

  const running = runs.filter((run) => run.status === "running");
  const finished = runs.filter((run) => run.status !== "running");
  const selected = runs.find((run) => run.id === selectedId) ?? finished[0];
  const cards = (selected?.items ?? []).map((item) => ({
    ...item,
    key: [selected?.id, item.from, item.subject, item.parsed?.trackingNumber || item.detail].join("|"),
    fresh: selected?.id === freshId,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entrada de guías</p>
        <h2 className="text-2xl font-semibold">Leer el buzón de despacho</h2>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Esta pantalla registra la cuenta, entrega el aviso por el correo del proveedor y muestra las extracciones. El producto se registra antes, en Registrar compra. IMAP no avisa solo: con la vigilancia activa el servidor vuelve a abrir la bandeja cada 45 segundos.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Cuenta de la sustentación</CardTitle>
          <CardDescription>El módulo no entra a la tienda y no inyecta un archivo de prueba.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>La sustentación usa una cuenta personal gratuita, vacía, creada solo para esto. No es Gmail Workspace ni el buzón de Grab It. En Gmail se activa la verificación en dos pasos y se crea una contraseña de aplicación. La clave normal de la cuenta no sirve. Yahoo pide lo mismo. GMX usa su clave normal después de activar IMAP en el webmail.</p>
          <p>El aviso de Amazon, con el pedido 112-4455667-1234567 y la guía 1Z999AA10123456784, sale desde aquí con «Enviar aviso». El proveedor lo guarda en su bandeja y la extracción lo lee por IMAP. La lista de abajo separa la lectura que está en curso de las que ya terminaron. Recargar la página no borra ese historial.</p>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => patch(PRESETS.gmail)}>Gmail</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => patch(PRESETS.yahoo)}>Yahoo</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => patch(PRESETS.gmx)}>GMX</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
            <Field label="Servidor IMAP" value={form.host} onChange={(host) => patch({ host })} />
            <Field label="Puerto" value={form.port} onChange={(port) => patch({ port })} />
            <Field label="Usuario" value={form.user} onChange={(user) => patch({ user })} type="email" autoComplete="username" />
            <Field label="Clave" value={form.password} onChange={(password) => patch({ password })} type="password" autoComplete="current-password" />
            <Field label="Carpeta" value={form.mailbox} onChange={(mailbox) => patch({ mailbox })} />
            <Field label="Días hacia atrás" value={form.sinceDays} onChange={(sinceDays) => patch({ sinceDays })} />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.secure} onChange={(event) => patch({ secure: event.target.checked })} />
              TLS. Gmail, Yahoo y GMX lo usan en el puerto 993.
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" variant="outline" disabled={busy}>Guardar y probar</Button>
              <Button type="button" onClick={() => void toggleWatch()} disabled={busy}>{watching ? "Detener vigilancia" : "Vigilar buzón"}</Button>
              <Button type="button" variant="secondary" onClick={() => void scan()} disabled={busy}>Leer ahora</Button>
              <Button type="button" onClick={() => void sendNotice()} disabled={busy}>Enviar aviso</Button>
            </div>
            {status && <p className="text-sm text-muted-foreground sm:col-span-2">{status}</p>}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Extracciones</CardTitle>
            <CardDescription>El servidor guarda cada lectura. Esta lista sigue ahí si se recarga la consola.</CardDescription>
          </div>
          <Badge variant={watching ? "ok" : "secondary"}>{watching ? "Vigilancia activa" : "Vigilancia detenida"}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RunGroup title="En curso" empty={watching ? "Ninguna lectura en este momento. La próxima abre sola." : "No hay una lectura en curso."} runs={running} selectedId={selected?.id} onOpen={setSelectedId} />
          <RunGroup title="Ejecutadas" empty="Todavía no hay extracciones." runs={finished} selectedId={selected?.id} onOpen={setSelectedId} />
        </CardContent>
      </Card>
      {cards.map((item) => (
        <ArrivalCard key={item.key} item={item} onLinked={onLinked} onStatus={setStatus} />
      ))}
    </div>
  );
}

function RunGroup({ title, empty, runs, selectedId, onOpen }: { title: string; empty: string; runs: ExtractionRun[]; selectedId?: string; onOpen: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {runs.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      {runs.map((run) => (
        <button
          key={run.id}
          type="button"
          onClick={() => onOpen(run.id)}
          className={cn("rounded-md border p-3 text-left", run.id === selectedId && "ring-2 ring-accent")}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{when(run.startedAt)}</p>
            <Badge variant={run.status === "running" ? "hold" : run.status === "error" ? "alert" : "ok"}>
              {run.status === "running" ? "en curso" : run.status === "error" ? "error" : "ejecutada"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{run.status === "running" ? "Leyendo la bandeja…" : runLine(run)}</p>
        </button>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  const id = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} required={label !== "Clave" && label !== "Carpeta" && label !== "Días hacia atrás"} />
    </div>
  );
}

function runLine(run: Pick<ExtractionRun, "examined" | "created" | "already" | "unmatched" | "ignored" | "error" | "status">): string {
  if (run.status === "error") return run.error || "La lectura falló.";
  return `${run.examined} mensajes. ${run.created} guías nuevas, ${run.already} ya estaban, ${run.unmatched} sin producto, ${run.ignored} no eran despachos.`;
}

function when(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-CO", { hour12: false });
}

function ArrivalCard({ item, onLinked, onStatus }: { item: Arrival; onLinked: () => void; onStatus: (text: string) => void }) {
  const read = item.parsed
    ? `${item.parsed.store} · pedido ${item.parsed.storeOrderNumber} · guía ${item.parsed.trackingNumber}`
    : item.detail;
  const product = item.outcome === "creado"
    ? "El pedido ya estaba. La guía entra al producto."
    : item.outcome === "ya-estaba"
      ? "Esa guía ya estaba registrada. No se duplica."
      : item.outcome === "sin-producto"
        ? "Ningún producto tiene ese pedido."
        : "No se crea un envío.";
  const tones = [
    item.from ? "border-ok/40 bg-ok/5" : "border-hold/40",
    item.parsed ? "border-ok/40 bg-ok/5" : "border-alert/40",
    item.outcome === "creado" || item.outcome === "ya-estaba" ? "border-ok/40 bg-ok/5" : item.outcome === "sin-producto" ? "border-hold/40" : "border-alert/40",
  ];
  const steps = [
    ["1. Llegó", item.from || "sin remitente"],
    ["2. Lectura", read],
    ["3. Producto", product],
  ];

  async function link(event: FormEvent<HTMLFormElement>, parsed: ParsedDispatch) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api("/api/correo/vincular", {
      method: "POST",
      body: JSON.stringify({
        ...parsed,
        customerCountry: "CO",
        customerCity: String(data.get("city") || "Bogotá"),
        mode: String(data.get("mode") || "international"),
      }),
    });
    onStatus(`Pedido ${parsed.storeOrderNumber} vinculado.`);
    onLinked();
  }

  return (
    <Card className={cn(item.fresh && "arrival-new ring-2 ring-accent")}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <CardTitle>{item.subject || item.from || "Mensaje"}</CardTitle>
        <Badge variant={item.outcome === "sin-producto" ? "hold" : item.outcome === "ignorado" ? "alert" : item.outcome === "creado" ? "ok" : "secondary"}>{outcomeLabel[item.outcome]}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol className="grid gap-3 md:grid-cols-3">
          {steps.map(([title, text], index) => (
            <li key={title} className={cn("rounded-md border p-3", tones[index])}>
              <p className="text-xs font-semibold uppercase">{title}</p>
              <p className="text-sm">{text}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">{item.detail}</p>
        {item.outcome === "sin-producto" && item.parsed && (
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => void link(event, item.parsed as ParsedDispatch)}>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`city-${item.key}`}>Ciudad del cliente</Label>
              <Input id={`city-${item.key}`} name="city" defaultValue="Bogotá" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`mode-${item.key}`}>Modo</Label>
              <select id={`mode-${item.key}`} name="mode" className="h-9 rounded-md border bg-card px-3 text-sm">
                <option value="international">Internacional</option>
                <option value="national">Nacional</option>
              </select>
            </div>
            <Button type="submit" variant="outline">Vincular</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
