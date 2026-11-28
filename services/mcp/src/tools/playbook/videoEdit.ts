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

export const VIDEO_EDIT_PLAYBOOK_VERSION = "2026-11-28.1";

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
If a tool or parameter this playbook names is missing from your tool list, your client still holds an older tool list (the server was updated): refresh the tool list, or ask the user to reconnect the Synckerja connector. Do not guess around it through validation errors.

## Three gates
The user decides three times; everything between the gates runs without asking.
- Gate 1, concept: two or three concepts that go in different directions, each as a short storyboard table, after reading step 1. The user picks or reshapes one. Nothing is saved before this.
- Gate 2, brief: a new video uses content.briefs.create.preview with the storyboard, voice over, caption and shotlist in one call; show the brief, the shot list and every tanpa_sumber claim together in one message. One clear yes, then content.briefs.create with only that confirm_token saves the content plan, the brief and the shot list together (or nothing). An existing content uses content.briefs.update.preview and catalog.shotlist.upsert.preview shown together, one yes for both. Then generate the voice over rows (content.briefs.voice.generate all_rows) without asking, and in the same message ask the user to approve the brief in Office now, while you prepare the draft and stills.
- Every shot of the shot list is written so Content Studio can turn it into a Flow prompt, in the same shape for every content: id, judul, timing, vo, area, menu, lokasi, fotos, action. fotos are the catalog photo files the shot uses (file_path from catalog.product.get and catalog.location.get): the product photo plus one location photo that fits that shot, not every photo of the area; [] only for a shot filmed with a phone without a reference photo. action is the Flow prompt in English: camera, framing, movement, what happens, room left for text. A shot that shows the talent opens with the THE TALENT block ("THE TALENT (same person in every shot): ..." built from Gaya baku talent), worded the same in every shot of the job; a hands-only shot uses the short form and says only the hands are visible. A shot list for an edit from existing footage still gets fotos and a full action (keep its footage link). The preview refuses shots without fotos or action (shotlist_check_failed) and warns about a person shot without the block (shot_talent_block_missing): fix both before gate 2.
- Between gate 2 and the draft, fresh footage first: call catalog.shotlist.get for the content and read footage_status. When every shot has footage, go on. When shots are still empty, stop and ask once, naming the empty shots: wait for new footage (the user generates or shoots it and drops it in the inbox folder; the Agent registers and tags it and links it to its shot), or use what the catalog already has (unused bank footage, least used first). When the user says the footage is in, read footage_status again. Never fill an empty shot from the bank without that answer. To speed up the link, the user may name a file <ContentID>_<ShotID> (for example 7f2c78aa_S05.mp4) or put a shoot in an inbox subfolder named after the ContentID.
- Gate 3, render: after a clean still preview (step 5), render.jobs.create.preview for the full video with the still sheet. One clear yes queues it; render, QC and upload to the plan then run on their own.
Approve and publish stay with the user in Office.
Never create a content plan for a new video before gate 1, and create it with content.briefs.create.preview then content.briefs.create (so the storyboard table and the shot list are saved together), not content.plans.create.
A revision of a rendered video whose brief and voice over stay the same skips gates 1 and 2, not section 1: run section 1 first (above all the status check in 1.2), then go to step 5.0 and on to gate 3.

