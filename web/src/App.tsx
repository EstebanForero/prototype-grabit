import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { MailPublic } from "@/lib/types";
import { Board } from "@/views/Board";
import { Mail } from "@/views/Mail";
import { ProductForm } from "@/views/ProductForm";

export function App() {
  const [view, setView] = useState("board");
  const [mail, setMail] = useState<MailPublic | null>(null);

  useEffect(() => {
    const load = () => {
      api<MailPublic>("/api/correo").then(setMail).catch(() => undefined);
    };
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-primary/70">GRAB IT</p>
            <h1 className="text-2xl font-semibold tracking-tight text-navy">Seguimiento</h1>
          </div>
          <p className="hidden max-w-sm text-right text-sm text-muted-foreground sm:block">
            {mail?.watching
              ? `Leyendo ${mail.user ?? "el correo"} cada 45 segundos.`
              : "El estado se aplica solo cuando la evidencia alcanza."}
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Tabs value={view} onValueChange={setView}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start rounded-xl bg-white/80 p-1 shadow-sm">
            <TabsTrigger value="board">Cola de hoy</TabsTrigger>
            <TabsTrigger value="mail">Buzón</TabsTrigger>
            <TabsTrigger value="product">Registrar compra</TabsTrigger>
          </TabsList>
          <TabsContent value="board"><Board active={view === "board"} /></TabsContent>
          <TabsContent value="mail" forceMount className={view === "mail" ? "" : "hidden"}>
            <Mail onLinked={() => setView("board")} />
          </TabsContent>
          <TabsContent value="product"><ProductForm /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
