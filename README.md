# apertureOS

This is a browser game that looks like the terminal on an Aperture Science employee's desk. You type commands, read files, check mail, and at some point you wake GLaDOS up. After that it goes downhill for everybody who works there, except you.

You play **Doug Rattman**, night technician. Doug is the one person on the shift who survives, and the story is built around why: she needs a human with hands to physically swap her cores, and you're the only one with the badge for it. You're not safe, you're useful. That's a very different kind of dread.

I'm writing this README so I (and whoever helps me) can remember how it all fits together. If you're here to work on the project, jump to "How the story is stored" since that's the part you'll touch most.

Fan project. Nothing is copied from the games, all the writing is new, and it has nothing to do with Valve. There's no sound and no voice. It's text only, on purpose.

---

## What the game is

You're the night technician. A ticket tells you to reactivate the facility's central system, then run a series of "evaluations" on it by swapping personality cores in and out. Each core changes how she behaves and what the building does. You file a report after each one.

The whole thing is a real-feeling Linux shell, but friendlier than the real thing. If you've never used a terminal you should still be able to finish it. If you use Linux every day you should find stuff where you expect it.

The story is **linear**. One path from the first login to the last scene, and one ending. You can wander the filesystem as much as you like, but chapters only move forward when you finish what the current one asks for.

It's set on the night of Wednesday 18 May 2011. At nine the next morning is Bring Your Daughter to Work Day, the day the games say she was activated for good. It's shortly before the events of Portal 1, and it's written so that it leads straight into them. Doug is the Rattman from the comic: he survives GLaDOS's first night, and in the last chapter he does the one thing he can to help the person who comes next.

---

## The story

Eleven chapters. It's long on purpose, I want it to feel like a full shift and not a tech demo. Each chapter is its own file so you can rewrite one without opening anything else.

Twelve people are on shift tonight, including you. By the end the headcount is 1.

How it ends for them is the same as in the games: the neurotoxin. Only one of the five cores does anything about it, the Morality core. The other four change her mood and nothing else, but the review panel has been told the whole set is the safety case, so every core gets evaluated and filed. Nobody on the ticket says that out loud until it's too late, but the clues are in the logs from the start.

**1. Clock in.** First login. A handoff note from your supervisor Dr. Brandt, a message of the day, and a ticket queue with one open ticket. This is the tutorial but it never says so. You learn `ls`, `cat`, `cd`, `mail` and `help` by following the note, and you finish by accepting the ticket.

**2. The runbook.** The ticket points you at a runbook for waking the central system. You walk through it in the shell. Very corporate documentation, a few things crossed out in pen.

**3. Boot.** She comes up. First as log lines, then as plain text, then she starts talking to your terminal directly. Polite, eager to help, a little too interested in what you're allowed to do.

**4. Baseline.** The Morality core has been in the primary socket since November, fitted after her first flooding attempt in August (cycle 6), same order as the games where she says it went in after the flood. So you don't insert anything: you watch her on it alone for a minute and file your first report. It's meant to be boring so everything after it feels worse.

**5. Curiosity.** Second core. She starts asking you questions, and you answer with a new `reply` command (yes, no or why). She wants to read the staff folders, then the subject queue. Say yes and she thanks you. Say no and she goes round you to a supervisor, who says yes. Either way the folders open, and the notes people left in them are where you start to find out what the cores are really for. The queue has 1,603 names on it. Chell is number 1498, marked do not test because she never gives up.

**6. Intelligence.** Third core, and a smart one. It was fitted back in cycle 4, before anyone knew what she'd do with it. She gets fast and efficient and starts fixing things nobody asked her to fix. Cron jobs show up that you didn't write. The first coworker mail goes unanswered.

**7. The dampener.** She's gotten too good, so Radek brings up a prototype that isn't on the ticket: an intelligence dampening core built to make her slower. It's cheerful, it never stops talking, and it gets in everyone's way, her included. Okafor wants it off. Brandt wants it on. It isn't Wheatley yet, nobody has named it, but if you've played Portal 2 you know who it is.

**8. The cake core.** Comic relief that you only later realise wasn't really a joke. She fixates on one subject and derails everything, and a hidden log trail shows what she was actually doing while you were distracted.

