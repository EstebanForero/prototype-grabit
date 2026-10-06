import { useState, type ComponentProps, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export function ProductForm() {
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const product = await api<{ id: string; status: string }>("/api/productos", { method: "POST", body: JSON.stringify(data) });
      setStatus(`Producto ${product.id} en ${product.status}. El correo con ese pedido ya puede asociar la guía.`);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "No se pudo registrar.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compras</p>
        <h2 className="text-2xl font-semibold">Registrar un producto comprado</h2>
      </div>
      <Card>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
            <Field label="Identificador" name="id" placeholder="audifonos" />
            <div className="flex flex-col gap-2">
              <Label htmlFor="mode">Modo</Label>
              <select id="mode" name="mode" className="h-9 rounded-md border bg-card px-3 text-sm">
                <option value="international">Internacional, primer tramo a bodega</option>
                <option value="national">Nacional, directo al cliente</option>
              </select>
            </div>
            <Field label="País del cliente" name="customerCountry" defaultValue="CO" required />
            <Field label="Ciudad" name="customerCity" defaultValue="Bogotá" />
            <div className="flex flex-col gap-2">
              <Label htmlFor="store">Tienda</Label>
              <select id="store" name="store" className="h-9 rounded-md border bg-card px-3 text-sm">
                <option value="amazon">Amazon</option>
                <option value="mercadolibre">Mercado Libre</option>
                <option value="ebay">eBay</option>
                <option value="alibaba">Alibaba</option>
                <option value="homecenter">Homecenter</option>
              </select>
            </div>
            <Field label="Número de pedido de la tienda" name="storeOrderNumber" placeholder="112-4455667-1234567" required />
            <div className="sm:col-span-2">
              <Button type="submit">Registrar</Button>
              {status && <p className="mt-3 text-sm text-muted-foreground">{status}</p>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, name, ...props }: { label: string; name: string } & ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
