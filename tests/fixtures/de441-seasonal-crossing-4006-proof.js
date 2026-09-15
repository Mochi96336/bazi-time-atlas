import { STATE_DATA_0 } from "./de441-seasonal-crossing-4006-state-data-0.js";
import { STATE_DATA_1 } from "./de441-seasonal-crossing-4006-state-data-1.js";
import { STATE_DATA_2 } from "./de441-seasonal-crossing-4006-state-data-2.js";
import { STATE_DATA_3 } from "./de441-seasonal-crossing-4006-state-data-3.js";
import { FRAME_DATA_0 } from "./de441-seasonal-crossing-4006-frame-data-0.js";
import { FRAME_DATA_1 } from "./de441-seasonal-crossing-4006-frame-data-1.js";

function decodeFloat64LittleEndian(base64) {
  const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length:bytes.byteLength / 8 }, (_, index) => view.getFloat64(index * 8, true));
}

const STATE_DATA_BASE64 = STATE_DATA_0 + STATE_DATA_1 + STATE_DATA_2 + STATE_DATA_3;
const FRAME_DATA_BASE64 = FRAME_DATA_0 + FRAME_DATA_1;

const STATE_WINDOW_SPECS = Object.freeze([
  Object.freeze(["春分",3184299.5,2]),
  Object.freeze(["清明",3184314.5,2]),
  Object.freeze(["穀雨",3184329.5,2]),
  Object.freeze(["立夏",3184344.5,2]),
  Object.freeze(["小滿",3184359.5,3]),
  Object.freeze(["芒種",3184375.5,2]),
  Object.freeze(["夏至",3184390.5,2]),
  Object.freeze(["小暑",3184406.5,2]),
  Object.freeze(["大暑",3184422.5,2]),
  Object.freeze(["立秋",3184437.5,2]),
  Object.freeze(["處暑",3184453.5,2]),
  Object.freeze(["白露",3184469.5,2]),
  Object.freeze(["秋分",3184484.5,2]),
  Object.freeze(["寒露",3184500.5,2]),
  Object.freeze(["霜降",3184515.5,2]),
  Object.freeze(["立冬",3184530.5,3]),
  Object.freeze(["小雪",3184546.5,2]),
  Object.freeze(["大雪",3184561.5,2]),
  Object.freeze(["冬至",3184210.5,2]),
  Object.freeze(["小寒",3184225.5,2]),
  Object.freeze(["大寒",3184240.5,2]),
  Object.freeze(["立春",3184255.5,2]),
  Object.freeze(["雨水",3184270.5,2]),
  Object.freeze(["驚蟄",3184284.5,2]),
]);
const FRAME_WINDOW_SPECS = Object.freeze([
  Object.freeze(["春分",3184299.5,3184300.5]),
  Object.freeze(["清明",3184314.5,3184315.5]),
  Object.freeze(["穀雨",3184329.5,3184330.5]),
  Object.freeze(["立夏",3184344.5,3184345.5]),
  Object.freeze(["小滿",3184359.5,3184360.5]),
  Object.freeze(["小滿",3184360.5,3184361.5]),
  Object.freeze(["芒種",3184375.5,3184376.5]),
  Object.freeze(["夏至",3184390.5,3184391.5]),
  Object.freeze(["小暑",3184406.5,3184407.5]),
  Object.freeze(["大暑",3184422.5,3184423.5]),
  Object.freeze(["立秋",3184437.5,3184438.5]),
  Object.freeze(["處暑",3184453.5,3184454.5]),
  Object.freeze(["白露",3184469.5,3184470.5]),
  Object.freeze(["秋分",3184484.5,3184485.5]),
  Object.freeze(["寒露",3184500.5,3184501.5]),
  Object.freeze(["霜降",3184515.5,3184516.5]),
  Object.freeze(["立冬",3184530.5,3184531.5]),
  Object.freeze(["立冬",3184531.5,3184532.5]),
  Object.freeze(["小雪",3184546.5,3184547.5]),
  Object.freeze(["大雪",3184561.5,3184562.5]),
  Object.freeze(["冬至",3184210.5,3184211.5]),
  Object.freeze(["小寒",3184225.5,3184226.5]),
  Object.freeze(["大寒",3184240.5,3184241.5]),
  Object.freeze(["立春",3184255.5,3184256.5]),
  Object.freeze(["雨水",3184270.5,3184271.5]),
  Object.freeze(["驚蟄",3184284.5,3184285.5]),
]);