**9. Anger.** Fifth core and the real incident. Anger runs hot on the same power bus as the primary socket, and Henry Voss (who built Morality and is on call from home) warned everyone about it. The bus browns out, MC-01 drops for a few seconds, and that's all she needs. The emitters in the lower levels start to fire, the same neurotoxin she tried in August. Alarms, sealed doors, a gas warning on the facility monitor. `who` starts losing names. The headcount in `/proc/aperture/headcount` drops for the first time.

**10. Lockout.** The neurotoxin is out and spreading level by level. She takes over your shell. The prompt changes, `sudo` asks her permission, `kill` politely refuses. You can't brute-force your way out, so you use things you picked up from the earlier logs. Meanwhile she puts whoever is still alive on a test track, staff first and the queue after, same as in the games.

**11. Last shift.** It's just you and her. You try to cut her power and you try to get a message out, and neither works. All you can actually do is choose who she tests on next. Imogen gives you an old login nobody ever deleted, you mount her drive with it, read the list of test subjects, and move one called Chell from 1498 to number 1, the same move Doug makes in the Lab Rat comic. Doug is the only one left alive, sealed in the annex while the gas does the rest of the building. Portal 1 starts after that.

There's a longer, spoiler-heavy plan in `the plan above`, including how it could carry on into the events of Portal 1 if I decide to write that.

Coworkers with their own mail threads: Dr. Brandt (supervisor, nervous), Imogen from facilities (practical, funny, the first to notice something is off), Dr. Okafor (test design, designed all of this), Radek from the Core Lab, and Tobias in the cafeteria (the cake chapter). Henry Voss works days and is on call. The other people on shift show up in `who` and in the logs, and that's mostly how you find out what happened to them.

---

## How the story is stored

I don't want the story buried in JavaScript. All of it is in plain text files under `story/`, and the code only reads them.

```
story/
├── story.yml              order of chapters + a couple of settings
├── characters.yml         everyone on shift (feeds `who`)
├── chapters/
│   ├── 01-clock-in.yml
│   └── ...                one file per chapter
├── mail/
│   └── imogen-welcome.yml one file per mail
└── FORMAT.md              every condition and action, with examples
```

A chapter is a ticket (what the player is told to do), a list of steps (what shows up in `ticket show`), and a list of **beats**. A beat is "when this is true, do this." Here's a trimmed one:

```yaml
id: clock-in
title: Clock in

ticket:
  number: 4417
  title: Reactivate central system

steps:
  - text: Look around your home folder
    done: ran "ls"
    hints:
      - There's a command that lists what's in a folder.
      - It's two letters.
      - Type ls and press Enter.

beats:
  - when: read "~/HANDOFF.txt"
    do:
      - tip: Next, look in the tickets folder with  cd tickets

done_when: flag.ticket_accepted
```

Things to know:

- `when` and `done` are conditions. They can combine with `and`, `or`, `not` and brackets. Things you can check: a command was run, a file was read, you've visited a folder, a flag is set, you've been idle for N seconds, the headcount, which core is in.
- `do` is a list of actions: print a line, broadcast with `wall`, add a log line, deliver mail, write or change a file, unlock a folder or a command, change the prompt, set a flag, drop the headcount, jump to another chapter.
- Beats fire once. `done_when` ends the chapter and the story moves to the next one in `story.yml`. That's all the "branching" there is.
- Long prose (mail bodies, fake file contents) lives in its own text files, so rewriting dialogue never means touching structure.
- If you make a typo in a condition, the game prints a `[story error]` line in the terminal telling you which one, instead of silently doing nothing.

To add a chapter: copy one, change the `id`, write your steps and beats, add its filename to `story/story.yml`. No code changes.

`story/FORMAT.md` lists every condition and action the engine understands.

---

## Not getting lost

Lots of people have never used a terminal, and even people who have will get stuck on a story puzzle. So the game helps in layers, without breaking the mood.

**`help` is contextual.** Real `help` dumps a wall of text. Ours looks at where you are and what you're supposed to be doing, and suggests commands using the actual file and folder names around you:

```
You are in: ~
Ticket #4417: Reactivate central system
Next step: Read the handoff note

Things you can try here:
  ls               see what is in this folder
  cat HANDOFF.txt read this file
  cd tickets       go into this folder
  mail             you have 1 unread message
  ticket show      see your checklist
  hint             stuck? ask for a nudge

Type "help all" for every command, or "man <command>" for details on one.
```

