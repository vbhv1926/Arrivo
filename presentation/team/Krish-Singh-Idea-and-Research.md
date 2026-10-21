# Krish Singh · Idea & Research

**Arrivo · INNOTECH'26 · Category 6 · your study guide**

**Your part:** why Arrivo exists and why it matters. That means:

- the problem
- where the numbers come from
- the root causes
- the idea and what is new about it
- who it helps
- the impact (SDGs)
- how it could grow and pay for itself

The rest of the team covers how it is built:

- **Vaibhav:** the site and the booking flow
- **Kritika:** the lot plan, the lens and the 3D view
- **Prisha:** the server and the database

You open and close the presentation, so you set the tone. Judges score two things almost entirely from your slides:

- **Concept & Originality** (10 marks)
- **Impact Value** (10 marks)

**Your slides:**

- **1:** opening
- **2:** the problem
- **3:** why it keeps happening
- **4:** the idea
- **5:** before and after
- **14:** impact
- **15:** where it goes next
- **17:** closing and questions
- **16:** you can introduce this one ("each of us built a piece; here's who explains what")

**How to use this guide.** Read it twice and say the scripts out loud until they sound like you. Know where every number comes from. A judge asking "where is that from?" is the most common question at a hackathon.

---

## 1. Say this

> **Slide 1 · Opening.** "Good morning. We're Team Arrivo: Krish, Kritika, Prisha and Vaibhav. Arrivo lets you book a parking bay before you leave, the way you pick a seat for a film. Let me show you why."

> **Slide 2 · The problem.** "It's 9:58 on a weekday. The lot is full, but you don't know that yet. So you circle: row A, row C, back past the gate. The lecture starts without you, and the car behind you is doing the same lap. This isn't just us. A well-known study of city traffic found that in busy centres, on average 30% of the cars on the road are just looking for parking. INRIX measured 17 hours a year per driver spent searching. And at the KIET main lot, with 96 bays, there are zero ways to know which one is free before you drive in."

> **Slide 3 · Why it keeps happening.** "The problem isn't too few bays. It's four things:
> - Nobody can *see* the free bays from the gate.
> - Nobody can *book* one: seats, trains and tables can all be booked, but a parking bay can't.
> - The people running the lot have no data, so nothing gets planned.
> - All of that turns into circling, which wastes time and fuel."

> **Slide 4 · The idea.** "Everyone already knows how to book a seat for a film. You see the hall, you pick an empty seat, it's held for you. We asked: why not a seat map for parking? That's Arrivo. You see every bay on a live plan, pick a free one, choose your hours, and it's yours when you arrive. Same idea, new place."

> **Slide 5 · Before and after.** "Today you drive in and hope. With Arrivo you tap a free bay, and it's held for your hours. If you're running late, you get a 15-minute grace window. Two cars for one bay becomes impossible, because the system refuses it. And the person running the lot finally sees how it's used. What's new is booking an *exact* bay, on a plan of the *real* lot, live for everyone at once."

> **Slide 14 · Impact.** "Arrivo connects to three UN Sustainable Development Goals:
> - **SDG 11, sustainable cities:** less traffic crawling around lots, and a fair first-booked system instead of first-lucky.
> - **SDG 13, climate action:** every lap you don't drive is fuel you don't burn.
> - **SDG 9, infrastructure:** it gets more out of the lot that already exists, with no new concrete.
>
> To give a sense of scale, and this is an illustration, not a measurement: if 100 drivers a day each skip five minutes of circling, that's 500 engine-minutes saved every day, on one lot."

> **Slide 15 · Where it goes next.** "The method works for any lot. Trace it once from its satellite photo and it's bookable every day: campuses, hospitals, malls, metro stations. It pays for itself with a small commission per booking and subscription plans for lot operators. Next we add UPI payments and QR check-in at the gate. Later, sensors and demand forecasts."

> **Slide 17 · Close.** "That's Arrivo: park like you booked a seat. Thank you. We'd love your questions."

---

## 2. The problem, properly

### What "cruising for parking" means

Cruising is driving around looking for a free space. While you cruise, you're not going anywhere useful, and you're adding to the traffic that everyone else is stuck in. Three groups pay for it:

1. **The driver** loses time and fuel, and gets stressed.
2. **Everyone else** is stuck behind slow, searching cars, at the gate and in the lanes.
3. **The air** gets engine exhaust for no journey at all.

