// Curated, repeatable starting-point measures for each activity the app offers.
//
// These are assessment definitions, not claims that every sport logger already
// calculates every value automatically. A program can establish the measure
// manually today; session-template metrics are merged beside these in the UI.

export type ProgramSportMetricOption = {
  key: string;
  label: string;
  metricKind: "NUMBER" | "RATIO" | "DURATION" | "GRADE" | "TEXT";
  unit: string;
  direction: "HIGHER" | "LOWER" | "TARGET" | "INFORMATIONAL";
  description: string;
};

type MetricInput = Omit<ProgramSportMetricOption, "key"> & { key: string };

const metric = (
  key: string,
  label: string,
  metricKind: ProgramSportMetricOption["metricKind"],
  unit: string,
  direction: ProgramSportMetricOption["direction"],
  description: string
): MetricInput => ({ key, label, metricKind, unit, direction, description });

const SPORT_METRICS: Record<string, MetricInput[]> = {
  climbing: [
    metric("outdoor_boulder_send", "Outdoor boulder - send", "GRADE", "", "HIGHER", "Highest outdoor boulder completed from the proper start."),
    metric("outdoor_boulder_flash", "Outdoor boulder - flash", "GRADE", "", "HIGHER", "Highest outdoor boulder completed first try."),
    metric("indoor_boulder_send", "Indoor boulder - send", "GRADE", "", "HIGHER", "Highest gym boulder completed from the proper start."),
    metric("indoor_boulder_flash", "Indoor boulder - flash", "GRADE", "", "HIGHER", "Highest gym boulder completed first try."),
    metric("outdoor_rope_redpoint", "Outdoor rope - redpoint", "GRADE", "", "HIGHER", "Highest outdoor route completed cleanly after prior attempts."),
    metric("outdoor_rope_onsight", "Outdoor rope - onsight", "GRADE", "", "HIGHER", "Highest outdoor route completed first try without prior beta."),
    metric("indoor_rope_redpoint", "Indoor rope - clean send", "GRADE", "", "HIGHER", "Highest gym route completed without falls or takes."),
    metric("indoor_rope_onsight", "Indoor rope - onsight", "GRADE", "", "HIGHER", "Highest gym route completed first try."),
    metric("project_attempts", "Project — attempts to send", "NUMBER", "attempts", "LOWER", "Attempts needed on a project near the same difficulty."),
    metric("project_moves", "Project — moves completed", "RATIO", "", "HIGHER", "Moves completed over total moves on one named project."),
    metric("project_links", "Project — linked sections completed", "RATIO", "", "HIGHER", "Sections or links completed over the full problem or route."),
    metric("target_grade_send_rate", "Target grade — sends per attempt", "RATIO", "", "HIGHER", "Sends over serious attempts at one chosen grade."),
    metric("grade_mileage", "Target grade — unique sends", "NUMBER", "climbs", "HIGHER", "Unique climbs completed at the chosen grade during the checkpoint period."),
    metric("benchmark_circuit", "Benchmark circuit completion", "RATIO", "", "HIGHER", "Problems or routes completed from the same benchmark circuit."),
    metric("continuous_moves", "Continuous quality moves", "NUMBER", "moves", "HIGHER", "Controlled climbing moves before a fall, take, or form breakdown."),
    metric("route_laps", "Route laps without falling", "NUMBER", "laps", "HIGHER", "Clean laps on the same route with standardized rest."),
    metric("topout_rate", "Outdoor top-out completion", "RATIO", "", "HIGHER", "Outdoor boulder top-outs completed over top-outs attempted."),
  ],
  surfing: [
    metric("waves_caught", "Waves caught per session", "NUMBER", "waves", "HIGHER", "Count caught waves in sessions of similar length and conditions."),
    metric("takeoff_rate", "Successful takeoffs", "RATIO", "", "HIGHER", "Controlled takeoffs over committed attempts."),
    metric("longest_ride", "Longest controlled ride", "DURATION", "sec", "HIGHER", "Longest ride kept under control in comparable conditions."),
    metric("maneuver_make_rate", "Maneuvers landed", "RATIO", "", "HIGHER", "Cleanly completed maneuvers over attempts."),
    metric("comfort_level", "Wave comfort level", "GRADE", "", "HIGHER", "Repeatable wave-size or condition level you can surf confidently."),
  ],
  bodysurfing: [
    metric("waves_caught", "Waves caught per session", "NUMBER", "waves", "HIGHER", "Count caught waves in sessions of similar length and conditions."),
    metric("takeoff_rate", "Successful takeoffs", "RATIO", "", "HIGHER", "Clean entries over committed attempts."),
    metric("longest_ride", "Longest controlled ride", "DURATION", "sec", "HIGHER", "Longest maintained line in comparable conditions."),
    metric("line_make_rate", "Lines completed", "RATIO", "", "HIGHER", "Planned lines completed over attempts."),
    metric("comfort_level", "Condition comfort level", "GRADE", "", "HIGHER", "Wave-size or condition level handled confidently."),
  ],
  wakesurfing: [
    metric("successful_starts", "Successful starts", "RATIO", "", "HIGHER", "Starts established cleanly over attempts."),
    metric("longest_ride", "Longest ropeless ride", "DURATION", "sec", "HIGHER", "Longest controlled ride without the rope."),
    metric("trick_make_rate", "Tricks landed", "RATIO", "", "HIGHER", "Clean makes over attempts for one named trick."),
    metric("trick_level", "Highest repeatable trick", "GRADE", "", "HIGHER", "Hardest trick you can land repeatedly, not a one-off."),
    metric("recovery_rate", "Recoveries back into the pocket", "RATIO", "", "HIGHER", "Successful recoveries after drifting back over attempts."),
  ],
  snowboarding: [
    metric("terrain_level", "Comfortable terrain level", "GRADE", "", "HIGHER", "Hardest terrain you can ride in control for a full run."),
    metric("clean_runs", "Clean benchmark runs", "RATIO", "", "HIGHER", "Controlled runs over attempts on the same trail or terrain type."),
    metric("trick_make_rate", "Trick make rate", "RATIO", "", "HIGHER", "Clean landings over attempts for one named trick."),
    metric("trick_level", "Highest repeatable trick", "GRADE", "", "HIGHER", "Hardest trick you can land repeatedly."),
    metric("continuous_riding", "Continuous riding tolerance", "DURATION", "min", "HIGHER", "Time riding before technique or symptoms require a stop."),
  ],
  skiing: [
    metric("terrain_level", "Comfortable terrain level", "GRADE", "", "HIGHER", "Hardest terrain you can ski in control for a full run."),
    metric("clean_runs", "Clean benchmark runs", "RATIO", "", "HIGHER", "Controlled runs over attempts on the same trail or terrain type."),
    metric("turn_quality", "Controlled turns in sequence", "NUMBER", "turns", "HIGHER", "Consecutive technically controlled turns on comparable terrain."),
    metric("skill_make_rate", "Skill make rate", "RATIO", "", "HIGHER", "Clean executions over attempts for one named skill."),
    metric("continuous_skiing", "Continuous skiing tolerance", "DURATION", "min", "HIGHER", "Time skiing before technique or symptoms require a stop."),
  ],
  skateboarding: [
    metric("trick_make_rate", "Trick make rate", "RATIO", "", "HIGHER", "Clean makes over attempts for one named trick."),
    metric("trick_level", "Highest repeatable trick", "GRADE", "", "HIGHER", "Hardest trick you can land repeatedly."),
    metric("line_completion", "Line completion", "RATIO", "", "HIGHER", "Full lines completed over attempts."),
    metric("consecutive_reps", "Consecutive clean repetitions", "NUMBER", "reps", "HIGHER", "Clean repetitions before the first miss."),
    metric("manual_balance", "Manual or balance hold", "DURATION", "sec", "HIGHER", "Longest controlled hold using the same setup."),
  ],
  basketball: [
    metric("free_throw_rate", "Free throws made", "RATIO", "", "HIGHER", "Makes over attempts from the free-throw line."),
    metric("spot_shooting_rate", "Spot-shooting makes", "RATIO", "", "HIGHER", "Makes over attempts using the same spots and shot count."),
    metric("three_point_rate", "Three-pointers made", "RATIO", "", "HIGHER", "Makes over attempts using the same arc locations."),
    metric("finishing_rate", "Finishing drill makes", "RATIO", "", "HIGHER", "Makes over attempts in one repeatable finishing drill."),
    metric("ball_handling_time", "Ball-handling course time", "DURATION", "sec", "LOWER", "Time through the same dribbling course with errors penalized."),
    metric("game_win_rate", "Games won", "RATIO", "", "HIGHER", "Wins over games played across a comparable run of games."),
  ],
  spikeball: [
    metric("serve_in_rate", "Serves in", "RATIO", "", "HIGHER", "Legal serves in over total serve attempts."),
    metric("serve_receive_rate", "Serve receives returned", "RATIO", "", "HIGHER", "Serve receives returned to a playable second touch."),
    metric("attack_conversion", "Attacks converted", "RATIO", "", "HIGHER", "Points won over intentional attacking chances."),
    metric("rally_win_rate", "Rallies won", "RATIO", "", "HIGHER", "Rallies won over rallies played in comparable games."),
    metric("game_win_rate", "Games won", "RATIO", "", "HIGHER", "Wins over games played."),
    metric("longest_rally", "Longest controlled rally", "NUMBER", "touches", "HIGHER", "Longest rally counted by total controlled touches."),
  ],
  tennis: [
    metric("first_serve_rate", "First serves in", "RATIO", "", "HIGHER", "First serves in over attempts."),
    metric("second_serve_rate", "Second serves in", "RATIO", "", "HIGHER", "Second serves in over attempts."),
    metric("target_serve_rate", "Serves to target", "RATIO", "", "HIGHER", "Serves landing in a defined target over attempts."),
    metric("rally_length", "Controlled rally length", "NUMBER", "shots", "HIGHER", "Consecutive controlled shots with the same partner or feed."),
    metric("point_win_rate", "Points won", "RATIO", "", "HIGHER", "Points won over points played in a repeatable drill or match set."),
    metric("court_drill_time", "Court movement drill time", "DURATION", "sec", "LOWER", "Time through the same movement pattern with clean touches."),
  ],
  golf: [
    metric("nine_hole_score", "9-hole score", "NUMBER", "strokes", "LOWER", "Score over the same course, tees, or comparable rating."),
    metric("eighteen_hole_score", "18-hole score", "NUMBER", "strokes", "LOWER", "Score over the same course, tees, or comparable rating."),
    metric("score_to_par", "Score to par", "NUMBER", "to par", "LOWER", "Course-adjusted scoring relative to par."),
    metric("fairways_hit", "Fairways hit", "RATIO", "", "HIGHER", "Fairways hit over eligible tee shots."),
    metric("greens_in_regulation", "Greens in regulation", "RATIO", "", "HIGHER", "Greens reached in regulation over holes played."),
    metric("putts_per_hole", "Putts per hole", "NUMBER", "putts", "LOWER", "Total putts divided by holes played."),
    metric("carry_distance", "Club carry distance", "NUMBER", "yd", "HIGHER", "Typical carry for the same club, not the single longest ball."),
    metric("target_hit_rate", "Range target hit rate", "RATIO", "", "HIGHER", "Shots finishing in a defined target area over attempts."),
  ],
  running: [
    metric("benchmark_time", "Benchmark distance time", "DURATION", "min", "LOWER", "Time over the same distance and similar terrain."),
    metric("pace", "Sustainable pace", "DURATION", "min/mi", "LOWER", "Average pace over the same distance and effort."),
    metric("continuous_duration", "Continuous running duration", "DURATION", "min", "HIGHER", "Continuous time before stopping at a comparable effort."),
    metric("weekly_distance", "Weekly distance", "NUMBER", "mi", "HIGHER", "Completed distance over a normal seven-day week."),
  ],
  hiking: [
    metric("distance", "Benchmark hike distance", "NUMBER", "mi", "HIGHER", "Distance completed under similar terrain and pack conditions."),
    metric("elevation_gain", "Elevation gain", "NUMBER", "ft", "HIGHER", "Vertical gain completed in one comparable outing."),
    metric("route_time", "Benchmark route time", "DURATION", "min", "LOWER", "Time on the same route at a sustainable effort."),
    metric("pack_weight", "Comfortable pack weight", "NUMBER", "lb", "HIGHER", "Pack carried comfortably over a defined route."),
  ],
  cycling: [
    metric("benchmark_time", "Benchmark route time", "DURATION", "min", "LOWER", "Time over the same route in similar conditions."),
    metric("average_speed", "Average speed", "NUMBER", "mph", "HIGHER", "Average speed over the same route and conditions."),
    metric("continuous_duration", "Continuous ride duration", "DURATION", "min", "HIGHER", "Continuous riding time at a sustainable effort."),
    metric("weekly_distance", "Weekly distance", "NUMBER", "mi", "HIGHER", "Completed distance over a normal seven-day week."),
  ],
  swimming: [
    metric("benchmark_time", "Benchmark distance time", "DURATION", "sec", "LOWER", "Time over the same stroke and distance."),
    metric("continuous_distance", "Continuous swim distance", "NUMBER", "yd", "HIGHER", "Distance completed continuously with consistent form."),
    metric("stroke_count", "Stroke count", "NUMBER", "strokes", "LOWER", "Strokes needed for the same pool distance."),
    metric("repeat_pace", "Repeat interval pace", "DURATION", "sec", "LOWER", "Average time across the same repeat set and rest."),
  ],
  rowing: [
    metric("benchmark_time", "Benchmark distance time", "DURATION", "min", "LOWER", "Time over the same rowing distance."),
    metric("split", "Sustainable split", "DURATION", "sec/500m", "LOWER", "Average split over the same distance and effort."),
    metric("continuous_duration", "Continuous rowing duration", "DURATION", "min", "HIGHER", "Continuous rowing time at a sustainable effort."),
    metric("stroke_rate", "Sustainable stroke rate", "NUMBER", "spm", "TARGET", "Stroke rate held while maintaining the target split."),
  ],
};

const ALIASES: Record<string, string> = {
  "trail-running": "running",
  "road-running": "running",
  walking: "running",
  biking: "cycling",
  "road-cycling": "cycling",
  "mountain-biking": "cycling",
  "gravel-cycling": "cycling",
  "pool-swimming": "swimming",
  "open-water-swimming": "swimming",
  endurance: "running",
};

export function programSportMetricOptions(pursuitKey: string): ProgramSportMetricOption[] {
  const slug = pursuitKey.trim().toLowerCase();
  const source = SPORT_METRICS[slug] ?? SPORT_METRICS[ALIASES[slug]] ?? [];
  return source.map((option) => ({ ...option, key: `sport:${slug || "general"}:${option.key}` }));
}
