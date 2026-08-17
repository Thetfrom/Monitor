#!/usr/bin/env python3
"""Apply the dial-overlap and GLM row-selection fixes to aivis.js.

Idempotent: running it twice is a no-op. Run from the repo root:
    python3 apply-fixes.py
"""
import re
import sys

PATH = 'aivis.js'

NEW_DD = (
    "function DD(rows){if(!rows||!rows.length)return rows||[];"
    "var m={},order=[],o=[],i,r,k,cur;"
    "function scored(x){var c=0,n,f;for(n=1;n<=3;n++){f=x['kw'+n+'_mentioned'];"
    "f=(f===undefined||f===null)?'':String(f).toLowerCase();if(f==='yes'||f==='no')c++;}return c;}"
    "function texts(x){var c=0,n;for(n=1;n<=3;n++){if(String(x['answer_kw'+n]||'').trim())c++;}return c;}"
    "function better(a,b){var sa=scored(a),sb=scored(b);if(sa!==sb)return sa>sb;return texts(a)>texts(b);}"
    "var s=rows.slice().sort(function(a,b){"
    "var x=(a&&a._createdDate&&a._createdDate.$date)||(a&&a._createdDate)||'';"
    "var y=(b&&b._createdDate&&b._createdDate.$date)||(b&&b._createdDate)||'';"
    "return String(x)<String(y)?-1:(String(x)>String(y)?1:0);});"
    "for(i=0;i<s.length;i++){r=s[i];"
    "k=String(r.check_date||r.checkDate||'')+'|'+String(r.model||'').toLowerCase();"
    "cur=m[k];if(!cur){m[k]=r;order.push(k);continue;}"
    "if(better(r,cur))m[k]=r;}"
    "for(i=0;i<order.length;i++)o.push(m[order[i]]);return o;}"
)

NEW_SKIN = (
    "function skin(){return '<style>#aivis2 .thr{display:none}"
    "#aivis2 .lf>div:not(.dial){flex:1 1 0;min-width:0;align-self:center}</style>';}"
)

# (description, exact old string, new string)
EDITS = [
    ("dial SVG scales to its box instead of overflowing it",
     ".dial svg{transform:rotate(-90deg);display:block;}",
     ".dial svg{transform:rotate(-90deg);display:block;width:100%;height:100%;}"),

    ("a fully-named model reads green, not navy",
     "#aivis2 .t6a.full{stroke:var(--t6-n)}",
     "#aivis2 .t6a.full{stroke:var(--gr)}"),

    ("same in dark mode",
     "#aivis2.dk .t6a.full{stroke:#FFFFFF}",
     "#aivis2.dk .t6a.full{stroke:var(--gr)}"),

    ("a model that returned nothing reads 0/N, not a bare em dash",
     "var val=s.ans?(s.named+'/'+s.ans):'\\u2014';",
     "var val=s.ans?(s.named+'/'+s.ans):(s.tot?('0/'+s.tot):'\\u2014');"),

    ("and its caption says why",
     "var cap=!s.ans?('no answer returned'):(s.miss?(s.miss+' of '+s.tot+' keywords not returned')"
     ":('all '+s.tot+' measured'));",
     "var cap=!s.tot?('no keywords tracked'):(s.miss?(s.miss+' of '+s.tot+' keywords not returned')"
     ":('all '+s.tot+' measured'));"),

    # mount() hid the "AI Visibility" heading with an inline display:none, then
    # located that same heading by requiring offsetParent!==null. Once app.js
    # re-rendered and destroyed #aivis2, the heading mount needed was the one it
    # had already hidden, so every later mount failed and the overlay - and the
    # page title - stayed gone until a full reload.
    ("re-show anything a previous mount hid, so a remount can find it again",
     "if(document.getElementById('aivis2'))return true;",
     "if(document.getElementById('aivis2'))return true;"
     "[].slice.call(document.querySelectorAll('[data-aivis-hid]')).forEach(function(el){"
     "el.style.removeProperty('display');el.removeAttribute('data-aivis-hid');});"),

    ("mark the legacy card as ours",
     "oldCard.style.display='none';",
     "oldCard.style.display='none';oldCard.setAttribute('data-aivis-hid','1');"),

    ("mark the heading as ours",
     "h.style.display='none';",
     "h.style.display='none';h.setAttribute('data-aivis-hid','1');"),

    ("mark the legacy model panel as ours",
     "pn.style.setProperty('display','none','important');",
     "pn.style.setProperty('display','none','important');pn.setAttribute('data-aivis-hid','1');"),
]