### Why it happens in a lot like KIET's

The KIET main lot (beside the football ground) has **96 bays in 5 rows**. Arrivo calls them A to E:

| Row | Name | Bays | Notes |
|---|---|---|---|
| A | Ground Edge | 33 | Along the football ground, off the service road |
| B | North Wing | 10 | A short shaded strip under the trees, compact cars |
| C | Main Block | 24 | Facing the main building; EV charging at the north end |
| D | Corner | 6 | By the south-east entrance; two step-free |
| E | South Lot | 23 | The open lot beside the two-wheeler stand |

The row names are the ones we gave them in the app. From the gate you can't see which of those 96 is empty. Most people arrive in the same short window before the first lecture. So everyone does the same thing at the same time: drive in and look.

### The numbers on slide 2, and exactly where they come from

**"30% of traffic in busy city centres is drivers cruising for parking."**

- **Source:** Donald Shoup, *"Cruising for parking"*, Transport Policy, vol. 13, 2006. Shoup is a professor at UCLA and the best-known researcher on parking.
- **What it really says:** He gathered 16 studies of traffic in busy city centres, done between 1927 and 2001. On average, about 30% of the cars in that traffic were cruising for parking. The share varied a lot from study to study.
- **Be careful with it:** It's an *average of older studies in busy downtowns*, not a law of nature. Newer studies in some cities found much lower shares. That's why the slide says "in busy city centres". If a judge pushes, say: "it's an average across 16 studies; the exact share depends on the place. That's why we also counted our own lot."

**"17 hours a year the average driver spends hunting for parking."**

- **Source:** INRIX parking study, 2017. INRIX is a traffic-data company.
- **What it really says:** American drivers spend on average about 17 hours a year searching for parking. Drivers in the UK and Germany spent more.
- **Be careful with it:** It's a **US** figure. We don't have a published Indian equivalent that we've checked, so we don't invent one. If asked "what about India?", say: "We didn't find a reliable Indian number, so we're measuring our own campus instead." Then do section 9.

**"0 ways to know which of the 96 bays at KIET is free before you drive in."**

- **Source:** our own count of the lot. There's no sign, app or board that shows free bays. This is a statement about today, and it's true.

### The lot survey we did

1. We took a **Google Earth** satellite capture of the lot and **marked the five rows in yellow**.
2. We **counted the bays: 96**.
3. We **measured** them using the photo's scale bar, where 50 metres is 385 pixels, so 7.7 pixels is one metre.
4. A standard bay works out to about **2.5 × 4.9 m**, which matches normal Indian car bays.

Kritika explains how that became the live plan. **This was a mapping survey, not a survey of people.** Don't call it a student survey unless you do one (section 9).

---

## 3. The four root causes (slide 3)

| Cause | What it means | Example |
|---|---|---|
| **No visibility** | From the gate you can't tell which bays are empty, so the only way to find out is to drive and look. | You enter, see row A is full, try row C, come back. |
| **No booking** | Cinema seats, train berths, restaurant tables, even gym slots can all be booked. A 2.5 × 5 m bay can't. | You leave home with no idea whether you'll get a space. |
| **Blind operators** | Whoever runs the lot has no data: which rows fill first, at what time, how long cars stay. | Nobody can plan extra bays, staff rows or visitor slots. |
| **Wasted minutes** | All of the above becomes circling: fuel, time, a queue at the gate, late arrivals. | Five cars doing the same lap at 9:58. |

**The key line:** "The problem isn't too few bays. It's that nobody can see them, book them or plan them." This matters because it means the fix is *information*, not concrete. That's cheaper, faster and greener than building more parking.

---

## 4. The idea, and why it's original (slides 4 and 5)

### The idea in one sentence

**A seat map for parking:** see every bay of the real lot on a live plan, pick a free one, choose your hours, and it's held for you.

### Why the seat-map comparison works

Every judge has booked a film seat. When you say "like booking a movie seat", they instantly understand three things:

- you **see** the whole hall
- you **choose** an exact seat
- it is **held** in your name

Arrivo copies exactly those three to parking. The site's opening section even draws rows A and C *as seats*.

### What already exists, and how Arrivo is different

Be fair about other products. Judges respect a team that knows its competition.

