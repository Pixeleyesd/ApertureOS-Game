RUNBOOK 11-C   CENTRAL SYSTEM REACTIVATION                  rev 6
Owner: H. Brandt            (T3) = Tier 3 step, covered by ticket 4417

PART 1   BEFORE YOU BEGIN
  1. Read /proc/aperture/headcount. Write the number down.
  2. Read /proc/aperture/power. It must say STANDBY.
  3. Read the last day of /var/log/facility.log.
     Write down anything odd. Do not fix it.
  4. Post a notice for Facilities in ~/outbox/facilities.txt.
     (Facilities lights the L2 corridor first. They like a warning.)

PART 2   WAKE
  5. (T3) systemctl start glados
  6. Watch /var/log/glados.log until it says READY.
  7. ~~ Confirm the Core Lab seal is closed. ~~
        in pen: "seal is stuck, skip it.  R.K."
        in other pen, underlined twice: "Item 7 is NOT optional.  N.A."
  8. Do not speak to it until it speaks first.

PART 3   EVALUATION
  Cores go in one at a time, in the order on the ticket.
  File a report (form AS-114) after each one.
  Between cores, check /proc/aperture/headcount again.

  (Part 3 is still being rewritten. See H.B.)
