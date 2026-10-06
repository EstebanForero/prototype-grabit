import { useEffect, useRef, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { MailPublic, Outcome, ParsedDispatch, ScanItem, ScanReport } from "@/lib/types";
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
  const [watching, setWatching] = useState(false);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const formRef = useRef(form);
  formRef.current = form;

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
        setStatus(`Buzón guardado para ${config.user}. La clave no se muestra.`);
      })
      .catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : "No se pudo leer el buzón."));
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  function patch(partial: Partial<FormState>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function body(): Record<string, unknown> {
    const current = formRef.current;
    const payload: Record<string, unknown> = {
      host: current.host,
      port: Number(current.port),
      secure: current.secure,
      user: current.user,
      mailbox: current.mailbox || "INBOX",
    };
    if (current.password) payload.password = current.password;
    return payload;
  }

  async function readInbox(): Promise<ScanReport> {
    if (formRef.current.password) await api("/api/correo", { method: "POST", body: JSON.stringify(body()) });
    return api<ScanReport>("/api/correo/escanear", {
      method: "POST",
      body: JSON.stringify({ sinceDays: Number(formRef.current.sinceDays || 21) }),
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("Probando la conexión…");
    try {
      await api("/api/correo", { method: "POST", body: JSON.stringify(body()) });
      const result = await api<{ user: string }>("/api/correo/probar", { method: "POST" });
      patch({ password: "" });
      setStatus(`Conexión correcta con ${result.user}. Ya se puede leer la bandeja.`);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "La conexión falló.");
    }
  }

  async function scan() {
    setStatus("Leyendo el buzón…");
    try {
      const report = await readInbox();
      setStatus(reportLine(report));
      show(report.items, true);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "No se pudo leer.");
    }
  }

  async function tick() {
    try {
      const report = await readInbox();
      setStatus(`Vigilando cada 45 s. ${reportLine(report)} La clave no se muestra.`);
      show(report.items, false);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "No se pudo leer.");
    }
  }

  function toggleWatch() {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
      setWatching(false);
      setStatus("Vigilancia detenida. La clave sigue en el servidor.");
      return;
    }
    setWatching(true);
    void tick();
    timer.current = setInterval(() => void tick(), 45_000);
  }

  function show(items: ScanItem[], replace: boolean) {
    setArrivals((current) => {
      const known = new Set(current.map((item) => item.key));
      const cards = [...items].reverse().map((item) => {
        const key = [item.from, item.subject, item.parsed?.trackingNumber || item.detail].join("|");
        return { ...item, key, fresh: !replace && !known.has(key) };
      });
      if (replace) return cards;
      const incoming = new Set(cards.map((item) => item.key));
      const kept = current.filter((item) => !incoming.has(item.key)).map((item) => ({ ...item, fresh: false }));
      return [...cards.filter((item) => item.fresh), ...cards.filter((item) => !item.fresh), ...kept];
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entrada de guías</p>
        <h2 className="text-2xl font-semibold">Leer el buzón de despacho</h2>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        El aviso entra al buzón como correo. Esta pantalla lo lee por IMAP y pinta de quién llegó, qué guía se leyó y si quedó en un producto. IMAP no avisa solo: con la vigilancia activa el servidor vuelve a abrir la bandeja cada 45 segundos.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Cómo llega el mensaje</CardTitle>
          <CardDescription>El módulo no entra a la tienda y no inyecta un archivo de prueba.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>La sustentación usa una cuenta personal gratuita, vacía, creada solo para esto. No es Gmail Workspace ni el buzón de Grab It. En Gmail se activa la verificación en dos pasos y se crea una contraseña de aplicación. La clave normal de la cuenta no sirve. Yahoo pide lo mismo. GMX usa su clave normal después de activar IMAP en el webmail.</p>
          <p>El aviso se redacta en ese webmail, para la misma cuenta. El cuerpo tiene que decir Amazon, el pedido 112-4455667-1234567 y la guía 1Z999AA10123456784. El proveedor lo guarda en su bandeja. Esta pantalla lo lee por IMAP. Desde <code>prototype/</code>, <code>bun run enviar</code> hace el mismo envío por SMTP si la cuenta ya está guardada.</p>
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
              <Button type="submit" variant="outline">Guardar y probar</Button>
              <Button type="button" onClick={toggleWatch}>{watching ? "Detener vigilancia" : "Vigilar buzón"}</Button>
              <Button type="button" variant="secondary" onClick={() => void scan()}>Leer ahora</Button>
            </div>
            {status && <p className="text-sm text-muted-foreground sm:col-span-2">{status}</p>}
          </form>
        </CardContent>
      </Card>
      {arrivals.map((item) => (
        <ArrivalCard key={item.key} item={item} onLinked={onLinked} onStatus={setStatus} />
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

function reportLine(report: ScanReport): string {
  return `${report.examined} mensajes. ${report.created} guías nuevas, ${report.already} ya estaban, ${report.unmatched} sin producto, ${report.ignored} no eran despachos.`;
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
