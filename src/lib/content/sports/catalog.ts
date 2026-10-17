import type { MetricSeed, SportProfile, SportSeed } from "./types";

/**
 * Broad sports catalog. These entries provide activity tracking, energy
 * estimates and an overview; full learning content exists only for sports
 * marked availability "full" (see the dedicated files). We deliberately do
 * not create empty lesson pages to look comprehensive.
 *
 * MET values are approximate, based on the Compendium of Physical Activities.
 */

const sel = (key: string, label: string, options: string[]): MetricSeed => ({ key, label, kind: "select", scope: "session", direction: "none", options });
const num = (key: string, label: string, unit?: string, max = 10000, direction: "higher" | "lower" | "none" = "none"): MetricSeed => ({ key, label, kind: "number", scope: "session", direction, unit, min: 0, max });
const pbTime = (key: string, label: string, min: number, max: number): MetricSeed => ({ key, label, kind: "time", scope: "performance", direction: "lower", unit: "s", min, max });
const pbNum = (key: string, label: string, unit: string, max: number): MetricSeed => ({ key, label, kind: "number", scope: "performance", direction: "higher", unit, min: 0, max });

const MATCH = (types = ["training", "match"]) => [sel("sessionType", "Session type", types), sel("result", "Result", ["won", "drew", "lost", "n/a"])];
const COMBAT = (types = ["technique", "drilling", "conditioning", "sparring / rolling"]) => [sel("sessionType", "Session type", types), num("rounds", "Rounds", undefined, 50)];
const ELEV = num("elevationM", "Elevation gain", "m", 10000);

const CONTACT_PROFILE = (extra: Partial<SportProfile> = {}): SportProfile => ({
  supervisionNote: "Contact techniques, throws, takedowns and sparring must be learned and practised under a qualified instructor in a registered club. This app does not provide contact or sparring instruction for this sport yet.",
  safety: ["Learn break-falls before any throwing or takedown practice.", "Use a mouthguard and protective equipment required by your club.", "Stop and get assessed after any head impact."],
  ageGuidance: "Young athletes should train in age-appropriate programmes run by qualified coaches.",
  ...extra,
});

const EXTERNAL = (note: string, extra: Partial<SportProfile> = {}): SportProfile => ({
  externalResources: [{ label: "Certified instruction required", note }],
  ...extra,
});

type Opt = Partial<Omit<SportSeed, "slug" | "name" | "category" | "met" | "summary">>;
const s = (slug: string, name: string, category: string, met: [number, number, number], summary: string, o: Opt = {}): SportSeed => ({
  slug,
  name,
  category,
  met,
  summary,
  availability: o.availability ?? "basic",
  ...o,
});