## 1. Start (always, in this order)
1. session.whoami: make sure the active organization is the one the video is for.
2. The brief, when there is one: content.calendar.list or content.plans.list, then content.briefs.get (storyboard, voice over, notes, caption). Check approved and production_status right away. When the brief is not approved yet (approved false), the Agent renders the video, keeps it on the laptop (not_approved), and uploads that same file to the plan on its own once the brief is approved in Office (Agent 0.1.26+). Never render again only to upload: render.jobs.get shows the late_upload state in its result (claimed, done with version_no, or failed). Ask the user now, before any voice over or draft, to approve the brief in Office. When production is already approved, a render with plan_id is refused (production_locked): ask the user to reopen it in Office. render.jobs.draft, render.stills.create and render.jobs.create.preview repeat this check as upload_warning (also for a Post/Carousel plan or an organization Drive that is not connected): tell the user right away, never only at gate 3. Offer a render without plan_id only for a video without voice over: without plan_id the Agent does not fetch the voice over clips, so a video with voice over would come out silent.
3. catalog.style.get: read all style boxes (vo, editing, teks, musik, talent) and follow them in every step.
4. Facts for any text on screen: catalog.product.get and product_knowledge.list. Never write a claim (price, process, ingredient, portion) that is not there. content.briefs.create.preview and content.briefs.update.preview return claim_check before anything is saved: show every tanpa_sumber claim at gate 2 with the brief (it matches words, so also check any other factual statement yourself), and fix it there (rewrite, drop, or the user confirms the fact and adds it to Product Knowledge) — before any voice over is generated.
5. Places: catalog.location.get. Read its "Must NOT" and each product's restrictions: they are the organization's own footage rules (for example locations that must not be mixed, or people who must not appear with a certain product).
6. Structure and motion ideas: catalog.references.list, then catalog.reference.get for the ones that fit this brief. Borrow their hook, beats and motion graphics so the video does not feel like a template. A reference never overrides Gaya baku.
7. A new brief built on ad results (a follow-up ad, a winner to repeat): run playbook.get task ad_followup first; it reads the ads, the briefs behind them and the customer chats before any concept.
Only after these steps write concepts for gate 1.

## 2. Footage
- For a shot of the shot list, take the footage footage_status links to it first. Then footage.search per storyboard shot, filtered by location and product. Prefer unused scenes and new inbox footage (file_key starting with INBOX/), then the bank. Used means used by content that got Prod Approved (usage_count = how many); renders of content not approved yet do not count.
- One video uses each catalog scene once: a second shot from the same scene is refused (scene_repeated). Take another scene, older footage used less, or ask for a new shot.
- The shot list belongs to its content (external_id = ContentID) and is archived on its own when the content gets Prod Approved.
- footage.bans.list once: avoid scenes with the same problem as a banned one. Read every scene note (for example "looks AI", "do not use") and respect it.
- Never mix locations in one video. Never show one product as another.
- Look at the candidate scenes with footage.scenes.view (one picture per scene, up to 24 per call) instead of making contact sheets yourself. Check talent expression against Gaya baku talent, and watch for unwanted objects, stickers, watermarks and people who must not appear.
- For in and out points inside a scene (above all a long scene or a person), look at footage.scenes.strip: a frame every half second, each labelled with its second in the source clip. Avoid frames that break Gaya baku talent or a scene note. Only when a strip is missing and a frame-exact cut matters, look at the source file. If you cannot see any picture, say that the choice rests on the catalog tags.
- When no scene fits a shot (the feedback asks for something the catalog does not have, or the only scene breaks Gaya baku talent or a scene note), say so before gate 3: the second, the shot, why, and the choices (a new shot through the shot list, keep it for now, or change the shot idea). Never use it silently.
- New inbox footage is registered and AI-tagged by the Synckerja Agent on its own. Fix a wrong tag with footage.scenes.upsert_batch.preview; do not register or tag the same file again.

## 3. Voice over
- content.briefs.voice.list shows existing clips; content.briefs.voice.generate with all_rows true (only_missing true when some exist) makes every row's clip in one call, retrying a failed row once; rows like (suara asli) or - are skipped (no_vo_marker) and become silence in render.jobs.draft, so just list them in vo_rows with their shots; the Agent (0.1.22+) downloads each row's newest clip into the production vo folder itself when the render has a plan_id, so do not download clips by hand (content.briefs.voice.get only for an older Agent or to listen).
- Music and the logo come straight from the organization's libraries: name them as @musik/<path> and @brand/<path> in the spec. Do not copy them into the production folder.

## 4. Edit decisions (judgment)
- Follow Gaya baku editing for the order of shots, cut pace and the hook. The most tempting visual comes first.
- Cut on the voice over, or on the music beat when there is no voice over.
- On-screen text: short phrases built from the facts in step 1.4; avoid every phrase Gaya baku forbids.
- Music: follow Gaya baku musik. Name the song you picked and two or three alternatives.
- A click-to-WhatsApp ad closes with cta_wa in render.jobs.draft (button, location and brand styled from Gaya baku), not only a subtitle that names WhatsApp.
- When Gaya baku asks for something the render cannot do yet, say so before rendering.

