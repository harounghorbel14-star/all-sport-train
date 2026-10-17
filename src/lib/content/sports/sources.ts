import type { SourceSeed } from "./types";

/**
 * Reference sources for rules and guidance. Summaries in the app are written
 * from these sources by content editors; they are not official reproductions.
 * URLs are only included where the publisher's site is well established —
 * otherwise users are directed to their national federation.
 */
export const SOURCES: SourceSeed[] = [
  { slug: "ifab-laws", title: "Laws of the Game", publisher: "International Football Association Board (IFAB)", url: "https://www.theifab.com", kind: "governing_body", notes: "Published annually; changes usually take effect from 1 July." },
  { slug: "fifa-11plus", title: "FIFA 11+ injury prevention programme", publisher: "FIFA Medical", url: "https://www.fifa.com", kind: "education", notes: "Warm-up programme shown in research to reduce injuries in amateur football." },
  { slug: "fiba-rules", title: "Official Basketball Rules", publisher: "FIBA", url: "https://www.fiba.basketball", kind: "governing_body", notes: "Used in international and most national competitions outside North America." },
  { slug: "nba-rules", title: "NBA Official Rules", publisher: "National Basketball Association", url: "https://www.nba.com", kind: "governing_body", notes: "Professional rules differ from FIBA in several areas." },
  { slug: "mlb-rules", title: "Official Baseball Rules", publisher: "Major League Baseball", url: "https://www.mlb.com", kind: "governing_body", notes: "Professional rules; youth and amateur leagues adapt them." },
  { slug: "wbsc", title: "Baseball and softball rules & regulations", publisher: "World Baseball Softball Confederation (WBSC)", url: "https://www.wbsc.org", kind: "governing_body" },
  { slug: "pitch-smart", title: "Pitch Smart", publisher: "MLB & USA Baseball", url: "https://www.mlb.com/pitch-smart", kind: "education", notes: "Age-based pitch count and rest guidelines for youth pitchers." },
  { slug: "world-aquatics", title: "Swimming rules", publisher: "World Aquatics", url: "https://www.worldaquatics.com", kind: "governing_body", notes: "Formerly FINA." },
  { slug: "world-athletics", title: "Book of Rules (Competition and Technical Rules)", publisher: "World Athletics", url: "https://worldathletics.org", kind: "governing_body" },
  { slug: "itf-rules", title: "ITF Rules of Tennis", publisher: "International Tennis Federation", url: "https://www.itftennis.com", kind: "governing_body", notes: "Includes appendices on alternative scoring methods." },
  { slug: "boxing-federation", title: "Olympic-style boxing technical & competition rules", publisher: "International / national boxing federations", kind: "governing_body", notes: "International governance of Olympic boxing has changed in recent years. Always use the current rulebook of your national federation." },
  { slug: "pro-boxing-commission", title: "Professional boxing rules", publisher: "State / national boxing commissions and sanctioning bodies", kind: "governing_body", notes: "Professional rules vary by jurisdiction and sanctioning body." },
  { slug: "calisthenics-federations", title: "Street workout & calisthenics competition formats", publisher: "Various federations and event organisers", kind: "other", notes: "There is no single global governing body; formats differ by organiser." },
  { slug: "compendium", title: "Compendium of Physical Activities", publisher: "Compendium research team", url: "https://pacompendium.com", kind: "research", notes: "Source of the approximate MET values used for energy estimates." },
  { slug: "who-activity", title: "WHO guidelines on physical activity and sedentary behaviour", publisher: "World Health Organization", url: "https://www.who.int", kind: "research" },
  { slug: "concussion-consensus", title: "Consensus statement on concussion in sport", publisher: "Concussion in Sport Group (published in the British Journal of Sports Medicine)", kind: "research", notes: "Basis for 'if in doubt, sit them out' guidance." },
  { slug: "apex-editorial", title: "APEX FIT coaching guidance", publisher: "APEX FIT content team", kind: "other", notes: "General coaching suggestions — not official rules. Reviewed for safety, not endorsed by any federation." },
];
