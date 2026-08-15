/**
 * Fetch ALL read-only EMS endpoints (including every TD brand/city/showroom),
 * refresh samples.json, and stamp a live catalog note on TD Cities/Showrooms/Cars.
 *
 * Does NOT call book / create / cancel / callback.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COLLECTION = path.join(__dirname, "postman/EMS_API_postman_collection_v2.json");
const AGENTS_COPY = path.resolve(
  __dirname,
  "../wallan_outbound_agents/postman/EMS_API_postman_collection_v2.json"
);
const OUT = path.join(__dirname, "samples.json");

const collection = JSON.parse(fs.readFileSync(COLLECTION, "utf8"));
const existing = JSON.parse(fs.readFileSync(OUT, "utf8"));
const vars = Object.fromEntries((collection.variable || []).map((v) => [v.key, v.value]));
const base = vars.base_url;
const key = vars.api_key;
const today = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();

function redact(url) {
  return url.replaceAll(key, "{{api_key}}");
}

async function get(p, qs = {}) {
  const u = new URL(`${base}/${p}`);
  u.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(qs)) {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  }
  const res = await fetch(u, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep */
  }
  return {
    fetchedAt: now,
    status: res.status,
    url: redact(u.pathname + u.search),
    body: json ? JSON.stringify(json, null, 2) : text,
    json,
  };
}

async function postForm(p, fields = {}) {
  const u = new URL(`${base}/${p}`);
  const res = await fetch(u, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ api_key: key, ...fields }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep */
  }
  return {
    fetchedAt: now,
    status: res.status,
    url: redact(u.pathname),
    body: json ? JSON.stringify(json, null, 2) : text,
    json,
  };
}

function strip(sample) {
  const { json, ...rest } = sample;
  return rest;
}

const samples = { ...existing };
async function save(pathKey, sample) {
  console.log(`${pathKey} … ${sample.status} (${sample.body.length} chars)`);
  samples[pathKey] = strip(sample);
  return sample;
}

function keepWriteSample(pathKey) {
  if (existing[pathKey]) {
    samples[pathKey] = existing[pathKey];
    console.log(`kept prior sample: ${pathKey}`);
  }
}

// --- Appointment reads ---
await save("appointment/franchises.php", await get("appointment/franchises.php"));
await save("appointment/departments.php", await get("appointment/departments.php"));
const serviceTypes = await save(
  "appointment/service_types.php",
  await get("appointment/service_types.php")
);
const typeId = serviceTypes.json?.data?.[0]?.id ?? 1;
await save(
  "appointment/branches.php",
  await get("appointment/branches.php", { franchise_id: "1", department_id: "2" })
);
await save(
  "appointment/available_slots.php",
  await get("appointment/available_slots.php", {
    branch: "85Q",
    Type_sel: String(typeId),
    date: today,
  })
);
await save("appointment/metadata.php", await postForm("appointment/metadata.php"));
await save(
  "appointment/car_data.php",
  await postForm("appointment/car_data.php", { franchise_id: "1" })
);
await save(
  "appointment/customer_lookup.php",
  await postForm("appointment/customer_lookup.php", { phone: "0582701766" })
);

keepWriteSample("appointment/create_customer.php");
keepWriteSample("appointment/book.php");
keepWriteSample("appointment/cancel.php");
keepWriteSample("call_back/add.php");
keepWriteSample("test_drive/book.php");
keepWriteSample("test_drive/cancel.php");

// --- Test drive catalog walk ---
const brands = await save("test_drive/brands.php", await get("test_drive/brands.php"));
const catalog = [];
let bestCities = null;
let bestShowrooms = null;
let bestCars = null;
let bestSlots = null;