| What exists | What it does | How Arrivo differs |
|---|---|---|
| Google Maps | Shows where a parking lot *is*, sometimes how busy an area is. | Arrivo shows **which bay** inside the lot is free and **holds it**. |
| Pre-booking apps abroad (e.g. SpotHero in the US, JustPark in the UK) | Let you pre-pay for *a* space in a garage or a driveway. | You usually get "a space in that garage", not a specific bay on a plan of the lot. |
| Indian parking apps (e.g. Park+) | Parking at partner locations, FASTag and car services. | We focus on lots that have **no system at all**, like a campus lot, starting from just a satellite photo. |
| Sensor-based "smart parking" | Sensors or cameras in every bay show occupancy on a board. | Needs hardware in every bay. Arrivo works **today with no hardware**; sensors are a later add-on. |

**Check before you quote:** company details change. Open each one's website the week before the event, so you can say "we checked".

### What is genuinely new in Arrivo (the four bullets on slide 5)

1. **Bay-level booking.** You book an exact bay, like A-14, not "some space".
2. **A plan traced from the real satellite photo.** The map *is* the real lot, measured in metres. Kritika explains how.
3. **An X-ray lens over a live plan.** Hold it and drag, and every bay under it shows its status. Kritika's part.
4. **Live for every viewer at once.** When anyone books, every open screen updates within about a second, without refreshing. Prisha's and Vaibhav's part.

### Before / after, row by row (slide 5)

| | Without Arrivo | With Arrivo | Why it matters |
|---|---|---|---|
| Finding a bay | Drive in, circle, look | Tap a free bay on a live plan | No circling |
| Knowing it'll be free | Hope | Held for your hours | Certainty before you leave |
| Running late | Someone else took it | 15-minute grace window | Fair to late arrivals, but the bay isn't wasted |
| Two cars, one bay | An argument at the gate | Impossible: the system refuses a second booking | No conflicts |
| The lot's owner | Guesses how it's used | Every booking is data | Better planning |

---

## 5. Who it helps

| Who | How |
|---|---|
| **Students and faculty who drive** | Know your bay before you leave; no late arrivals from circling. |
| **Visitors** (parents, guests, interview candidates) | They don't know the campus at all. A booked bay with a pass is a huge help. |
| **People who need step-free access** | Step-free bays are marked (D-01, D-02, A-33) and can be booked in advance, so they're not taken by chance. |
| **EV drivers** | EV-charging bays (C-01 to C-04) are marked and bookable. |
| **Security and gate staff** | A pass with a code instead of arguments. |
| **The campus administration** | Data: which rows fill first, peak times, how long cars stay. They can plan visitor bays, staff rows or events. |
| **Everyone else on the road** | Fewer cars crawling around the lot and blocking the gate. |

---

## 6. Impact and the SDGs (slide 14)

The UN's 17 **Sustainable Development Goals** (SDGs, 2015) are the world's shared targets for 2030. The judging sheet asks for "relevance to society, environment or SDGs", so name the goals *and* the specific link.

| SDG | Name | Our link | A specific target you can mention |
|---|---|---|---|
| **11** | Sustainable cities and communities | Less traffic crawling round lots and gates. Fairer access: first booked, not first lucky. Step-free bays bookable in advance. | **11.2**: sustainable transport systems for all, with attention to persons with disabilities. **11.6**: reduce cities' environmental impact, including air quality. |
| **13** | Climate action | Every lap not driven is fuel not burned and CO₂ not emitted. | The goal as a whole: take urgent action against climate change. |
| **9** | Industry, innovation and infrastructure | Uses existing lots better: no new concrete, just software. | **9.1**: quality, reliable, sustainable infrastructure. **9.4**: upgrade infrastructure for resource efficiency. |

### The "500 engine-minutes" number: how to explain it honestly

- **The slide says:** if **100 drivers** a day each skip **5 minutes** of circling, that's **500 engine-minutes saved a day**, on one lot.
- **It's labelled "illustrative estimate" on purpose.** It's a simple multiplication to show scale, not something we measured.
- **If a judge asks for fuel or CO₂,** do it *out loud with your assumptions*:
  - Assume a car crawling around a lot burns roughly **1 litre of petrol an hour**. This is an assumption; it depends on the car.
  - 500 minutes ≈ 8.3 hours ≈ **about 8 litres a day**.
  - Burning 1 litre of petrol releases about **2.3 kg of CO₂**, so that's **about 19 kg of CO₂ a day**, on one lot.
  - Over ~200 working days: **about 3.8 tonnes of CO₂ a year**, from one lot.
