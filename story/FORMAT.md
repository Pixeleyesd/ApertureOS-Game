# story format

Everything the player reads or does in a chapter is in a file in `story/chapters/`. This is the whole vocabulary. If you only want to change dialogue or hints, you never need to touch anything but text.

Add a new chapter by copying an existing one and putting its file name in `story/story.yml`. Chapters play in that order. A name with no file yet is skipped.

If anything in a story file is wrong (unknown condition, bad action, typo in a path) the game prints a `[story error]` line in the terminal and keeps going, so you can see it while you test.

## A chapter file

```yaml
id: boot                 # unique name
title: Boot              # shown if show_chapter_titles is on in story.yml
next: 04-baseline        # optional. default is the next chapter in story.yml
idle_nudge: 60           # optional. seconds idle before the help-desk nudge

ticket:                  # shown by  ticket show  and  help
  number: 4418
  title: Something short

steps:                   # the checklist, ticks itself off
  - text: What the player should do, in plain words
    done: <condition>
    final: true          # optional. the step  ticket accept  doesn't wait for
    hints:               # vague -> exact. avoid a colon followed by a space in a hint
      - first nudge
      - clearer nudge
      - the exact command

hints:                   # optional chapter-wide fallback when every step is done
  - ...

on_start:                # actions that run when the chapter begins
  - ...

beats:                   # things that happen when something becomes true
  - id: my-beat          # optional. a name for your own reference
    when: <condition>
    do:
      - <action>

done_when: <condition>   # when true, the chapter ends
on_done:                 # actions that run as it ends
  - ...
```

A beat fires once, the first time its `when` is true. Beats are checked after every command and every second.

A step can be `optional: true`. It still shows in `ticket show` (marked optional) and ticks off, but `help` and `hint` never send the player to it and `ticket accept` doesn't wait for it. Good for "look at this if you're curious" things.

The in-game clock starts at 22:41 on Friday 4 March 2011 and runs in real time. `clock_to` is how the story skips ahead.

## Conditions

Use in `when`, `done` and `done_when`. Join with `and`, `or`, `not` and brackets.

| condition | true when |
|---|---|
| `true` | always |
| `ran "ls"` | the player ran a command starting with that (this chapter only) |
| `read "~/HANDOFF.txt"` | the player has cat/less/head/tail'd that file |
| `visited "~/tickets"` | the player has been in that folder |
| `wrote "~/notes.txt"` | the player saved that file this chapter (with `>` or `>>`) |
| `seen "/var/log/glados.log"` | the player has read that file this chapter (cat, tail, journalctl and so on). `read` is the same but counts every chapter |
| `after flag.name 30` | that flag was set at least 30 seconds ago. Use it to make things happen on a timer |
| `cwd "/var/log"` | the player is in that folder right now |
| `flag.name` | that flag has been set |
| `idle 45` | no input for 45 seconds |
| `since 120` | the chapter began 120 seconds ago |
| `headcount < 5` | compare the headcount (`<` `>` `<=` `>=` `==` `!=`) |
| `mail_read "mail-id"` | the player opened that message |
| `core "curiosity"` | that core is in |

Examples: `ran "ls" or ran "tree"`, `flag.glados_awake and not flag.met_her`, `read "/var/log/glados.log" and idle 30`.

## Actions

Two ways to write one. Both do the same thing.

```yaml
- say: Hello there.            # one key, one value
- say "Hello there."           # or a short sentence
```

Use a `|` block for anything with several lines:

```yaml
- say: |
    First line.
    Second line.
```

| action | what it does |
|---|---|
| `say: text` | prints text |
| `tip: text` | prints `[tip] text`, only if beginner mode is on |
| `wall: text` | prints a broadcast message from glados. `wall: [name, text]` for another sender (`name@central`), or write the whole address yourself: `wall: [facility-monitor@annex-03, text]` |
| `log: [file, text]` | adds a timestamped line to `/var/log/file` |
| `mail: id` | delivers `story/mail/id.yml` and prints "You have new mail." Add `quiet` to skip the message: `mail: [id, quiet]` |
| `set: flag.name = true` | sets a flag |
| `set: headcount = 9` | changes the headcount (`/proc/aperture/headcount`) |
| `set: core = curiosity` | changes which core is in (`none` clears it) |
| `set: gone.twren = true` | removes that person from `who` |
| `write: [/path, text]` | creates or replaces a file |
| `append: [/path, text]` | adds to the end of a file |
| `unlock: /path` | opens a locked folder |
| `unlock_cmd: [corectl, report]` | makes locked commands available |
| `lock_cmd: name` | takes a command away again |
| `prompt: "{user}@{host}:{cwd}$ "` | changes the prompt. `prompt: default` restores it |
| `clock_to: "00:10"` | jumps the in-world clock forward to the next time it is 00:10. Use it between chapters so a shift can run from 22:41 to dawn. Mail, logs and `date` all follow it |
| `goto: chapter-id` | jumps to another chapter right now |
| `next` | ends this chapter right now |

## Mail

One file per message in `story/mail/`, named after its id.

```yaml
from: Imogen Farrow <ifarrow@facilities>
subject: the subject line
body: |
  The message,
  as many lines as you like.
```

## Characters

`story/characters.yml` lists everyone on shift. It feeds the `who` command. `set: gone.<login> = true` removes someone from it.

## Fake files

`content/filesystem.yml` says which files exist. Each is either `src:` (a text file under `content/fs/`) or `dynamic:` (a live value: `headcount`, `core`, `power`, `mailbox`). List folders that should start locked under `locked:`.

## New commands

A command is one object in `src/commands/`: a name, a one-line summary, usage, a plain-language description, examples, and a `run` function. Those fields are what `help` and `man` show, so write them for someone who has never used a terminal. Commands that appear later in the story are defined with `locked: true` and opened with `unlock_cmd`. A later entry in `src/commands/index.js` replaces an earlier one of the same name, so a chapter's real `systemctl` can replace the stub.