for (const brand of brands.json?.data || []) {
  const cities = await get("test_drive/cities.php", { brand_id: brand.id });
  const cityList = cities.json?.success ? cities.json.data || [] : [];
  const brandRow = {
    id: brand.id,
    brand: brand.brand_name,
    cities: [],
  };
  console.log(
    `  brand ${brand.id} ${brand.brand_name}: cities=${cityList.length || cities.json?.message}`
  );

  if (brand.id === 1 && cities.json?.success) bestCities = cities;

  for (const city of cityList) {
    const showrooms = await get("test_drive/showrooms.php", { city_id: city.id });
    const rooms = showrooms.json?.success ? showrooms.json.data || [] : [];
    brandRow.cities.push({
      id: city.id,
      city: city.city_name,
      showrooms: rooms.map((s) => ({
        id: s.id,
        name: s.showroom_name || s.name,
      })),
    });
    console.log(`    city ${city.id} ${city.city_name}: showrooms=${rooms.length}`);

    if (
      !bestShowrooms ||
      (showrooms.json?.count || 0) > (bestShowrooms.json?.count || 0)
    ) {
      bestShowrooms = showrooms;
    }

    for (const room of rooms) {
      const cars = await get("test_drive/cars.php", {
        brand_id: brand.id,
        showroom_id: room.id,
      });
      const carCount = cars.json?.cars_count || cars.json?.cars?.length || 0;
      console.log(
        `      showroom ${room.id} ${room.showroom_name || room.name}: cars=${carCount}`
      );
      if (!bestCars || carCount > (bestCars.json?.cars_count || 0)) {
        bestCars = cars;
      }
      const model = cars.json?.cars?.[0]?.car_model;
      if (model && !bestSlots) {
        const slots = await get("test_drive/available_slots.php", {
          showroom_id: room.id,
          car_model: model,
          date: today,
          brand_id: brand.id,
        });
        if (slots.json?.success) bestSlots = slots;
      }
    }
  }
  catalog.push(brandRow);
}

if (bestCities) await save("test_drive/cities.php", bestCities);
if (bestShowrooms) await save("test_drive/showrooms.php", bestShowrooms);
if (bestCars) await save("test_drive/cars.php", bestCars);

// Prefer a slots sample that includes available:true if we can find one
if (bestSlots) await save("test_drive/available_slots.php", bestSlots);

const lookup = await postForm("test_drive/lookup.php", {
  customer_phone: "0582701766",
});
if (lookup.json?.data?.length) {
  const booked = lookup.json.data.find((d) => d.status === "Booked") || lookup.json.data[0];
  const cancelled =
    lookup.json.data.find((d) => d.status === "Cancelled") || lookup.json.data[1];
  samples["test_drive/lookup.php"] = {
    fetchedAt: now,
    status: lookup.status,
    url: lookup.url,
    body: JSON.stringify(
      {
        success: true,
        count: lookup.json.count,
        customer_phone: lookup.json.customer_phone,
        data: [booked, cancelled].filter(Boolean),
      },
      null,
      2
    ),
    source: "live-truncated",
  };
  console.log("test_drive/lookup.php …", lookup.status, "count=", lookup.json.count);
  const getOne = await get("test_drive/get.php", {
    appointment_id: booked.appointment_id,
  });
  await save("test_drive/get.php", getOne);
}

function catalogNote(rows) {
  const lines = ["Live catalog snapshot (fetched " + today + "):"];
  for (const b of rows) {
    if (!b.cities.length) {
      lines.push(`• ${b.brand} (id ${b.id}): no cities`);
      continue;
    }
    const bits = b.cities.map((c) => {
      const names = c.showrooms.map((s) => `${s.name}#${s.id}`).join(", ") || "no showrooms";
      return `${c.city}#${c.id} [${names}]`;
    });
    lines.push(`• ${b.brand} (id ${b.id}): ${bits.join("; ")}`);
  }
  return lines.join("\n");
}

function walk(items, fn) {
  for (const it of items || []) {
    if (it.item) walk(it.item, fn);
    else fn(it);
  }
}

const note = catalogNote(catalog);
console.log("\n" + note);

walk(collection.item, (it) => {
  if (it.name?.startsWith("14.")) {
    const baseDesc = (it.request.description || "").split("\n\nLive catalog")[0];
    it.request.description = `${baseDesc}\n\n${note}`;
  }
  if (it.name?.startsWith("15.")) {
    const baseDesc = (it.request.description || "").split("\n\nLive catalog")[0];
    it.request.description =
      `${baseDesc}\n\nSample below uses the city with the most showrooms from the live walk.\n\n${note}`;
  }
  if (it.name?.startsWith("16.")) {
    const baseDesc = (it.request.description || "").split("\n\nLive catalog")[0];
    it.request.description =
      `${baseDesc}\n\nSample below is the showroom with the largest car list from the live walk.`;
  }
});

fs.writeFileSync(COLLECTION, JSON.stringify(collection, null, 2) + "\n");
try {
  fs.writeFileSync(AGENTS_COPY, JSON.stringify(collection, null, 2) + "\n");
} catch {
  /* optional */
}
fs.writeFileSync(OUT, JSON.stringify(samples, null, 2));
fs.writeFileSync(path.join(__dirname, "_td_catalog.json"), JSON.stringify(catalog, null, 2));
console.log(`Wrote ${OUT} (${Object.keys(samples).length} samples)`);
