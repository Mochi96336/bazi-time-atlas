import { readFile } from "node:fs/promises";
import {
  decodeDe441SeasonalEpochChunk
} from "../../src/astronomy/de441-seasonal-event-chunk.js";
import {
  clearResearchSeasonalEvidenceForTests,
  installResearchSeasonalEvidenceChunk
} from "../../src/recurrence/research-seasonal-evidence-registry.js";

export async function installResearchSeasonal10026Fixture() {
  clearResearchSeasonalEvidenceForTests();
  const manifest = JSON.parse(
    await readFile(
      new URL("../../data/research/de441-seasonal-10026.manifest.json", import.meta.url),
      "utf8"
    )
  );
  const bytes = new Uint8Array(
    await readFile(
      new URL("../../data/research/de441-seasonal-10026.bin", import.meta.url)
    )
  );
  const chunk = decodeDe441SeasonalEpochChunk(bytes);
  installResearchSeasonalEvidenceChunk({ manifest, chunk });
  return { manifest, chunk, bytes };
}