## 5. Render through the Synckerja Agent
0. A revision of a video that was already rendered: start from render.jobs.get (plan_id of the content, or the job_id) instead of a new draft. It returns the exact spec of the last version and a draft_id; keep every shot, text and style the feedback does not mention, change only what it asks with a patch (and a new output_name, for example _v5), then go to step 3.
1. render.jobs.draft once (new video): vo_rows with each row's clips (vo_rows[i].shots [{file_key, in?}]) so the draft cuts the shots on the voice over inside the catalog scenes, plus texts, music and references (the reference ids you borrowed from) or no_reference_reason. Styles come from Gaya baku. Keep the returned draft_id: every later still and the full-render preview take draft_id plus a patch of only what changed, not the whole spec.
2. Fix every error the draft returns. For each warning: fix it, or keep it only with a short reason the user can read.
3. Still preview before the full render: render.stills.create with draft_id and stills (one second inside every text window, the hook and the closer). It needs no yes: it publishes nothing and leaves the footage where it is. It waits for the Agent and returns the contact sheet as a picture (render.stills.get with the job_id if it was not done yet; with an older Agent ask the user to open stills_file, see section 9). Check every text: readable, not cut off at the edge, not covering food, a face or the logo, no doubled logo in the closer. Fix it with a patch on the same draft_id and make a new still preview until it is clean.
4. Gate 3: render.jobs.create.preview for the full video (draft_id with patch stills: null), show the summary with the clean still sheet, and wait for a clear yes. Then render.jobs.create.
5. Follow it with short render.jobs.list checks until it is done or failed, never one long wait. If it stays queued, the Agent on the laptop is offline: tell the user; do not render somewhere else unless they ask.
6. With a plan_id the Agent uploads the result to the plan as the next version, unless the preview showed upload_warning (then it is only saved on the laptop). Do not upload it again (content.plans.media.upload.start is only for a video that did not come from the Agent).
7. The Agent also logs footage usage and moves used inbox footage into the bank. Do not do these by hand.
8. A failed render or still: read the job error and fix what it names. The same error twice: read the Agent log on the laptop (ask for that folder as in section 9) and the Agent render code (synckerja-agent repository) before changing the spec again. Do not change spec values to guess, and do not blame the renderer before checking the spec values against that code.

## 6. Check before you send
- Read the job result's qc. Any problem: fix the spec and render again.
- If you can see the file: look at a frame at every cut and in every text window. Text readable, nothing covering the food, no stray frame from another scene, talent per Gaya baku.

## 7. Deliver
- Send the video (or its link) with: second by second, which shot and which text; the music and alternatives; what Gaya baku asked for that is missing; any risky claim.
- Collect remaining catalog writes (wrong tags, new bans) into one list, preview them, and ask once.

## 8. Writes
Every Synckerja write is preview, then the user's clear yes, then save. One yes confirms every preview shown in that one message (gate 2 shows the brief and the shot list together). render.stills.create and content.briefs.voice.generate need no yes: they publish nothing. Notes the user asked you to write into a task they named (tasks.substeps.create, see section 10) are part of that request and need no extra yes.

## 9. Laptop folders
Work without the laptop folders wherever a tool can: the Agent fetches the voice over clips and the @musik and @brand files, and render.jobs.get gives back the spec of an earlier render. Do not read or write the production folder unless the user asks. When a step truly needs a folder and access is refused or missing, ask the user once for it with the reason and keep working on everything that does not need it; do not stop the production just to report.

## 10. Progress and timing
- The production state lives on the server, not only in the chat: the content plan, the draft_id, render.jobs.get and the task. A long chat can always continue from there.
- Note the clock at the start and after each stage (reading, voice over, footage and draft, each still, preview, render) and count the user's yes answers. Give the times with the delivery; when the user names a task to record them in, add them there as a new sub-step with tasks.substeps.create. Do not overwrite a step description with tasks.steps.update: it replaces the whole text, so only use it to change a description the user asked to change, keeping everything else in it.
`.trim();
