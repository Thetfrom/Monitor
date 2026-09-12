# wix/ — read this before trusting the files in here

**The two files in this folder describe a design that is not what runs in
production.** They were committed in `362a5f6` ("Wire up Velo bridge — auth_error
handling and Make.com data fetch") and, as far as anything here can tell, were
never deployed in that form.

Verified 17 Aug 2026. Two separate sessions lost hours to this — one went hunting
for a Velo file that isn't the one in use, the other for a Make scenario that
doesn't exist. If you are about to change how the dashboard gets its data, start
here rather than with `MyDashboard.js`.

## What these files say happens

`pages/MyDashboard.js` embeds the dashboard in an iframe (`#html1`) pointed at
`https://audits.tameyogroup.com/dashboard`, resolves the logged-in member, and
`postMessage`s `{type:'auth', subscriberId, plan, status, businessName}` into it.
The app is then expected to fetch its own data from Make.

`backend/subscriberLookup.jsw` supports that by mapping a member email to a
subscriber record through the `MONITOR_READ_WEBHOOK` secret.

## What actually happens

The live `/my-dashboard` page on tameyogroup.com renders a single **"Open My
Dashboard"** button. Clicking it opens the dashboard with the subscriber's whole
payload already base64'd into the URL fragment as `#d=…`. There is no iframe
handshake in that path.

`app.js` supports both routes — `readUrlData()` reads the `#d=` fragment, and
`fetchSubscriberData()` POSTs to `MAKE_READ_ENDPOINT` — but:

```js
const MAKE_READ_ENDPOINT = '';
```

It is an empty string, and `fetchSubscriberData()` bails out to the no-account
screen when it is unset. So the fetch route has never run.

## Two consequences worth knowing

**There is no read webhook in Make.** Team `1263995` has five webhook-triggered
scenarios and every one is an audit funnel — Wix Audit Purchase, Wix Order
Trigger, Full Footprint, Instagram Checkout, Speed Audit. A sixth webhook,
`2995947`, is attached to no scenario at all. Nothing serves subscriber data.

**Only someone holding a `#d=` URL can open the dashboard.** A member who signs
in and clicks the button gets whatever the live page builds; nothing in this
repo produces that payload, and no code here can serve a member without it.

## Where the live code is

The button's click handler — the code that queries the collections, chooses which
fields to include, and builds the `#d=` URL — lives in the Velo **Page Code** for
`/my-dashboard` in the Wix editor. It is not in this repository and cannot be
reached through the Wix REST API or MCP connector; those cover site data and app
extensions, not the Velo source of an existing site's pages.

That page code is the only place to change which fields reach the dashboard.
Anything to do with the payload's shape belongs there, not here.

## If you are adding fields to the payload

The current payload carries, per row of `ai_visibility_checks`:

```
subscriber_id, check_date, model,
kw1_mentioned, kw2_mentioned, kw3_mentioned,
score, answer_kw1, answer_kw2, answer_kw3
```

Confirmed by decoding a live `#d=` fragment. Notably absent is
`answerTextKw1..3`, the one-or-two-sentence description each model returns — the
Make writer stores it, and `aivis.js` already reads it via `ptxt()`, but it never
reaches the browser. Adding those three fields is a Page Code change, and worth
capping to recent rows: each is up to 400 characters, so three per row across
90 days would add roughly 278,000 characters to a URL fragment.

`pages/MyDashboard.payload.js` is the exception in this folder: it is a
deliberate reference implementation of that block, not a stale description of
one. It caps the history to 45 days and adds `answer_text_kw1..3` to rows from
the last 7 days, with the sizing reasoning in comments. Wix does not load it —
it is meant to be read alongside the live Page Code and pasted in after the two
open questions at the bottom of it are checked.

## The Make writer, and why it stopped

Verified 12 Sep 2026. Scenario 6905973 (AI Visibility Daily) had been off since
19 Aug — Make auto-disables after 3 consecutive failures — because its four Wix
insert modules build the request as a raw JSON string with model answer text
pasted straight in. Newlines were stripped; double quotes were not. The first
answer containing a `"` broke the body ("The provided JSON body content is not
valid JSON"). The Monthly Engine (6256592) had the same construct on its twelve
`recommendedAction*` fields, with no newline handling at all.

Both are patched. Each text field is now wrapped as:

```
replace(replace(replace(replace(replace(X; newline; " "); carriagereturn; " ");
  tab; " "); decodeURL("%5C"); "/"); decodeURL("%22"); "'")
```

Two things learned the hard way, for whoever edits these next:

- Make's `replace()` accepts regex literals, but a regex with hex escapes
  (`/\x22/g`) fails **scenario validation at run time** — the API accepts the
  blueprint, `isinvalid` stays false, and the first execution dies with
  "Scenario validation failed - N problem(s) found". `decodeURL("%22")` is the
  quote-safe way to write a `"` inside a Make expression.
- `validate_module_configuration` checks field types only, not expression
  syntax. The only real test is a run. A manual run of the Monthly Engine on a
  day that isn't anyone's `runDay` costs 2 operations and sends nothing.

## What to do with this folder

Either bring these files into line with the live implementation, or delete them.
Leaving them as an accurate description of an abandoned design is what cost the
time. This README is the stopgap, not the fix.