def fn_span(src, name, nth):
    """Byte span of the nth `function NAME(...){...}`, skipping string literals."""
    hits = [m.start() for m in re.finditer(r'function\s+' + name + r'\s*\(', src)]
    if nth >= len(hits):
        return None
    start = hits[nth]
    i = src.index('{', start)
    depth = 0
    while i < len(src):
        c = src[i]
        if c in '"\'`':
            q = c
            i += 1
            while i < len(src):
                if src[i] == '\\':
                    i += 2
                    continue
                if src[i] == q:
                    break
                i += 1
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return (start, i + 1)
        i += 1
    raise SystemExit('unbalanced braces in ' + name)


def main():
    src = open(PATH, encoding='utf-8').read()
    applied, skipped = [], []

    for desc, old, new in EDITS:
        if new in src:
            skipped.append(desc)
            continue
        n = src.count(old)
        if n != 1:
            sys.exit('ERROR: expected exactly 1 match for %r, found %d' % (desc, n))
        src = src.replace(old, new, 1)
        applied.append(desc)

    # skin() has been rewritten several times, each attempt shrinking the dial
    # further (128 -> 104 -> 80) to stop the ring colliding with the headline.
    # The collision was never the dial's size: the SVG is hard-coded 128x128 and
    # did not scale, so a smaller box only made it overflow further. With the
    # SVG scaling (edit above), these overrides are what keep the dial and the
    # score numeral shrunken, so the whole function is replaced rather than
    # string-matched against whichever revision is present.
    if NEW_SKIN not in src:
        span = fn_span(src, 'skin', 0)
        if span is None:
            sys.exit('ERROR: skin() not found')
        src = src[:span[0]] + NEW_SKIN + src[span[1]:]
        applied.append('drop skin() overrides that shrank the dial and score type')
    else:
        skipped.append('skin() already restored')

    # aivis.js declared function DD twice in one scope; the later declaration
    # silently replaced the earlier one, so fixes to the first never ran.
    spans = [m.start() for m in re.finditer(r'function\s+DD\s*\(', src)]
    if len(spans) == 2:
        s2, e2 = fn_span(src, 'DD', 1)
        src = src[:s2] + src[e2:]
        s1, e1 = fn_span(src, 'DD', 0)
        src = src[:s1] + NEW_DD + src[e1:]
        applied.append('collapse the two DD declarations into one correct implementation')
    elif len(spans) == 1 and 'function better(a,b)' in src:
        skipped.append('DD already unified')
    else:
        sys.exit('ERROR: expected 1 or 2 DD declarations, found %d' % len(spans))

    open(PATH, 'w', encoding='utf-8').write(src)

    for d in applied:
        print('applied  ' + d)
    for d in skipped:
        print('skipped  ' + d + ' (already present)')
    print('\n%d applied, %d already present' % (len(applied), len(skipped)))

    # Only bump the cache-bust when aivis.js actually changed, so re-running
    # this script does not walk the version forward every time. Binary mode:
    # index.html carries trailing NUL bytes and text mode would mangle them.
    if applied:
        try:
            raw = open('index.html', 'rb').read()
        except IOError:
            return
        m = re.search(br'aivis\.js\?v=(\d+)', raw)
        if not m:
            print('note: no aivis.js?v= tag in index.html, cache-bust not bumped')
            return
        nxt = int(m.group(1)) + 1
        raw = raw[:m.start()] + ('aivis.js?v=%d' % nxt).encode() + raw[m.end():]
        open('index.html', 'wb').write(raw)
        print('bumped   index.html cache-bust to v%d' % nxt)


if __name__ == '__main__':
    main()
