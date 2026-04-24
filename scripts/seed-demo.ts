import "dotenv/config";
import { db } from "../lib/db";
import { runAnomalyPipeline } from "../lib/detectors/runAll";
import { generateMockMeterData } from "./generate-mock-meter-data";

async function main() {
  const g = generateMockMeterData();
  await db.$transaction([
    db.anomaly.deleteMany(),
    db.consumerReading.deleteMany(),
    db.feederReading.deleteMany(),
    db.consumer.deleteMany(),
    db.feeder.deleteMany(),
    db.substation.deleteMany(),
  ]);

  for (const s of g.substations) {
    await db.substation.create({
      data: { id: s.id, code: s.code, name: s.name, division: s.division, lat: s.lat, lng: s.lng },
    });
  }
  for (const f of g.feeders) {
    await db.feeder.create({
      data: {
        id: f.id,
        substationId: f.substationId,
        code: f.code,
        name: f.name,
        type: f.type,
        capacityKW: f.capacityKW,
      },
    });
  }
  for (const c of g.consumers) {
    await db.consumer.create({
      data: {
        id: c.id,
        feederId: c.feederId,
        rrNumber: c.rrNumber,
        name: c.name,
        type: c.type,
        sanctionedLoad: c.sanctionedLoad,
        pincode: c.pincode,
        lat: c.lat,
        lng: c.lng,
      },
    });
  }
  for (let i = 0; i < g.feederReadings.length; i += 400) {
    const chunk = g.feederReadings.slice(i, i + 400);
    await db.feederReading.createMany({
      data: chunk.map((r) => ({
        id: r.id,
        feederId: r.feederId,
        timestamp: r.timestamp,
        kwhSupplied: r.kwhSupplied,
        kwhBilled: r.kwhBilled,
        lossKwh: r.lossKwh,
        lossPct: r.lossPct,
      })),
    });
  }
  for (let i = 0; i < g.consumerReadings.length; i += 400) {
    const chunk = g.consumerReadings.slice(i, i + 400);
    await db.consumerReading.createMany({
      data: chunk.map((r) => ({
        id: r.id,
        consumerId: r.consumerId,
        timestamp: r.timestamp,
        kwh: r.kwh,
        voltage: r.voltage,
        current: r.current,
        powerFactor: r.powerFactor,
        reverseFlow: r.reverseFlow,
        commStatus: r.commStatus,
      })),
    });
  }
  const det = await runAnomalyPipeline();
  console.log("MeterSense AI seed complete.");
  console.log(`Substations: ${g.substations.length}, feeders: ${g.feeders.length}, consumers: ${g.consumers.length}`);
  console.log(
    `Readings: feeder ${g.feederReadings.length}, consumer ${g.consumerReadings.length}`
  );
  console.log("Detection:", det);
  console.log("Start: npm run dev  →  http://localhost:3000");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
