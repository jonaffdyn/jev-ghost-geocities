# JEV//GHOST — single box query

This build does exactly one semantic operation per scan:

    image frame
      ↓
    Jev 1.14
      ↓
    box question: "Where is the ghost?"
      ↓
    returned bounding box
      ↓
    draw it over the camera

There is no baseline, pixel diff, anomaly scoring, training, or secondary Jev question.

## Run

    JEV_API_KEY="your_key_here" node server.mjs

Then open:

    http://localhost:8787

The browser also displays the raw Jev box response so we can immediately see the exact response shape if the API differs from the parser assumptions.


## Confidence gate

The box is now treated as a proposal, not a detection.

Default threshold: `0.70`

- confidence >= threshold: draw the box
- confidence < threshold: show LOW CONFIDENCE
- no confidence returned: show NO CONFIDENCE and do not draw

The threshold can be adjusted in the UI from 0.50 to 0.95.


## Found-footage frontend

The accepted Jev box is now treated as a visual stage.

When a box clears the confidence threshold, the frontend can optionally **manifest** a fake translucent figure inside that exact box. This does not change the Jev request and does not add another model call. It is purely a presentation layer.

The "manifest detected entity" checkbox controls this effect.

The UI also adds:
- REC indicator
- tape timestamp
- scanlines / vignette
- occasional signal dropout
- recovered-tape metadata


## GeoCities skin

The frontend is intentionally styled like an abandoned late-90s paranormal homepage:

- 760px centered layout
- Times New Roman / Courier / MS Sans Serif
- blue underlined links
- "under construction" copy
- fake visitor counter
- faux WebRing
- marquee text
- ridge/outset borders
- 800x600 / Netscape-era framing
- camera presented like a questionable embedded scanner utility

The actual Jev behavior is unchanged: one image, one box query, one confidence-gated box.
