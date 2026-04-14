import type { BodyZonePath } from "./types";

// ViewBox: "0 14 200 426"
// Body center x=100. Shoulders ~x45-155 at y≈75. Waist x≈60-140. Hips x≈62-138.
// Left arm outer: x≈33-64 | inner: x≈52-64 | y≈72-221
// Right arm outer: x≈136-167 | inner: x≈136-148 | y≈72-221
// Left leg: x≈54-100 | Right leg: x≈100-146 | y≈230-420

export const bodyZonePaths: Record<string, BodyZonePath> = {

  // ═══════════════════════════════════════════════════════════════════
  //  FRONT VIEW
  // ═══════════════════════════════════════════════════════════════════

  // Neck — sternocleidomastoid region
  "neck-front": {
    slug: "neck-front", label: "Neck (front)", view: "front",
    d: "M89 50 C92 47 108 47 111 50 C114 57 113 65 110 69 C105 72 95 72 90 69 C87 65 86 57 89 50 Z",
  },

  // Anterior deltoids — rounded caps over the front shoulders
  // Wide curve from acromion (y≈72) tapering toward mid-arm (y≈108)
  "left-shoulder-front": {
    slug: "left-shoulder-front", label: "Left Shoulder (front)", view: "front",
    d: "M57 76 C62 63 76 58 88 67 C85 78 82 90 80 103 C70 105 59 101 53 92 C49 85 51 80 57 76 Z",
  },
  "right-shoulder-front": {
    slug: "right-shoulder-front", label: "Right Shoulder (front)", view: "front",
    d: "M112 67 C124 58 138 63 143 76 C149 80 151 85 147 92 C141 101 130 105 120 103 C118 90 115 78 112 67 Z",
  },

  // Pectoralis major — fan shape, medial border runs the full sternum length.
  // Origin: clavicle/sternum x=100. Fan sweeps wide to pec-delt groove.
  // Inferior border curves to inframammary fold ~y=131.
  "left-chest": {
    slug: "left-chest", label: "Left Chest", view: "front",
    d: "M100 78 C97 70 86 65 74 69 C62 74 57 87 58 103 C59 118 68 128 79 132 C90 134 99 131 100 128 Z",
  },
  "right-chest": {
    slug: "right-chest", label: "Right Chest", view: "front",
    d: "M100 78 C103 70 114 65 126 69 C138 74 143 87 142 103 C141 118 132 128 121 132 C110 134 101 131 100 128 Z",
  },

  // Rectus abdominis — slightly convex 6-pack column.
  // Outer border only; tendinous inscriptions are the fascia groove lines.
  "abs": {
    slug: "abs", label: "Abdominals", view: "front",
    d: "M84 128 C88 124 112 124 116 128 C120 148 120 171 116 193 C110 196 90 196 84 193 C80 171 80 148 84 128 Z",
  },

  // External obliques — wrap around the side from rib cage to hip
  "obliques": {
    slug: "obliques", label: "Obliques", view: "front",
    d: "M61 118 C68 120 76 124 82 131 C82 152 83 172 86 193 C78 193 71 190 65 183 C59 162 57 138 61 118 Z M118 131 C124 124 132 120 139 118 C143 138 141 162 135 183 C129 190 122 193 114 193 C117 172 118 152 118 131 Z",
  },

  // Biceps brachii — peaked oval belly in the upper arm
  "left-bicep": {
    slug: "left-bicep", label: "Left Bicep", view: "front",
    d: "M53 100 C59 92 72 91 80 99 C82 117 79 138 73 154 C63 156 52 152 47 144 C44 125 45 110 53 100 Z",
  },
  "right-bicep": {
    slug: "right-bicep", label: "Right Bicep", view: "front",
    d: "M120 99 C128 91 141 92 147 100 C155 110 156 125 153 144 C148 152 137 156 127 154 C121 138 118 117 120 99 Z",
  },

  // Forearms — tapered from elbow to wrist
  "left-forearm-front": {
    slug: "left-forearm-front", label: "Left Forearm", view: "front",
    d: "M48 154 C56 157 65 157 72 154 C73 175 70 197 65 216 C55 218 45 216 41 209 C39 185 42 168 48 154 Z",
  },
  "right-forearm-front": {
    slug: "right-forearm-front", label: "Right Forearm", view: "front",
    d: "M128 154 C135 157 144 157 152 154 C158 168 161 185 159 209 C155 216 145 218 135 216 C130 197 127 175 128 154 Z",
  },

  // Hip flexors / iliacus — at the inguinal crease
  "left-hip-flexor": {
    slug: "left-hip-flexor", label: "Left Hip Flexor", view: "front",
    d: "M74 193 C82 188 93 189 100 193 C99 207 97 220 94 232 C83 230 73 226 68 219 C68 207 70 199 74 193 Z",
  },
  "right-hip-flexor": {
    slug: "right-hip-flexor", label: "Right Hip Flexor", view: "front",
    d: "M100 193 C107 189 118 188 126 193 C130 199 132 207 132 219 C127 226 117 230 106 232 C103 220 101 207 100 193 Z",
  },

  // Adductors — inner thigh, elongated teardrop
  "left-adductor": {
    slug: "left-adductor", label: "Left Adductor", view: "front",
    d: "M87 231 C93 227 100 230 101 237 C101 261 100 287 98 309 C91 308 84 305 80 299 C81 270 83 247 87 231 Z",
  },
  "right-adductor": {
    slug: "right-adductor", label: "Right Adductor", view: "front",
    d: "M99 237 C100 230 107 227 113 231 C117 247 119 270 120 299 C116 305 109 308 102 309 C100 287 99 261 99 237 Z",
  },

  // Quadriceps — outer silhouette, vastus lateralis dominates the bulk
  "left-quad": {
    slug: "left-quad", label: "Left Quad", view: "front",
    d: "M66 228 C73 222 85 223 90 231 C89 257 87 282 84 312 C74 314 63 312 57 305 C55 273 57 248 66 228 Z",
  },
  "right-quad": {
    slug: "right-quad", label: "Right Quad", view: "front",
    d: "M110 231 C115 223 127 222 134 228 C143 248 145 273 143 305 C137 312 126 314 116 312 C113 282 111 257 110 231 Z",
  },

  // Knees — patella region
  "left-knee-front": {
    slug: "left-knee-front", label: "Left Knee", view: "front",
    d: "M58 314 C66 310 77 309 85 313 C87 323 86 333 83 339 C75 341 66 341 59 337 C56 331 56 321 58 314 Z",
  },
  "right-knee-front": {
    slug: "right-knee-front", label: "Right Knee", view: "front",
    d: "M115 313 C123 309 134 310 142 314 C144 321 144 331 141 337 C134 341 125 341 117 339 C114 333 113 323 115 313 Z",
  },

  // Tibialis anterior — runs along the lateral shin
  "left-shin": {
    slug: "left-shin", label: "Left Shin", view: "front",
    d: "M59 341 C66 337 77 337 84 341 C85 361 82 380 78 396 C70 398 62 396 57 390 C55 370 56 354 59 341 Z",
  },
  "right-shin": {
    slug: "right-shin", label: "Right Shin", view: "front",
    d: "M116 341 C123 337 134 337 141 341 C144 354 145 370 143 390 C138 396 130 398 122 396 C118 380 115 361 116 341 Z",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  BACK VIEW
  // ═══════════════════════════════════════════════════════════════════

  // Neck posterior
  "neck-back": {
    slug: "neck-back", label: "Neck (back)", view: "back",
    d: "M89 50 C92 47 108 47 111 50 C114 57 113 65 110 69 C105 72 95 72 90 69 C87 65 86 57 89 50 Z",
  },

  // Posterior deltoids — rounded caps over the back of the shoulders
  "left-shoulder-back": {
    slug: "left-shoulder-back", label: "Left Shoulder (back)", view: "back",
    d: "M56 76 C62 63 76 58 89 67 C86 79 83 91 81 103 C70 105 58 101 52 92 C49 85 51 80 56 76 Z",
  },
  "right-shoulder-back": {
    slug: "right-shoulder-back", label: "Right Shoulder (back)", view: "back",
    d: "M111 67 C124 58 138 63 144 76 C149 80 151 85 148 92 C142 101 130 105 119 103 C117 91 114 79 111 67 Z",
  },

  // Erector spinae — raised central column either side of the spine
  "upper-spine": {
    slug: "upper-spine", label: "Upper Spine", view: "back",
    d: "M93 70 C97 68 103 68 107 70 C109 90 109 110 107 128 C103 130 97 130 93 128 C91 110 91 90 93 70 Z",
  },

  // Trapezius — large triangular sheet from neck to mid-back, lateral to acromion
  // Upper fibers: neck → acromion. Mid fibers: T-spine → acromion.
  "left-upper-back": {
    slug: "left-upper-back", label: "Left Upper Back (Trap)", view: "back",
    d: "M71 74 C80 68 90 69 93 73 C93 93 91 112 89 128 C78 128 67 125 62 117 C60 101 62 86 71 74 Z",
  },
  "right-upper-back": {
    slug: "right-upper-back", label: "Right Upper Back (Trap)", view: "back",
    d: "M107 73 C110 69 120 68 129 74 C138 86 140 101 138 117 C133 125 122 128 111 128 C109 112 107 93 107 73 Z",
  },

  // Mid thoracic spine / rhomboids column
  "mid-spine": {
    slug: "mid-spine", label: "Mid Spine (thoracic)", view: "back",
    d: "M93 129 C97 126 103 126 107 129 C109 148 109 168 107 184 C103 186 97 186 93 184 C91 168 91 148 93 129 Z",
  },

  // Latissimus dorsi — triangular fan: wide origin at armpit, narrows to lumbar
  "left-lat": {
    slug: "left-lat", label: "Left Lat", view: "back",
    d: "M64 128 C73 121 86 122 93 128 C91 152 87 173 79 188 C69 183 62 169 60 153 C58 139 59 133 64 128 Z",
  },
  "right-lat": {
    slug: "right-lat", label: "Right Lat", view: "back",
    d: "M107 128 C114 122 127 121 136 128 C141 133 142 139 140 153 C138 169 131 183 121 188 C113 173 109 152 107 128 Z",
  },

  // Lumbar erectors / lower back
  "lower-back": {
    slug: "lower-back", label: "Lower Back (lumbar)", view: "back",
    d: "M78 186 C87 182 113 182 122 186 C125 200 123 215 118 227 C108 230 92 230 82 227 C77 215 75 200 78 186 Z",
  },

  // Triceps brachii — horseshoe belly on the back of the upper arm
  "left-tricep": {
    slug: "left-tricep", label: "Left Tricep", view: "back",
    d: "M52 99 C59 91 72 91 80 99 C81 119 78 139 71 155 C62 157 51 153 47 145 C44 125 45 108 52 99 Z",
  },
  "right-tricep": {
    slug: "right-tricep", label: "Right Tricep", view: "back",
    d: "M120 99 C128 91 141 91 148 99 C155 108 156 125 153 145 C149 153 138 157 129 155 C122 139 119 119 120 99 Z",
  },

  // Forearms posterior
  "left-forearm-back": {
    slug: "left-forearm-back", label: "Left Forearm (back)", view: "back",
    d: "M48 155 C56 158 64 158 71 155 C72 176 68 197 63 218 C53 219 44 217 40 211 C38 186 42 168 48 155 Z",
  },
  "right-forearm-back": {
    slug: "right-forearm-back", label: "Right Forearm (back)", view: "back",
    d: "M129 155 C136 158 144 158 152 155 C158 168 162 186 160 211 C156 217 147 219 137 218 C132 197 128 176 129 155 Z",
  },

  // Gluteus maximus — large rounded mass
  "left-glute": {
    slug: "left-glute", label: "Left Glute", view: "back",
    d: "M68 228 C78 221 93 222 100 230 C102 248 99 264 94 272 C83 275 70 271 63 262 C60 247 62 236 68 228 Z",
  },
  "right-glute": {
    slug: "right-glute", label: "Right Glute", view: "back",
    d: "M100 230 C107 222 122 221 132 228 C138 236 140 247 137 262 C130 271 117 275 106 272 C101 264 98 248 100 230 Z",
  },

  // Gluteus medius — lateral hip, visible above the glute max
  "left-lateral-hip": {
    slug: "left-lateral-hip", label: "Left Hip (Glute Med)", view: "back",
    d: "M60 208 C66 199 75 193 85 190 C89 202 90 216 89 230 C79 229 70 227 64 221 C61 216 59 212 60 208 Z",
  },
  "right-lateral-hip": {
    slug: "right-lateral-hip", label: "Right Hip (Glute Med)", view: "back",
    d: "M115 190 C125 193 134 199 140 208 C141 212 139 216 136 221 C130 227 121 229 111 230 C110 216 111 202 115 190 Z",
  },

  // Hamstrings — biceps femoris + semitendinosus/semimembranosus
  // Split into proximal (upper) and distal (lower) for more anatomical detail
  "left-hamstring-proximal": {
    slug: "left-hamstring-proximal", label: "Left Hamstring (upper)", view: "back",
    d: "M63 271 C73 265 88 265 98 271 C97 286 95 300 92 313 C81 315 69 314 62 308 C59 292 59 279 63 271 Z",
  },
  "right-hamstring-proximal": {
    slug: "right-hamstring-proximal", label: "Right Hamstring (upper)", view: "back",
    d: "M102 271 C112 265 127 265 137 271 C141 279 141 292 138 308 C131 314 119 315 108 313 C105 300 103 286 102 271 Z",
  },

  "left-hamstring-distal": {
    slug: "left-hamstring-distal", label: "Left Hamstring (lower)", view: "back",
    d: "M61 315 C71 311 85 311 93 314 C94 326 92 336 88 342 C79 344 69 344 63 340 C60 333 59 322 61 315 Z",
  },
  "right-hamstring-distal": {
    slug: "right-hamstring-distal", label: "Right Hamstring (lower)", view: "back",
    d: "M107 314 C115 311 129 311 139 315 C141 322 140 333 137 340 C131 344 121 344 112 342 C108 336 106 326 107 314 Z",
  },

  // Posterior knee / popliteal
  "left-knee-back": {
    slug: "left-knee-back", label: "Left Knee (back)", view: "back",
    d: "M62 343 C70 339 81 339 88 343 C90 352 88 361 85 366 C77 368 68 368 62 364 C59 358 59 350 62 343 Z",
  },
  "right-knee-back": {
    slug: "right-knee-back", label: "Right Knee (back)", view: "back",
    d: "M112 343 C119 339 130 339 138 343 C141 350 141 358 138 364 C132 368 123 368 115 366 C112 361 110 352 112 343 Z",
  },

  // Gastrocnemius — diamond twin-belly shape, medial and lateral heads
  "left-calf": {
    slug: "left-calf", label: "Left Calf", view: "back",
    d: "M62 366 C68 362 77 361 85 364 C88 376 86 390 82 398 C74 401 65 400 59 394 C56 384 57 373 62 366 Z",
  },
  "right-calf": {
    slug: "right-calf", label: "Right Calf", view: "back",
    d: "M115 364 C123 361 132 362 138 366 C143 373 144 384 141 394 C135 400 126 401 118 398 C114 390 112 376 115 364 Z",
  },

  // Achilles / distal calf / soleus
  "left-achilles": {
    slug: "left-achilles", label: "Left Achilles", view: "back",
    d: "M61 399 C66 395 74 395 79 399 C82 408 80 416 78 420 L60 420 C58 416 58 408 61 399 Z",
  },
  "right-achilles": {
    slug: "right-achilles", label: "Right Achilles", view: "back",
    d: "M121 399 C126 395 134 395 139 399 C142 408 142 416 140 420 L122 420 C120 416 118 408 121 399 Z",
  },
};

export const allBodyZonePaths = Object.values(bodyZonePaths);

export function getBodyZonePath(slug: string) {
  return bodyZonePaths[slug];
}
