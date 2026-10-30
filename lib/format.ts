export function when(ts: string | null | undefined) {
  return ts ? new Date(ts).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "never";
}
