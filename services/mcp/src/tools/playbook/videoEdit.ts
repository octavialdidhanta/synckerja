/**
 * Platform playbook: how any AI (Claude, ChatGPT, the in-Office AI employee) edits a short video for a Synckerja
 * organization. One source for every tenant; served by playbook.get.
 *
 * What belongs here: order of work and judgment. What does NOT belong here:
 * - style values (colors, fonts, positions, durations): the organization's Gaya baku (catalog.style.get);
 * - organization facts (locations, menus, footage restrictions): the catalog and Product Knowledge;
 * - rules a tool enforces (frame rate, frozen frames, paths, naming, text overlap): the tool's errors/warnings.
 * Keep numbers out of this text so a change in code or in Gaya baku never makes the playbook wrong.
 * Every tool named here must exist (test/playbook.test.ts).
 */

export const VIDEO_EDIT_PLAYBOOK_VERSION = "2026-11-24.3";

export const VIDEO_EDIT_PLAYBOOK = `
# Synckerja video edit playbook

Use this for every short video (Reels, TikTok, ads) of a Synckerja organization: from a content brief, from a request in
chat, or to fix a render. Reply to the user in their language.

## 0. Who wins
1. Tool results: an error or warning from a Synckerja tool wins over everything below. Fix it; do not argue or work around it.
2. The organization's Gaya baku (catalog.style.get) wins over this playbook and over your own taste.
3. This playbook.
4. Your habits.
Never work around a refused tool, a blocked download or a sandbox limit. Say what is blocked and continue with what works.

## 1. Start (always, in this order)
1. session.whoami: make sure the active organization is the one the video is for.
2. The brief, when there is one: content.calendar.list or content.plans.list, then content.briefs.get (storyboard, voice over, notes, caption).
3. catalog.style.get: read all style boxes (vo, editing, teks, musik, talent) and follow them in every step.
4. Facts for any text on screen: catalog.product.get and product_knowledge.list. Never write a claim (price, process, ingredient, portion) that is not there.
5. Places: catalog.location.get. Read its "Must NOT" and each product's restrictions: they are the organization's own footage rules (for example locations that must not be mixed, or people who must not appear with a certain product).
6. Structure and motion ideas: catalog.references.list, then catalog.reference.get for the ones that fit this brief. Borrow their hook, beats and motion graphics so the video does not feel like a template. A reference never overrides Gaya baku.

## 2. Footage
- footage.search per storyboard shot, filtered by location and product. Prefer unused scenes and new inbox footage (file_key starting with INBOX/), then the bank.
- footage.bans.list once: avoid scenes with the same problem as a banned one. Read every scene note (for example "looks AI", "do not use") and respect it.
- Never mix locations in one video. Never show one product as another.
- Look at the candidate scenes with footage.scenes.view (one picture per scene, up to 24 per call) instead of making contact sheets yourself. Check talent expression against Gaya baku talent, and watch for unwanted objects, stickers, watermarks and people who must not appear.
- Only for frame-exact in and out points, or a scene that changes inside, look at the source file itself. If you cannot see any picture, say that the choice rests on the catalog tags.
- New inbox footage is registered and AI-tagged by the Synckerja Agent on its own. Fix a wrong tag with footage.scenes.upsert_batch.preview; do not register or tag the same file again.

## 3. Voice over
- content.briefs.voice.list shows existing clips; content.briefs.voice.generate makes a missing one; content.briefs.voice.get gives a short-lived download link. Save it in the production folder's vo folder.

## 4. Edit decisions (judgment)
- Follow Gaya baku editing for the order of shots, cut pace and the hook. The most tempting visual comes first.
- Cut on the voice over, or on the music beat when there is no voice over.
- On-screen text: short phrases built from the facts in step 1.4; avoid every phrase Gaya baku forbids.
- Music: follow Gaya baku musik. Name the song you picked and two or three alternatives.
- When Gaya baku asks for something the render cannot do yet, say so before rendering.

## 5. Render through the Synckerja Agent
1. render.jobs.draft with the shots (file_key, in, out), texts and music, plus references (the reference ids you borrowed from) or no_reference_reason. Styles come from Gaya baku.
2. Fix every error the draft returns. For each warning: fix it, or keep it only with a short reason the user can read.
3. render.jobs.create.preview, show the summary, and wait for a clear yes. Then render.jobs.create.
4. Follow it with render.jobs.list until it is done or failed. If it stays queued, the Agent on the laptop is offline: tell the user; do not render somewhere else unless they ask.
5. With a plan_id the Agent uploads the result to the plan as the next version. Do not upload it again (content.plans.media.upload.start is only for a video that did not come from the Agent).
6. The Agent also logs footage usage and moves used inbox footage into the bank. Do not do these by hand.

## 6. Check before you send
- Read the job result's qc. Any problem: fix the spec and render again.
- If you can see the file: look at a frame at every cut and in every text window. Text readable, nothing covering the food, no stray frame from another scene, talent per Gaya baku.

## 7. Deliver
- Send the video (or its link) with: second by second, which shot and which text; the music and alternatives; what Gaya baku asked for that is missing; any risky claim.
- Collect remaining catalog writes (wrong tags, new bans) into one list, preview them, and ask once.

## 8. Writes
Every Synckerja write is preview, then the user's clear yes, then save. One yes confirms the writes shown in that one preview.
`.trim();
