import { ArrowUpRight, Download, Mail, MapPin, Phone } from "lucide-react";
import type { Resume } from "@/lib/schema";
import { PrintButton } from "./print-button";
import { ThemeToggle } from "./theme-toggle";

function Section({ eyebrow, children, className = "" }: { eyebrow: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-5 ${className}`}>
      <h2 className="eyebrow m-0">{eyebrow}</h2>
      {children}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line-subtle bg-elevated px-3 py-1 text-sm text-fg-muted print:border-line print:px-2 print:py-0.5 print:text-[11px]">
      {children}
    </span>
  );
}

function dates(start: string, end: string) {
  if (!start && !end) return "";
  if (!end || start === end) return start || end;
  return `${start} – ${end}`;
}

function isExternal(url: string) {
  return /^https?:\/\//.test(url);
}

export function ResumeView({ resume, banner, updatedAt }: { resume: Resume; banner?: React.ReactNode; updatedAt?: string | null }) {
  const { basics } = resume;

  return (
    <div className="min-h-screen bg-page">
      {banner}
      <main className="mx-auto flex max-w-[1180px] flex-col gap-14 px-5 pt-10 pb-20 sm:px-8 sm:pt-16 print:max-w-none print:gap-7 print:p-0">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-6">
          <div className="no-print flex items-center justify-between gap-4">
            <a href="https://nativesilicon.co.za/about" className="flex items-center gap-2.5 text-sm text-fg-muted transition-colors hover:text-fg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/native_silicon_light.png" alt="" width={27} height={24} className="dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/native_silicon_dark.png" alt="" width={27} height={24} className="hidden dark:block" />
              Native Silicon
            </a>
            <ThemeToggle />
          </div>

          <div className="flex flex-col gap-3">
            <span className="eyebrow">Résumé</span>
            <h1 className="h1-page m-0 print:text-[34px]">{basics.name}</h1>
            {basics.title && <p className="m-0 text-xl font-medium text-brand sm:text-2xl print:text-base">{basics.title}</p>}
          </div>

          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-[15px] text-fg-muted print:text-[11px]">
            {basics.location && (
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-fg-subtle print:hidden" />
                {basics.location}
              </li>
            )}
            {basics.email && (
              <li>
                <a href={`mailto:${basics.email}`} className="flex items-center gap-2 hover:text-brand">
                  <Mail className="h-4 w-4 text-fg-subtle print:hidden" />
                  {basics.email}
                </a>
              </li>
            )}
            {basics.phone && (
              <li>
                <a href={`tel:${basics.phone.replace(/\s+/g, "")}`} className="flex items-center gap-2 hover:text-brand">
                  <Phone className="h-4 w-4 text-fg-subtle print:hidden" />
                  {basics.phone}
                </a>
              </li>
            )}
            {basics.links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  {...(isExternal(l.url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex items-center gap-1 hover:text-brand"
                >
                  {l.label}
                  <ArrowUpRight className="h-3.5 w-3.5 print:hidden" />
                  <span className="hidden print:inline"> ({l.url.replace(/^https?:\/\//, "")})</span>
                </a>
              </li>
            ))}
          </ul>

          <div className="no-print flex flex-wrap gap-3">
            {resume.pdfUrl && (
              <a
                href={resume.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-fg px-5 text-sm font-medium text-page shadow-sm transition-colors hover:bg-brand"
              >
                <Download className="h-4 w-4" />
                Download CV (PDF)
              </a>
            )}
            <PrintButton />
          </div>
        </header>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_340px] print:block">
          <div className="flex flex-col gap-14 print:gap-7">
            {resume.summary.length > 0 && (
              <Section eyebrow="Profile">
                <div className="flex flex-col gap-4">
                  {resume.summary.map((p, i) => (
                    <p key={i} className="m-0 text-[17px] leading-[1.7] text-fg-muted print:text-[12px] print:leading-[1.55]">
                      {p}
                    </p>
                  ))}
                </div>
              </Section>
            )}

            {resume.experience.length > 0 && (
              <Section eyebrow="Experience">
                <ol className="m-0 flex list-none flex-col gap-5 p-0">
                  {resume.experience.map((job, i) => (
                    <li key={`${job.company}-${i}`} className="print-avoid-break rounded-[24px] bg-elevated p-6 shadow-sm sm:p-8 print:rounded-none print:p-0 print:pb-3 print:shadow-none">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className="m-0 text-[21px] font-medium text-fg print:text-[14px]">
                          {job.role} <span className="text-fg-subtle">·</span> <span className="text-brand">{job.company}</span>
                        </h3>
                        <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle print:text-[10px]">
                          {dates(job.start, job.end)}
                        </span>
                      </div>
                      {job.bullets.length > 0 && (
                        <ul className="mt-4 mb-0 flex list-disc flex-col gap-2.5 pl-5 text-[15.5px] leading-[1.65] text-fg-muted marker:text-brand print:mt-2 print:gap-1 print:text-[11.5px] print:leading-[1.5]">
                          {job.bullets.map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {resume.projects.length > 0 && (
              <Section eyebrow="Key projects">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5 print:block">
                  {resume.projects.map((p, i) => (
                    <article key={`${p.name}-${i}`} className="print-avoid-break flex flex-col gap-3 rounded-[24px] border border-line-subtle bg-page p-6 print:mb-3 print:rounded-none print:border-0 print:p-0">
                      <div className="flex flex-col gap-1">
                        <h3 className="m-0 text-[18px] font-medium text-fg print:text-[13px]">{p.name}</h3>
                        {p.org && <span className="mono-label text-[11px] text-fg-subtle print:text-[9px]">{p.org}</span>}
                      </div>
                      {p.summary && <p className="m-0 text-[15px] leading-[1.65] text-fg-muted print:text-[11.5px] print:leading-[1.5]">{p.summary}</p>}
                      {p.lesson && (
                        <p className="m-0 border-l-2 border-brand pl-3 text-[14.5px] leading-[1.6] text-fg-muted italic print:text-[11px]">
                          {p.lesson}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </Section>
            )}
          </div>

          <aside className="flex flex-col gap-12 print:mt-7 print:gap-6">
            {resume.skills.length > 0 && (
              <Section eyebrow="Technical skills">
                <dl className="m-0 flex flex-col gap-4 rounded-[24px] bg-sunken p-6 print:rounded-none print:bg-transparent print:p-0">
                  {resume.skills.map((g, i) => (
                    <div key={`${g.name}-${i}`} className="print-avoid-break flex flex-col gap-2">
                      <dt className="text-sm font-medium text-fg print:text-[11.5px]">{g.name}</dt>
                      <dd className="m-0 flex flex-wrap gap-1.5">
                        {g.items.map((s) => (
                          <Chip key={s}>{s}</Chip>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Section>
            )}

            {resume.competencies.length > 0 && (
              <Section eyebrow="Core competencies">
                <div className="flex flex-col gap-5 print:grid print:grid-cols-3 print:gap-3">
                  {resume.competencies.map((g, i) => (
                    <div key={`${g.name}-${i}`} className="print-avoid-break flex flex-col gap-2">
                      <span className="mono-label text-[11px] text-fg-subtle print:text-[9px]">{g.name}</span>
                      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[15px] text-fg-muted print:text-[11px]">
                        {g.items.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {resume.education.length > 0 && (
              <Section eyebrow="Education & certifications">
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                  {resume.education.map((e, i) => (
                    <li key={`${e.title}-${i}`} className="print-avoid-break flex flex-col gap-0.5">
                      <span className="text-[15.5px] font-medium text-fg print:text-[12px]">{e.title}</span>
                      <span className="text-sm text-fg-muted print:text-[11px]">
                        {[e.institution, e.year].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </aside>
        </div>

        {updatedAt && (
          <footer className="no-print border-t border-line-subtle pt-6 font-mono text-xs text-fg-subtle">
            Last updated {new Date(updatedAt).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}
          </footer>
        )}
      </main>
    </div>
  );
}
