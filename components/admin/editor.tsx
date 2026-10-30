"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Braces, Copy, Eye, FileUp, Lock, Rocket, Save } from "lucide-react";
import { activateVersion, createVersion, saveVersion, uploadPdf, type ActionResult } from "@/app/admin/actions";
import { when } from "@/lib/format";
import { normalize } from "@/lib/normalize";
import type { Role, VersionSummary } from "@/lib/resume";
import type { Resume } from "@/lib/schema";
import { Field, LinesField, ListEditor, TextArea } from "./fields";

const SECTIONS = [
  ["basics", "Basics"],
  ["summary", "Profile"],
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["skills", "Skills"],
  ["competencies", "Competencies"],
  ["education", "Education"],
  ["pdf", "PDF"],
  ["json", "JSON"],
] as const;
type SectionId = (typeof SECTIONS)[number][0];

export function Editor({ initial, version, role }: { initial: Resume; version: VersionSummary; role: Role }) {
  const [doc, setDoc] = useState<Resume>(initial);
  const [label, setLabel] = useState(version.label);
  const [saved, setSaved] = useState(() => JSON.stringify([version.label, initial]));
  const [section, setSection] = useState<SectionId>("basics");
  const [status, setStatus] = useState<ActionResult | null>(null);
  const [updatedAt, setUpdatedAt] = useState(version.updatedAt);
  const [json, setJson] = useState("");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // The live version is read-only (the database refuses edits to it too).
  const locked = version.isActive;
  const dirty = useMemo(() => !locked && JSON.stringify([label, doc]) !== saved, [locked, label, doc, saved]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof Resume>(key: K, value: Resume[K]) => setDoc((d) => ({ ...d, [key]: value }));

  async function save(): Promise<boolean> {
    const clean = normalize(doc) as Resume;
    const res = await saveVersion(version.id, label, clean);
    setStatus(res);
    if (res.ok) {
      setDoc(clean);
      setSaved(JSON.stringify([label, clean]));
      if (res.at) setUpdatedAt(res.at);
    }
    return res.ok;
  }

  const onSave = () => startTransition(async () => void (await save()));

  const onActivate = () =>
    startTransition(async () => {
      if (dirty && !(await save())) return;
      if (!confirm(`Make "${label}" the live résumé?`)) return;
      // Revalidation re-renders this page as the (now locked) live version.
      setStatus(await activateVersion(version.id));
    });

  const onDuplicate = () => {
    const name = prompt("Name for the new version:", `${label} (copy)`);
    if (!name) return;
    startTransition(async () => setStatus(await createVersion(version.id, name)));
  };

  const onUpload = () =>
    startTransition(async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) return setStatus({ ok: false, message: "Choose a PDF first." });
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadPdf(fd);
      setStatus(res);
      if (res.ok && res.pdfUrl) set("pdfUrl", res.pdfUrl);
    });

  const openSection = (id: SectionId) => {
    if (id === "json") setJson(JSON.stringify(doc, null, 2));
    setSection(id);
  };

  const applyJson = () => {
    try {
      setDoc(JSON.parse(json) as Resume);
      setStatus({ ok: true, message: "JSON applied to the editor. Save to validate and store it." });
    } catch (e) {
      setStatus({ ok: false, message: `Invalid JSON: ${(e as Error).message}` });
    }
  };

  return (
    <div className="min-h-screen bg-page">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-line-subtle bg-[var(--nav-glass)] backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link href="/admin" className="btn-ghost shrink-0" aria-label="Back to versions" title="Back to versions">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <input
                aria-label="Version name"
                value={label}
                disabled={locked}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full max-w-[420px] truncate rounded-[8px] border border-transparent bg-transparent px-1 text-[17px] font-medium text-fg hover:border-line focus:border-brand focus:outline-none disabled:hover:border-transparent"
              />
              <span className="px-1 text-xs text-fg-subtle">
                {locked ? "Live · locked" : "Not live"} · saved {when(updatedAt)}
                {dirty && " · unsaved changes"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {locked ? (
              <button type="button" className="btn-primary" onClick={onDuplicate} disabled={pending}>
                <Copy className="h-4 w-4" /> Duplicate to edit
              </button>
            ) : (
              <button type="button" className="btn-secondary" onClick={onSave} disabled={pending || !dirty}>
                <Save className="h-4 w-4" /> Save
              </button>
            )}
            <a className="btn-secondary" href={`/admin/versions/${version.id}/preview`} target="_blank" rel="noopener" title="Shows the last saved state">
              <Eye className="h-4 w-4" /> Preview
            </a>
            {!locked && role === "admin" && (
              <button type="button" className="btn-primary" onClick={onActivate} disabled={pending}>
                <Rocket className="h-4 w-4" /> Make live
              </button>
            )}
          </div>
        </div>
        {(status || locked) && (
          <div
            role="status"
            className={`flex items-center justify-center gap-2 border-t border-line-subtle px-5 py-2 text-center text-sm sm:px-8 ${
              status ? (status.ok ? "text-success" : "text-destructive") : "text-fg-muted"
            }`}
          >
            {!status && <Lock className="h-3.5 w-3.5" />}
            {status?.message ?? "This is the live version, so it is read-only. Duplicate it to make changes, then make the copy live."}
          </div>
        )}
      </header>

      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-5 py-8 sm:px-8 md:grid-cols-[180px_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => openSection(id)}
              className={`shrink-0 cursor-pointer rounded-[10px] px-3 py-2 text-left text-sm transition-colors ${
                section === id ? "bg-brand-tint font-medium text-fg" : "text-fg-muted hover:bg-sunken hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-5 rounded-[24px] border-0 bg-elevated p-5 shadow-sm sm:p-8">
          {section === "basics" && (
            <>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Field label="Name" value={doc.basics.name} onChange={(v) => set("basics", { ...doc.basics, name: v })} />
                <Field label="Title" value={doc.basics.title} onChange={(v) => set("basics", { ...doc.basics, title: v })} />
              </div>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Field label="Location" value={doc.basics.location} onChange={(v) => set("basics", { ...doc.basics, location: v })} />
                <Field label="Email" type="email" value={doc.basics.email} onChange={(v) => set("basics", { ...doc.basics, email: v })} />
                <Field label="Phone (optional, public)" value={doc.basics.phone} onChange={(v) => set("basics", { ...doc.basics, phone: v })} />
              </div>
              <h3 className="mt-2 mb-0 text-[15px] font-medium">Links</h3>
              <ListEditor
                items={doc.basics.links}
                onChange={(links) => set("basics", { ...doc.basics, links })}
                create={() => ({ label: "", url: "https://" })}
                addLabel="Add link"
                title={(l) => l.label}
                render={(l, update) => (
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Field label="Label" value={l.label} placeholder="GitHub" onChange={(v) => update({ ...l, label: v })} />
                    <Field label="URL" value={l.url} onChange={(v) => update({ ...l, url: v })} />
                  </div>
                )}
              />
            </>
          )}

          {section === "summary" && (
            <ListEditor
              items={doc.summary}
              onChange={(summary) => set("summary", summary)}
              create={() => ""}
              addLabel="Add paragraph"
              title={(p, i) => `Paragraph ${i + 1}${p ? ` — ${p.slice(0, 48)}…` : ""}`}
              render={(p, update) => <TextArea label="Text" value={p} rows={6} onChange={update} />}
            />
          )}

          {section === "experience" && (
            <ListEditor
              items={doc.experience}
              onChange={(experience) => set("experience", experience)}
              create={() => ({ role: "", company: "", start: "", end: "Present", bullets: [] })}
              addLabel="Add role"
              title={(j) => [j.role, j.company].filter(Boolean).join(" · ")}
              render={(j, update) => (
                <>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Field label="Role" value={j.role} onChange={(v) => update({ ...j, role: v })} />
                    <Field label="Company" value={j.company} onChange={(v) => update({ ...j, company: v })} />
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Field label="Start" value={j.start} placeholder="2023" onChange={(v) => update({ ...j, start: v })} />
                    <Field label="End" value={j.end} placeholder="Present" onChange={(v) => update({ ...j, end: v })} />
                  </div>
                  <ListEditor
                    items={j.bullets}
                    onChange={(bullets) => update({ ...j, bullets })}
                    create={() => ""}
                    addLabel="Add bullet"
                    title={(b, i) => `Bullet ${i + 1}${b ? ` — ${b.slice(0, 48)}…` : ""}`}
                    render={(b, set) => <TextArea label="Text" value={b} rows={3} onChange={set} />}
                  />
                </>
              )}
            />
          )}

          {section === "projects" && (
            <ListEditor
              items={doc.projects}
              onChange={(projects) => set("projects", projects)}
              create={() => ({ name: "", org: "", summary: "", lesson: "" })}
              addLabel="Add project"
              title={(p) => p.name}
              render={(p, update) => (
                <>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Field label="Name" value={p.name} onChange={(v) => update({ ...p, name: v })} />
                    <Field label="Organisation" value={p.org} onChange={(v) => update({ ...p, org: v })} />
                  </div>
                  <TextArea label="What it was" value={p.summary} rows={4} onChange={(v) => update({ ...p, summary: v })} />
                  <TextArea label="What I learned" value={p.lesson} rows={3} onChange={(v) => update({ ...p, lesson: v })} />
                </>
              )}
            />
          )}

          {(section === "skills" || section === "competencies") && (
            <ListEditor
              items={doc[section]}
              onChange={(groups) => set(section, groups)}
              create={() => ({ name: "", items: [] })}
              addLabel="Add group"
              title={(g) => g.name}
              render={(g, update) => (
                <>
                  <Field label="Group" value={g.name} onChange={(v) => update({ ...g, name: v })} />
                  <LinesField label="Items" value={g.items} rows={5} onChange={(items) => update({ ...g, items })} />
                </>
              )}
            />
          )}

          {section === "education" && (
            <ListEditor
              items={doc.education}
              onChange={(education) => set("education", education)}
              create={() => ({ title: "", institution: "", year: "" })}
              addLabel="Add qualification"
              title={(e) => e.title}
              render={(e, update) => (
                <>
                  <Field label="Qualification / certification" value={e.title} onChange={(v) => update({ ...e, title: v })} />
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Field label="Institution" value={e.institution} onChange={(v) => update({ ...e, institution: v })} />
                    <Field label="Year (optional)" value={e.year} onChange={(v) => update({ ...e, year: v })} />
                  </div>
                </>
              )}
            />
          )}

          {section === "pdf" && (
            <div className="flex flex-col gap-4">
              <p className="m-0 text-sm text-fg-muted">
                Upload the PDF version of your CV. Visitors get a “Download CV” button; it goes live on the next publish.
                Without a PDF, the page still offers “Print / Save PDF”.
              </p>
              {doc.pdfUrl ? (
                <p className="m-0 text-sm">
                  Current:{" "}
                  <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline">
                    {doc.pdfUrl.split("/").pop()}
                  </a>{" "}
                  <button type="button" className="btn-ghost" onClick={() => set("pdfUrl", "")}>
                    Remove
                  </button>
                </p>
              ) : (
                <p className="m-0 text-sm text-fg-subtle">No PDF attached.</p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <input ref={fileRef} type="file" accept="application/pdf" className="text-sm" />
                <button type="button" className="btn-secondary" onClick={onUpload} disabled={pending}>
                  <FileUp className="h-4 w-4" /> Upload
                </button>
              </div>
            </div>
          )}

          {section === "json" && (
            <div className="flex flex-col gap-4">
              <p className="m-0 text-sm text-fg-muted">
                Raw document, for bulk edits or a backup. <strong>Apply</strong> loads it into the editor; <strong>Save draft</strong> validates it.
              </p>
              <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={28} spellCheck={false} className="field font-mono text-[13px]" />
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={applyJson}>
                  <Braces className="h-4 w-4" /> Apply
                </button>
                <button type="button" className="btn-ghost" onClick={() => setJson(JSON.stringify(doc, null, 2))}>
                  Reset
                </button>
              </div>
            </div>
          )}
        </fieldset>
      </div>
    </div>
  );
}
