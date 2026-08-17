// Program detail lives at /programs/:id. The view itself is the Focus
// roadmap page — same row, surfaced word — so it is re-used rather than
// duplicated. /focus/:id stays valid for any link already out there.
//
// `dynamic` is redeclared instead of re-exported: Next parses route segment
// config statically and rejects a re-exported one.

import FocusDetailPage from "@/app/focus/[id]/page";

export const dynamic = "force-dynamic";

export default FocusDetailPage;
