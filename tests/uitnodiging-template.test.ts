import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const template = readFileSync("supabase/templates/uitnodiging.html", "utf8");

describe("uitnodigingsmail", () => {
  it("gebruikt de Supabase-uitnodigingslink en restaurantnaam met fallback", () => {
    expect(template).toContain('href="{{ .ConfirmationURL }}"');
    expect(template).toContain("{{ if .Data.uitnodiging_restaurant }}");
    expect(template).toContain("<strong>{{ .Data.uitnodiging_restaurant }}</strong>");
    expect(template).toContain("{{ else }}");
    expect(template).toContain("{{ end }}");
    expect(template).toContain("een restaurant te beheren");
  });
});
