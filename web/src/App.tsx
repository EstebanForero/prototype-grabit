import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Board } from "@/views/Board";
import { Mail } from "@/views/Mail";
import { ProductForm } from "@/views/ProductForm";

export function App() {
  const [view, setView] = useState("board");

  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6">
          <p className="text-sm font-semibold tracking-wide text-accent">Grab It</p>
          <h1 className="text-3xl font-semibold">Seguimiento</h1>
          <p className="max-w-xl text-sm text-white/80">El estado se aplica solo cuando la evidencia alcanza. Lo demás queda retenido.</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Tabs value={view} onValueChange={setView}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
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
