---
name: ketchup-video
description: "Only use when named. Catches the user up like pstack:ketchup, with a short subtitled video of slides for what happened and the waiting decisions as text under it. Use for pstack:ketchup-video."
builtin-tools:
  - pstack_read_current_thread
---

# Ketchup video

Follow [`pstack:ketchup`](../ketchup/SKILL.md), but show what happened in a short subtitled video instead of its summary and visuals. Its window starts at the last message the invoking user wrote before `pstack:ketchup-video`, not before any earlier `pstack:ketchup`. Scheduled wake-ups, notifications, and child reports are not their messages. Writing and rendering the reply video is the one exception to its read-only rule. Work in a scratch directory outside the source tree; place the final reviewable video in `.amp/in/artifacts/`. Do not change product code, configure models, create schedules, or publish. The reply is ketchup's opening sentence, the embedded video, one line naming any work left that you can do yourself, and the action items. When the video shows a call's options, call each option by the name the video gives it. If the render fails, say so in one line and give only the calls.

## Slides

Use the screenshots, recordings, diffs, and data the work produced, not the chat's prose about them. Before you draw, write the one sentence the user should leave with and one line per slide. Drop each slide that does not change what the user knows. Use at most 10 slides, and fewer is better. Neither note goes in the reply.

Each slide makes one point. Build the slides on one picture and change it from slide to slide, rather than cut to an unrelated one. A color or shape means the same thing on every slide. Show the work in pictures, such as how a system works, a PR stack with each PR's state, a before and after of a fix, or options side by side. Point at what changed with arrows, highlights, and motion. A slide is never a bullet list, a status list, a table, or boxes with nothing connecting them.

Keep text to the minimum. Put each label on the thing it names, in plain words a person would say, not tags like "Tests: pass". Never caption what a picture shows, and never give a fact twice, across slides or in the text under them.

Show what came of each thing the user asked for, and whether it is done, still running, failed, or not checked. Never show something done that still waits on the user. Show any bug found and fixed on the way. If a visible change has no screenshot, say so on its slide and name what changed on screen. Draw only from facts you have. Never invent a number, and never draw a screen you did not capture.

## Subtitles

Give each slide one short subtitle line, about ten words, that says its point the way you would tell the user, from only what that slide shows. Say what the picture means rather than read out its labels. Put the subtitle in a strip below the slide, the same height on every slide and empty except for the subtitle, so it never covers the slide. Set it small, but readable when the video plays at chat size.

## Render

Use the available video workflow; if `video-hyperframes` is installed, load it before authoring. Rendering the catch-up does not authorize external publication or a paid service. Render one silent landscape video, such as an mp4, with motion between slides. Every frame is the slide itself, edge to edge, above its subtitle strip. Make the frames from the slides, never by recording a screen, and burn each subtitle into its slide's frames so it stays on screen for the slide's whole hold. The hold is the time a slide is fully on screen, not counting the motion into or out of it. Hold each slide long enough to read the words it adds, at least one second for each three words. A slide adds its subtitle and each word that was not on the slide before it, including a label it changes. The first slide adds all its words. Words inside a screenshot do not count.

Before you embed the video, check the rendered file. Look at one frame from each slide at chat size, and check that its subtitle is readable and covers nothing. Measure each hold by matching the file's frames to the slide, not with a still-frame detector, which counts the faint ends of a fade as still. Count the words each slide adds against its measured hold. Fix any slide you cannot read in that time, render again, and check again. Embed the final video with Markdown image syntax and its actual file URL.
