/**
 * Fetches safe read-only EMS endpoints and writes samples.json.
 * Does NOT call book / create / cancel / callback.
 *
 * Usage: node fetch-samples.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COLLECTION = path.resolve(
  __dirname,
  "postman/EMS_API_postman_collection_v2.json"
);
const OUT = path.resolve(__dirname, "samples.json");

const collection = JSON.parse(fs.readFileSync(COLLECTION, "utf8"));
const vars = Object.fromEntries(
  (collection.variable || []).map((v) => [v.key, v.value])
);
const base = process.env.EMS_BASE_URL || vars.base_url;
const key = process.env.EMS_API_KEY || vars.api_key;

function redact(url) {
  return url.replaceAll(key, "{{api_key}}");
}

async function get(p, qs = {}) {
  const u = new URL(`${base}/${p}`);
  u.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(qs)) {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
  }
  const res = await fetch(u.toString(), {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    /* keep */
  }
  if (body.length > 12000) body = body.slice(0, 12000) + "\n… truncated …";
  return {
    fetchedAt: new Date().toISOString(),
    status: res.status,
    url: redact(u.pathname + u.search),
    body,
    json: (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })(),
  };
}

async function postForm(p, fields = {}) {
  const u = new URL(`${base}/${p}`);
  const body = new URLSearchParams({ api_key: key, ...fields });
  const res = await fetch(u.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  let pretty = text;
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    /* keep */
  }
  if (pretty.length > 12000) pretty = pretty.slice(0, 12000) + "\n… truncated …";
  return {
    fetchedAt: new Date().toISOString(),
    status: res.status,
    url: redact(u.pathname),
    body: pretty,
    json: (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })(),
  };
}

function stripJson(sample) {
  const { json, ...rest } = sample;
  return rest;
}

const samples = {};

async function save(pathKey, sample) {
  process.stdout.write(`${pathKey} … ${sample.status}\n`);
  samples[pathKey] = stripJson(sample);
  return sample;
}

await save("appointment/franchises.php", await get("appointment/franchises.php"));
await save("appointment/departments.php", await get("appointment/departments.php"));
await save(
  "appointment/branches.php",
  await get("appointment/branches.php", { franchise_id: "1", department_id: "2" })
);

const today = new Date().toISOString().slice(0, 10);
const serviceTypes = await get("appointment/service_types.php");
await save("appointment/service_types.php", serviceTypes);
const typeId =
  serviceTypes.json?.data?.[0]?.id ??
  serviceTypes.json?.data?.[0]?.Type_sel ??
  serviceTypes.json?.data?.[0]?.type_id;

const slots = await get("appointment/available_slots.php", {
  branch: "85Q",
  Type_sel: typeId != null ? String(typeId) : "1",
  date: today,
});
await save("appointment/available_slots.php", slots);

await save(
  "appointment/metadata.php",
  await postForm("appointment/metadata.php")
);
await save(
  "appointment/car_data.php",
  await postForm("appointment/car_data.php", { franchise_id: "1" })
);

await save("test_drive/brands.php", await get("test_drive/brands.php"));

let cities = await get("test_drive/cities.php", { brand_id: "5" });
if (!cities.json?.success) {
  cities = await get("test_drive/cities.php", { brand_id: "1" });
}
await save("test_drive/cities.php", cities);

const cityId = cities.json?.data?.[0]?.id || cities.json?.data?.[0]?.city_id;
if (cityId) {
  const showrooms = await get("test_drive/showrooms.php", {
    city_id: String(cityId),
  });
  await save("test_drive/showrooms.php", showrooms);
  const showroomId =
    showrooms.json?.data?.[0]?.id || showrooms.json?.data?.[0]?.showroom_id;
  if (showroomId) {
    const cars = await get("test_drive/cars.php", {
      brand_id: "5",
      showroom_id: String(showroomId),
    });
    await save("test_drive/cars.php", cars);
    const carModel =
      cars.json?.cars?.[0]?.car_model ||
      cars.json?.cars?.[0]?.name ||
      cars.json?.data?.[0]?.car_model ||
      cars.json?.data?.[0]?.name;
    if (carModel) {
      const tdSlots = await get("test_drive/available_slots.php", {
        showroom_id: String(showroomId),
        car_model: String(carModel),
        date: today,
        brand_id: "5",
      });
      await save("test_drive/available_slots.php", tdSlots);
    }
  }
}

fs.writeFileSync(OUT, JSON.stringify(samples, null, 2));
console.log(`Wrote ${OUT} (${Object.keys(samples).length} samples)`);