export const CATALOG: SportSeed[] = [
  // ── A. Combat sports & martial arts ────────────────────────────────
  s("kickboxing", "Kickboxing", "combat", [6, 7.3, 10.3], "Stand-up striking with punches and kicks; rulesets vary between organisations.", { metrics: COMBAT(["technique", "bag / pads", "conditioning", "sparring"]), profile: CONTACT_PROFILE({ exerciseTags: ["combat"] }) }),
  s("muay-thai", "Muay Thai", "combat", [6, 7.3, 10.3], "Thai striking art using fists, elbows, knees and shins, plus clinch work.", { aliases: ["thai boxing"], metrics: COMBAT(["technique", "bag / pads", "clinch", "conditioning", "sparring"]), profile: CONTACT_PROFILE({ exerciseTags: ["combat"] }) }),
  s("mma", "Mixed Martial Arts (MMA)", "combat", [6, 8, 10.3], "Combat sport combining striking and grappling under unified rules.", { aliases: ["mixed martial arts"], metrics: COMBAT(["striking", "wrestling", "grappling", "conditioning", "sparring"]), profile: CONTACT_PROFILE({ exerciseTags: ["combat"] }) }),
  s("bjj", "Brazilian Jiu-Jitsu", "combat", [5.3, 7, 10], "Grappling art focused on positional control and submissions on the ground.", { aliases: ["jiu-jitsu", "bjj"], metrics: COMBAT(["technique", "drilling", "positional sparring", "rolling"]), profile: CONTACT_PROFILE({ beginner: ["Tap early and often — tapping is how you learn safely.", "Learn to shrimp and break-fall in your first classes."] }) }),
  s("judo", "Judo", "combat", [5.3, 7, 10.3], "Olympic grappling sport of throws, pins, chokes and armlocks.", { metrics: COMBAT(["technique", "uchikomi", "randori", "competition"]), profile: CONTACT_PROFILE({ beginner: ["Break-falls (ukemi) come before throws."] }) }),
  s("wrestling", "Wrestling", "combat", [5.3, 7, 10], "Grappling sport of takedowns and pins; freestyle, Greco-Roman and folkstyle variants.", { metrics: COMBAT(["technique", "drilling", "live wrestling", "conditioning"]), profile: CONTACT_PROFILE({ ageGuidance: "Never use rapid or extreme weight cutting." }) }),
  s("karate", "Karate", "combat", [5.3, 7, 10.3], "Japanese striking art; practised through kihon (basics), kata (forms) and kumite (sparring).", { metrics: COMBAT(["kihon", "kata", "kumite", "conditioning"]), profile: CONTACT_PROFILE() }),
  s("taekwondo", "Taekwondo", "combat", [5.3, 7, 10.3], "Korean martial art and Olympic sport emphasising kicks.", { metrics: COMBAT(["technique", "poomsae", "sparring", "conditioning"]), profile: CONTACT_PROFILE() }),
  s("kung-fu", "Kung Fu / Chinese martial arts", "combat", [4, 5.3, 8], "Diverse family of Chinese martial arts including forms (taolu) and applications.", { aliases: ["wushu", "kungfu"], metrics: COMBAT(["forms", "technique", "applications", "conditioning"]), profile: CONTACT_PROFILE() }),
  s("sanda", "Sanda", "combat", [6, 7.3, 10.3], "Chinese full-contact kickboxing that includes throws.", { aliases: ["sanshou"], metrics: COMBAT(), profile: CONTACT_PROFILE() }),
  s("jujutsu", "Jujutsu", "combat", [5.3, 7, 10], "Traditional Japanese grappling and self-defence art; sport formats exist.", { aliases: ["ju-jitsu"], metrics: COMBAT(), profile: CONTACT_PROFILE() }),
  s("aikido", "Aikido", "combat", [4, 5.3, 7], "Japanese martial art of joint locks and throws using the attacker's energy; typically non-competitive.", { metrics: COMBAT(["technique", "ukemi", "weapons"]), profile: CONTACT_PROFILE() }),
  s("krav-maga", "Krav Maga", "combat", [6, 7.3, 10], "Self-defence system focused on practical responses to threats.", { metrics: COMBAT(["technique", "scenario drills", "conditioning"]), profile: CONTACT_PROFILE() }),
  s("fencing", "Fencing", "combat", [4, 6, 8], "Olympic weapon sport with three disciplines: foil, épée and sabre.", { metrics: [sel("sessionType", "Session type", ["footwork", "lesson", "bouting", "competition"]), sel("weapon", "Weapon", ["foil", "épée", "sabre"])], profile: { safety: ["Only fence with approved masks, jackets and weapons under club supervision."] } }),
  s("savate", "Savate", "combat", [6, 7.3, 10.3], "French kickboxing using punches and kicks with shoes.", { metrics: COMBAT(), profile: CONTACT_PROFILE() }),
  s("sambo", "Sambo", "combat", [5.3, 7, 10.3], "Russian grappling sport (and combat variant) with throws and leg locks.", { metrics: COMBAT(), profile: CONTACT_PROFILE() }),
  s("capoeira", "Capoeira", "combat", [4.5, 6, 8], "Afro-Brazilian art combining martial movement, acrobatics and music.", { metrics: COMBAT(["movement", "roda", "music", "acrobatics"]), profile: CONTACT_PROFILE() }),
  s("martial_arts", "Other martial arts", "combat", [5.3, 7, 10.3], "Traditional and regional martial arts not listed separately.", { metrics: [sel("sessionType", "Session type", ["technique", "forms", "drilling", "sparring / rolling"]), { key: "style", label: "Style", kind: "text", scope: "session", direction: "none" }], profile: CONTACT_PROFILE() }),

  // ── B. Team ball sports ────────────────────────────────────────────
  s("volleyball", "Volleyball", "team", [3, 4, 8], "Two teams of six hit the ball over a net, using up to three touches per side.", { metrics: MATCH(["training", "indoor match", "beach"]), profile: { beginner: ["Learn the platform pass (forearm dig) first.", "Land softly from jumps and strengthen shoulders for serving and spiking."], templates: [{ title: "Jump & shoulder prep", durationMin: 30, intensity: "moderate", structure: ["Landing sticks", "Squat jumps", "Band pull-aparts", "Face pulls"] }], exerciseTags: ["volleyball"] } }),
  s("beach-volleyball", "Beach volleyball", "team", [6, 8, 8], "Two-a-side volleyball on sand.", { parent: "volleyball", metrics: MATCH() }),
  s("handball", "Handball", "team", [6, 8, 12], "Fast team sport: seven-a-side, throwing the ball into the opponents' goal.", { metrics: [...MATCH(), num("goals", "Goals", undefined, 50, "higher")] }),
  s("rugby-union", "Rugby union", "team", [6.3, 8.3, 10], "Fifteen-a-side contact sport of running, passing backwards, kicking and tackling.", { metrics: [...MATCH(), num("tries", "Tries", undefined, 20, "higher")], profile: CONTACT_PROFILE({ supervisionNote: "Tackling, scrums and rucks must be coached in a club with age-appropriate rules." }) }),
  s("rugby-league", "Rugby league", "team", [6.3, 8.3, 10], "Thirteen-a-side rugby with a six-tackle possession rule.", { metrics: [...MATCH(), num("tries", "Tries", undefined, 20, "higher")], profile: CONTACT_PROFILE({ supervisionNote: "Tackling must be coached in a club with age-appropriate rules." }) }),
  s("american-football", "American football", "team", [6, 8, 9], "Eleven-a-side gridiron sport of downs, passing and running plays.", { metrics: MATCH(), profile: CONTACT_PROFILE({ supervisionNote: "Tackling must be coached with certified helmets and pads in an organised programme." }) }),
  s("flag-football", "Flag football", "team", [5, 7, 8], "Non-tackle version of American football — pulling a flag ends the play.", { metrics: MATCH() }),
  s("aussie-rules", "Australian rules football", "team", [6, 8, 10], "Eighteen-a-side contact sport on an oval, scoring goals and behinds.", { aliases: ["afl", "aussie rules"], metrics: MATCH(), profile: CONTACT_PROFILE() }),
  s("softball", "Softball", "team", [4, 5, 6], "Bat-and-ball game related to baseball with a larger ball and underhand pitching.", { metrics: [sel("sessionType", "Session type", ["practice", "batting", "game"]), num("hits", "Hits", undefined, 10, "higher"), num("at_bats", "At-bats", undefined, 10)] }),
  s("cricket", "Cricket", "team", [4.8, 5, 6], "Bat-and-ball sport between teams of eleven; formats from T20 to multi-day Tests.", { metrics: [sel("sessionType", "Session type", ["nets", "fielding", "match"]), num("runs", "Runs scored", undefined, 400, "higher"), num("balls_faced", "Balls faced", undefined, 600), num("overs_bowled", "Overs bowled", undefined, 50), num("wickets", "Wickets", undefined, 10, "higher")], profile: { safety: ["Wear a helmet and pads against hard-ball bowling.", "Fast bowlers: follow workload guidance, especially when young."] } }),
  s("field-hockey", "Field hockey", "team", [5, 7.8, 8], "Eleven-a-side stick and ball sport played on grass or turf.", { metrics: [...MATCH(), num("goals", "Goals", undefined, 20, "higher")], profile: { safety: ["Shin guards and mouthguards are strongly recommended (required in many competitions)."] } }),
  s("ice-hockey", "Ice hockey", "team", [5, 8, 10], "Fast skating team sport played with sticks and a puck.", { metrics: [...MATCH(), num("goals", "Goals", undefined, 20, "higher"), num("assists", "Assists", undefined, 20, "higher")], profile: { safety: ["Full protective equipment including helmet required."] } }),
  s("futsal", "Futsal", "team", [6, 8, 10], "Five-a-side indoor football with a smaller, heavier ball and its own laws.", { parent: "football", metrics: [...MATCH(), num("goals", "Goals", undefined, 30, "higher")] }),
  s("water-polo", "Water polo", "team", [7, 10, 10], "Seven-a-side team sport played in a pool.", { metrics: [...MATCH(), num("goals", "Goals", undefined, 20, "higher")], profile: { safety: ["Strong swimming ability required."] } }),
  s("lacrosse", "Lacrosse", "team", [5, 8, 8], "Team sport using sticks with a net to carry, pass and shoot a ball.", { metrics: [...MATCH(), num("goals", "Goals", undefined, 20, "higher")] }),
  s("netball", "Netball", "team", [5, 6.5, 8], "Seven-a-side passing game; players can't run with the ball.", { metrics: [...MATCH(), num("goals", "Goals", undefined, 100, "higher")] }),
  s("ultimate", "Ultimate frisbee", "team", [4, 6, 8], "Non-contact disc sport, self-officiated under the Spirit of the Game.", { aliases: ["ultimate frisbee"], metrics: MATCH() }),
  s("gaelic-football", "Gaelic football", "team", [6, 8, 10], "Irish field sport combining kicking and hand-passing.", { metrics: MATCH(), profile: CONTACT_PROFILE() }),
  s("hurling", "Hurling", "team", [6, 8, 10], "Irish stick-and-ball field sport played with a hurley and sliotar.", { metrics: MATCH(), profile: { safety: ["Helmets with face guards are mandatory in competition."] } }),
  s("kabaddi", "Kabaddi", "team", [5, 7, 9], "South Asian contact team sport of raids and tags.", { metrics: MATCH(), profile: CONTACT_PROFILE() }),
  s("sepak-takraw", "Sepak takraw", "team", [4, 6, 8], "Southeast Asian net sport played with the feet, knees, chest and head.", { metrics: MATCH() }),
  s("korfball", "Korfball", "team", [5, 6.5, 8], "Mixed-gender team sport scoring through a high basket.", { metrics: MATCH() }),

  // ── C. Racket, paddle & bat sports ─────────────────────────────────
  s("table-tennis", "Table tennis", "racket", [4, 4, 8], "Fast racket sport on a table; spin and placement are central.", { aliases: ["ping pong"], metrics: [...MATCH(["drills", "match"]), num("setsPlayed", "Games played", undefined, 20)] }),
  s("badminton", "Badminton", "racket", [5.5, 7, 7], "Racket sport hitting a shuttlecock over a high net.", { metrics: [...MATCH(["drills", "singles", "doubles"]), num("setsPlayed", "Games played", undefined, 10)] }),
  s("squash", "Squash", "racket", [7.3, 7.3, 12], "Indoor racket sport played against the walls of an enclosed court.", { metrics: MATCH(["drills", "match"]), profile: { safety: ["Wear protective eyewear — required in many clubs for juniors and doubles."] } }),
  s("padel", "Padel", "racket", [5, 6, 8], "Doubles racket sport on an enclosed court; walls are part of play.", { metrics: MATCH(["drills", "match"]) }),
  s("pickleball", "Pickleball", "racket", [4, 4.5, 6], "Paddle sport on a small court with a perforated plastic ball.", { metrics: MATCH(["drills", "singles", "doubles"]) }),
  s("racquetball", "Racquetball", "racket", [7, 7, 10], "Indoor racket sport with a hollow rubber ball.", { metrics: MATCH(["drills", "match"]), profile: { safety: ["Eye protection strongly recommended."] } }),
  s("beach-tennis", "Beach tennis", "racket", [5, 6, 7], "Paddle and ball game on sand, usually doubles; the ball must not bounce.", { metrics: MATCH() }),

  // ── D. Athletics & endurance (running disciplines are linked to Running) ─
  s("sprinting", "Sprinting", "athletics", [8, 10, 12], "Track events from 60 m to 400 m.", { parent: "running", distance: "km", metrics: [pbTime("time_100m", "100 m time", 9, 30), pbTime("time_200m", "200 m time", 19, 60), pbTime("time_400m", "400 m time", 43, 120)] }),
  s("middle-distance", "Middle-distance running", "athletics", [8, 10, 12], "800 m to 3000 m track events.", { parent: "running", distance: "km", metrics: [pbTime("time_800m", "800 m time", 100, 400), pbTime("time_1500m", "1500 m time", 200, 800), pbTime("time_mile", "Mile time", 220, 900)] }),
  s("long-distance", "Long-distance running", "athletics", [8, 9.8, 11.8], "5000 m, 10,000 m and road races.", { parent: "running", distance: "km", metrics: [pbTime("time_5k", "5 km time", 720, 5400), pbTime("time_10k", "10 km time", 1560, 10800)] }),
  s("marathon", "Marathon", "athletics", [8, 9.8, 11.8], "42.195 km road race.", { parent: "running", distance: "km", metrics: [pbTime("time_marathon", "Marathon time", 7200, 32400)] }),
  s("trail-running", "Trail running", "athletics", [8, 9, 12], "Running on natural trails and mountain paths.", { parent: "running", distance: "km", metrics: [ELEV, sel("terrain", "Terrain", ["forest", "mountain", "mixed", "desert"])], profile: { safety: ["Carry water, a phone and a layer; tell someone your route.", "Check weather and daylight."] } }),
  s("hurdles", "Hurdles", "athletics", [8, 10, 12], "Sprint races over hurdles: 100/110 m and 400 m.", { metrics: [pbTime("time_hurdles", "Hurdles time", 12, 90)], profile: { supervisionNote: "Learn hurdle technique with a qualified athletics coach." } }),
  s("relays", "Relays", "athletics", [8, 10, 12], "Team running events with baton exchanges.", { metrics: [sel("sessionType", "Session type", ["exchanges", "race"])] }),
  s("long-jump", "Long jump", "athletics", [4, 6, 8], "Horizontal jump from a take-off board into a sand pit.", { metrics: [pbNum("jump_distance", "Best jump", "m", 10)], profile: { supervisionNote: "Coaching recommended for approach and take-off." } }),
  s("triple-jump", "Triple jump", "athletics", [4, 6, 8], "Hop, step and jump sequence into a sand pit.", { metrics: [pbNum("jump_distance", "Best jump", "m", 20)], profile: { supervisionNote: "High-impact event — build up under a qualified coach." } }),
  s("high-jump", "High jump", "athletics", [4, 6, 8], "Vertical jump over a bar, typically using the Fosbury flop.", { metrics: [pbNum("jump_height", "Best clearance", "m", 3)], profile: { supervisionNote: "Requires a proper landing mat and coaching." } }),
  s("pole-vault", "Pole vault", "athletics", [4, 6, 8], "Vaulting over a high bar using a flexible pole.", { availability: "external", metrics: [pbNum("vault_height", "Best clearance", "m", 7)], profile: EXTERNAL("Pole vault must be learned with a qualified coach, correct poles and certified landing equipment.") }),
  s("shot-put", "Shot put", "athletics", [4, 5, 6], "Throwing a heavy metal ball for distance from a circle.", { metrics: [pbNum("throw_distance", "Best throw", "m", 25)], profile: { safety: ["Never throw or retrieve while others are in the sector."] } }),
  s("discus", "Discus", "athletics", [4, 5, 6], "Rotational throw of a disc from a caged circle.", { metrics: [pbNum("throw_distance", "Best throw", "m", 80)], profile: { safety: ["Throw only from a safety cage with a clear sector."] } }),
  s("javelin", "Javelin", "athletics", [4, 5, 6], "Throwing a spear-like javelin for distance after a run-up.", { metrics: [pbNum("throw_distance", "Best throw", "m", 100)], profile: { safety: ["Strict sector discipline — javelins can cause serious injury."], supervisionNote: "Learn with a qualified coach." } }),
  s("hammer-throw", "Hammer throw", "athletics", [4, 5, 6], "Rotational throw of a weighted ball on a wire from a caged circle.", { availability: "external", metrics: [pbNum("throw_distance", "Best throw", "m", 90)], profile: EXTERNAL("Hammer throwing requires a certified cage and qualified coaching.") }),
  s("race-walking", "Race walking", "athletics", [5, 6.5, 8], "Walking race with strict contact and straight-knee rules.", { distance: "km", metrics: [pbTime("time_5k_walk", "5 km walk time", 1080, 4800)] }),
  s("walking", "Walking", "athletics", [2.8, 3.5, 5], "Everyday walking and brisk fitness walking.", { distance: "km", metrics: [num("steps", "Steps", undefined, 100000)], profile: { beginner: ["Walking counts — it is one of the best habits you can build.", "A brisk pace is where talking is possible but singing is hard."], templates: [{ title: "Brisk walk", durationMin: 30, intensity: "moderate", structure: ["5 min easy", "20 min brisk", "5 min easy"] }] } }),
  s("cycling", "Road cycling", "athletics", [4, 6.8, 10], "Cycling on roads for fitness, touring or racing.", { aliases: ["bike", "biking", "road cycling"], distance: "km", metrics: [sel("environment", "Environment", ["outdoor", "indoor"]), ELEV], profile: { beginner: ["Set saddle height so the knee is slightly bent at the bottom of the pedal stroke.", "Always wear a helmet outdoors."], safety: ["Wear a helmet, use lights, follow traffic rules."], templates: [{ title: "Endurance ride", durationMin: 45, intensity: "moderate", structure: ["10 min easy", "30 min steady", "5 min easy"] }] } }),
  s("track-cycling", "Track cycling", "athletics", [6.8, 10, 14], "Racing on a banked velodrome on fixed-gear bikes.", { parent: "cycling", distance: "km", profile: { supervisionNote: "Velodrome accreditation sessions are usually required before riding." } }),
  s("mountain-biking", "Mountain biking", "athletics", [6.8, 8.5, 14], "Off-road cycling on trails.", { parent: "cycling", distance: "km", metrics: [ELEV], profile: { safety: ["Helmet always; gloves and pads recommended.", "Ride trails within your skill level."] } }),
  s("bmx", "BMX racing", "athletics", [6, 8.5, 10], "Short, intense races on dirt tracks with jumps.", { parent: "cycling", profile: { safety: ["Full-face helmet, gloves and protective gear required."] } }),
  s("triathlon", "Triathlon", "athletics", [6, 8, 10], "Swim, bike and run in sequence.", { distance: "km", metrics: [sel("discipline", "Discipline", ["swim", "bike", "run", "brick", "race"])], profile: { safety: ["Open-water swim safety applies — never train open water alone."] } }),
  s("duathlon", "Duathlon", "athletics", [6, 8, 10], "Run, bike, run multisport event.", { distance: "km", metrics: [sel("discipline", "Discipline", ["bike", "run", "brick", "race"])] }),
  s("rowing", "Rowing", "athletics", [4.8, 7, 12], "Propelling a boat (or ergometer) with oars.", { distance: "km", metrics: [sel("environment", "Environment", ["water", "ergometer"]), pbTime("erg_2k", "2000 m ergometer", 330, 900)], profile: { safety: ["On-water rowing requires swimming ability and club safety rules."] } }),
  s("canoeing", "Canoeing", "athletics", [3.5, 5.8, 12], "Paddling a canoe with a single-blade paddle.", { distance: "km", profile: { safety: ["Wear a buoyancy aid; know capsize procedures."] } }),
  s("kayaking", "Kayaking", "athletics", [3.5, 5, 12], "Paddling a kayak with a double-bladed paddle.", { distance: "km", profile: { safety: ["Wear a buoyancy aid; learn capsize and rescue skills with a qualified instructor."] } }),

  // ── E. Strength, gymnastics & fitness ──────────────────────────────
  s("street-workout", "Street workout", "strength", [3.8, 5, 8], "Outdoor calisthenics culture with freestyle bar skills.", { parent: "calisthenics", workoutBased: true }),
  s("strength", "Strength training", "strength", [3.5, 5, 6], "Resistance training with free weights, machines or bodyweight.", { workoutBased: true, metrics: [sel("sessionType", "Session type", ["full body", "upper", "lower", "push", "pull"])], profile: { beginner: ["Learn the movement with light loads first.", "Leave 1–3 reps in reserve on most sets.", "Add load in small steps once all target reps feel solid."] } }),
  s("gym", "Bodybuilding / gym training", "strength", [3.5, 5, 6], "Hypertrophy-focused resistance training.", { aliases: ["bodybuilding"], workoutBased: true, metrics: [sel("sessionType", "Session type", ["push", "pull", "legs", "upper", "lower", "full body"])], profile: { beginner: ["About 10 hard sets per muscle per week is a solid starting point.", "Prioritise compound lifts, then add isolation work.", "Sleep and protein matter as much as the program."], safety: ["Avoid extreme bulking or cutting and performance-enhancing drugs."] } }),
  s("powerlifting", "Powerlifting", "strength", [3.5, 5, 6], "Strength sport of the squat, bench press and deadlift.", { workoutBased: true, metrics: [pbNum("squat_1rm", "Squat best", "kg", 600), pbNum("bench_1rm", "Bench press best", "kg", 400), pbNum("deadlift_1rm", "Deadlift best", "kg", 600)], profile: { safety: ["Use safety bars and spotters for squats and bench.", "Maximal attempts only with good technique and coaching."] } }),
  s("weightlifting", "Olympic weightlifting", "strength", [3.5, 5, 6], "Olympic sport of the snatch and clean & jerk.", { workoutBased: true, metrics: [pbNum("snatch_best", "Snatch best", "kg", 250), pbNum("cj_best", "Clean & jerk best", "kg", 300)], profile: { supervisionNote: "Technical lifts are best learned with a qualified weightlifting coach." } }),
  s("strongman", "Strongman", "strength", [5, 6, 8], "Strength events such as carries, stones, logs and pulls.", { workoutBased: true, profile: { supervisionNote: "Learn implements with experienced coaches; build up gradually." } }),
  s("crossfit", "CrossFit-style training", "strength", [5, 8, 10], "Mixed-modal high-intensity functional training.", { aliases: ["functional fitness", "wod"], workoutBased: true, metrics: [sel("sessionType", "Session type", ["strength", "metcon", "skills"])] }),
  s("functional-fitness", "Functional fitness", "strength", [4, 6, 8], "Training movement patterns for everyday and sport performance.", { workoutBased: true }),
  s("hiit", "HIIT & conditioning", "strength", [6, 8, 10], "High-intensity intervals alternating hard work and recovery.", { metrics: [num("rounds", "Rounds", undefined, 100), num("workSec", "Work interval", "s", 600), num("restSec", "Rest interval", "s", 600)], profile: { beginner: ["Start with low-impact moves and longer rests.", "One or two HIIT sessions per week is enough for most people."], templates: [{ title: "Low-impact intervals", durationMin: 20, intensity: "moderate", structure: ["Step jacks", "Step-back burpees", "Mountain climbers", "40 s work / 20 s rest × 3 rounds"] }] } }),
  s("kettlebell-sport", "Kettlebell sport", "strength", [6, 8, 10], "Timed kettlebell lifts (jerk, snatch, long cycle) for maximum reps.", { profile: { supervisionNote: "Learn lifting technique from a qualified kettlebell coach." } }),
  s("artistic-gymnastics", "Artistic gymnastics", "strength", [3.8, 5, 8], "Olympic apparatus gymnastics: floor, vault, bars, beam, rings, pommel horse.", { availability: "external", profile: EXTERNAL("Apparatus skills require a gymnastics club with qualified coaches, spotting and safety matting.", { exerciseTags: ["calisthenics"] }) }),
  s("rhythmic-gymnastics", "Rhythmic gymnastics", "strength", [3.8, 5, 6], "Gymnastics with apparatus such as ribbon, hoop, ball, clubs and rope.", { availability: "external", profile: EXTERNAL("Train with a qualified rhythmic gymnastics coach.") }),
  s("trampoline", "Trampoline", "strength", [3.5, 4.5, 6], "Acrobatic sport performed on a trampoline.", { availability: "external", profile: EXTERNAL("Somersaults must be learned with a qualified coach and safety equipment. Recreational bouncing: one person at a time, with nets.") }),
  s("parkour", "Parkour", "strength", [5, 7, 9], "Moving efficiently through the environment by running, jumping and climbing.", { profile: { safety: ["Start at ground level and master landings and rolls.", "Check surfaces and never train on rooftops."] } }),
  s("yoga", "Yoga", "strength", [2.3, 3, 4], "Mind–body practice of postures, breathing and relaxation.", { metrics: [sel("style", "Style", ["hatha", "vinyasa", "yin", "power", "restorative"])], profile: { beginner: ["Use blocks and straps freely.", "Never force a pose into pain."], templates: [{ title: "Gentle flow", durationMin: 20, intensity: "light", structure: ["Breathing", "Cat-cow", "Sun salutations", "Child's pose"] }], exerciseTags: ["yoga"] } }),
  s("pilates", "Pilates", "strength", [2.8, 3, 4], "Controlled exercise focusing on core strength, posture and breathing.", { metrics: [sel("style", "Style", ["mat", "reformer"])], profile: { beginner: ["Focus on controlled breathing and deep core engagement."], exerciseTags: ["pilates"] } }),
  s("mobility", "Mobility & flexibility", "strength", [2.3, 2.5, 3], "Joint range-of-motion and flexibility training.", { metrics: [{ key: "focusArea", label: "Focus area", kind: "text", scope: "session", direction: "none" }], profile: { beginner: ["Short daily sessions beat occasional long ones."], exerciseTags: ["mobility"] } }),
  s("aerobics", "Aerobics", "strength", [5, 7.3, 8], "Rhythmic group exercise to music.", {}),
  s("dance-fitness", "Dance fitness", "strength", [4.5, 6, 7.8], "Choreographed fitness classes set to music.", { aliases: ["zumba"] }),
  s("athletic", "General athletic training", "strength", [4, 6, 8], "Mixed strength, speed, mobility and conditioning.", { metrics: [{ key: "focusArea", label: "Focus", kind: "text", scope: "session", direction: "none" }] }),

  // ── F. Water sports (swimming disciplines linked to Swimming) ──────
  s("open-water-swimming", "Open-water swimming", "water", [6, 8, 10], "Swimming in lakes, rivers and the sea.", { parent: "swimming", distance: "m", profile: { safety: ["Never swim open water alone.", "Use a bright cap and tow float; check conditions and water temperature."] } }),
  s("diving", "Diving", "water", [3, 3, 3], "Springboard and platform diving.", { availability: "external", profile: EXTERNAL("Diving must be learned with a qualified coach in a pool with certified depth and boards.") }),
  s("artistic-swimming", "Artistic swimming", "water", [6, 8, 10], "Choreographed swimming routines to music (formerly synchronised swimming).", { availability: "external", profile: EXTERNAL("Train in a club with qualified coaches.") }),
  s("surfing", "Surfing", "water", [3, 5, 6], "Riding waves on a surfboard.", { profile: { safety: ["Take lessons with a qualified school first.", "Learn rip currents and surf etiquette; never surf alone."] } }),
  s("windsurfing", "Windsurfing", "water", [5, 7, 11], "Sailing a board with an attached rig.", { availability: "external", profile: EXTERNAL("Learn at an accredited windsurf school; wear a buoyancy aid.") }),
  s("kitesurfing", "Kitesurfing", "water", [5, 7, 11], "Riding a board pulled by a power kite.", { availability: "external", profile: EXTERNAL("Kites can cause serious injuries — only learn with a certified instructor.") }),
  s("sailing", "Sailing", "water", [3, 3, 5], "Navigating a boat using sails.", { availability: "external", profile: EXTERNAL("Complete a recognised sailing course before sailing independently.") }),
  s("sup", "Stand-up paddleboarding", "water", [3, 6, 8], "Paddling while standing on a board.", { aliases: ["paddleboarding", "sup"], distance: "km", profile: { safety: ["Wear a leash and buoyancy aid; avoid offshore winds."] } }),
  s("water-skiing", "Water skiing", "water", [6, 6, 6], "Skiing on water towed by a boat.", { availability: "external", profile: EXTERNAL("Requires a trained boat driver and spotter, and lessons.") }),
  s("wakeboarding", "Wakeboarding", "water", [6, 6, 6], "Riding a board towed by a boat or cable.", { availability: "external", profile: EXTERNAL("Learn at a cable park or with an experienced boat crew; wear a helmet and buoyancy aid.") }),
  s("snorkeling", "Snorkeling", "water", [5, 5, 5], "Swimming at the surface with mask and snorkel.", { profile: { safety: ["Swim with a buddy; check currents; never snorkel alone."] } }),
  s("scuba-diving", "Scuba diving", "water", [7, 7, 7], "Underwater diving with breathing apparatus.", { availability: "external", profile: EXTERNAL("Scuba diving requires certification from a recognised training agency and medical fitness.") }),
  s("rafting", "Rafting", "water", [5, 5, 5], "Navigating rivers in an inflatable raft.", { availability: "external", profile: EXTERNAL("Raft only with licensed guides and proper safety equipment.") }),

  // ── G. Outdoor, mountain & adventure ───────────────────────────────
  s("hiking", "Hiking", "outdoor", [5.3, 6, 7.8], "Walking on trails and paths in nature.", { distance: "km", metrics: [ELEV, num("packKg", "Pack weight", "kg", 50)], profile: { beginner: ["Carry water, check weather and tell someone your route."], safety: ["Turn back if weather turns; carry navigation and a layer."], templates: [{ title: "Trail prep", durationMin: 35, intensity: "moderate", structure: ["Step-ups", "Reverse lunges", "Calf raises", "Single-leg balance"] }], exerciseTags: ["hiking"] } }),
  s("trekking", "Trekking", "outdoor", [6, 7, 8], "Multi-day walking journeys.", { parent: "hiking", distance: "km", metrics: [ELEV] }),
  s("mountaineering", "Mountaineering", "outdoor", [5, 7, 9], "Ascending mountains, often on snow, ice and rock.", { availability: "external", profile: EXTERNAL("Learn rope, crampon, avalanche and navigation skills with certified guides or a mountaineering club.") }),
  s("rock-climbing", "Rock climbing", "outdoor", [5.8, 7.5, 8], "Climbing natural rock with ropes and protection.", { availability: "external", profile: EXTERNAL("Rope systems and belaying must be taught by a qualified instructor.", { exerciseTags: ["climbing"] }) }),
  s("sport-climbing", "Sport climbing", "outdoor", [5.8, 7.5, 8], "Climbing bolted routes; Olympic format includes lead, bouldering and speed.", { availability: "external", profile: EXTERNAL("Complete a belay course at a climbing wall before lead or top-rope climbing.") }),
  s("bouldering", "Bouldering", "outdoor", [5.8, 7.5, 8], "Climbing short problems without ropes above crash pads.", { metrics: [sel("venue", "Venue", ["indoor", "outdoor"]), { key: "hardest_grade", label: "Hardest grade sent", kind: "text", scope: "session", direction: "none" }], profile: { safety: ["Learn to fall and land on pads; never land on someone.", "Warm up fingers gradually."] } }),
  s("orienteering", "Orienteering", "outdoor", [6, 9, 10], "Navigating between checkpoints with a map and compass.", { distance: "km" }),
  s("skateboarding", "Skateboarding", "outdoor", [5, 5, 6], "Riding and performing tricks on a skateboard.", { profile: { safety: ["Wear a helmet; wrist guards and pads while learning."] } }),
  s("inline-skating", "Inline skating", "outdoor", [5, 7.5, 9.8], "Skating on inline wheels for fitness or speed.", { distance: "km", profile: { safety: ["Helmet, wrist guards and knee pads recommended."] } }),
  s("roller-skating", "Roller skating", "outdoor", [5, 7, 9], "Skating on quad roller skates.", { profile: { safety: ["Helmet and protective pads recommended."] } }),
  s("bmx-freestyle", "BMX freestyle", "outdoor", [6, 8, 10], "Tricks on BMX bikes in parks and streets.", { parent: "bmx", profile: { safety: ["Helmet and pads; progress tricks gradually."] } }),
  s("skiing", "Skiing", "outdoor", [5.3, 7, 8], "Alpine (downhill) and cross-country skiing on snow.", { distance: "km", metrics: [sel("discipline", "Discipline", ["alpine", "cross-country", "touring"])], profile: { safety: ["Take lessons; wear a helmet.", "Off-piste and touring require avalanche training and equipment."] } }),
  s("snowboarding", "Snowboarding", "outdoor", [5.3, 5.3, 8], "Descending snow slopes on a single board.", { profile: { safety: ["Take lessons; wear a helmet and wrist guards."] } }),
  s("ice-skating", "Ice skating", "outdoor", [5.5, 7, 9], "Recreational and speed skating on ice.", { profile: { safety: ["Only skate on approved rinks or officially checked ice."] } }),
  s("figure-skating", "Figure skating", "outdoor", [5.5, 7, 9], "Artistic skating with jumps, spins and footwork.", { availability: "external", profile: EXTERNAL("Jumps and spins must be learned with a qualified skating coach.") }),
  s("equestrian", "Equestrian sports", "outdoor", [4, 5.5, 7.3], "Horse riding disciplines including dressage, show jumping and eventing.", { availability: "external", profile: EXTERNAL("Ride only with qualified instructors and an approved riding helmet.") }),
  s("archery", "Archery", "outdoor", [4.3, 4.3, 4.3], "Shooting arrows at targets with a bow.", { availability: "external", metrics: [{ key: "score", label: "Round score", kind: "number", scope: "performance", direction: "higher", min: 0, max: 1440 }], profile: EXTERNAL("Shoot only at supervised ranges after a beginner course.") }),
  s("golf", "Golf", "outdoor", [3.5, 4.8, 5.3], "Striking a ball into holes with as few strokes as possible.", { metrics: [sel("sessionType", "Session type", ["range", "short game", "9 holes", "18 holes"]), { key: "score", label: "Score (strokes)", kind: "number", scope: "performance", direction: "lower", min: 18, max: 200 }] }),
  s("disc-golf", "Disc golf", "outdoor", [3, 3.5, 4], "Throwing discs into baskets over a course.", { metrics: [{ key: "score", label: "Score (throws)", kind: "number", scope: "performance", direction: "lower", min: 9, max: 200 }] }),
  s("bowling", "Bowling", "outdoor", [3, 3.8, 4], "Rolling a ball to knock down pins.", { metrics: [{ key: "game_score", label: "Best game", kind: "number", scope: "performance", direction: "higher", min: 0, max: 300 }] }),

  // ── H. Dance, adaptive & other ─────────────────────────────────────
  s("dance", "Dance", "other", [4.5, 5.5, 7.8], "Styles from ballet and contemporary to hip hop and ballroom.", { metrics: [{ key: "style", label: "Style", kind: "text", scope: "session", direction: "none" }] }),
  s("cheerleading", "Cheerleading", "other", [4, 6, 8], "Team routines combining stunts, tumbling, jumps and dance.", { availability: "external", profile: EXTERNAL("Stunts and tumbling require qualified coaches and spotters.") }),
  s("wheelchair-basketball", "Wheelchair basketball", "other", [4, 6.5, 7.8], "Paralympic basketball played in sport wheelchairs.", { parent: "basketball", metrics: MATCH() }),
  s("wheelchair-racing", "Wheelchair racing", "other", [6, 8, 10], "Paralympic track and road racing in racing chairs.", { distance: "km" }),
  s("para-swimming", "Para swimming", "other", [5.8, 7, 9.8], "Paralympic swimming with sport classes for different impairments.", { parent: "swimming", distance: "m" }),
  s("boccia", "Boccia", "other", [2.5, 2.5, 3], "Paralympic precision ball sport.", {}),
  s("goalball", "Goalball", "other", [5, 6, 8], "Paralympic team sport for athletes with visual impairments, using a ball with bells.", { metrics: MATCH() }),
  s("sitting-volleyball", "Sitting volleyball", "other", [3, 4, 6], "Paralympic volleyball played seated on a smaller court.", { parent: "volleyball", metrics: MATCH() }),
  s("adaptive-fitness", "Adaptive fitness", "other", [2.5, 4, 6], "Strength and conditioning adapted to individual abilities.", { workoutBased: true, profile: { beginner: ["Work with a professional who understands your needs to adapt exercises.", "Every exercise in the library can be filtered by your limitations."] } }),
];
