# lore notes

What the story relies on from the Portal lore (Portal Wiki, Combine OverWiki, Half-Life wiki, the Lab Rat comic) and where I bent it. The sources disagree in places, so where they do I note which one I went with.

## things the story relies on

- **Morality core is the only one that stops the neurotoxin.** The others (curiosity, cake/knowledge, anger) just change her personality. The review panel thinks all five are the safety case. Radek and Brandt know it's only MC-01.
- **Morality was fitted after the flood.** In Portal 1 GLaDOS says "a morality core they installed after I flooded the enrichment center". In the game the cycle 6 flood (Aug 2010, L9, 11 seconds, nobody hurt by luck) comes first, Henry builds MC-01, and it goes in on 14 Nov 2010. Chapter 4 is a watch on MC-01 alone, nothing is inserted. The comic and some wiki pages show it the other way round, but I'm going with her line.
- **Cores 2 to 5** go in the annex cradle. Intelligence was fitted back in cycle 4, before the flood, which is why nobody thought she was dangerous yet. The disaster in chapter 9 isn't Morality being pulled out. Anger overloads the power bus it shares with the primary socket and MC-01 browns out.
- **Chell was number 1498 and Doug moved her to number 1** (Lab Rat, page 21). So the queue has to be longer than 1,498. Mine is 1,603. Her file says "tenacity abnormal, do not test, never gives up".
- **Staff get forced into testing after the flood** and Chell is the last one standing. So she tests staff first, then the queue, and Chell only moves up at the very end.
- **Doug is the only survivor of the flood** and hides in places she can't watch.

## things I'm not sure of

- **Date.** The wikis say the flood happened in May 200-, on the first Bring Your Daughter to Work Day. The year is hidden, so I picked 2011. The night is Wednesday 18 May 2011 and the daughters' day is Thursday 19 May at 9am (mentioned in Brandt's first mail and in `facility.log`). To change it: `BASE` in `src/state.js`, the year in `facility.log`, and the banner in `src/world.js`.
- **Cores.** MC-03 Intelligence is a smart core, fitted in cycle 4, and it makes her brilliant. The cake core is separate. The Intelligence *Dampening* core (the Wheatley stand-in, MC-06) is a prototype built this spring to make her slower. It isn't on the ticket and gets its own chapter (7). Nobody names it Wheatley in the story yet.
- **Doug himself.** In the comic he's a scientist/programmer who works on the portal gun, takes antipsychotics ("for the end times") and has a Companion Cube he talks to.
- **Henry.** A new character, Henry Voss. He works days, built MC-01 (so he's the one who shows Doug the Morality core in the comic), and is on call from home tonight. His notes are in `/home/hvoss` and say he's overtired and keeps saying "it's only a little". Brandt stays the nervous supervisor.
- **Version number.** The boot log says GLaDOS v1.07. The wikis say 1.07 was from an old ARG image and the official one is 3.11. Doesn't matter much.
- **Brenda.** One of the names on the dead-employee list in Lab Rat is Brenda Bogenschutz. The mop in the game is called Brenda. Works as a nod.