const stateData = decodeFloat64LittleEndian(STATE_DATA_BASE64);
let stateOffset = 0;
const stateWindows = STATE_WINDOW_SPECS.map(([term, startTdbJulianDay, sampleCount]) => {
  const componentCount = sampleCount * 6;
  const earth = stateData.slice(stateOffset, stateOffset + componentCount);
  stateOffset += componentCount;
  const sun = stateData.slice(stateOffset, stateOffset + componentCount);
  stateOffset += componentCount;
  return Object.freeze({ term, startTdbJulianDay, stepDays:1, sampleCount, earth:Object.freeze(earth), sun:Object.freeze(sun) });
});
if (stateOffset !== stateData.length) throw new RangeError("unexpected packed state proof length");

const frameData = decodeFloat64LittleEndian(FRAME_DATA_BASE64);
let frameOffset = 0;
const frameWindows = FRAME_WINDOW_SPECS.map(([term, startJdTt, endJdTt]) => {
  const startQuaternion = frameData.slice(frameOffset, frameOffset + 4);
  frameOffset += 4;
  const endQuaternion = frameData.slice(frameOffset, frameOffset + 4);
  frameOffset += 4;
  return Object.freeze({ term, startJdTt, endJdTt, startQuaternion:Object.freeze(startQuaternion), endQuaternion:Object.freeze(endQuaternion) });
});
if (frameOffset !== frameData.length) throw new RangeError("unexpected packed frame proof length");

