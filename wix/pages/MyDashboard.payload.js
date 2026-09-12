// Reference implementation — the `ai_visibility_checks` block of the LIVE
// /my-dashboard Page Code.
//
// This is NOT a file Wix loads. The live code lives in the Velo Page Code for
// /my-dashboard (or, with Git integration on, `src/pages/My Dashboard.ye8ne.js`
// in the Wix-managed repo). Read wix/README.md first — the other two files in
// this folder describe an architecture that never shipped.
//
// Purpose: two changes to what reaches the browser in the `#d=` fragment.
//
//   1. Cap the history to 45 days. Today it sends everything, and the fragment
//      grows without bound as checks accumulate.
//   2. Add `answerTextKw1..3` — the sentence each model actually returned — but
//      only on rows from the last 7 days, because those fields are large.
//
// Why 45 and 7, specifically:
//
//   * 45 days. Nothing in the dashboard reads further back than that. `app.js`
//     caps the AI history table at `slice(-40)` rows, and the three trend views
//     each work over "the last 7 check days". 45 days clears the deepest
//     consumer with room to spare, and at 4 model lanes per day that is ~180
//     rows — well inside what the fragment carries comfortably.
//   * 7 days for the answer text. Each `answerTextKw*` runs up to ~400
//     characters, so three of them roughly triple a row. Across 45 days that
//     would add ~160,000 characters to a URL. Across 7 days (~28 rows) it adds
//     ~34,000 — and 7 days is exactly the window the quotes section renders.
//
// Field naming, which is the easiest thing to get wrong here: the CMS columns
// are camelCase (`checkDate`, `answerKw1`, `answerTextKw1`) and the payload
// keys `aivis.js` reads are snake_case (`check_date`, `answer_kw1`). The map
// below is the only place that translation happens. `answer_text_kw*` is the
// snake_case name `ptxt()` in aivis.js already looks for — it has been reading
// for these fields all along and finding nothing.
//
// Surgical: this replaces only the query-and-map that produces `aiChecks`.
// Nothing else on the page changes.

import wixData from 'wix-data';

const HISTORY_DAYS = 45;   // rows older than this are not sent at all
const ANSWER_TEXT_DAYS = 7; // rows older than this are sent without answer text

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Build the `ai_visibility_checks` array for the dashboard payload.
 *
 * @param {string} subscriberId - e.g. 'TM-2026-0048'
 * @returns {Promise<Array<Object>>} rows in snake_case, oldest first
 */
export async function buildAiChecks(subscriberId) {
  const historyCutoff = daysAgo(HISTORY_DAYS);
  const textCutoff = daysAgo(ANSWER_TEXT_DAYS);

  // `.limit(1000)` because wix-data defaults to 50 and would silently truncate
  // the history to a fortnight. 45 days x 4 model lanes is ~180 rows, so 1000
  // is headroom, not an expectation.
  const res = await wixData.query('AIVisibilityChecks')
    .eq('subscriberId', subscriberId)
    .ge('checkDate', historyCutoff)
    .ascending('checkDate')
    .limit(1000)
    .find();

  return res.items.map((it) => {
    const row = {
      subscriber_id: it.subscriberId,
      check_date: it.checkDate,
      model: it.model,
      kw1_mentioned: it.kw1Mentioned,
      kw2_mentioned: it.kw2Mentioned,
      kw3_mentioned: it.kw3Mentioned,
      score: it.score,
      answer_kw1: it.answerKw1,
      answer_kw2: it.answerKw2,
      answer_kw3: it.answerKw3,
    };

    // Recent rows only — see the sizing note at the top of this file.
    const when = it.checkDate instanceof Date ? it.checkDate : new Date(it.checkDate);
    if (when >= textCutoff) {
      row.answer_text_kw1 = it.answerTextKw1;
      row.answer_text_kw2 = it.answerTextKw2;
      row.answer_text_kw3 = it.answerTextKw3;
    }

    return row;
  });
}

// Call site, for reference — the rest of the payload is unchanged:
//
//   const aiChecks = await buildAiChecks(subscriberId);
//   const payload = {
//     masterRecord,
//     ai_visibility_checks: aiChecks,
//     // ...the other collections, untouched
//   };
//   const d = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
//
// Two things to confirm against the live page before pasting any of this in,
// because this file was written without being able to read it:
//
//   * the collection id. 'AIVisibilityChecks' is the likely name; the live
//     query is the authority.
//   * the CMS column ids for the mentioned flags. They are camelCase, but
//     whether they are `kw1Mentioned` or `kw1_mentioned` in the CMS depends on
//     how the Make writer created the columns.
//
// Everything else — the cap, the windows, the snake_case output keys — is
// confirmed against aivis.js and a decoded live fragment.
