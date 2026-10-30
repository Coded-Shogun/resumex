import { z } from "zod";

// The whole résumé is one JSON document stored per version in Supabase (resume_versions.document).
// Every editable field lives here; the public page and the admin editor both
// read this shape, so adding a field means: add it here, render it in
// components/resume-view.tsx, and expose it in components/admin/editor.tsx.

const text = z.string().trim();
const lines = z.array(text.min(1)).default([]);

export const linkSchema = z.object({
  label: text.min(1),
  url: text.min(1),
});

export const groupSchema = z.object({
  name: text.min(1),
  items: lines,
});

export const experienceSchema = z.object({
  role: text.min(1),
  company: text.min(1),
  start: text,
  end: text,
  bullets: lines,
});

export const projectSchema = z.object({
  name: text.min(1),
  org: text,
  summary: text,
  lesson: text,
});

export const educationSchema = z.object({
  title: text.min(1),
  institution: text,
  year: text,
});

export const resumeSchema = z.object({
  basics: z.object({
    name: text.min(1),
    title: text,
    location: text,
    email: text,
    phone: text.default(""),
    links: z.array(linkSchema).default([]),
  }),
  summary: lines,
  competencies: z.array(groupSchema).default([]),
  skills: z.array(groupSchema).default([]),
  experience: z.array(experienceSchema).default([]),
  projects: z.array(projectSchema).default([]),
  education: z.array(educationSchema).default([]),
  pdfUrl: text.default(""),
});

export type Resume = z.infer<typeof resumeSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Group = z.infer<typeof groupSchema>;
export type Link = z.infer<typeof linkSchema>;
