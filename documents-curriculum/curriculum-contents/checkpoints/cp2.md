# cp2 — OOP Gate

**Time:** 2h · **Start:** empty folder `attempts/cp2-attempt-N/` · **Allowed:** docs, search · **Forbidden:** AI, own code · Rules: `00-system/checkpoint-protocol.md`

## Task — Notification system

Design and build: `INotificationChannel` with three implementations (email, SMS, console — fake transports that *record* what they "sent"), and a `NotificationService` that:
- takes its channels and an `IClock` via constructor injection,
- enforces quiet hours: no SMS between 22:00 and 07:00 — queued for later instead,
- exception: `Priority.Urgent` messages send on all channels regardless,
- exposes `Flush()` to send queued messages (when called outside quiet hours).

## Pass criteria (all mandatory)

- [ ] Service has zero references to concrete channel types and zero `DateTime.Now` — fully injected
- [ ] Quiet-hours behavior tested with a fake clock, including the boundary at exactly 22:00 and 07:00
- [ ] Urgent override tested
- [ ] Queue + Flush behavior tested
- [ ] Adding a 4th channel would touch no existing class (prove by adding one in the last 10 min)
- [ ] Invalid construction (no channels / null clock) impossible
- [ ] Spoken: 2-minute design explanation recorded (phone is fine)

## Attempt log

| # | Date | Time used | Result | Failed criteria → exact reason | Remediation plan |
|---|---|---|---|---|---|
| | | | | | |
