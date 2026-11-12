import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shifts: [] as { id: string; weekdag: number }[],
  reservaties: [] as { datum: string; tijdslot: string; aantal_personen: number; shift_template_id: string | null }[],
  insert: vi.fn(),
  deleteFilter: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/admin/auth", () => ({
  adminContext: async () => ({
    restaurant: { id: "restaurant-a", tijdzone: "Europe/Brussels" },
    db: {
      from(table: string) {
        const q = {
          select: () => q,
          eq: (key: string, value: string) => {
            if (table === "date_exceptions") mocks.deleteFilter(key, value);
            return q;
          },
          gte: () => q,
          lte: () => q,
          in: () => q,
          order: () => q,
          range: async (start: number, end: number) => ({ data: mocks.reservaties.slice(start, end + 1), error: null }),
          insert: mocks.insert,
          delete: () => q,
          then: (resolve: (value: { data: typeof mocks.shifts; error: null }) => void) => resolve({ data: mocks.shifts, error: null }),
        };
        return q;
      },
    },
  }),
}));

const { maakUitzondering, verwijderUitzonderingsperiode } = await import("@/app/app/[slug]/(panel)/shiften/actions");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  mocks.shifts = [];
  mocks.reservaties = [];
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.deleteFilter.mockReset();
  mocks.revalidate.mockReset();
});

describe("uitzonderingen voor een periode", () => {
  it("slaat een vakantie inclusief beide datums atomair op met één periode-id", async () => {
    const result = await maakUitzondering("bistro", form({ datum: "2026-12-24", einddatum: "2026-12-26", soort: "gesloten", opmerking: "Vakantie" }));
    expect(result?.ok).toContain("3 dag");
    const rijen = mocks.insert.mock.calls[0][0];
    expect(rijen.map((r: { datum: string }) => r.datum)).toEqual(["2026-12-24", "2026-12-25", "2026-12-26"]);
    expect(rijen.every((r: { gesloten: boolean; periode_id: string; restaurant_id: string }) =>
      r.gesloten && r.periode_id === rijen[0].periode_id && r.restaurant_id === "restaurant-a")).toBe(true);
    expect(rijen[0].periode_id).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("behoudt de bestaande eendaagse invoer", async () => {
    await maakUitzondering("bistro", form({ datum: "2026-12-24", soort: "geblokkeerd", shift_id: "00000000-0000-4000-8000-000000000001" }));
    expect(mocks.insert).not.toHaveBeenCalled();
    mocks.shifts = [{ id: "00000000-0000-4000-8000-000000000001", weekdag: 4 }];
    await maakUitzondering("bistro", form({ datum: "2026-12-24", soort: "geblokkeerd", shift_id: mocks.shifts[0].id }));
    expect(mocks.insert.mock.calls[0][0]).toEqual([expect.objectContaining({ datum: "2026-12-24", periode_id: null, shift_template_id: mocks.shifts[0].id })]);
  });

  it("slaat dagen zonder gekozen shift over en gebruikt de shift van elke weekdag", async () => {
    mocks.shifts = [{ id: "donderdag", weekdag: 4 }, { id: "zaterdag", weekdag: 6 }];
    const result = await maakUitzondering("bistro", form({ datum: "2026-12-24", einddatum: "2026-12-26", shift: "Avond", soort: "capaciteit", capaciteit: "3" }));
    expect(result?.ok).toContain("1 dag(en) zonder de gekozen shift overgeslagen");
    expect(mocks.insert.mock.calls[0][0]).toEqual([
      expect.objectContaining({ datum: "2026-12-24", shift_template_id: "donderdag", afwijkende_capaciteit: 3 }),
      expect.objectContaining({ datum: "2026-12-26", shift_template_id: "zaterdag", afwijkende_capaciteit: 3 }),
    ]);
  });

  it("waarschuwt over bestaande reservaties op elke dag vóór het opslaan", async () => {
    mocks.reservaties = [
      { datum: "2026-12-24", tijdslot: "12:00", aantal_personen: 2, shift_template_id: null },
      { datum: "2026-12-26", tijdslot: "12:00", aantal_personen: 3, shift_template_id: null },
    ];
    const input = { datum: "2026-12-24", einddatum: "2026-12-26", soort: "gesloten" };
    expect((await maakUitzondering("bistro", form(input)))?.waarschuwing).toContain("2 bestaande");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect((await maakUitzondering("bistro", form({ ...input, bevestig: "ja" })))?.ok).toContain("3 dag");
  });

  it("controleert ook reservaties na de eerste databasepagina", async () => {
    mocks.reservaties = Array.from({ length: 1001 }, () => ({
      datum: "2026-12-24", tijdslot: "12:00", aantal_personen: 1, shift_template_id: null,
    }));
    const result = await maakUitzondering("bistro", form({ datum: "2026-12-24", einddatum: "2026-12-26", soort: "gesloten" }));
    expect(result?.waarschuwing).toContain("1001 bestaande");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("telt capaciteit per dag en kwartier, niet over verschillende dagen samen", async () => {
    mocks.reservaties = [
      { datum: "2026-12-24", tijdslot: "12:00", aantal_personen: 3, shift_template_id: null },
      { datum: "2026-12-25", tijdslot: "12:00", aantal_personen: 3, shift_template_id: null },
    ];
    const result = await maakUitzondering("bistro", form({ datum: "2026-12-24", einddatum: "2026-12-25", soort: "capaciteit", capaciteit: "4" }));
    expect(result?.ok).toContain("2 dag");
  });

  it("weigert ongeldige, omgekeerde en te lange datums", async () => {
    for (const [begin, eind] of [["2026-02-31", ""], ["2026-12-24", "2026-12-23"], ["2026-01-01", "2028-01-01"]]) {
      expect((await maakUitzondering("bistro", form({ datum: begin, einddatum: eind, soort: "gesloten" })))?.fout).toBeTruthy();
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("vraagt bevestiging voor het verwijderen van een periode en filtert op restaurant", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect((await verwijderUitzonderingsperiode("bistro", id, form({})))?.waarschuwing).toBeTruthy();
    expect(mocks.deleteFilter).not.toHaveBeenCalled();
    expect((await verwijderUitzonderingsperiode("bistro", id, form({ bevestig: "ja" })))?.ok).toBeTruthy();
    expect(mocks.deleteFilter).toHaveBeenCalledWith("restaurant_id", "restaurant-a");
    expect(mocks.deleteFilter).toHaveBeenCalledWith("periode_id", id);
  });
});