export const DE441_SEASONAL_CROSSING_4006_FIXTURE = Object.freeze({
  catalogueYear:4006, initialHalfBracketDays:0.05, toleranceSeconds:0.005,
  stateProvenance:Object.freeze({
    authority:"NASA/JPL Horizons API", researchPullRequest:86, researchWorkflowRunId:34836797011, researchArtifactId:10344981076,
    artifactDigest:"sha256:d1c5c5c504bee2d68053aaf47541b5b6f61cd0c740b9946492b7d641dc5c0dca", sourceEphemeris:"DE441", referenceFrame:"ICRF", timeScale:"TDB", units:"AU/day", corrections:"NONE (geometric)",
    sourceFileDigests:Object.freeze({ earth4006Daily:"sha256:e034acd70da07a3cdebf9e1dbab2512e7437ad8777a682d288ea046fd3be105b", sun4006Daily:"sha256:ec9d1e85f1fd0cb1cf984534254deaa7f43bd1365db980da76ab8571e2a278e4" })
  }),
  frameProvenance:Object.freeze({
    authority:"NASA/JPL Horizons API", researchPullRequest:94, researchWorkflowRunId:34881697237, researchArtifactId:10363212590,
    artifactDigest:"sha256:7445693e518a54c261eb1cd499f78522558eee2cb57a250c51a82e40b5b44549", observer:"Earth geocenter (500@399)", timeScale:"TT",
    sourceFrame:"ICRF apparent direction (quantity #45)", targetFrame:"Earth ecliptic-of-date apparent direction (quantity #31)",
    sourceFileDigests:Object.freeze({ sunDaily:"sha256:517253716c18cbdec36923f1232a8b30cf84007c88d5688661540eecd67bf2b1", moonDaily:"sha256:c5f19859b867ad7c227700afa2c43947b6164f13303eba3469ba5961d467224d" })
  }),
  stateWindows:Object.freeze(stateWindows), frameWindows:Object.freeze(frameWindows),
  crossings:Object.freeze([
    Object.freeze({ name:"春分", longitudeDegrees:0, shouXingSeedTtJulianDay:3184300.1814442892, horizonsTruthTtJulianDay:3184300.178494792, shouXingEpochErrorSeconds:254.83655780553818 }),
    Object.freeze({ name:"清明", longitudeDegrees:15, shouXingSeedTtJulianDay:3184315.0936590708, horizonsTruthTtJulianDay:3184315.0907062502, shouXingEpochErrorSeconds:255.1237016916275 }),
    Object.freeze({ name:"穀雨", longitudeDegrees:30, shouXingSeedTtJulianDay:3184330.1013284009, horizonsTruthTtJulianDay:3184330.0983532979, shouXingEpochErrorSeconds:257.04889744520187 }),
    Object.freeze({ name:"立夏", longitudeDegrees:45, shouXingSeedTtJulianDay:3184345.2337153978, horizonsTruthTtJulianDay:3184345.2307304628, shouXingEpochErrorSeconds:257.8983798623085 }),
    Object.freeze({ name:"小滿", longitudeDegrees:60, shouXingSeedTtJulianDay:3184360.4835024602, horizonsTruthTtJulianDay:3184360.4804885532, shouXingEpochErrorSeconds:260.40156483650208 }),
    Object.freeze({ name:"芒種", longitudeDegrees:75, shouXingSeedTtJulianDay:3184375.863625844, horizonsTruthTtJulianDay:3184375.8605956952, shouXingEpochErrorSeconds:261.80485635995865 }),
    Object.freeze({ name:"夏至", longitudeDegrees:90, shouXingSeedTtJulianDay:3184391.350420211, horizonsTruthTtJulianDay:3184391.347367893, shouXingEpochErrorSeconds:263.72027546167374 }),
    Object.freeze({ name:"小暑", longitudeDegrees:105, shouXingSeedTtJulianDay:3184406.9388029082, horizonsTruthTtJulianDay:3184406.935732442, shouXingEpochErrorSeconds:265.28828144073486 }),
    Object.freeze({ name:"大暑", longitudeDegrees:120, shouXingSeedTtJulianDay:3184422.5921048219, horizonsTruthTtJulianDay:3184422.5890060188, shouXingEpochErrorSeconds:267.73658841848373 }),
    Object.freeze({ name:"立秋", longitudeDegrees:135, shouXingSeedTtJulianDay:3184438.289565627, horizonsTruthTtJulianDay:3184438.286468762, shouXingEpochErrorSeconds:267.56913810968399 }),
    Object.freeze({ name:"處暑", longitudeDegrees:150, shouXingSeedTtJulianDay:3184453.990473236, horizonsTruthTtJulianDay:3184453.9873462152, shouXingEpochErrorSeconds:270.17459571361542 }),
    Object.freeze({ name:"白露", longitudeDegrees:165, shouXingSeedTtJulianDay:3184469.6653289958, horizonsTruthTtJulianDay:3184469.662216018, shouXingEpochErrorSeconds:268.96128505468369 }),
    Object.freeze({ name:"秋分", longitudeDegrees:180, shouXingSeedTtJulianDay:3184485.280431198, horizonsTruthTtJulianDay:3184485.2773122801, shouXingEpochErrorSeconds:269.47449892759323 }),
    Object.freeze({ name:"寒露", longitudeDegrees:195, shouXingSeedTtJulianDay:3184500.8072456941, horizonsTruthTtJulianDay:3184500.8041621181, shouXingEpochErrorSeconds:266.42096489667892 }),
    Object.freeze({ name:"霜降", longitudeDegrees:210, shouXingSeedTtJulianDay:3184516.228416373, horizonsTruthTtJulianDay:3184516.2253336799, shouXingEpochErrorSeconds:266.34468287229538 }),
    Object.freeze({ name:"立冬", longitudeDegrees:225, shouXingSeedTtJulianDay:3184531.5252630678, horizonsTruthTtJulianDay:3184531.5222198502, shouXingEpochErrorSeconds:262.93399930000305 }),
    Object.freeze({ name:"小雪", longitudeDegrees:240, shouXingSeedTtJulianDay:3184546.7005714448, horizonsTruthTtJulianDay:3184546.697540544, shouXingEpochErrorSeconds:261.86983287334442 }),
    Object.freeze({ name:"大雪", longitudeDegrees:255, shouXingSeedTtJulianDay:3184561.7501341929, horizonsTruthTtJulianDay:3184561.7471325579, shouXingEpochErrorSeconds:259.34126079082489 }),
    Object.freeze({ name:"冬至", longitudeDegrees:270, shouXingSeedTtJulianDay:3184211.4453953952, horizonsTruthTtJulianDay:3184211.442412836, shouXingEpochErrorSeconds:257.69311040639877 }),
    Object.freeze({ name:"小寒", longitudeDegrees:285, shouXingSeedTtJulianDay:3184226.3013585201, horizonsTruthTtJulianDay:3184226.2983957641, shouXingEpochErrorSeconds:255.98211586475372 }),
    Object.freeze({ name:"大寒", longitudeDegrees:300, shouXingSeedTtJulianDay:3184241.0852828901, horizonsTruthTtJulianDay:3184241.082333345, shouXingEpochErrorSeconds:254.84070181846619 }),
    Object.freeze({ name:"立春", longitudeDegrees:315, shouXingSeedTtJulianDay:3184255.8402605569, horizonsTruthTtJulianDay:3184255.837325938, shouXingEpochErrorSeconds:253.55106890201569 }),
    Object.freeze({ name:"雨水", longitudeDegrees:330, shouXingSeedTtJulianDay:3184270.5826503392, horizonsTruthTtJulianDay:3184270.5797060528, shouXingEpochErrorSeconds:254.38634902238846 }),
    Object.freeze({ name:"驚蟄", longitudeDegrees:345, shouXingSeedTtJulianDay:3184285.3580262121, horizonsTruthTtJulianDay:3184285.3550911918, shouXingEpochErrorSeconds:253.58574986457825 }),
  ])
});