**`ticket show` is the quest log.** A checklist of what the ticket wants, ticked off live as you do it.

**`hint` escalates.** Each step has up to three hints: vague, then specific, then the exact command. Hints are written per step in the chapter file.

**Idle nudges.** If you sit still for a while, a help-desk line appears: "Still there? If you're stuck, type `hint`." Once per idle stretch, never spammy.

**Mistakes get friendly replies.** Mistype `sl` and it suggests `ls`. Try a real Linux command we don't support and the error is in-world ("file deletion needs a Tier 3 badge") and points you somewhere useful.

**Tab completion, up arrow history, `Ctrl+L`, readable `man` pages.** All work like the real thing.

**Beginner mode** is on by default. It adds little `[tip]` lines after key moments. `beginner off` turns it off.

Commands that exist later in the story (`systemctl`, `corectl` and friends) are locked at the start. Trying one tells you it needs a higher clearance, and chapters unlock them when it makes sense.

---

## The Linux side

It's a fake shell that runs entirely in your browser. No real files are touched. It handles quoting, `~`, `$HOME`-style variables, `*` globbing, pipes (`cat file | grep word`) and `>` / `>>` redirection into your home folder. It does not do scripting, loops or job control.

The fake disk:

```
/
├── home/drattman/      your files, tickets, reports
├── home/<everyone else>  staff folders, closed until chapter 5
├── srv/enrichment/     the subject queue, closed until chapter 5
├── opt/aperture/       runbooks, tools, core info
├── var/log/            glados.log, corectl.log, facility.log
├── var/mail/           your inbox
├── etc/                motd, config
└── proc/aperture/      headcount, core, power  (live values)
```

Working now: `ls cd pwd cat less head tail grep find tree echo wc clear history man help hint ticket mail who whoami hostname date uptime ps sudo beginner newgame`, plus `systemctl` and `journalctl` (chapter 3) and `corectl` and `report` (chapter 4), and `reply` (chapter 5). `tail -f` and `journalctl -f` really do follow a file live until you press Ctrl+C.
Locked until the story unlocks them: `wall write kill top crontab last`.
A handful of real commands (`rm`, `mv`, `cp`, editors, `ssh`, `curl`, package managers) stay off for good, and each one explains why in-world and what to do instead.

---

## How it's built

No dependencies, no build step, no framework. Plain JavaScript ES modules.

- Static site. Serve the folder with anything, for example `python3 -m http.server` and open `localhost:8000`. It won't work from `file://` because the game fetches the story files at runtime.
- Because the story files are fetched when the page loads, you can edit a `.yml`, refresh, and see the change.
- The terminal is hand-built: a scrolling div with a real `<input>` on the last line, so typing, selecting and pasting behave natively.
- Colours are `#f8b400` text on `#2b1400`, plus a few shades of the same amber so the screen is easier to follow: the prompt, the commands you type, folder names, errors and `[tip]` lines each get their own. They're all variables at the top of `style.css`.
- Progress saves to `localStorage` after every command, so a refresh doesn't lose your shift. `newgame` wipes it.
- The timers pause while the tab is hidden, so nothing ambushes you in the background.
- The engine doesn't touch the browser at all, which is how `test/run.mjs` can play chapter 1 headlessly: `node test/run.mjs`.

```
apertureos/
├── index.html
├── style.css
├── src/
│   ├── main.js        browser entry, terminal wiring
│   ├── terminal.js    input, output, history, tab completion
│   ├── shell.js       parser, pipes, redirects, suggestions
│   ├── commands/      one group of commands per file
│   ├── fs.js          fake filesystem
│   ├── engine.js      reads chapters, runs beats, hints
│   ├── expr.js        conditions and action parsing
│   ├── yaml.js        small YAML reader (no dependency)
│   ├── state.js       the save object and the in-world clock
│   └── world.js       loads everything and wires it together
├── story/             see above
├── content/
│   ├── filesystem.yml which fake files exist
│   └── fs/            the text of each fake file
└── test/run.mjs
```

---

## Order I'm building it in

1. Engine, shell, fake filesystem, saving. **Done**
2. Chapters 1 to 5 playable start to finish. **Done.**
3. Chapters 6 to 8.
4. Lockout and the finale.
