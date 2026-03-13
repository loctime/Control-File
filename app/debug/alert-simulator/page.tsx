"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, FileText, Gauge, Mail, Play, Radar, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type SimulationResponse = {
  detectedEmailType?: string | null;
  operationName?: string | null;
  events?: JsonValue[];
  eventSummaries?: JsonValue[];
  speedIncidents?: JsonValue[];
  summary?: JsonValue;
  incidentSummary?: JsonValue;
  riskScore?: number;
  emailHtml?: string;
  plateGrouping?: JsonValue[];
  eventCounts?: JsonValue;
  unparsedLines?: JsonValue[];
};

const sampleSubject = "Excesos del dia";
const sampleBody = `Operacion: Demo
145 Km/h 12/03/26 08:10:00 AF123BC - SCANIA R450 JUAN PEREZ (ABC123) RN 9 KM 123
148 Km/h 12/03/26 08:12:10 AF123BC - SCANIA R450 JUAN PEREZ (ABC123) RN 9 KM 123
12/03/26 09:45:10 AG456DE - IVECO STRALIS MARIO GOMEZ (Conductor inactivo: MARIO GOMEZ)`;

function DebugCard({
  title,
  icon,
  value,
}: {
  title: string;
  icon: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {icon}
        {title}
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function JsonPanel({ title, data }: { title: string; data: unknown }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
        {title}
      </div>
      <pre className="max-h-80 overflow-auto p-4 text-xs leading-6 text-slate-700">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}

export default function AlertSimulatorPage() {
  const [subject, setSubject] = useState(sampleSubject);
  const [body, setBody] = useState(sampleBody);
  const [receivedAt, setReceivedAt] = useState("");
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSimulate() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/debug/simulate-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          body,
          received_at: receivedAt || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo simular la alerta");
      }

      setResult(data);
    } catch (requestError: any) {
      setError(requestError?.message || "No se pudo simular la alerta");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_30%),linear-gradient(135deg,#fffef7,#eef7ff_48%,#f5fff5)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[28px] border border-sky-100 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
                Debug RSV
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Alert Simulator
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Pega un email RSV y ejecuta el mismo parseo, agrupaci{"\u00f3"}n, score y renderizado
                del pipeline productivo. Esta herramienta no escribe en Firestore y no env{"\u00ed"}a emails.
              </p>
            </div>
            <Button
              className="gap-2 rounded-full px-6"
              onClick={handleSimulate}
              disabled={loading}
            >
              <Play className="h-4 w-4" />
              {loading ? "Simulando..." : "Simulate Alert"}
            </Button>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
            <section className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Subject
                </label>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Excesos del dia"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Received at
                </label>
                <Input
                  value={receivedAt}
                  onChange={(event) => setReceivedAt(event.target.value)}
                  placeholder="2026-03-13T09:00:00-03:00"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  RSV email body
                </label>
                <Textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="min-h-[420px] bg-white font-mono text-xs leading-6"
                  placeholder="Pegue aqui el cuerpo del email RSV"
                />
              </div>
            </section>

            <section className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DebugCard
                  title="Detected Type"
                  icon={<Mail className="h-4 w-4" />}
                  value={result?.detectedEmailType || "-"}
                />
                <DebugCard
                  title="Events"
                  icon={<Radar className="h-4 w-4" />}
                  value={Array.isArray(result?.events) ? result?.events.length : 0}
                />
                <DebugCard
                  title="Speed Incidents"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  value={Array.isArray(result?.speedIncidents) ? result?.speedIncidents.length : 0}
                />
                <DebugCard
                  title="Risk Score"
                  icon={<Gauge className="h-4 w-4" />}
                  value={result?.riskScore ?? 0}
                />
              </div>

              <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
                  <FileText className="h-4 w-4 text-sky-700" />
                  Email HTML Preview
                </div>
                <iframe
                  title="Alert email preview"
                  className="h-[640px] w-full bg-white"
                  srcDoc={result?.emailHtml || "<div style='padding:24px;font-family:Arial,sans-serif;color:#64748b'>Run a simulation to preview the generated email.</div>"}
                />
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <JsonPanel title="Parsed events" data={result?.events || []} />
                <JsonPanel title="Event summaries" data={result?.eventSummaries || []} />
                <JsonPanel title="Speed incidents" data={result?.speedIncidents || []} />
                <JsonPanel title="Incident summary" data={result?.incidentSummary || {}} />
                <JsonPanel title="Summary" data={result?.summary || {}} />
                <JsonPanel title="Plate grouping" data={result?.plateGrouping || []} />
                <JsonPanel title="Event counts" data={result?.eventCounts || {}} />
                <JsonPanel title="Unparsed lines" data={result?.unparsedLines || []} />
              </div>
            </section>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
            <Search className="h-4 w-4" />
            Backend endpoint: <code className="rounded bg-slate-100 px-2 py-1">POST /api/debug/simulate-alert</code>
          </div>
        </div>
      </div>
    </main>
  );
}