- Always add: **"These are assumptions to show the order of size. We'd measure the real number with QR check-in data."**

### Other impact worth mentioning

- **Time.** Five minutes a day is about 16 hours over a 200-day academic year, per person.
- **Safety.** Fewer cars moving slowly between pedestrians in the lot.
- **Stress and punctuality.** Fewer late arrivals to lectures and exams.
- **Data for planning.** The campus learns exactly how its lot is used.
- **Inspiring change** (the judging sheet asks for this): the same method works for any lot, so one student project can become a model for hospitals, malls and metro stations.

---

## 7. Scale, money and roadmap (slide 15)

### Same method, any lot

Adding a new lot means four steps:

1. Get its satellite photo.
2. Mark its rows.
3. Measure with the scale bar.
4. Place the bays.

That's hours of work, not new hardware. Target places: **campuses, hospitals, malls, metro stations, offices and events.** All have a fixed lot, a rush hour, and people who'd like a guaranteed space.

### How it pays for itself

There are three revenue sources on the slide.

| Source | What it is |
|---|---|
| **8% commission** on each booking | We keep a small share of the parking charge; the lot owner gets the rest. |
| **Partners** | Campuses and parking providers who put their lots on Arrivo. |
| **Plans** | Monthly subscriptions for lot operators: the dashboard, the data, more lots. |

**The site also shows a ₹5 booking fee** paid by the driver. Prices are ₹15/h compact, ₹20/h standard and step-free, ₹35/h EV.

Example, labelled as a proposal:

- A 2-hour standard booking = ₹40 + ₹5 fee = **₹45 paid**.
- Arrivo keeps ₹5 + 8% of ₹40 (₹3.20) = **₹8.20**.
- The lot owner gets **₹36.80**.

These are our proposed numbers, not a business that's running.

**"But campus parking is free."** That may be true at KIET. The answer: the campus can set the hourly rate to ₹0 for students and staff and still get booking, fairness and data. Revenue then comes from the operator subscription. Paid hourly rates make most sense in public lots: malls, hospitals, metro stations.

### Roadmap

| When | What | Why |
|---|---|---|
| **Now** (built) | Live plan, booking, pass, lens and 3D on the KIET main lot. | The working prototype you see today. |
| **Next** | UPI payments, QR check-in at the gate, more KIET lots. | Payment makes it real. Check-in confirms the car actually arrived and frees no-shows faster. |
| **Later** | Cameras or sensors for occupancy, and demand forecasts. | Catch cars parked without booking, and predict busy days (exams, events). |

---

## 8. The product, in enough detail to answer basic questions

Judges sometimes ask anyone anything. You should be able to give the short answer, then hand over.

- **How a booking works:**
  1. Tap a free bay on the live plan.
  2. Pick an arrival time (now, +30 min, +1 h, +2 h) and a stay (1 to 8 hours).
  3. Type your number plate, see the total, press Hold.
  4. You get a yellow bay pass with a code.
  
  *(Detail: Vaibhav.)*
- **Bay colours:**
  - **Free:** pale
  - **Booked:** grey with a car
  - **Ending soon:** grey with a yellow ring (leaving within 20 minutes)
  - **Reserved:** striped (someone due within 30 minutes)
  - **Yours:** yellow
- **Late?** The bay waits **15 minutes** past your arrival time, then opens up.
- **Double booking?** Impossible. The server checks inside a locked step, and the database has a rule that refuses overlaps. *(Detail: Prisha.)*
- **Built with:** a website (HTML, CSS, JavaScript, React) and one Python file for the server, with an SQLite database. No app to install; it works in any phone browser.
- **Privacy:** no sign-up. A random device ID marks your bookings (stored only in scrambled form), and other people's number plates are masked like `UP14 •• 4821`.
- **The cars you see moving on the live demo** are demo traffic made up by the server so the lot looks alive. Bookings made on the site are real and saved.
- **The seat map on slide 1** is an animation of how the site draws the lot. The real live plan is on slide 10.

