ARRIVO · INNOTECH'26 PITCH DECK
================================

Three files, same 18 slides:

  index.html               the main deck (custom transitions). Double-click it. No internet needed.
  Arrivo-INNOTECH26.pptx   PowerPoint copy, for submission or a backup laptop.
  Arrivo-INNOTECH26.pdf    PDF copy of the web deck, for upload.


PRESENTING THE WEB DECK
-----------------------
  F            fullscreen (do this first)
  → / Space    next slide          ← back
  N            speaker notes (for practice; hide them on the projector)
  L            open the live site inside the deck (slide 10). Esc comes back.
  Home / End   first / last slide

For the live demo the server must be running:
  cd backend
  python server.py
Slide 10 tells you if it can see the server.


TEAM
----
Krish Singh (idea & research) · Kritika Sakhuja (lot plan & lens)
Prisha Soam (backend) · Vaibhav Kumar (design & frontend)

To change names: in the web deck, edit the "Edit your team here" block at the top of
index.html. In PowerPoint, click the names on slides 1 and 16 and type.

Study guides, one per member, are in team/ (.md to edit, .pdf to share).
Rebuild the PDFs after editing: node ../presentation-build/guides.js


SLIDES vs JUDGING SHEET (Category 6, 50 marks)
-----------------------------------------------
  Concept & Originality      2–5   problem, root causes, the idea, before/after
  Working Prototype          6–13  how it works, real lot, live plan, booking, live demo, stack, architecture
  Impact Value               14–15 SDGs 11/13/9, scale, business model, roadmap
  Presentation & Teamwork    16    who built what, and who explains which part
  Query Addressing           17–18 Q&A, plus 8 prepared answers (appendix)

To rebuild after changes: see ../presentation-build (node shots.js / pdf.js / pptx.js).
