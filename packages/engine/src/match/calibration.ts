/**
 * Every tuning constant of the match engine lives here, so calibration against real-world
 * statistics (see `npm run calibrate`) changes one file. Changing any value changes match
 * outcomes for existing seeds: bump ENGINE_VERSION when you do.
 */
export const K = {
  pitchLength: 105,
  pitchWidth: 68,
  goalWidth: 7.32,
  halfSeconds: 45 * 60,

  // --- time (seconds) consumed by actions
  passSeconds: [2.2, 4.8] as [number, number],
  dribbleSeconds: [2.5, 5.5] as [number, number],
  shotSeconds: 2,
  restartSeconds: {
    throwIn: 9,
    goalKick: 18,
    corner: 22,
    freeKick: 20,
    kickOff: 25,
    goal: 45,
    sub: 30,
    injury: 45,
  },
  /** Tempo slider (0-1) speeds play by up to this fraction. */
  tempoSpeedup: 0.3,

  // --- decisions
  shootBase: 0.62,
  /** Distance (m) beyond which players almost never shoot. */
  maxShotDistance: 35,
  /** Shot willingness falls off with distance at this scale (m). */
  shotDistanceScale: 6.5,
  dribbleBase: 0.32,
  crossBase: 0.72,
  clearanceBase: 0.5,

  // --- passing
  passBase: 0.885,
  /** Success penalty per metre beyond a comfortable short pass. */
  passLengthPenalty: 0.0052,
  comfortablePass: 14,
  passPressurePenalty: 0.16,
  passSkillWeight: 0.016,
  /** Extra risk for forward passes (per unit of forward progress in pitch fraction). */
  forwardRisk: 0.18,
  throughBallRisk: 0.12,
  crossSuccess: 0.32,
  /** Share of failed passes that go out of play rather than being intercepted. */
  failedPassOut: 0.28,

  // --- dribbling & duels
  dribbleSuccess: 0.6,
  duelSkillWeight: 0.03,
  dribblePressurePenalty: 0.18,
  /** Probability a lost duel or tackle attempt is a foul. */
  foulBase: 0.18,
  /** Probability (per action under pressure) the defender attempts a tackle. */
  pressureTurnover: 0.045,

  // --- shooting (see xg.ts)
  xgIntercept: -0.55,
  xgDistance: -0.115,
  xgAngle: 1.05,
  headerFactor: 0.55,
  pressureXgPenalty: 0.4,
  oneOnOneBonus: 1.9,
  blockBase: 0.12,
  blockPressure: 0.22,
  /** Effect of finishing vs goalkeeping (log-odds per 10 attribute points of difference). */
  finishingWeight: 0.55,
  keeperWeight: 0.6,
  onTargetFloor: 0.28,
  woodworkShare: 0.04,
  saveToCornerShare: 0.3,
  blockToCornerShare: 0.45,
  penaltyXg: 0.76,
  directFreeKickRange: 30,

  // --- set pieces & discipline
  penaltyFoulShare: 0.065,
  yellowPerFoul: 0.15,
  directRedPerFoul: 0.004,
  offsideOnThroughBall: 0.2,
  cornerHeaderChance: 0.42,

  // --- physical
  /** Condition lost per minute at average stamina and neutral intensity. */
  fatiguePerMinute: 0.32,
  injuryPerIntenseAction: 0.0011,

  // --- context
  homeAdvantage: 0.045,
  /** Per-match form wobble from the consistency attribute (multiplier SD at consistency 1). */
  inconsistency: 0.05,
};
