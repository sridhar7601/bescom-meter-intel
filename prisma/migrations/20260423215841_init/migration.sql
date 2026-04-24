-- CreateTable
CREATE TABLE "Substation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Feeder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "substationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacityKW" REAL NOT NULL,
    CONSTRAINT "Feeder_substationId_fkey" FOREIGN KEY ("substationId") REFERENCES "Substation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Consumer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feederId" TEXT NOT NULL,
    "rrNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sanctionedLoad" REAL NOT NULL,
    "pincode" TEXT NOT NULL,
    "lat" REAL,
    "lng" REAL,
    CONSTRAINT "Consumer_feederId_fkey" FOREIGN KEY ("feederId") REFERENCES "Feeder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeederReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feederId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "kwhSupplied" REAL NOT NULL,
    "kwhBilled" REAL NOT NULL,
    "lossKwh" REAL NOT NULL,
    "lossPct" REAL NOT NULL,
    CONSTRAINT "FeederReading_feederId_fkey" FOREIGN KEY ("feederId") REFERENCES "Feeder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsumerReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consumerId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "kwh" REAL NOT NULL,
    "voltage" REAL,
    "current" REAL,
    "powerFactor" REAL,
    "reverseFlow" BOOLEAN NOT NULL DEFAULT false,
    "commStatus" TEXT,
    CONSTRAINT "ConsumerReading_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Anomaly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consumerId" TEXT,
    "feederId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "score" REAL NOT NULL,
    "evidence" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "estimatedLossKwh" REAL,
    "estimatedRevenueLossInr" REAL,
    "investigator" TEXT,
    "resolution" TEXT,
    "statusHistory" TEXT,
    CONSTRAINT "Anomaly_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Anomaly_feederId_fkey" FOREIGN KEY ("feederId") REFERENCES "Feeder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Substation_code_key" ON "Substation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Feeder_code_key" ON "Feeder"("code");

-- CreateIndex
CREATE INDEX "Feeder_substationId_idx" ON "Feeder"("substationId");

-- CreateIndex
CREATE UNIQUE INDEX "Consumer_rrNumber_key" ON "Consumer"("rrNumber");

-- CreateIndex
CREATE INDEX "Consumer_feederId_idx" ON "Consumer"("feederId");

-- CreateIndex
CREATE INDEX "Consumer_pincode_idx" ON "Consumer"("pincode");

-- CreateIndex
CREATE INDEX "FeederReading_feederId_timestamp_idx" ON "FeederReading"("feederId", "timestamp");

-- CreateIndex
CREATE INDEX "ConsumerReading_consumerId_timestamp_idx" ON "ConsumerReading"("consumerId", "timestamp");

-- CreateIndex
CREATE INDEX "Anomaly_status_severity_idx" ON "Anomaly"("status", "severity");

-- CreateIndex
CREATE INDEX "Anomaly_feederId_idx" ON "Anomaly"("feederId");

-- CreateIndex
CREATE INDEX "Anomaly_type_idx" ON "Anomaly"("type");
