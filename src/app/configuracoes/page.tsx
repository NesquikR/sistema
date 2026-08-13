"use client";

import * as React from "react";
import {
  Bot,
  Clock3,
  Database,
  Link2,
  Percent,
  Save,
  Send,
  Sparkles,
  Timer,
} from "lucide-react";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Card, CardBody, CardHeader, Divider } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Switch } from "@/components/ui/controls";
import { categories } from "@/data/categories";
import { channels } from "@/data/logs";
import { stores } from "@/data/stores";
import { compact } from "@/lib/utils";

const sections = [
  { id: "telegram", label: "Telegram", icon: Send },
  { id: "busca", label: "Intervalo de busca", icon: Timer },
  { id: "categorias", label: "Categorias", icon: Sparkles },
  { id: "desconto", label: "Desconto mínimo", icon: Percent },
  { id: "horarios", label: "Horários", icon: Clock3 },
  { id: "afiliado", label: "Links de afiliado", icon: Link2 },
  { id: "ia", label: "IA", icon: Bot },
  { id: "banco", label: "Banco de dados", icon: Database },
];

export default function ConfiguracoesPage() {
  const [active, setActive] = React.useState("telegram");
  const [minDiscount, setMinDiscount] = React.useState(35);
  const [autoPublish, setAutoPublish] = React.useState(true);
  const [requireApproval, setRequireApproval] = React.useState(true);
  const [interval, setIntervalMinutes] = React.useState("15");
  const [cats, setCats] = React.useState(categories);

  return (
    <PageShell>
      <PageTitle
        title="Configurações"
        subtitle="Parâmetros operacionais do motor. As alterações passam a valer no próximo ciclo."
        actions={
          <>
            <Button variant="ghost" size="sm">Descartar</Button>
            <Button variant="primary" size="sm">
              <Save className="h-3.5 w-3.5" strokeWidth={2.2} />
              Salvar alterações
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[212px_minmax(0,1fr)]">
        {/* Navegação lateral das seções */}
        <nav className="lg:sticky lg:top-[84px] lg:self-start">
          <ul className="space-y-0.5">
            {sections.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setActive(s.id)}
                    className={
                      "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] transition-colors duration-150 " +
                      (isActive
                        ? "border border-line-strong bg-white/[0.06] text-fg"
                        : "border border-transparent text-fg-muted hover:bg-white/[0.04] hover:text-fg")
                    }
                  >
                    <Icon
                      className={
                        "h-4 w-4 " + (isActive ? "text-violet-soft" : "text-fg-subtle")
                      }
                      strokeWidth={1.9}
                    />
                    <span className="font-medium">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-3.5">
          {/* Telegram */}
          <Card glow>
            <CardHeader
              title="Telegram"
              subtitle="Credenciais do bot e canais de destino"
              action={
                <Badge tone="ok">
                  <StatusDot tone="ok" /> conectado
                </Badge>
              }
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Token do bot" hint="Armazenado criptografado no servidor">
                  <Input type="password" defaultValue="7412998301:AAH_xxxxxxxxxxxxxxxxxxxxxxxx" />
                </Field>
                <Field label="Nome do bot" hint="Exibido como remetente">
                  <Input defaultValue="@beautybot_oficial" />
                </Field>
              </div>

              <Divider />

              <div className="space-y-2">
                {channels.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-black/20 px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-fg">{c.name}</p>
                      <p className="mt-0.5 font-mono text-[11.5px] text-fg-subtle">{c.handle}</p>
                    </div>
                    <Badge tone="neutral" className="ml-2">
                      {compact(c.members)} membros
                    </Badge>
                    <Switch checked={c.active} onChange={() => {}} label={c.name} />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Busca e agendamento */}
          <Card>
            <CardHeader
              title="Intervalo de busca e horários"
              subtitle="Frequência dos ciclos e janelas em que o bot pode publicar"
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Intervalo entre ciclos" hint="Expressão cron gerada automaticamente">
                  <Select
                    value={interval}
                    onChange={(e) => setIntervalMinutes(e.target.value)}
                    className="w-full"
                  >
                    <option value="5">A cada 5 minutos</option>
                    <option value="15">A cada 15 minutos</option>
                    <option value="30">A cada 30 minutos</option>
                    <option value="60">A cada hora</option>
                  </Select>
                </Field>
                <Field label="Janela de publicação" hint="Fora dela as ofertas ficam agendadas">
                  <div className="flex items-center gap-2">
                    <Input type="time" defaultValue="08:00" />
                    <span className="text-fg-subtle">—</span>
                    <Input type="time" defaultValue="22:00" />
                  </div>
                </Field>
                <Field label="Máximo de publicações por hora" hint="Evita saturar os canais">
                  <Input type="number" defaultValue={6} />
                </Field>
              </div>

              <Divider />

              <Toggle
                label="Publicação automática"
                hint="Ofertas com score acima do limiar são publicadas sem intervenção."
                checked={autoPublish}
                onChange={setAutoPublish}
              />
              <Toggle
                label="Exigir aprovação manual abaixo do limiar"
                hint="Ofertas com score entre 50 e 85 vão para a fila da Central de Operações."
                checked={requireApproval}
                onChange={setRequireApproval}
              />
            </CardBody>
          </Card>

          {/* Desconto e categorias */}
          <Card>
            <CardHeader
              title="Desconto mínimo e categorias"
              subtitle="Limiar global e ajustes por nicho"
            />
            <CardBody className="space-y-5">
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[13px] font-medium text-fg">Desconto mínimo global</p>
                  <span className="num text-[17px] font-semibold text-violet-soft">
                    {minDiscount}%
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={80}
                  value={minDiscount}
                  onChange={(e) => setMinDiscount(Number(e.target.value))}
                  className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-violet"
                  style={{
                    background: `linear-gradient(90deg,#8b5cf6 ${((minDiscount - 10) / 70) * 100}%, #ffffff14 ${((minDiscount - 10) / 70) * 100}%)`,
                  }}
                />
                <p className="mt-2 text-[11.5px] text-fg-subtle">
                  Ofertas abaixo desse patamar são descartadas antes de chegar à IA.
                </p>
              </div>

              <Divider />

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {cats.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-[12px] border border-line bg-black/20 px-3.5 py-2.5"
                  >
                    <span className="text-[15px]">{c.emoji}</span>
                    <span className="text-[12.5px] font-medium text-fg">{c.name}</span>
                    <span className="num ml-auto text-[12px] text-fg-subtle">
                      mín. {c.minDiscount}%
                    </span>
                    <Switch
                      checked={c.active}
                      onChange={(v) =>
                        setCats((prev) =>
                          prev.map((x) => (x.id === c.id ? { ...x, active: v } : x)),
                        )
                      }
                      label={c.name}
                    />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Afiliados */}
          <Card>
            <CardHeader
              title="Links de afiliado"
              subtitle="Identificadores usados na reescrita das URLs de cada loja"
            />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {stores.map((s) => (
                <Field key={s.id} label={s.name} hint={s.connector}>
                  <Input defaultValue={`beautybot-${s.id}-01`} />
                </Field>
              ))}
            </CardBody>
          </Card>

          {/* IA */}
          <Card>
            <CardHeader title="Inteligência Artificial" subtitle="Modelo e limiares de decisão" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Modelo" hint="Usado na avaliação de cada oferta">
                  <Select defaultValue="v4" className="w-full">
                    <option value="v4">beautybot-scorer-v4</option>
                    <option value="v3">beautybot-scorer-v3</option>
                    <option value="rules">Somente regras (sem IA)</option>
                  </Select>
                </Field>
                <Field label="Score mínimo para publicar" hint="Abaixo disso vai para a fila">
                  <Input type="number" defaultValue={85} />
                </Field>
                <Field label="Score mínimo para manter" hint="Abaixo disso é descartada">
                  <Input type="number" defaultValue={50} />
                </Field>
              </div>
              <Toggle
                label="Validar histórico de preços de 90 dias"
                hint="Principal defesa contra promoções falsas com preço-âncora inflado."
                checked
                onChange={() => {}}
              />
              <Toggle
                label="Gerar texto da publicação com IA"
                hint="Caso desativado, o sistema usa o template padrão de mensagem."
                checked
                onChange={() => {}}
              />
            </CardBody>
          </Card>

          {/* Banco */}
          <Card>
            <CardHeader
              title="Banco de dados"
              subtitle="Conexão e política de retenção"
              action={
                <Badge tone="ok">
                  <StatusDot tone="ok" /> 4 ms
                </Badge>
              }
            />
            <CardBody className="space-y-4">
              <Field label="String de conexão" hint="Somente leitura nesta tela">
                <Input
                  readOnly
                  defaultValue="postgresql://beautybot@localhost:5432/beautybot"
                  className="font-mono text-[12px] text-fg-muted"
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Retenção de ofertas" hint="Após o prazo, são arquivadas">
                  <Select defaultValue="180" className="w-full">
                    <option value="90">90 dias</option>
                    <option value="180">180 dias</option>
                    <option value="365">1 ano</option>
                  </Select>
                </Field>
                <Field label="Retenção de logs" hint="Eventos de nível debug">
                  <Select defaultValue="14" className="w-full">
                    <option value="7">7 dias</option>
                    <option value="14">14 dias</option>
                    <option value="30">30 dias</option>
                  </Select>
                </Field>
                <Field label="Backup automático" hint="Snapshot diário às 03h">
                  <Select defaultValue="on" className="w-full">
                    <option value="on">Ativado</option>
                    <option value="off">Desativado</option>
                  </Select>
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[12.5px] font-medium text-fg">{label}</label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1.5 text-[11px] text-fg-subtle">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-[12px] border border-line bg-black/20 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-fg">{label}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-fg-subtle">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