**Handover lines** (practise them; smooth handovers score "team coordination"):

- "Vaibhav will show you how booking works." (before slide 6)
- "Kritika traced the real lot; she'll show you." (before slide 7)
- "Prisha will explain how we make double booking impossible." (before slide 12)

---

## 9. Research to do before 30 October (strongly recommended)

Right now our problem numbers come from the US and from old city studies. The judges score **"understanding of the problem"**, and nothing beats data from our own campus. Two small things, about one morning's work:

### A. Count the circling (20 minutes, one person)

1. Stand near the lot entrance from about **9:30 to 10:00** on a normal weekday.
2. For every car that comes in, note:
   - whether it parked on the first pass, or drove past rows and came back (a "lap")
   - roughly how long it took from entering to parking
3. Write down how many bays were free at 9:30 and at 10:00.

### B. A 3-question survey (Google Form, 20–30 people who drive to KIET)

1. On a normal morning, how long does it take you to find a parking space? (0–2 / 2–5 / 5–10 / 10+ minutes)
2. In the last month, were you ever late because of parking? (Never / Once or twice / Often)
3. Would you book a bay in advance if you could? (Yes / Maybe / No)

**Then tell the team.** We can put **your real numbers on slide 2**, as "our survey of N KIET drivers, October 2026". Only use numbers you actually collected, and say how many people you asked. "We asked 24 drivers" is far more convincing than a big number nobody can check.

---

## 10. Questions to prepare

Short answer first; add detail only if they ask.

### The problem

**Q1. Is parking really a problem at KIET?**
At peak time before the first lecture, yes: everyone arrives at once and nobody can see which of the 96 bays is free. (If you did the survey in section 9, quote it here.)

**Q2. Where is the 30% from? Is it true for India?**
Donald Shoup's 2006 paper *"Cruising for parking"*, an average across 16 studies of busy city centres. It's not an Indian number, and the exact share depends on the place. That's why we measured our own lot.

**Q3. And the 17 hours?**
INRIX's 2017 parking study: the average American driver spends about 17 hours a year searching for parking. Again not Indian, which is why we're counting our own campus.

**Q4. Isn't the real fix just more parking?**
Building costs land, money and concrete. Most of the waste comes from *not knowing* where the free bays are. Information is the cheaper, greener fix, and that's SDG 9: get more from what already exists.

**Q5. Who did you talk to?**
Answer truthfully. Say what you actually did: the lot mapping, your own experience as students who drive or are driven in, and the survey if you did it.

### The idea

**Q6. What's original here? Parking apps exist.**
Booking an **exact bay** on a **plan traced from the real lot**, live for everyone at once, with no hardware. Most apps sell "a space somewhere in a garage". We start from a satellite photo and make *any* lot bookable bay by bay.

**Q7. Why not just use Google Maps?**
Maps tells you a lot exists. Arrivo tells you which bay in it is free, and holds it for you.

**Q8. Why would people book parking in advance?**
For the same reason they book film seats: certainty. It matters most when you can't be late (an exam, a hospital appointment, a flight) or when you need a special bay (step-free, EV).

**Q9. What if someone books and never comes?**
Our rule is that the bay waits 15 minutes past their arrival time, then opens up for anyone. In the prototype that rule is shown to the driver; freeing a no-show automatically needs check-in at the gate, which is next on our roadmap.

**Q10. What if someone parks without booking?**
The prototype doesn't check that yet. In a real rollout, gate staff would check the pass code. Next on our roadmap is QR check-in at the gate; later, cameras or sensors can spot a car in a bay that has no booking.

**Q11. What about people without smartphones, or visitors?**
It's a website, so any phone browser works and there's no app to install. For walk-ins, a lot can keep some bays unbookable as first-come (that's a policy choice, not something we've built yet).

**Q12. Couldn't someone book every bay?**
Payment and per-person limits stop that. Limits aren't built yet; they're an easy rule to add on the server.

### Impact

**Q13. Which SDGs, and why?**
- **SDG 11:** less traffic around lots and fairer access, including step-free bays.
- **SDG 13:** fewer laps means less fuel and CO₂.
- **SDG 9:** better use of existing infrastructure with no new building.

**Q14. Is 500 engine-minutes real?**
No, and the slide says so: it's an illustration. 100 drivers × 5 minutes. Measuring it properly needs check-in data, which is on our roadmap.

