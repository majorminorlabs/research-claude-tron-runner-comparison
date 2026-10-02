/**
 * All gameplay tuning lives here. World units are roughly metres; +Z points
 * away from the camera, +X to the right, +Y up. The player's centre never
 * leaves Z = 0 — the track moves past instead.
 */

export const LANE_COUNT = 3;
/** Centre-to-centre distance between lanes. */
export const LANE_WIDTH = 2.6;
/** X position of each lane centre, indexed by lane. */
export const LANE_X: readonly number[] = [-LANE_WIDTH, 0, LANE_WIDTH];

/** Fixed simulation step. The renderer interpolates between steps. */
export const STEP = 1 / 120;
/** Never advance more than this much simulated time in one frame. */
export const MAX_FRAME_TIME = 0.25;

// --- Player ---------------------------------------------------------------
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_SLIDE_HEIGHT = 0.8;
export const PLAYER_HALF_WIDTH = 0.35;
export const PLAYER_HALF_DEPTH = 0.55;

export const GRAVITY = 30;
export const JUMP_VELOCITY = 11.5;
/** Holding jump at the apex softens the fall slightly. */
export const JUMP_HOLD_GRAVITY_SCALE = 0.62;
export const SLIDE_DURATION = 0.55;
/** Seconds to travel one lane. Short enough that strafing is never a trap. */
export const STRAFE_DURATION = 0.13;
/** A jump pressed this long before landing still fires on touchdown. */
export const JUMP_BUFFER = 0.12;

// --- Speed ----------------------------------------------------------------
export const START_SPEED = 26;
export const MAX_SPEED = 72;
/** Distance over which speed climbs from START_SPEED to MAX_SPEED. */
export const SPEED_RAMP_DISTANCE = 9000;
/** Fraction of speed lost on taking a hit. */
export const HIT_SPEED_PENALTY = 0.3;
/** How fast speed recovers toward its target after a hit, per second. */
export const SPEED_RECOVERY = 14;
export const BOOST_SPEED_BONUS = 16;
export const BOOST_DURATION = 5;
export const BOOST_SCORE_MULTIPLIER = 2;

// --- Integrity / damage ---------------------------------------------------
export const MAX_INTEGRITY = 3;
export const START_INTEGRITY = 3;
/** Invulnerable window after a hit, so one wall can't drain two segments. */
export const INVULN_DURATION = 1.4;

// --- Scoring --------------------------------------------------------------
/** Score per world unit travelled, before multipliers. */
export const SCORE_PER_UNIT = 0.6;
export const ORB_SCORE = 50;
/** Each consecutive orb adds this to the combo multiplier, up to the cap. */
export const COMBO_STEP = 0.1;
export const COMBO_MAX = 3;
/** Missing orbs for this long resets the combo. */
export const COMBO_TIMEOUT = 4;

// --- Track generation -----------------------------------------------------
/** Obstacles become visible here and are culled behind the player. */
export const SPAWN_DISTANCE = 230;
export const DESPAWN_DISTANCE = -14;
/** Distance of empty track before the first hazard. */
export const GRACE_DISTANCE = 90;
/** Row spacing is the larger of this and speed * ROW_GAP_SECONDS. */
export const MIN_ROW_GAP = 26;
/**
 * Seconds of travel between hazard rows. Must exceed the jump's airtime
 * (2 * JUMP_VELOCITY / GRAVITY ~= 0.77s) so a jump row followed by a slide row
 * is always clearable.
 */
export const ROW_GAP_SECONDS = 0.92;
/** Extra random spacing added on top of the computed gap. */
export const ROW_GAP_JITTER = 14;

// --- Obstacle geometry ----------------------------------------------------
export const OBSTACLE_HALF_WIDTH = 0.95;
export const OBSTACLE_HALF_DEPTH = 0.6;
/** Ground barrier: cleared by jumping. */
export const BARRIER_HEIGHT = 1.15;
/** Overhead beam: cleared by sliding. Spans BEAM_BOTTOM upward. */
export const BEAM_BOTTOM = 1.0;
export const BEAM_TOP = 4.2;
/** Full-height block: cleared only by being in another lane. */
export const BLOCK_HEIGHT = 4.2;

// --- Pickups --------------------------------------------------------------
export const ORB_RADIUS = 0.75;
export const ORB_GROUND_Y = 1.15;
/** Orbs placed above a barrier, to reward jumping through it. */
export const ORB_AIR_Y = 2.6;
export const PICKUP_HALF_DEPTH = 0.75;
export const SHIELD_CHANCE = 0.1;
export const BOOST_CHANCE = 0.07;
/** Rows of orbs appear this often between hazard rows. */
export const ORB_ROW_CHANCE = 0.55;
