/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractFlowProfileFields,
  mapFlowResponseToLeadSubmission,
  normalizeFlowGender,
  parseFlowAge,
} from "./mapFlowResponseToLeadSubmission.ts";

Deno.test("normalizeFlowGender maps Indonesian and English values", () => {
  assertEquals(normalizeFlowGender("Laki-laki"), "Male");
  assertEquals(normalizeFlowGender("perempuan"), "Female");
  assertEquals(normalizeFlowGender("Other"), "Other");
  assertEquals(normalizeFlowGender("unknown"), null);
});

Deno.test("parseFlowAge accepts valid range only", () => {
  assertEquals(parseFlowAge("28"), 28);
  assertEquals(parseFlowAge(35), 35);
  assertEquals(parseFlowAge("0"), null);
  assertEquals(parseFlowAge("abc"), null);
  assertEquals(parseFlowAge("150"), null);
});

Deno.test("extractFlowProfileFields uses Indonesian aliases", () => {
  const profile = extractFlowProfileFields({
    jenis_kelamin: "Wanita",
    umur: "32",
    pekerjaan: "Designer",
    lokasi: "Jakarta",
  });
  assertEquals(profile.gender, "Female");
  assertEquals(profile.age, 32);
  assertEquals(profile.occupation, "Designer");
  assertEquals(profile.location, "Jakarta");
});

Deno.test("mapFlowResponseToLeadSubmission maps core + profile + extras", () => {
  const result = mapFlowResponseToLeadSubmission({
    name: "Budi",
    email: "budi@test.com",
    phone: "628123456789",
    gender: "Male",
    age: "28",
    occupation: "Engineer",
    location: "Bandung",
    budget: "50jt",
  });

  assertEquals(result.core.name, "Budi");
  assertEquals(result.core.email, "budi@test.com");
  assertEquals(result.core.phone_number, "628123456789");
  assertEquals(result.profile.gender, "Male");
  assertEquals(result.profile.age, 28);
  assertEquals(result.profile.occupation, "Engineer");
  assertEquals(result.profile.location, "Bandung");
  assertEquals(result.formData?.budget, "50jt");
  assertEquals(result.formData?.gender, undefined);
  assertEquals(result.formData?.age, undefined);
  assertEquals(result.formData?.occupation, undefined);
  assertEquals(result.formData?.location, undefined);
  assertEquals(result.formData?.name, undefined);
});

Deno.test("mapFlowResponseToLeadSubmission skips form_data when only core+profile", () => {
  const result = mapFlowResponseToLeadSubmission({
    name: "Ana",
    email: "a@test.com",
    phone: "628111",
    gender: "Female",
    age: "25",
    occupation: "HR",
    location: "Surabaya",
  });

  assertEquals(result.formData, null);
});
