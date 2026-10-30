import { describe, expect, it } from "vitest";
import seed from "./seed.json";
import { normalize } from "./normalize";
import { resumeSchema } from "./schema";

describe("seed", () => {
  it("is a valid résumé", () => {
    expect(resumeSchema.safeParse(seed).success).toBe(true);
  });

  it("has no known CV typos left", () => {
    const text = JSON.stringify(seed);
    for (const typo of ["kubenetes", "Kubenetes", "Cillium", "cillium", "refractor", "the the", "my manger", "remove agents"]) {
      expect(text).not.toContain(typo);
    }
  });
});

describe("normalize", () => {
  it("drops blank lines from string lists and trims", () => {
    expect(normalize({ items: ["  a ", "", "b", "   "], name: " x " })).toEqual({ items: ["a", "b"], name: "x" });
  });

  it("keeps lists of objects intact", () => {
    expect(normalize({ links: [{ label: " L ", url: "u" }] })).toEqual({ links: [{ label: "L", url: "u" }] });
  });

  it("produces something the schema accepts from an editor state with blanks", () => {
    const draft = structuredClone(seed);
    draft.experience[0].bullets.push("", "  ");
    draft.skills[0].items.push("");
    const parsed = resumeSchema.safeParse(normalize(draft));
    expect(parsed.success).toBe(true);
  });
});

describe("schema", () => {
  it("rejects a role without a company", () => {
    const bad = structuredClone(seed);
    bad.experience[0].company = "";
    expect(resumeSchema.safeParse(bad).success).toBe(false);
  });
});

describe("seed content", () => {
  it("lists the Native Silicon founder role first", () => {
    expect(seed.experience[0]).toMatchObject({ role: "Founder", company: "Native Silicon", end: "Present" });
  });
});