**Q15. How much CO₂ is that?**
Give the worked estimate from section 6 with its assumptions: roughly 8 litres and 19 kg of CO₂ a day on one lot, if a crawling car burns about a litre an hour.

**Q16. How does this inspire change beyond KIET?**
The method works for any lot: trace it once and it's bookable. A college project can become the model for hospitals, malls and metro parking.

### Business

**Q17. How does it make money?**
An 8% commission per booking, a small booking fee, and subscription plans for lot operators.

**Q18. KIET parking is free. Why would anyone pay?**
The campus can set the rate to ₹0 and still get booking, fairness and data; it pays through an operator plan. Paid hourly rates make sense in public lots like malls and hospitals.

**Q19. Who would you sell to first?**
KIET itself, the lot we already mapped. Then other campuses nearby in Ghaziabad and Delhi NCR, then hospitals and malls.

**Q20. What are the costs?**
Mapping a lot takes hours. The server is one small Python program, which is cheap to run. The big costs come later: payments, QR scanners at gates, and support.

**Q21. What are the risks?**
- **Adoption:** people have to use it. That's why we start with one campus.
- **Enforcement:** parking without booking. Answered by QR check-in, then sensors.
- **Payments:** the next build step.

### Team and process

**Q22. What did you do?**
"I did the research and shaped the idea: the problem, the causes, the impact and the business side. I also helped map the lot." Only say the last part if it's true.

**Q23. How did you split the work?**
- Krish: research and idea
- Kritika: the lot plan and lens
- Prisha: the server
- Vaibhav: the design and frontend

Each of us can explain our part.

**Q24. Did you use AI?**
Answer truthfully, as a team, the same way. If you did, say so plainly and show you understand the result. For example: "Yes, we used AI tools while building, like most developers do now. The idea, the lot, the decisions and the testing were ours, and each of us can explain our part."

**Q25. What would you do with more time?**
UPI payments and QR check-in, more KIET lots, then a proper pilot with real usage data, so we can replace our illustrative numbers with measured ones.

---

## 11. Words you should know

| Word | Meaning |
|---|---|
| **Cruising** | Driving around looking for a free parking space. |
| **Occupancy** | How many bays are in use right now, often as a %. |
| **Utilisation** | How much of the lot's total time is actually used across a day. |
| **Peak** | The busiest time (for a campus, just before the first lecture). |
| **No-show** | Someone who booked but didn't come. |
| **Grace period** | The 15 minutes a reserved bay waits past the arrival time. |
| **Bay** | One parking space. Arrivo names them like A-14 (row A, bay 14). |
| **Step-free** | A bay suitable for wheelchair users: wider access, no kerb. |
| **SDG** | One of the UN's 17 Sustainable Development Goals for 2030. |
| **Commission** | A % of each booking that the platform keeps. |
| **Subscription** | A fixed monthly fee, here for lot operators. |
| **Prototype** | A working early version that shows the idea is real. |
| **Scalability** | How easily it grows to many lots and many users. |
| **Stakeholder** | Anyone affected: drivers, the campus, gate staff, visitors. |
| **Illustrative estimate** | A worked example to show size, not a measurement. |

---

## 12. Numbers to remember

| | |
|---|---|
| Lot | KIET main lot, beside the football ground, Ghaziabad |
| Bays | **96** in **5 rows**: A 33 · B 10 · C 24 · D 6 · E 23 |
| Bay size | about **2.5 × 4.9 m** (standard) |
| Photo scale | 50 m = 385 px → **7.7 px per metre** |
| Shoup 2006 | ~**30%** of traffic in busy centres is cruising (average of 16 studies) |
| INRIX 2017 | ~**17 hours** a year per US driver searching for parking |
| Rules | ending soon ≤ **20 min** · reserved = due within **30 min** · grace **15 min** |
| Prices | ₹15 compact · ₹20 standard / step-free · ₹35 EV · + ₹5 fee |
| Business | **8%** commission · operator subscriptions · partners |
| Impact example | 100 drivers × 5 min = **500 engine-minutes / day** (illustrative) |
| SDGs | **11** cities · **13** climate · **9** infrastructure |
| Event | INNOTECH'26 · **30 October 2026** · Category 6 · 50 marks |
